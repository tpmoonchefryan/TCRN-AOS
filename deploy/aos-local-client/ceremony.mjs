#!/usr/bin/env node
// The local-side remote governance ceremony, as a recipe (TCRN-AOS-STORY-133).
//
//   node deploy/aos-local-client/ceremony.mjs --payload <file.json> [--receipt <file.json>] [--dry-run]
//
// WHY THIS EXISTS. The AOS chain's truth is on tcrn-platform-dev. A governance write
// from this laptop is therefore five values (host, engine CLI, workspace root,
// attest-dir, actor), a head sentinel read moments before, an RFC3339 instant, and a
// remote shell that re-parses every argument. The first such write was performed by
// hand-assembling that ssh command line. It worked; it is also the shape where an
// operator attests into the wrong sidecar, drives the wrong chain, or sends a flag the
// verb does not define — and STORY-131 did send three such flags and had to re-run.
//
// So the write is now a RECIPE with a FILE PAYLOAD (CONF-007 ruling ①: 文件载荷批驱动
// 仪式). The operator writes what they want recorded; this reads where and how from
// one place (topology.mjs) and refuses anything the host engine's own catalogue does
// not define.
//
// WHAT IT WILL NOT DO, and both refusals are derived rather than remembered:
//   - it will not drive a verb that requires a per-invocation authority file. Those are
//     the relocation and gate-identity families; the test is the catalogue's own shape,
//     the same derivation ADR 0003 uses for the MCP facade;
//   - it will not accept a payload that names --workspace, --attest-dir or
//     --expected-version. The first two belong to the topology and the third must come
//     from a live read or it enforces nothing.
//
// The remote quoting is not this file's invention either: `shellQuote` comes from the
// switch rehearsal's library, where it was written because ssh re-joins the remote argv
// with spaces and hands the result to a login shell, so a `--scope` carrying
// parentheses became a remote syntax error. Imported, not copied.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { shellQuote, ssh } from "../aos-resident-cockpit/resident-lib.mjs";
import {
  ACTOR, REPO_ROOT, VM_ATTEST_DIR, VM_ENGINE_CLI, VM_HOST, VM_WORKSPACE
} from "./topology.mjs";
import { aosPartition } from "./aos-partitions.mjs";
import {
  assertPayload, catalogueIndex, judgeReadback, planStep, resolveExpectations
} from "./ceremony-plan.mjs";
import { scrubHostPathsInText } from "../../scripts/lib/evidence-hygiene.mjs";
import { emitCeremonySpan } from "./ceremony-spans.mjs";

const sha256Text = (text) => createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
const instant = () => new Date().toISOString().replace(/\.\d+Z$/u, "Z");

/**
 * EPIC-041: the ceremony actor must be a legal attributed actor. The chain
 * accepts any string, but an unattributed ceremony would record a write no one
 * can say who performed. `agent:<model>` for an AI, `person:<id>` for a human
 * (the Owner writing over SSH is `person:owner:governance`). Refused here,
 * before the network, so a typo'd actor is the operator's mistake named
 * locally rather than a remote refusal.
 */
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

/**
 * A payload path stated relative to this checkout when it is inside it.
 *
 * A payload from outside the repository is reported as `<outside-repository>` rather
 * than as a `../../..` walk back out: the relative form would leak the same host
 * structure the absolute form does, one segment at a time.
 */
function relativeToRepo(path) {
  const rel = relative(REPO_ROOT, resolve(path));
  return rel.startsWith("..") ? "<outside-repository>" : rel;
}

/** One engine verb on the host that owns the chain. A refusal is data, not a throw. */
export async function remoteEngine(argv) {
  const remote = ["node", VM_ENGINE_CLI, ...argv].map(shellQuote).join(" ");
  const result = await ssh([remote], { allowFailure: true });
  const emitted = result.code === 0 ? result.stdout : (result.stderr.trim() || result.stdout.trim());
  let json = null;
  try { json = JSON.parse(emitted); } catch { json = null; }
  return {
    accepted: result.code === 0 && json !== null,
    exitCode: result.code,
    reasonCode: json?.reasonCode ?? json?.error ?? (json === null ? "NON_JSON_OUTPUT" : null),
    json,
    raw: json === null ? emitted.slice(0, 400) : undefined
  };
}

/** The live head, read immediately before each mutating step. */
export async function readChainHead(workspace = VM_WORKSPACE) {
  const status = await remoteEngine(["status", "--workspace", workspace]);
  if (!status.accepted) {
    throw new Error(`the host engine refused to report status: ${status.reasonCode ?? status.exitCode}`);
  }
  return {
    workspaceId: status.json.workspaceId,
    version: status.json.version,
    headEventHash: status.json.headEventHash,
    work: status.json.work
  };
}

