#!/usr/bin/env node
// STORY-182 — the AOS facade WRITE service: the ceremony semantics, server-side.
//
//   (an HTTP service; started in-process by the test suite on this machine, or by a
//    runner the STORY-188 deployment window provides. It is not a standalone entry
//    point by itself.)
//
// WHAT IT IS. The write face that fronts the ENGINE CLI (file backend). The read
// face (facade-read-service.mjs, STORY-181) fronts the engine's read verbs; this
// service is the complementary surface: ONE ceremony endpoint over HTTP that
// performs a governed write batch — a payload of steps plus at least one read-back
// — by driving the engine CLI in-process. It is the server-side form of the recipe
// deploy/aos-local-client/ceremony.mjs, and it reuses that recipe's PLANNING half
// (ceremony-plan.mjs) unchanged: assertPayload, planStep, judgeReadback,
// resolveExpectations and the reserved-flag / one-shot-authority refusals are
// imported, not rewritten. Only the SENDING half differs — in-process engine
// execution instead of an SSH round trip — which is exactly the half ceremony-plan
// deliberately keeps separate ("the sending half needs SSH and a live chain and
// therefore only runs by hand").
//
// WHY THE WRITE SURFACE IS ONE CEREMONY, NOT PER-VERB. D5 (TCRN-CROSS-MIN-061):
// the write surface is one `ceremony` tool, not a per-verb forwarding of the
// mutating catalogue. Ceremony discipline — a payload of steps plus at least one
// read-back, reserved flags, expected-version from a live read, receipts — is ONE
// invariant, and per-verb forwarding would push that discipline onto the caller,
// reopening the door this platform closed.
//
// WHAT IT WILL NOT DO, structurally rather than by promise:
//
//   - IT PERFORMS NO CHAIN WRITE OF ITS OWN. Every step and every read-back is an
//     argv handed to the ENGINE CLI, which is the only writer. The set of verbs it
//     will drive in a step is derived from the engine's OWN `commands` catalogue —
//     mutates:true, not authorityBearing, not requiring a one-shot authority file —
//     so a hand-written allow-list cannot go stale in the permissive direction.
//
//   - IT REFUSES A PAYLOAD THAT NAMES --workspace / --attest-dir / --expected-version
//     (RESERVED_FLAG_IN_PAYLOAD), a payload with no read-back (PAYLOAD_INVALID), a
//     step verb absent from the engine's catalogue (VERB_NOT_IN_CATALOGUE), the
//     one-shot authority verb family (VERB_REQUIRES_OUT_OF_BAND_AUTHORITY, by
//     derivation from the -authority-digest flag shape), and a step verb the engine
//     does not mark mutates:true (FACADE_WRITE_VERB_NOT_MUTATING). All of these are
//     refused BEFORE any step is sent.
//
//   - IT SUPPLIES --expected-version ITSELF, from a live head read before every
//     mutating step — the chain head for chain verbs, the knowledge store MARKER
//     version for the knowledge-* family (STORY-160: the marker version and the
//     chain version are unrelated counters) — because a sentinel the payload chose
//     froze nothing. The payload may not name it.
//
//   - IT MATERIALISES A RECEIPT FOR EVERY CALL, SCRUBBED OF HOST PATHS, including a
//     call that throws (INC-047: a write nobody read back is not proven, and a write
//     that failed before a receipt must still say so). A full-value read-back is part
//     of the receipt; NOTHING_COMPARED is not a comparison and is a refusal.
//
// THE CATALOGUE IS TWO-SOURCED, the same discipline as the read face
// (判据两侧必须能够不同). Source A decides what this face may FORWARD: `commands`
// mutates:true. Source B is the engine's OWN `workflowMcpTools()` descriptors: a
// verb this face drives in a step must be one the engine itself publishes as NOT
// readOnlyHint:true. The two sources are complementary filters over the same
// catalogue, so they can only disagree when one of them is wrong — and that
// disagreement is the red. A verb either source withholds is refused with a reason
// code that names the ground.
//
// NO PINS, BY SHAPE. This service accepts no authority argument and holds no
// operator-authority pins; it drives the engine CLI, which needs none for the file
// backend (the same way the read facade's scratch test seeds a chain). A verb that
// requires a per-invocation authority file is refused here — a batch driver holding
// one would turn a per-invocation permit into a standing grant.

import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { runEngineCli, CATALOG_TTL_MS, RESPONSE_MAX_BYTES } from "./facade-read-service.mjs";
import {
  assertPayload, catalogueIndex, judgeReadback, planStep, resolveExpectations,
  KNOWLEDGE_STORE_CAS_VERBS, requiresOutOfBandAuthority
} from "../aos-local-client/ceremony-plan.mjs";
import { engineAnnotationIndex } from "../aos-local-client/remote-read-mcp.mjs";
import { scrubHostPaths, scrubHostPathsInText } from "../../scripts/lib/evidence-hygiene.mjs";

export const FACADE_WRITE_SERVER_NAME = "tcrn-aos-facade-write";
export const FACADE_WRITE_SERVER_VERSION = "0.1.0";
export const RECEIPT_SCHEMA = "aos.facade-write-receipt.v1";
export const CATALOG_SCHEMA = "aos.facade-write-catalog.v1";

const sha256Text = (text) => createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
const instant = () => new Date().toISOString().replace(/\.\d+Z$/u, "Z");
const execFileAsync = promisify(execFile);

