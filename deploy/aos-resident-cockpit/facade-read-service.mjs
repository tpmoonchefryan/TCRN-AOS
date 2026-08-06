#!/usr/bin/env node
// STORY-181 — the AOS facade read service: the engine read-verb full set, over HTTP.
//
//   (an HTTP service; started by facade-read-runner.mjs, or in-process by the test
//    suite on this machine — it is not a standalone entry point by itself)
//
// WHAT IT IS. The read face that fronts the ENGINE rather than the domain store.
// The LAN read face (cockpit-read, STORY-138/140) serves the built web and the
// domain store but has no chain reads at all. This service is the complementary
// surface: every read-only verb in the engine's command catalogue, exposed over
// HTTP so a governed chain's reads can be reached without driving the engine CLI
// by hand. It runs the engine CLI in-process on the FILE backend (the chains live
// there until the STORY-188 window moves them), forwarding each verb with the
// partition's workspace path from the deployment's workspaces record.
//
// WHY THE DERIVATION IS TWO-SOURCED. A face that filters its published tool table
// by its own predicate and then asserts the negation of the same predicate can
// never go red (判据两侧必须能够不同 — a recorded platform sin). This file borrows
// the two independent sources remote-read-mcp.mjs already carries, so the safety
// property is literally the tested one, not a copy:
//
//   - SOURCE A (what gets published): `withheldGround` — the engine catalogue's
//     own mutates / authorityBearing / fixture-only / per-invocation-authority
//     flags. A verb the catalogue marks as any of those is withheld.
//   - SOURCE B (what may NOT be published): `assertNoWriteExposed` — the engine's
//     OWN `workflowMcpTools()` descriptors (readOnlyHint / destructiveHint /
//     membership). If the engine's own MCP surface would not publish a verb as a
//     read, this face may not either, even if source A let it through.
//
//   The two sources are complementary filters over the SAME catalogue, so they
//   can only disagree when one of them is wrong — and that disagreement is the
//   red. A verb either source withholds is refused here with the reason code that
//   names the ground (MCP_REMOTE_WRITE_REFUSED / MCP_REMOTE_AUTHORITY_OUTPUT_REFUSED
//   / MCP_REMOTE_FIXTURE_ONLY).
//
// NO PINS, BY SHAPE. The service accepts no authority argument, constructs no
// chain client, and never names an operator authority file. It forwards only
// verbs the derivation proved read-only, and passes no pins to the engine CLI
// (reads need none). A mutating verb is refused before routing, so there is no
// code path to a governed write. That is the invariant read-face-gate enforces
// at the source.
//
// FIVE PARTITIONS, ONE SEAM. The service knows each partition's workspace path
// through the same seam the write face's CockpitServiceOptions uses: a
// `workspaces` record of partitionId → workspace path. The deployment states the
// record; this file never hard-codes a path.
//
// FRESHNESS. The tool table is derived from the engine's LIVE `commands` output
// and re-derived after CATALOG_TTL_MS, so a verb the engine adds, or a verb whose
// mutates flag flips, stops being forwarded within one TTL rather than at the
// next restart. A stale table is the index-with-no-freshness-precondition failure
// mode this platform has already paid for (索引类工具必带新鲜度前置).

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  AUTHORITY_OUTPUT_REFUSED, EXPOSURE_UNPROVEN, FIXTURE_ONLY_REFUSED, PARTITION_ARGUMENT,
  RESERVED_FLAGS, WRITE_REFUSED, assertNoWriteExposed, cliFlagValue, engineAnnotationIndex,
  flagSchema, isForwardableRead, toolName, withheldGround
} from "../aos-local-client/remote-read-mcp.mjs";
import { scrubHostPathsInText } from "../../scripts/lib/evidence-hygiene.mjs";

const runFile = promisify(execFile);

export const FACADE_SERVER_NAME = "tcrn-aos-facade-read";
export const FACADE_SERVER_VERSION = "0.1.0";