export async function runCeremony({ payloadPath, dryRun = false, partition = "TCRN-AOS" }) {
  const payloadText = readFileSync(payloadPath, "utf8");
  const payload = JSON.parse(payloadText);
  emitCeremonySpan({ span: "ceremony.start", partition, outcome: "started" });
  const admission = assertPayload(payload);
  if (!admission.ok) {
    emitCeremonySpan({ span: "ceremony.refused", partition, outcome: "refused", reasonCode: admission.reasonCode });
    return { ok: false, reasonCode: admission.reasonCode, problems: admission.problems };
  }

  // TCRN-CROSS-INIT-017: the ceremony can target any partition whose chain lives
  // on the AOS host. Default is the AOS partition itself; the fallback replay
  // drives other partitions by naming them.
  const target = partition === "TCRN-AOS"
    ? { workspace: VM_WORKSPACE, attestDir: VM_ATTEST_DIR }
    : aosPartition(partition);

  const catalogueResult = await remoteEngine(["commands"]);
  if (!catalogueResult.accepted) {
    emitCeremonySpan({ span: "ceremony.refused", partition, outcome: "refused", reasonCode: "HOST_CATALOGUE_UNAVAILABLE" });
    return { ok: false, reasonCode: "HOST_CATALOGUE_UNAVAILABLE", detail: catalogueResult.reasonCode };
  }
  const commands = catalogueResult.json.commands ?? catalogueResult.json.result?.commands ?? [];
  const catalogue = catalogueIndex(commands);

  const supply = { workspace: target.workspace, attestDir: target.attestDir, actor: assertAttributedActor(payload.actor ?? ACTOR) };
  const receipt = {
    schemaVersion: "aos.local-client-ceremony-receipt.v1",
    story: payload.story,
    intent: payload.intent,
    startedAt: instant(),
    dryRun,
    host: VM_HOST,
    partition,
    topology: {
      engineCli: VM_ENGINE_CLI,
      workspace: target.workspace,
      attestDir: target.attestDir,
      actor: supply.actor,
      configuredIn: "deploy/aos-local-client/topology.mjs (VM half imported from deploy/aos-resident-cockpit/manifest.mjs); partition targets in deploy/aos-local-client/aos-partitions.mjs"
    },
    // Repo-relative when the payload lives in this checkout, so a receipt can be
    // committed as evidence without carrying this laptop's home directory into it
    // (TCRN-AOS-INC-037: two receipts shipped exactly that, and making this repository
    // public then cost a 93-commit history rewrite). The digest is what identifies the
    // payload anyway; the path is a courtesy for a reader.
    payload: {
      path: relativeToRepo(payloadPath),
      sha256: sha256Text(payloadText),
      bytes: Buffer.byteLength(payloadText, "utf8")
    },
    hostEngineCatalogue: { verbs: commands.length },
    chainBefore: await readChainHead(target.workspace),
    steps: [],
    readback: [],
    chainAfter: null
  };

  for (const step of payload.steps) {
    // Re-read the head before EVERY mutating step. A batch advances the chain as it
    // runs, so one sentinel captured at the start would be stale by step two — and a
    // stale sentinel does not fail safe silently, it fails the step with a CAS
    // mismatch, which reads like a defect in the payload.
    const head = step.readHeadFirst === false ? receipt.chainBefore : await readChainHead(target.workspace);
    const plan = planStep({ step, catalogue, supply, chainVersion: head.version, at: instant() });
    if (!plan.ok) {
      emitCeremonySpan({ span: "ceremony.refused", partition, verb: plan.verb ?? null, expectedVersion: head.version, outcome: "refused", reasonCode: plan.reasonCode });
      receipt.steps.push({ ...plan, headAtPlanning: head.version });
      receipt.ok = false;
      receipt.reasonCode = plan.reasonCode;
      return receipt;
    }
    if (dryRun) {
      receipt.steps.push({
        ...plan, headAtPlanning: head.version, executed: false,
        // The values are shown; nothing is sent. A dry run that also sent the command
        // would be a dry run in name only.
        wouldSend: `node ${VM_ENGINE_CLI} ${plan.argv.map(shellQuote).join(" ")}`
      });
      continue;
    }
    const result = await remoteEngine(plan.argv);
    // TCRN-CROSS-STORY-135: keep the engine's own error text on a refusal, so the
    // receipt answers "why did this fail" on its own instead of forcing a local
    // reproduction (CONF-050's close-conference collision was diagnosed only after
    // re-running it in a temp workspace, because the receipt held reasonCode + argv
    // and nothing else). Scrubbed before it lands: a ceremony receipt is committed
    // as evidence and an engine message can quote a path (TCRN-AOS-INC-037). Full on
    // a refusal; a success carries no error field, and anything that ever appears on
    // one is scrubbed then truncated rather than kept whole.
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
      emitCeremonySpan({ span: "ceremony.refused", partition, verb: step.verb, expectedVersion: head.version, outcome: "refused", reasonCode: "STEP_REFUSED_BY_HOST_ENGINE" });
      receipt.ok = false;
      receipt.reasonCode = "STEP_REFUSED_BY_HOST_ENGINE";
      receipt.chainAfter = await readChainHead(target.workspace);
      return receipt;
    }
  }

  for (const step of payload.readback) {
    const plan = planStep({ step, catalogue, supply, chainVersion: null, at: instant() });
    if (!plan.ok) {
      emitCeremonySpan({ span: "ceremony.refused", partition, verb: step.verb, outcome: "refused", reasonCode: plan.reasonCode });
      receipt.readback.push(plan);
      receipt.ok = false;
      receipt.reasonCode = plan.reasonCode;
      return receipt;
    }
    if (dryRun) {
      receipt.readback.push({ ...plan, executed: false });
      continue;
    }
    const result = await remoteEngine(plan.argv);
    // `work-show` answers with the immutable `record` and the mutable `advisory` as
    // SIBLINGS, so a read-back comparison written against `record` alone can never see
    // a scope, a sprint or a decided-by — the very fields an annotate sets. Both are
    // flattened into one view to compare against, with `record` last so an immutable
    // field can never be shadowed by an advisory one of the same name.
    const record = result.json === null ? null : { ...result.json.advisory, ...result.json.record };
    const { expected, problems } = resolveExpectations({ step, steps: payload.steps });
    if (problems.length > 0) {
      emitCeremonySpan({ span: "ceremony.refused", partition, verb: step.verb, outcome: "refused", reasonCode: "EXPECTATION_UNRESOLVABLE" });
      receipt.readback.push({ ...plan, executed: true, reasonCode: "EXPECTATION_UNRESOLVABLE", problems });
      receipt.ok = false;
      receipt.reasonCode = "EXPECTATION_UNRESOLVABLE";
      return receipt;
    }
    const verdict = judgeReadback({ expected, observed: record });
    receipt.readback.push({
      ...plan,
      executed: true,
      accepted: result.accepted,
      reasonCode: result.reasonCode,
      verdict,
      record: step.recordFields
        ? Object.fromEntries(step.recordFields.map((field) => [field, record?.[field] ?? null]))
        : undefined
    });
    if (!result.accepted || verdict.ok === false) {
      emitCeremonySpan({ span: "ceremony.refused", partition, verb: step.verb, outcome: "refused", reasonCode: !result.accepted ? "READBACK_REFUSED" : "READBACK_DIVERGENT" });
      receipt.ok = false;
      receipt.reasonCode = !result.accepted ? "READBACK_REFUSED" : "READBACK_DIVERGENT";
      receipt.chainAfter = await readChainHead(target.workspace);
      return receipt;
    }
    emitCeremonySpan({ span: "ceremony.readback", partition, verb: step.verb, outcome: "ok" });
  }

  receipt.chainAfter = await readChainHead(target.workspace);
  receipt.eventsAppended = receipt.chainAfter.version - receipt.chainBefore.version;
  receipt.ok = true;
  receipt.reasonCode = dryRun ? "CEREMONY_PLANNED_ONLY" : "CEREMONY_COMPLETED_AND_READ_BACK";
  receipt.finishedAt = instant();
  emitCeremonySpan({ span: "ceremony.end", partition, outcome: "ok", reasonCode: receipt.reasonCode });
  return receipt;
}

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  const payloadPath = argument("payload");
  if (!payloadPath) {
    process.stderr.write("usage: ceremony.mjs --payload <file.json> [--receipt <file.json>] [--dry-run] [--partition <id>]\n");
    process.exit(2);
  }
  const receipt = await runCeremony({
    payloadPath: resolve(payloadPath),
    dryRun: process.argv.includes("--dry-run"),
    partition: argument("partition") ?? "TCRN-AOS"
  });
  const receiptPath = argument("receipt");
  if (receiptPath) {
    mkdirSync(dirname(resolve(receiptPath)), { recursive: true });
    writeFileSync(resolve(receiptPath), `${JSON.stringify(receipt, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (receipt.ok !== true) process.exitCode = 1;
}