function fail(reasonCode, message) {
  const error = new Error(message);
  error.reasonCode = reasonCode;
  throw error;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ── the write whitelist: derived from the engine's own catalogue ─────────────

export const WRITE_VERB_NOT_MUTATING = "FACADE_WRITE_VERB_NOT_MUTATING";
export const WRITE_AUTHORITY_OUTPUT = "FACADE_WRITE_AUTHORITY_OUTPUT";
export const WRITE_REQUIRES_OUT_OF_BAND = "FACADE_WRITE_VERB_REQUIRES_OUT_OF_BAND_AUTHORITY";
export const WRITE_FIXTURE_ONLY = "FACADE_WRITE_FIXTURE_ONLY";
export const EXPOSURE_UNPROVEN = "FACADE_WRITE_EXPOSURE_UNPROVEN";
export const EXPOSURE_INVARIANT = "FACADE_WRITE_EXPOSURE_INVARIANT";

/**
 * Why a verb is withheld from the facade write face's STEP surface — `null` when
 * this face will drive it as a governed write.
 *
 * The derivation is the catalogue's own shape, never a list of names: a verb a
 * later engine adds with mutates:true becomes forwardable on its own, and a verb
 * whose mutates flag flips stops being driven at the next catalogue refresh.
 * `requiresOutOfBandAuthority` is ceremony-plan.mjs's own derivation (a required
 * flag whose name ends in -authority-digest), imported rather than restated, so a
 * write face and the local ceremony refuse the SAME family the SAME way.
 */
export function writeWithheldGround(entry) {
  if (entry?.mutates !== true) {
    return Object.freeze({
      reasonCode: entry?.authorityBearing === true ? WRITE_AUTHORITY_OUTPUT : WRITE_VERB_NOT_MUTATING,
      ground: entry?.authorityBearing === true
        ? "the catalogue marks it authorityBearing:true — it produces an authority-bearing output, which is not a governed chain write"
        : "the catalogue does not mark it mutates:true — it is a read or projection verb, not a governed write",
      remedy: "reads go through the facade read service; this face drives governed writes"
    });
  }
  if (entry?.authorityBearing === true) {
    return Object.freeze({
      reasonCode: WRITE_AUTHORITY_OUTPUT,
      ground: "the catalogue marks it authorityBearing:true",
      remedy: "performed out of band as its own ceremony"
    });
  }
  if (requiresOutOfBandAuthority(entry)) {
    return Object.freeze({
      reasonCode: WRITE_REQUIRES_OUT_OF_BAND,
      ground: "it requires a per-invocation authority file, which is spent once and never held by a wrapper",
      remedy: "performed out of band as its own ceremony"
    });
  }
  if (entry?.availability === "fixture-only") {
    return Object.freeze({
      reasonCode: WRITE_FIXTURE_ONLY,
      ground: "the catalogue marks it availability:fixture-only",
      remedy: "run it against a fixture installation locally"
    });
  }
  return null;
}

export const isForwardableWrite = (entry) => writeWithheldGround(entry) === null;

/**
 * The second, independent source for the write whitelist — the engine's OWN
 * `workflowMcpTools()` descriptors.
 *
 * This is not a re-reading of `commands` through this file's predicate: the engine
 * decides what IT would publish and with which annotations, which is precisely why
 * it can disagree with `writeWithheldGround`. A verb this face drives in a step must
 * be one the engine's own surface does NOT publish as a read. A verb that is
 * missing, or that the engine withholds, or that the engine marks readOnlyHint:true,
 * is a red. A missing or empty annotation index is refused, not passed: an
 * unevaluated invariant is not a satisfied one.
 */
export function assertNoReadExposedOnWrite(entries, engineAnnotations) {
  if (!(engineAnnotations instanceof Map) || engineAnnotations.size === 0) {
    fail(EXPOSURE_UNPROVEN,
      "the facade write exposure invariant was handed no engine descriptors, so it could not be "
      + "evaluated. Refusing to drive any verb as a write: an unevaluated invariant is not a "
      + "satisfied one.");
  }
  const leaked = [];
  for (const entry of entries) {
    if (!engineAnnotations.has(entry.name)) {
      leaked.push(`${entry.name} (the engine's own catalogue does not define it)`);
      continue;
    }
    const annotations = engineAnnotations.get(entry.name);
    if (annotations === null) {
      leaked.push(`${entry.name} (the engine's own MCP surface withholds it)`);
      continue;
    }
    if (annotations.readOnlyHint === true) {
      leaked.push(`${entry.name} (the engine's own descriptor marks it readOnlyHint:true — a read, not a write)`);
    }
  }
  if (leaked.length > 0) {
    fail(EXPOSURE_INVARIANT,
      `refusing to drive ${leaked.length} verb(s) as writes that the engine itself does not treat as `
      + `writes: ` + leaked.join("; "));
  }
  return entries;
}

/**
 * The full facade write catalogue, derived from the engine's live `commands` output.
 *
 * EVERY entry is indexed (withheld ones included), so a step naming a read verb is
 * told it was refused with its ground, not "unknown verb". The `catalogue` is
 * ceremony-plan's index for planStep; `byName` keeps the raw entries for
 * writeWithheldGround, which reads the flags as a list.
 */
export async function deriveFacadeWriteCatalog({ engineRoot, engineCli }) {
  const commandsResult = await runEngineCli(engineRoot, ["commands"], { engineCli });
  const commands = commandsResult.json?.commands ?? commandsResult.json?.result?.commands ?? null;
  if (!commandsResult.ok || !Array.isArray(commands) || commands.length === 0) {
    fail("FACADE_WRITE_CATALOGUE_UNAVAILABLE",
      `the engine at ${engineRoot} did not report its command catalogue`
      + `${commandsResult.json?.reasonCode ? `: ${commandsResult.json.reasonCode}` : ""}`);
  }

  // Source B, independently: the engine's OWN MCP descriptors.
  let mcp = null;
  try {
    mcp = await import(pathToFileURL(
      resolve(engineRoot, "dist/build/packages/cli/src/mcp.js")).href);
  } catch {
    // fall through; assertNoReadExposedOnWrite refuses the publication as unevaluated
  }
  const engineAnnotations = mcp && typeof mcp.workflowMcpTools === "function"
    ? engineAnnotationIndex(commands, mcp.workflowMcpTools(), mcp.WORKFLOW_MCP_TOOL_PREFIX)
    : null;

  const forwardable = commands.filter(isForwardableWrite);
  const withheld = commands.filter((entry) => !isForwardableWrite(entry));
  if (forwardable.length + withheld.length !== commands.length) {
    fail(EXPOSURE_INVARIANT,
      `the forwardable/withheld split does not account for the whole catalogue: `
      + `${forwardable.length} + ${withheld.length} !== ${commands.length}`);
  }
  assertNoReadExposedOnWrite(forwardable, engineAnnotations);

  return {
    catalogue: catalogueIndex(commands),
    byName: new Map(commands.map((entry) => [entry.name, entry])),
    forwardable,
    withheld
  };
}

// ── engine access: in-process, file backend ─────────────────────────────────

/**
 * The live chain head, read immediately before a step that CAS's on it.
 *
 * Same shape as ceremony.mjs's readChainHead, but through the in-process engine
 * executor rather than SSH — the facade runs on the file backend (the chains live
 * there until the STORY-188 window moves them).
 */
export async function readChainHead(workspace, engineRoot, { engineCli, pgSchema, pgConnection } = {}) {
  const result = await runEngineCli(engineRoot, ["status", "--workspace", workspace], { engineCli, pgSchema, pgConnection });
  if (!result.ok || result.json === null) {
    throw Object.assign(
      new Error(`the engine refused to report status for ${workspace}: `
        + `${result.json?.reasonCode ?? result.json?.error ?? result.code}`),
      { reasonCode: result.json?.reasonCode ?? "FACADE_WRITE_HEAD_UNREADABLE" });
  }
  return {
    workspaceId: result.json.workspaceId,
    version: result.json.version,
    headEventHash: result.json.headEventHash,
    work: result.json.work
  };
}

/**
 * The knowledge store marker.
 *
 * The knowledge-* mutating verbs CAS on the store's OWN `version`, which is unrelated
 * to the chain version (STORY-160). Since STORY-189 the marker lives in Postgres
 * (the `knowledge_marker` table of the chain schema), NOT in the file tree — the
 * file tree is a sealed archive. INC-085/INC-086: reading the file-tree marker
 * after migration returns a FROZEN version, which is why a knowledge-rebase that
 * read it reported KNOWLEDGE_CAS_MISMATCH (92:93). When a PG connection is in
 * hand, the marker is read from PG; the file tree is the pre-migration fallback.
 */
export async function readKnowledgeMarker(workspace, { pgSchema, pgConnection, engineRoot } = {}) {
  if (typeof pgSchema === "string" && pgSchema.length > 0
    && typeof pgConnection === "string" && pgConnection.length > 0) {
    try {
      // The deployed facade runtime is intentionally lean and does not carry a
      // second copy of the PG driver.  The governed engine owns the dependency;
      // resolve it from that installation when the service supplies engineRoot.
      const pgSpecifier = typeof engineRoot === "string" && engineRoot.length > 0
        ? pathToFileURL(resolve(engineRoot, "node_modules/pg/lib/index.js")).href
        : "pg";
      // The service runs as root for the sealed workspace paths, while the
      // governance database uses socket peer auth for the engine role.  The
      // same sudo boundary as runEngineCli is therefore required for this
      // read; passing `user` to pg does not change the OS peer identity.
      const markerReader = [
        "const pg = await import(process.argv[1]);",
        "const Client = pg.default?.Client ?? pg.Client;",
        "const schema = process.env.TCRN_PG_SCHEMA;",
        "if (!/^[a-z][a-z0-9_]*$/u.test(schema ?? \"\")) throw new Error(\"invalid PG schema\");",
        "const client = new Client({ connectionString: process.env.TCRN_PG_CONNECTION });",
        "await client.connect();",
        "try {",
        "  const { rows } = await client.query(`select bytes from ${schema}.knowledge_marker`);",
        "  if (!rows[0]?.bytes) throw new Error(\"knowledge marker row is empty\");",
        "  process.stdout.write(JSON.stringify({ bytes: Buffer.from(rows[0].bytes).toString(\"base64\") }));",
        "} finally { await client.end().catch(() => {}); }"
      ].join("\n");
      const { stdout } = await execFileAsync("sudo", [
        "-n", "-u", "tcrn_engine", "env",
        `TCRN_PG_CONNECTION=${pgConnection}`,
        `TCRN_PG_SCHEMA=${pgSchema}`,
        process.execPath, "--input-type=module", "-e", markerReader, pgSpecifier
      ], { timeout: 15000, maxBuffer: 1024 * 1024 });
      const markerResult = parseJson(stdout.trim());
      const json = markerResult?.bytes
        ? parseJson(Buffer.from(markerResult.bytes, "base64").toString("utf8"))
        : null;
      if (json !== null && Number.isSafeInteger(json.version)) {
        return {
          version: json.version,
          workspaceId: json.workspaceId ?? null,
          eventHighWaterDigest: json.eventHighWaterDigest ?? null
        };
      }
      throw new Error("knowledge marker is not a valid PG record");
    } catch (error) {
      throw Object.assign(
        new Error(`the PG knowledge store marker could not be read: ${String(error?.message ?? error)}`),
        { reasonCode: "FACADE_WRITE_KNOWLEDGE_MARKER_UNREADABLE" });
    }
  }
  let raw;
  try {
    raw = readFileSync(resolve(workspace, ".tcrn-workflow/knowledge/store.json"), "utf8");
  } catch (error) {
    throw Object.assign(
      new Error(`the knowledge store marker could not be read: ${String(error?.message ?? error)}`),
      { reasonCode: "FACADE_WRITE_KNOWLEDGE_MARKER_UNREADABLE" });
  }
  const json = parseJson(raw);
  if (json === null || !Number.isSafeInteger(json.version)) {
    throw Object.assign(
      new Error("the knowledge store marker is not a valid store.json (no integer version)"),
      { reasonCode: "FACADE_WRITE_KNOWLEDGE_MARKER_INVALID" });
  }
  return {
    version: json.version,
    workspaceId: json.workspaceId ?? null,
    eventHighWaterDigest: json.eventHighWaterDigest ?? null
  };
}

/**
 * Which sentinel a step CAS's on: the knowledge store marker, or the chain head.
 *
 * The declared list (KNOWLEDGE_STORE_CAS_VERBS, imported from ceremony-plan.mjs) has
 * a loud failure mode: a knowledge verb added later that is absent here would be
 * planned with the chain version and the engine would answer KNOWLEDGE_CAS_MISMATCH —
 * a visible red, not a silent wrong write.
 */
export const casSource = (verb) => (KNOWLEDGE_STORE_CAS_VERBS.includes(verb) ? "marker" : "chain");

function engineResult(result) {
  return {
    accepted: result.ok === true && result.json !== null,
    exitCode: result.code,
    reasonCode: result.json?.reasonCode ?? result.json?.error
      ?? (result.json === null ? "FACADE_WRITE_NON_JSON_OUTPUT" : null),
    json: result.json,
    raw: result.json === null ? String(result.text ?? "").slice(0, 400) : undefined
  };
}

/** EPIC-041: the ceremony actor must be a legal attributed actor. Refused before the network. */
function assertAttributedActor(actor) {
  const ok = typeof actor === "string"
    && (/^agent:[A-Za-z0-9._:-]+$/u.test(actor) || /^person:[A-Za-z0-9._:-]+$/u.test(actor));
  if (!ok) {
    throw new Error(
      `actor must be an attributed actor (agent:<model> or person:<id>); got ${JSON.stringify(actor)}. `
      + "The Owner writing over SSH is person:owner:governance; an AI is agent:fable."
    );
  }
  return actor;
}

// ── the ceremony itself: ceremony-plan's planning half + this face's sending half ──

/**
 * Perform one facade write ceremony. The planning and refusal logic is ceremony-plan
 * mjs's own (assertPayload / planStep / judgeReadback / resolveExpectations); the
 * sending half runs the engine CLI in-process, and the write whitelist gate adds the
 * one refusal the local ceremony does not need: a step whose verb is not a governed
 * write is refused here before it is planned.
 *
 * A refusal is a RECEIPT, not a throw — except where reading the live head or the
 * marker fails, which throws so the caller's INC-047 receipt path catches it and
 * records that the chain position is unknown.
 *
 * @param {object} opts
 * @param {object} opts.payload The ceremony payload ({schemaVersion, story, intent, steps[], readback[]}).
 * @param {boolean} opts.dryRun Plan and read only; send nothing.
 * @param {string} opts.partition Which partition this write targets.
 * @param {{workspace: string, attestDir: string|null}} opts.target Resolved from THIS face's records, never the payload.
 * @param {string} opts.actor The attributed ceremony actor.
 * @param {() => Promise<{catalogue: Map, byName: Map}>} opts.currentCatalog Live (TTL-bounded) write catalogue.
 * @param {string} opts.engineRoot The installed engine copy whose CLI answers every call.
 * @param {string} [opts.engineCli] Override for the engine CLI entry (tests).
 * @param {string} opts.host Label carried in the receipt.
 */
export async function performFacadeWrite({
  payload, dryRun, partition, target, actor, channelHost, currentCatalog, engineRoot, engineCli, host, pgSchemas, pgConnection
}) {
  // STORY-189 switch window: after migration, the engine CLI reads/writes a
  // PG-backed chain when TCRN_PG_SCHEMA is set alongside TCRN_PG_CONNECTION, run
  // as the PG peer-auth role. Threaded into every engine call below, resolved per
  // partition from this face's records (never the payload).
  const pgSchema = pgSchemas?.[partition] ?? undefined;
  const engineCall = { engineCli, pgSchema, pgConnection };
  const admission = assertPayload(payload);
  if (!admission.ok) {
    return {
      schemaVersion: RECEIPT_SCHEMA,
      story: typeof payload?.story === "string" ? payload.story : null,
      intent: typeof payload?.intent === "string" ? payload.intent : null,
      startedAt: instant(),
      dryRun,
      host,
      partition,
      channelHost: channelHost ?? "unknown",
      payloadActor: typeof payload?.actor === "string" ? payload.actor : actor ?? null,
      executionForm: typeof payload?.executionForm === "string" ? payload.executionForm : null,
      ok: false,
      reasonCode: admission.reasonCode,
      problems: admission.problems,
      steps: [],
      readback: [],
      chainBefore: null,
      chainAfter: null
    };
  }

  const attributedActor = assertAttributedActor(actor);
  const catalogEntry = await currentCatalog();
  const catalogue = catalogEntry.catalogue;
  const byName = catalogEntry.byName;
  const supply = { workspace: target.workspace, attestDir: target.attestDir, actor: attributedActor };
  const payloadText = JSON.stringify(payload);

  const receipt = {
    schemaVersion: RECEIPT_SCHEMA,
    story: payload.story,
    intent: payload.intent,
    startedAt: instant(),
    dryRun,
    host,
    partition,
    // INC-092: the transport channel and the attributed payload actor are
    // parallel receipt fields. The channel is supplied by the local MCP face;
    // the actor is the server-side-whitelisted identity actually handed to the
    // engine, never an inferred name in a report.
    channelHost: channelHost ?? "unknown",
    payloadActor: typeof payload.actor === "string" ? payload.actor : attributedActor,
    executionForm: typeof payload.executionForm === "string" ? payload.executionForm : null,
    topology: {
      workspace: target.workspace,
      attestDir: target.attestDir,
      actor: attributedActor,
      seam: "workspaces / attestDirs records stated by the deployment, never by the payload"
    },
    payload: {
      sha256: sha256Text(payloadText),
      bytes: Buffer.byteLength(payloadText, "utf8")
    },
    hostEngineCatalogue: { verbs: catalogue.size },
    chainBefore: null,
    steps: [],
    readback: [],
    chainAfter: null
  };

  const chainHead = () => readChainHead(target.workspace, engineRoot, engineCall);
  const headFor = async (verb, preferFresh) => {
    if (preferFresh === false) return receipt.chainBefore;
    return casSource(verb) === "marker"
      ? readKnowledgeMarker(target.workspace, { pgSchema, pgConnection, engineRoot })
      : chainHead();
  };

  receipt.chainBefore = await chainHead();

  for (const step of payload.steps) {
    const raw = byName.get(step.verb);
    // The write whitelist gate: a step verb must be a governed WRITE. planStep would
    // happily plan a read verb (it is in the catalogue and takes no reserved flags);
    // only this face refuses it, because a write ceremony does not step reads.
    // The one-shot authority family is left to planStep so the established reason code
    // VERB_REQUIRES_OUT_OF_BAND_AUTHORITY travels unaltered.
    if (raw !== undefined && !requiresOutOfBandAuthority(raw)) {
      const ground = writeWithheldGround(raw);
      if (ground !== null) {
        const plan = { ok: false, verb: step.verb, reasonCode: ground.reasonCode, detail: ground.ground };
        receipt.steps.push({ ...plan, headAtPlanning: null });
        receipt.ok = false;
        receipt.reasonCode = plan.reasonCode;
        return receipt;
      }
    }

    const head = await headFor(step.verb, step.readHeadFirst);
    const plan = planStep({ step, catalogue, supply, chainVersion: head.version, at: instant() });
    if (!plan.ok) {
      receipt.steps.push({ ...plan, headAtPlanning: head.version });
      receipt.ok = false;
      receipt.reasonCode = plan.reasonCode;
      return receipt;
    }
    if (dryRun) {
      receipt.steps.push({
        ...plan,
        headAtPlanning: head.version,
        executed: false,
        wouldSend: `node ${resolve(engineRoot, "scripts/tcrn-workflow.mjs")} ${plan.argv.map((value) => String(value)).join(" ")}`
      });
      continue;
    }
    const result = engineResult(await runEngineCli(engineRoot, plan.argv, engineCall));
    const engineErrorText = typeof result.json?.error === "string" ? result.json.error : null;
    const engineError = engineErrorText === null
      ? null
      : result.accepted
        ? scrubHostPathsInText(engineErrorText).slice(0, 200)
        : scrubHostPathsInText(engineErrorText);
    receipt.steps.push({
      ...plan,
      headAtPlanning: head.version,
      executed: true,
      accepted: result.accepted,
      reasonCode: result.reasonCode,
      error: engineError,
      recordId: result.json?.record?.id ?? result.json?.id ?? null,
      version: result.json?.version ?? null,
      raw: result.raw
    });
    if (!result.accepted) {
      receipt.ok = false;
      receipt.reasonCode = "STEP_REFUSED_BY_HOST_ENGINE";
      receipt.chainAfter = await chainHead();
      return receipt;
    }
  }

  for (const step of payload.readback) {
    const plan = planStep({ step, catalogue, supply, chainVersion: null, at: instant() });
    if (!plan.ok) {
      receipt.readback.push(plan);
      receipt.ok = false;
      receipt.reasonCode = plan.reasonCode;
      return receipt;
    }
    if (dryRun) {
      receipt.readback.push({ ...plan, executed: false });
      continue;
    }
    const result = await runEngineCli(engineRoot, plan.argv, engineCall);
    // work-show answers with immutable `record` and mutable `advisory` as SIBLINGS, so
    // a comparison written against `record` alone can never see the fields an annotate
    // sets. Flatten both, `record` last so an immutable field can never be shadowed.
    const hasRecordShape = result.json !== null
      && (Object.hasOwn(result.json, "record") || Object.hasOwn(result.json, "advisory"));
    const record = result.json === null ? null
      : hasRecordShape
        ? { ...result.json.advisory, ...result.json.record }
        : result.json;
    const { expected, problems } = resolveExpectations({ step, steps: payload.steps });
    if (problems.length > 0) {
      receipt.readback.push({ ...plan, executed: true, reasonCode: "EXPECTATION_UNRESOLVABLE", problems });
      receipt.ok = false;
      receipt.reasonCode = "EXPECTATION_UNRESOLVABLE";
      return receipt;
    }
    const verdict = judgeReadback({ expected, observed: record });
    receipt.readback.push({
      ...plan,
      executed: true,
      accepted: result.ok === true,
      reasonCode: result.json?.reasonCode ?? null,
      verdict,
      record: step.recordFields
        ? Object.fromEntries(step.recordFields.map((field) => [field, record?.[field] ?? null]))
        : undefined
    });
    if (result.ok !== true || verdict.ok === false) {
      // NOTHING_COMPARED is not a comparison: a read-back that compared no field is a
      // write nobody read back, and it must be a named refusal, not a silent pass.
      receipt.ok = false;
      receipt.reasonCode = result.ok !== true ? "READBACK_REFUSED"
        : verdict.reasonCode === "NOTHING_COMPARED" ? "READBACK_NOTHING_COMPARED" : "READBACK_DIVERGENT";
      receipt.chainAfter = await chainHead();
      return receipt;
    }
  }

  // STORY-160: every real ceremony rebases the knowledge store on the write path, so
  // the knowledge face does not go stale on the next read. Best-effort but RECORDED:
  // a failed rebase leaves the store stale, and the marker-freshness gate
  // independently reds on that residue. Not run for a dry run, and not run twice.
  const batchAlreadyRebased = (payload.steps ?? []).some((step) => step.verb === "knowledge-rebase");
  if (!dryRun && !batchAlreadyRebased) {
    try {
      const marker = await readKnowledgeMarker(target.workspace, { pgSchema, pgConnection, engineRoot });
      const rebasePlan = planStep({
        step: { verb: "knowledge-rebase", flags: {} }, catalogue, supply,
        chainVersion: marker.version, at: instant()
      });
      if (rebasePlan.ok) {
        const result = await runEngineCli(engineRoot, rebasePlan.argv, engineCall);
        receipt.knowledgeRebase = {
          verb: "knowledge-rebase",
          markerVersionBefore: marker.version,
          accepted: result.ok === true,
          reasonCode: result.json?.reasonCode ?? null,
          version: result.json?.version ?? null,
          error: result.ok === true ? undefined
            : scrubHostPathsInText(String(result.text ?? "")).slice(0, 200)
        };
      } else {
        receipt.knowledgeRebase = { verb: "knowledge-rebase", accepted: false, reasonCode: rebasePlan.reasonCode };
      }
    } catch (error) {
      receipt.knowledgeRebase = {
        verb: "knowledge-rebase", accepted: false, reasonCode: "MARKER_UNREADABLE",
        error: scrubHostPathsInText(String(error?.message ?? error)).slice(0, 200)
      };
    }
  }

  receipt.chainAfter = await chainHead();
  receipt.eventsAppended = receipt.chainAfter.version - receipt.chainBefore.version;
  receipt.ok = true;
  receipt.reasonCode = dryRun ? "CEREMONY_PLANNED_ONLY" : "CEREMONY_COMPLETED_AND_READ_BACK";
  receipt.finishedAt = instant();
  return receipt;
}

// ── the HTTP service ─────────────────────────────────────────────────────────

function securityHeaders() {
  return {
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  };
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...securityHeaders()
  });
  response.end(payload);
}

function asRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    fail("MCP_INVALID_REQUEST", label);
  }
  return value;
}

async function readBody(request) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > RESPONSE_MAX_BYTES) fail("MCP_INPUT_OVERSIZED", "request body exceeds the size ceiling");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim() === "") return {};
  try {
    const parsed = JSON.parse(text);
    return asRecord(parsed, "request body");
  } catch {
    fail("MCP_INVALID_REQUEST", "request body is not a JSON object");
  }
}

/** A filename-friendly timestamp plus a nonce, so two calls in one millisecond cannot collide. */
function stamp() {
  return `${new Date().toISOString().replace(/[.:]/g, "-")}-${randomBytes(3).toString("hex")}`;
}

/** The INC-047 failure receipt: a ceremony that THREW must still leave a receipt. */
function thrownReceipt({ payload, dryRun, partition, host, channelHost, error, startedAt }) {
  return {
    schemaVersion: RECEIPT_SCHEMA,
    story: typeof payload?.story === "string" ? payload.story : "<unknown>",
    intent: typeof payload?.intent === "string" ? payload.intent : "<unknown>",
    startedAt,
    finishedAt: instant(),
    dryRun,
    host,
    partition,
    channelHost: channelHost ?? "unknown",
    payloadActor: typeof payload?.actor === "string" ? payload.actor : null,
    executionForm: typeof payload?.executionForm === "string" ? payload.executionForm : null,
    ok: false,
    reasonCode: "CEREMONY_THREW_BEFORE_RECEIPT",
    error: scrubHostPathsInText(String(error?.message ?? error)).slice(0, 500),
    thrownBeforeReceipt: true,
    chainBefore: null,
    chainAfter: null,
    steps: [],
    readback: []
  };
}