/**
 * How long the derived tool table may be believed without re-deriving it.
 *
 * Same bound and same reasoning as remote-read-mcp's HOST_CATALOG_TTL_MS: an
 * MCP server lives for hours, a face answering from a snapshot would keep
 * forwarding a verb whose mutates flag flipped mid-session while telling the
 * caller it had asked the authority. Re-deriving from the engine's live
 * `commands` output costs a sub-second child process, so sixty seconds is a
 * bound whose price is negligible and whose benefit is that the window in which
 * this face can be wrong is stated rather than unbounded.
 */
export const CATALOG_TTL_MS = 60_000;

/** The engine CLI may project for a while on a big chain; stop waiting, don't cancel. */
export const ENGINE_TIMEOUT_MS = 120_000;
export const ENGINE_MAX_BUFFER = 64 * 1024 * 1024;
/** Mirrors the engine facade's line ceiling, so no single answer is oversized here either. */
export const RESPONSE_MAX_BYTES = 64 * 1024 * 1024;

/**
 * @typedef {object} FacadeReadOptions
 * @property {string} engineRoot The installed engine copy whose `commands` catalogue drives the tool table.
 * @property {Readonly<Record<string, string>>} workspaces Partition id → workspace path, the same seam as CockpitServiceOptions.workspaces.
 * @property {string} host Concrete bind address. The deployment states it; nothing here defaults a network address.
 * @property {number} port Port to answer on.
 * @property {readonly string[]} [allowedHosts] Allowed Host header values for DNS-rebinding protection.
 * @property {number} [catalogTtlMs] Override for the freshness bound, so a test can prove drift without waiting it out.
 * @property {string} [engineCli] Override for the engine CLI entry; tests point it at the local engine copy.
 */

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function fail(reasonCode, message) {
  const error = new Error(message);
  error.reasonCode = reasonCode;
  throw error;
}

/**
 * Run the engine CLI once. The engine answers JSON on stdout for both success and
 * refusal; a non-zero exit is a refusal, not a transport break.
 *
 * When `pgSchema` is set, the CLI is run as the PG peer-auth role (tcrn_engine on
 * the VM) with TCRN_PG_CONNECTION + TCRN_PG_SCHEMA in its environment, so the
 * verb answers from the PG-backed chain (STORY-189 switch window). The facade
 * service runs as root; dropping to tcrn_engine for the PG connection is a
 * privilege DECREASE, which is why the unit's NoNewPrivileges guard is off for
 * this one downward hop. Reads only — this face forwards no mutating verb.
 */
export async function runEngineCli(engineRoot, argv, { engineCli, pgSchema, pgConnection, pgUser } = {}) {
  const entry = engineCli ?? resolve(engineRoot, "scripts/tcrn-workflow.mjs");
  const command = pgSchema
    ? ["sudo", "-n", "-u", pgUser ?? "tcrn_engine", "env",
      `TCRN_PG_CONNECTION=${pgConnection ?? ""}`,
      `TCRN_PG_SCHEMA=${pgSchema}`,
      "node", entry, ...argv]
    : ["node", entry, ...argv];
  try {
    const { stdout } = await runFile(command[0], command.slice(1), {
      timeout: ENGINE_TIMEOUT_MS,
      maxBuffer: ENGINE_MAX_BUFFER
    });
    return { ok: true, code: 0, text: stdout, json: parseJson(stdout) };
  } catch (error) {
    const text = String(error?.stdout ?? "").trim()
      || String(error?.stderr ?? "").trim()
      || String(error?.message ?? error).trim();
    return {
      ok: false,
      code: typeof error?.code === "number" ? error.code : null,
      text,
      json: parseJson(text)
    };
  }
}

/**
 * Whether a verb is partition-scoped for THIS face: it names a topology-owned
 * flag. Derived rather than listed, so a verb that grows a --workspace later
 * becomes partition-scoped on its own instead of silently losing the value.
 */