/**
 * Start the facade write service.
 *
 * Binds the stated concrete address (never a wildcard), validates the Host header
 * when an allow-list is stated, and serves exactly three surfaces: /api/health,
 * /api/engine/catalog, and POST /api/ceremony. There is no per-verb route to a
 * write — the ceremony is the one write surface.
 *
 * @param {object} options
 * @param {string} options.engineRoot The installed engine copy whose CLI answers every call.
 * @param {Readonly<Record<string, string>>} options.workspaces Partition id → workspace path.
 * @param {Readonly<Record<string, string>>} options.attestDirs Partition id → attestation dir (sibling of the workspace, never inside it).
 * @param {string} options.host Concrete bind address. The deployment states it; nothing here defaults a network address.
 * @param {number} options.port Port to answer on.
 * @param {string} options.writeRoot Where payloads and receipts are materialised. Tool-owned; a caller cannot name a path.
 * @param {string} options.actor Default attributed ceremony actor (a payload may override it).
 * @param {readonly string[]} [options.allowedHosts] Allowed Host header values for DNS-rebinding protection.
 * @param {string} [options.hostLabel] Label carried in receipts; defaults to options.host.
 * @param {number} [options.catalogTtlMs] Override for the freshness bound, so a test can prove drift without waiting it out.
 * @param {string} [options.engineCli] Override for the engine CLI entry; tests point it at the local engine copy.
 */
export async function startFacadeWriteService(options) {
  if (typeof options.host !== "string" || options.host.trim().length === 0) {
    throw new Error("facade write refused to start: no bind host stated");
  }
  // INC-084: the bind is hardcoded loopback per CONF-007. A deny-list misses
  // alternate spellings (::0, the all-zero IPv6 long form) and routable
  // addresses; the positive rule "must be loopback" has no holes.
  if (options.host !== "127.0.0.1" && options.host !== "::1") {
    throw new Error(`facade write refused to bind ${options.host}: CONF-007 requires a loopback bind; `
      + "the service is reachable only through an SSH tunnel");
  }
  if (!options.workspaces || Object.keys(options.workspaces).length === 0) {
    throw new Error("facade write refused to start: no workspaces stated. The service must know each "
      + "partition's workspace path (CockpitServiceOptions.workspaces seam).");
  }
  for (const id of Object.keys(options.workspaces)) {
    if (!options.attestDirs || typeof options.attestDirs[id] !== "string"
      || options.attestDirs[id].length === 0) {
      throw new Error(`facade write refused to start: partition ${id} has no attestation dir. A write `
        + "ceremony attests into a sidecar beside the chain, and a deployment that cannot state one "
        + "must not silently skip it.");
    }
  }
  // INC-084: pgSchemas must cover EVERY workspace, else refuse to start. The
  // INIT-020 fork's silent mechanism was `pgSchemas?.[partition] ?? undefined`
  // falling back to the file track; a service that cannot state a PG schema for
  // a partition must not start serving it from the file tree by accident.
  if (!options.pgSchemas || Object.keys(options.pgSchemas).length === 0) {
    throw new Error("facade write refused to start: no pgSchemas stated. After the file→pg migration "
      + "every partition's chain lives in Postgres, and a service that cannot name each schema must "
      + "not silently serve the stale file track.");
  }
  for (const id of Object.keys(options.workspaces)) {
    if (typeof options.pgSchemas[id] !== "string" || options.pgSchemas[id].length === 0) {
      throw new Error(`facade write refused to start: partition ${id} has no PG schema. A write ceremony `
        + "must name the schema the chain migrated to (INC-074 storage-home); a missing schema means the "
        + "caller would be writing the stale file track.");
    }
  }
  // INC-084: actor whitelist. When stated, the attributed actor (payload override
  // or default) must be on it; an unlisted actor is refused server-side instead of
  // a self-reported payload actor being trusted.
  if (typeof options.writeRoot !== "string" || options.writeRoot.trim().length === 0) {
    throw new Error("facade write refused to start: no writeRoot stated. Receipts are materialised there.");
  }
  if (typeof options.actor !== "string" || options.actor.length === 0) {
    throw new Error("facade write refused to start: no default actor stated (EPIC-041 requires an "
      + "attributed actor: agent:<model> or person:<id>).");
  }
  const allowedActors = options.allowedActors ?? [options.actor];
  if (!Array.isArray(allowedActors) || allowedActors.length === 0
    || allowedActors.some((candidate) => typeof candidate !== "string" || !/^agent:[A-Za-z0-9._:-]+$/u.test(candidate) && !/^person:[A-Za-z0-9._:-]+$/u.test(candidate))) {
    throw new Error("facade write refused to start: allowedActors must be a non-empty attributed-actor allow-list");
  }

  const workspaces = { ...options.workspaces };
  const attestDirs = { ...options.attestDirs };
  const partitionIds = Object.keys(workspaces);
  const ttlMs = options.catalogTtlMs ?? CATALOG_TTL_MS;
  const writeRoot = resolve(options.writeRoot);
  const host = options.host;
  const hostLabel = options.hostLabel ?? host;

  let catalog = await deriveFacadeWriteCatalog({
    engineRoot: options.engineRoot,
    engineCli: options.engineCli
  });
  let derivedAt = Date.now();

  async function refreshCatalog() {
    const next = await deriveFacadeWriteCatalog({
      engineRoot: options.engineRoot,
      engineCli: options.engineCli
    });
    catalog = next;
    derivedAt = Date.now();
    return catalog;
  }

  async function currentCatalog() {
    if (Date.now() - derivedAt >= ttlMs) return refreshCatalog();
    return catalog;
  }

  const allowedHosts = options.allowedHosts ?? [];
  const engineRoot = options.engineRoot;
  const idempotency = new Map();

  const server = createServer((request, response) => {
    void handle(request, response, {
      workspaces,
      attestDirs,
      partitionIds,
      currentCatalog,
      allowedHosts,
      engineRoot,
      engineCli: options.engineCli,
      pgSchemas: options.pgSchemas,
      pgConnection: options.pgConnection,
      allowedActors,
      idempotency,
      ttlMs,
      writeRoot,
      hostLabel,
      defaultChannelHost: options.channelHost ?? "unknown",
      defaultActor: options.actor
    }).catch((error) => {
      sendJson(response, 500, {
        ok: false,
        reasonCode: typeof error?.reasonCode === "string" ? error.reasonCode : "SERVICE_ERROR",
        error: scrubHostPathsInText(String(error?.message ?? error))
      });
    });
  });

  server.listen(options.port, options.host);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("service address unreadable");

  return {
    server,
    url: `http://${options.host}:${address.port}`,
    close: async () => {
      await new Promise((done, refused) => server.close((error) => error ? refused(error) : done()));
    }
  };
}