export const isFacadePartitionScoped = (entry) =>
  (entry.flags ?? []).some((flag) => RESERVED_FLAGS.includes(flag.name));

/**
 * The tool descriptor for one verb, mirroring remote-read-mcp's shape so a
 * caller that learned an argument shape from that face meets the same one here.
 * The partition enum is this face's own workspaces keys, not the VM roster.
 */
export function facadeToolDescriptor(entry, partitionIds) {
  const callerFlags = (entry.flags ?? []).filter((flag) => !RESERVED_FLAGS.includes(flag.name));
  const scoped = isFacadePartitionScoped(entry);
  const properties = Object.fromEntries(callerFlags.map((flag) => [flag.name, flagSchema(flag)]));
  const required = callerFlags.filter((flag) => flag.required === true).map((flag) => flag.name);
  if (scoped) {
    properties[PARTITION_ARGUMENT] = {
      type: "string",
      enum: partitionIds,
      description: "Which governed partition to read. The workspace path behind it comes from "
        + "the facade's workspaces record and may not be named by the caller."
    };
    required.push(PARTITION_ARGUMENT);
  }
  return {
    name: toolName(entry.name),
    description: `Read-only Workflow command ${entry.name}, run through the AOS facade against the `
      + "engine CLI (file backend). Stable CLI reason codes are preserved. This face performs no "
      + "governed write.",
    inputSchema: {
      type: "object",
      properties,
      required: required.sort(),
      additionalProperties: false
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  };
}

/**
 * The exposure invariant, judged against the engine's OWN descriptors — the
 * second, independent source. Same function as remote-read-mcp's; it answers
 * from the installed engine's `workflowMcpTools()` rather than from
 * `withheldGround`, so a widening of one predicate that source A misses is still
 * a red here. A missing or empty annotation index is refused, not passed.
 */
export function assertNoWriteExposedFacade(entries, engineAnnotations) {
  if (!(engineAnnotations instanceof Map) || engineAnnotations.size === 0) {
    fail(EXPOSURE_UNPROVEN,
      "the facade exposure invariant was handed no engine descriptors, so it could not be "
      + "evaluated. Refusing to publish: an unevaluated invariant is not a satisfied one.");
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
    if (annotations.destructiveHint === true) leaked.push(`${entry.name} (destructiveHint:true)`);
    if (annotations.readOnlyHint !== true) leaked.push(`${entry.name} (not readOnlyHint:true)`);
  }
  if (leaked.length > 0) {
    fail("MCP_REMOTE_EXPOSURE_INVARIANT",
      `refusing to publish ${leaked.length} withheld verb(s) on a read-only face: ` + leaked.join("; "));
  }
  return entries;
}

/**
 * One engine verb turned into the argv the engine CLI will be sent — with the
 * workspace resolved from THIS face's workspaces record, not from a hard-coded
 * roster. Mirrors remote-read-mcp's remoteArgv structure; the reserved-flag
 * handling, unknown-arg and missing-arg refusals are the same, so a caller
 * cannot smuggle a workspace value through.
 */
export function facadeArgv(entry, input, workspaces) {
  const given = input === undefined ? {} : asRecord(input, "arguments");

  const declared = new Set((entry.flags ?? []).map((flag) => flag.name));
  for (const reserved of RESERVED_FLAGS) {
    if (!declared.has(reserved)) continue;
    if (Object.hasOwn(given, reserved)) {
      fail("MCP_ARGUMENT_RESERVED",
        `${reserved} comes from the facade's workspaces record and may not be named by a caller; `
        + `name ${PARTITION_ARGUMENT} instead`);
    }
  }

  const scoped = isFacadePartitionScoped(entry);
  const allowed = new Set((entry.flags ?? [])
    .map((flag) => flag.name)
    .filter((name) => !RESERVED_FLAGS.includes(name)));
  if (scoped) allowed.add(PARTITION_ARGUMENT);
  const unknown = Object.keys(given).filter((name) => !allowed.has(name));
  if (unknown.length > 0) fail("MCP_ARGUMENT_UNKNOWN", unknown.sort().join(","));

  let partition = null;
  if (scoped) {
    partition = given[PARTITION_ARGUMENT];
    if (typeof partition !== "string" || partition.length === 0) {
      fail("MCP_ARGUMENT_MISSING", PARTITION_ARGUMENT);
    }
    if (!Object.hasOwn(workspaces, partition)) {
      fail("MCP_PARTITION_UNKNOWN",
        `partition ${partition} has no workspace in this facade's workspaces record; known: `
        + `${Object.keys(workspaces).join(", ")}`);
    }
  }

  const missing = (entry.flags ?? [])
    .filter((flag) => flag.required === true
      && !RESERVED_FLAGS.includes(flag.name)
      && given[flag.name] === undefined)
    .map((flag) => flag.name);
  if (missing.length > 0) fail("MCP_ARGUMENT_MISSING", missing.join(","));

  const argv = [entry.name];
  for (const flag of entry.flags ?? []) {
    if (flag.name === "workspace") {
      argv.push("--workspace", workspaces[partition]);
      continue;
    }
    if (flag.name === "attest-dir") {
      // No read verb currently declares attest-dir, and the workspaces record
      // carries no attestation address — if one ever does, this is the place a
      // deployment would state it, and until then a forwardable verb naming it
      // is refused rather than silently dropped.
      fail("MCP_ATTEST_DIR_UNSUPPORTED",
        `the verb ${entry.name} declares attest-dir, which the read face does not resolve; `
        + "the facade forwards reads only and the workspaces record holds workspace paths.");
    }
    const value = given[flag.name];
    if (value === undefined) continue;
    argv.push(`--${flag.name}`, cliFlagValue(flag, value));
  }
  return { argv, partition };
}

function asRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    fail("MCP_INVALID_REQUEST", label);
  }
  return value;
}