async function handle(request, response, context) {
  const hostHeader = request.headers.host;
  if (context.allowedHosts.length > 0) {
    const host = typeof hostHeader === "string" ? (hostHeader.split(":")[0] ?? "") : "";
    if (!context.allowedHosts.includes(host)) {
      sendJson(response, 403, { ok: false, reasonCode: "HOST_NOT_ALLOWED", error: "Host is not on the facade allow-list" });
      return;
    }
  }

  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const path = url.pathname;

  if (request.method === "GET" && path === "/api/health") {
    const catalog = await context.currentCatalog();
    // INC-084: report the per-partition backend, so a deployment that silently
    // fell back to the file track (the INIT-020 fork mechanism) is visible in
    // health instead of only at write time.
    const pgServing = typeof context.pgConnection === "string" && context.pgConnection.length > 0;
    const backends = Object.fromEntries(context.partitionIds.map((id) => [id, pgServing && context.pgSchemas?.[id] ? "pg" : "file"]));
    sendJson(response, 200, {
      ok: true,
      service: FACADE_WRITE_SERVER_NAME,
      readonly: false,
      chainWriteAvailable: true,
      partitions: context.partitionIds,
      backends,
      engineVerbs: { forwardable: catalog.forwardable.length, withheld: catalog.withheld.length },
      noPins: true,
      freshWithinMs: context.ttlMs ?? CATALOG_TTL_MS
    });
    return;
  }

  if (request.method === "GET" && path === "/api/engine/catalog") {
    const catalog = await context.currentCatalog();
    sendJson(response, 200, {
      ok: true,
      schemaVersion: CATALOG_SCHEMA,
      forwardable: catalog.forwardable.map((entry) => entry.name),
      withheld: catalog.withheld.map((entry) => ({
        name: entry.name,
        reasonCode: writeWithheldGround(entry).reasonCode,
        ground: writeWithheldGround(entry).ground
      })),
      partitionIds: context.partitionIds
    });
    return;
  }

  if (request.method === "POST" && path === "/api/ceremony") {
    await handleCeremony(request, response, context);
    return;
  }

  if (request.method !== "GET" && request.method !== "POST") {
    sendJson(response, 405, { ok: false, reasonCode: "METHOD_NOT_ALLOWED", error: "this face accepts GET (health/catalog) and POST (ceremony) only" });
    return;
  }

  sendJson(response, 404, { ok: false, reasonCode: "NOT_FOUND", error: "no such surface" });
}