/**
 * The full facade catalogue, derived from the engine's live `commands` output
 * (source A) and the engine's own MCP descriptors (source B).
 */
export async function deriveFacadeCatalog({ engineRoot, partitionIds, engineCli }) {
  const commandsResult = await runEngineCli(engineRoot, ["commands"], { engineCli });
  const commands = commandsResult.json?.commands ?? commandsResult.json?.result?.commands ?? null;
  if (!commandsResult.ok || !Array.isArray(commands) || commands.length === 0) {
    fail("MCP_REMOTE_CATALOGUE_UNAVAILABLE",
      `the engine at ${engineRoot} did not report its command catalogue`
      + `${commandsResult.json?.reasonCode ? `: ${commandsResult.json.reasonCode}` : ""}`);
  }

  // Source B, independently: the engine's OWN MCP descriptors. Not a re-reading
  // of `commands` through this file's predicate — `workflowMcpTools()` is the
  // engine's code deciding what it itself would publish and with which
  // annotations, which is precisely why it can disagree with `withheldGround`.
  let mcp = null;
  try {
    mcp = await import(pathToFileURL(
      resolve(engineRoot, "dist/build/packages/cli/src/mcp.js")).href);
  } catch {
    // fall through; the catalogue is still the substance and assertNoWriteExposed
    // will refuse the publication as unevaluated when handed no descriptors
  }
  const engineAnnotations = mcp && typeof mcp.workflowMcpTools === "function"
    ? engineAnnotationIndex(commands, mcp.workflowMcpTools(), mcp.WORKFLOW_MCP_TOOL_PREFIX)
    : null;

  const byTool = new Map();
  for (const entry of commands) {
    const name = toolName(entry.name);
    if (byTool.has(name)) fail("MCP_TOOL_COLLISION", "catalog command names do not map one-to-one");
    // EVERY entry is indexed, withheld ones included, so a caller who asks for a
    // write verb is told it was refused and where to go, not "unknown tool".
    byTool.set(name, entry);
  }
  const forwardable = commands.filter(isForwardableRead);
  const withheld = commands.filter((entry) => !isForwardableRead(entry));
  if (forwardable.length + withheld.length !== byTool.size) {
    fail("MCP_REMOTE_EXPOSURE_INVARIANT",
      `the published/withheld split does not account for the whole catalogue: `
      + `${forwardable.length} + ${withheld.length} !== ${byTool.size}`);
  }
  // The two-source assertion: nothing source A would publish may be withheld by
  // source B. When the engine descriptors could not be loaded this refuses the
  // publication as UNPROVEN rather than publishing on the strength of source A.
  assertNoWriteExposedFacade(forwardable, engineAnnotations);

  return {
    byTool,
    forwardable,
    withheld,
    partitionIds: [...partitionIds],
    tools: forwardable.map((entry) => facadeToolDescriptor(entry, [...partitionIds]))
  };
}

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