async function handleCeremony(request, response, context) {
  let body;
  try {
    body = await readBody(request);
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      reasonCode: typeof error?.reasonCode === "string" ? error.reasonCode : "MCP_INVALID_REQUEST",
      error: scrubHostPathsInText(String(error?.message ?? error))
    });
    return;
  }

  let partition;
  let dryRun;
  let payload;
  let idempotencyKey;
  let channelHost;
  try {
    const allowed = ["payload", "dryRun", "partition", "idempotencyKey", "channelHost"];
    const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
    if (unknown.length > 0) fail("MCP_ARGUMENT_UNKNOWN", unknown.sort().join(","));

    partition = body.partition ?? "TCRN-AOS";
    if (typeof partition !== "string" || !Object.hasOwn(context.workspaces, partition)) {
      fail("MCP_PARTITION_UNKNOWN", `partition must be one of ${context.partitionIds.sort().join(", ")}`);
    }
    dryRun = body.dryRun ?? false;
    if (typeof dryRun !== "boolean") fail("MCP_ARGUMENT_INVALID", "dryRun");

    // INC-092: the channel is a declared transport fact, not a prose hint in
    // the intent. Keep it small and structured so the receipt can say which
    // client face carried the payload without accepting a path or credential.
    channelHost = body.channelHost ?? context.defaultChannelHost ?? "unknown";
    if (typeof channelHost !== "string" || !/^[A-Za-z][A-Za-z0-9._:-]{0,63}$/u.test(channelHost)) {
      fail("MCP_ARGUMENT_INVALID", "channelHost must be a short declared channel identifier");
    }

    // INC-084: idempotency key. A ceremony that times out after a successful write
    // must not be re-run into a double write; a replayed key is refused.
    idempotencyKey = body.idempotencyKey;
    if (idempotencyKey !== undefined && typeof idempotencyKey !== "string") {
      fail("MCP_ARGUMENT_INVALID", "idempotencyKey");
    }

    payload = body.payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        fail("MCP_ARGUMENT_INVALID", "payload is not valid JSON");
      }
    }
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      fail("MCP_ARGUMENT_INVALID", "payload must be a ceremony payload object");
    }
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      reasonCode: typeof error?.reasonCode === "string" ? error.reasonCode : "MCP_ARGUMENT_INVALID",
      error: scrubHostPathsInText(String(error?.message ?? error))
    });
    return;
  }

  const target = {
    workspace: context.workspaces[partition],
    attestDir: context.attestDirs[partition]
  };

  // INC-084: a stated actor must be on the server-side whitelist. A self-reported
  // payload actor is no longer trusted on its own.
  const actor = typeof payload.actor === "string" ? payload.actor : context.defaultActor;
  const attributed = typeof actor === "string"
    && (/^agent:[A-Za-z0-9._:-]+$/u.test(actor) || /^person:[A-Za-z0-9._:-]+$/u.test(actor));
  if (attributed && context.allowedActors !== null && context.allowedActors !== undefined && !context.allowedActors.includes(actor)) {
    sendJson(response, 403, {
      ok: false,
      reasonCode: "ACTOR_NOT_ALLOWED",
      error: `actor ${actor} is not on this facade's whitelist`
    });
    return;
  }

  // INC-084: every real ceremony has a stable key. Clients may state one, but
  // the payload digest is the fail-safe default for older callers; a retry after
  // a timeout therefore cannot silently append the same batch twice.
  const requestDigest = sha256Text(JSON.stringify({ partition, payload }));
  const effectiveIdempotencyKey = dryRun ? null : idempotencyKey ?? requestDigest;
  if (effectiveIdempotencyKey !== null) {
    const previousDigest = context.idempotency.get(effectiveIdempotencyKey);
    if (previousDigest !== undefined) {
      if (previousDigest !== requestDigest) {
        sendJson(response, 409, {
          ok: false,
          reasonCode: "IDEMPOTENCY_KEY_REUSED",
          error: `idempotencyKey ${effectiveIdempotencyKey} was already bound to another payload`
        });
        return;
      }
      sendJson(response, 409, {
        ok: false,
        reasonCode: "IDEMPOTENCY_REPLAY",
        error: `idempotencyKey ${effectiveIdempotencyKey} was already applied`
      });
      return;
    }
  }

  // Materialisation paths are THIS service's decision: the caller names neither the
  // payload nor the receipt path. Both land under the tool-owned root, scrubbed, so
  // they are committable evidence that does not leak the host's directory structure.
  const nonce = stamp();
  const payloadPath = resolve(context.writeRoot, "payloads", `${nonce}-${partition}.json`);
  mkdirSync(dirname(payloadPath), { recursive: true });
  const materializedPayloadText = `${JSON.stringify(scrubHostPaths(payload), null, 2)}\n`;
  writeFileSync(payloadPath, materializedPayloadText);
  const materializedPayload = {
    path: relative(context.writeRoot, payloadPath),
    sha256: sha256Text(materializedPayloadText),
    bytes: Buffer.byteLength(materializedPayloadText, "utf8"),
    materialization: {
      schemaVersion: "aos.receipt-materialization.v1",
      mode: "full",
      cropped: false,
      cropFingerprint: null
    }
  };

  let receipt;
  try {
    receipt = await performFacadeWrite({
      payload,
      dryRun,
      partition,
      target,
      actor,
      channelHost,
      currentCatalog: context.currentCatalog,
      engineRoot: context.engineRoot,
      engineCli: context.engineCli,
      pgSchemas: context.pgSchemas,
      pgConnection: context.pgConnection,
      host: context.hostLabel
    });
  } catch (error) {
    // INC-047: a ceremony that THROWS must still leave a receipt — otherwise an orphan
    // payload sits in evidence/ and the caller cannot tell how many steps of a batch
    // landed, or whether any did.
    receipt = thrownReceipt({ payload, dryRun, partition, host: context.hostLabel, channelHost, error, startedAt: instant() });
  }
  // Hash the bytes this service actually materialised, not a second
  // re-serialization of the request. A full-byte declaration makes a cropped or
  // hand-rebuilt receipt fail closed at the evidence gate.
  receipt.payload = materializedPayload;
  // Reserve only after the engine reports a completed, read-back-verified
  // ceremony. A refusal must remain retryable; reserving before execution made
  // a failed first attempt look like a successful replay.
  if (receipt.ok === true && effectiveIdempotencyKey !== null) {
    context.idempotency.set(effectiveIdempotencyKey, requestDigest);
  }

  // INC-084: receipt materialisation is inside the ceremony's error surface. A
  // receipt that cannot be written must produce a named error receipt (409), not
  // a bare 500 with no evidence — the INC-047 shape, applied to the receipt itself.
  let receiptPath;
  try {
    receiptPath = resolve(context.writeRoot, "receipts", `${nonce}-${partition}.json`);
    mkdirSync(dirname(receiptPath), { recursive: true });
    writeFileSync(receiptPath, `${JSON.stringify(scrubHostPaths(receipt), null, 2)}\n`);
  } catch (error) {
    sendJson(response, 409, {
      ok: false,
      reasonCode: "RECEIPT_MATERIALISATION_FAILED",
      error: scrubHostPathsInText(String(error?.message ?? error)),
      receipt: scrubHostPaths(receipt)
    });
    return;
  }

  const result = {
    ok: receipt.ok === true,
    reasonCode: receipt.reasonCode ?? (receipt.ok === true ? "CEREMONY_OK" : "CEREMONY_REFUSED"),
    host: context.hostLabel,
    partition,
    dryRun,
    channelHost,
    payloadActor: receipt.payloadActor ?? (typeof payload.actor === "string" ? payload.actor : null),
    receipt: scrubHostPaths(receipt),
    receiptPath: relative(context.writeRoot, receiptPath),
    payloadPath: relative(context.writeRoot, payloadPath)
  };
  sendJson(response, receipt.ok === true ? 200 : 409, result);
}