/**
 * Start the facade read service.
 *
 * Binds the stated concrete address (never a wildcard), validates the Host
 * header when an allow-list is stated, and serves exactly three surfaces:
 * /api/health, /api/engine/catalog, and POST /api/engine/<verb> for verbs the
 * two-source derivation proved read-only. There is no route to a write.
 */
export async function startFacadeReadService(options) {
  if (typeof options.host !== "string" || options.host.trim().length === 0) {
    throw new Error("facade read refused to start: no bind host stated");
  }
  if (["0.0.0.0", "::", "*"].includes(options.host)) {
    throw new Error(`facade read refused to bind ${options.host}: wildcard binds are not allowed`);
  }
  if (!options.workspaces || Object.keys(options.workspaces).length === 0) {
    throw new Error("facade read refused to start: no workspaces stated. The service must know "
      + "each partition's workspace path (CockpitServiceOptions.workspaces seam).");
  }
  const workspaces = { ...options.workspaces };
  const partitionIds = Object.keys(workspaces);
  const ttlMs = options.catalogTtlMs ?? CATALOG_TTL_MS;

  let catalog = await deriveFacadeCatalog({
    engineRoot: options.engineRoot,
    partitionIds,
    engineCli: options.engineCli
  });
  let derivedAt = Date.now();

  async function refreshCatalog() {
    const next = await deriveFacadeCatalog({
      engineRoot: options.engineRoot,
      partitionIds,
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

  const server = createServer((request, response) => {
    void handle(request, response, {
      workspaces,
      partitionIds,
      currentCatalog,
      allowedHosts,
      engineRoot: options.engineRoot,
      engineCli: options.engineCli,
      pgSchemas: options.pgSchemas,
      pgConnection: options.pgConnection,
      ttlMs
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
    sendJson(response, 200, {
      ok: true,
      service: FACADE_SERVER_NAME,
      readonly: true,
      chainWriteAvailable: false,
      partitions: context.partitionIds,
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
      schemaVersion: "aos.facade-read-catalog.v1",
      tools: catalog.tools,
      withheld: catalog.withheld.map((entry) => ({
        name: toolName(entry.name),
        reasonCode: withheldGround(entry).reasonCode,
        ground: withheldGround(entry).ground
      })),
      partitionIds: context.partitionIds
    });
    return;
  }

  if (request.method === "POST" && path.startsWith("/api/engine/")) {
    await handleEngineCall(request, response, context, path.slice("/api/engine/".length));
    return;
  }

  if (request.method !== "GET" && request.method !== "POST") {
    sendJson(response, 405, { ok: false, reasonCode: "METHOD_NOT_ALLOWED", error: "this face accepts GET (health/catalog) and POST (verb invocation) only" });
    return;
  }

  sendJson(response, 404, { ok: false, reasonCode: "NOT_FOUND", error: "no such surface" });
}

async function handleEngineCall(request, response, context, verbSegment) {
  if (verbSegment.length === 0 || verbSegment.includes("/")) {
    sendJson(response, 404, { ok: false, reasonCode: "MCP_TOOL_UNKNOWN", error: `no such engine verb: ${verbSegment}` });
    return;
  }
  const catalog = await context.currentCatalog();
  const entry = catalog.byTool.get(toolName(verbSegment));
  if (entry === undefined) {
    sendJson(response, 404, {
      ok: false,
      reasonCode: "MCP_TOOL_UNKNOWN",
      error: `the engine catalogue has no verb ${verbSegment}; this face indexes every verb it knows, `
        + "and a verb that exists here but is withheld answers with its own reason code"
    });
    return;
  }

  // THE RED LEG. A mutating / authority-bearing / fixture-only verb is refused
  // BEFORE routing — there is no route to a governed write. The reason code
  // names the ground and the remedy, so the caller knows where to go.
  const withheld = withheldGround(entry);
  if (withheld !== null) {
    sendJson(response, 409, {
      ok: false,
      command: entry.name,
      reasonCode: withheld.reasonCode,
      ground: withheld.ground,
      remedy: withheld.remedy,
      error: `${entry.name} is not forwardable by the facade read face: ${withheld.ground}. `
        + `This face carries no operator-authority pins and forwards no mutating verb. ${withheld.remedy}`
    });
    return;
  }

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

  let plan;
  try {
    // The body splits caller arguments from the partition selector (a verb's own
    // schema has no `partition` flag); merge them back into one argument record
    // for facadeArgv, which resolves `partition` into the workspace itself.
    const argumentsRecord = {
      ...(body.arguments ?? {}),
      ...(body.partition !== undefined ? { partition: body.partition } : {})
    };
    plan = facadeArgv(entry, argumentsRecord, context.workspaces);
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      command: entry.name,
      reasonCode: typeof error?.reasonCode === "string" ? error.reasonCode : "MCP_ARGUMENT_INVALID",
      error: scrubHostPathsInText(String(error?.message ?? error))
    });
    return;
  }

  const result = await runEngineCliFor(entry, plan, context);
  if (!result.ok) {
    const refused = {
      ok: false,
      command: entry.name,
      partition: plan.partition,
      reasonCode: result.json?.reasonCode
        ?? (result.json === null ? "MCP_REMOTE_NON_JSON_OUTPUT" : "MCP_REMOTE_READ_REFUSED"),
      exitCode: result.code,
      error: scrubHostPathsInText(result.text).slice(0, 2000)
    };
    sendJson(response, 502, refused);
    return;
  }
  // The engine's own bytes, unaltered. Rewriting a successful read would mean
  // this face could change what the chain says about itself; only diagnostics
  // are scrubbed.
  sendJson(response, 200, {
    ok: true,
    command: entry.name,
    partition: plan.partition,
    result: result.json ?? result.text
  });
}

async function runEngineCliFor(entry, plan, context) {
  const catalog = await context.currentCatalog();
  const current = catalog.byTool.get(toolName(entry.name));
  // Freshness re-check: the verb must STILL be a read in the engine's CURRENT
  // catalogue. If the engine was upgraded mid-session and this verb became
  // mutates:true, the forward is refused here rather than performed.
  if (current === undefined) {
    throw Object.assign(new Error(`the engine's current catalogue no longer defines ${entry.name}; the face is stale and refuses the forward`), { reasonCode: "MCP_REMOTE_VERB_ABSENT" });
  }
  const currentWithheld = withheldGround(current);
  if (currentWithheld !== null) {
    throw Object.assign(new Error(`${entry.name} became non-forwardable in the engine's current catalogue: ${currentWithheld.ground}`), { reasonCode: currentWithheld.reasonCode });
  }
  return runEngineCli(context.engineRoot, plan.argv, {
    engineCli: context.engineCli,
    pgSchema: context.pgSchemas?.[plan.partition ?? ""],
    pgConnection: context.pgConnection,
  });
}
