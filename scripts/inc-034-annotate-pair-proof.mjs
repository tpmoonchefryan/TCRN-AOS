#!/usr/bin/env node
// Red-prove the annotate-pair criterion (TCRN-AOS-INC-034 route B, TCRN-AOS-MIN-007).
//
// The claim under test: an annotate pair is judged green only when the write was
// accepted AND its byte-identical replay was refused as a no-op. A criterion is
// only worth trusting if it can go red, so this script runs the real judge
// (scripts/lib/annotate-pair.mjs — shared code, not a re-implementation) against
// three real pairs on a scratch governed chain:
//
// The judge was originally shared with the mirror acceptance proof's fallback leg.
// That proof was retired with the mirror segment (TCRN-AOS-STORY-134), so this is
// now the judge's only caller — which is precisely why this red-proof matters
// more than it did: it is the last thing standing between that policy and nobody
// exercising it.
//
//   green — a faithful pair: judge must pass;
//   red 1 — the replay has one byte changed, so the engine ACCEPTS it: the
//           judge must fail, and fail on "replay-refused" (a refusal that was
//           never held must not be reported as held);
//   red 2 — the replay aims at a wrong record id: the engine refuses with the
//           same reason code (WORKSPACE_INPUT_INVALID) but a different message:
//           the judge must fail on "refusal-names-the-noop" (a shared code must
//           not count as the no-op refusal).
//
// The scratch chain is real — every observation below is the engine's own
// answer, not a simulation. It lives only under an explicitly supplied root:
// a governed workspace is never something a proof script places by default.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, isAbsolute, resolve } from "node:path";
import {
  stripStampLines,
  stampedScope,
  judgeAnnotatePair,
  NOOP_REFUSAL_MESSAGE
} from "./lib/annotate-pair.mjs";

const run = promisify(execFile);

const ENGINE = process.env.AOS_ENGINE_CLI
  ?? resolve(homedir(), ".tcrn-workflow/tcrn-workflow/scripts/tcrn-workflow.mjs");

const scratchRootArg = process.argv.includes("--scratch-root")
  ? process.argv[process.argv.indexOf("--scratch-root") + 1]
  : process.env.TCRN_AOS_SCRATCH_ROOT;
if (!scratchRootArg || !isAbsolute(scratchRootArg)) {
  console.error(JSON.stringify({
    ok: false,
    error: "an absolute --scratch-root (or TCRN_AOS_SCRATCH_ROOT) is required: this proof creates a "
      + "real governed workspace, and where a chain lives is a decision the caller makes, not a default"
  }));
  process.exit(1);
}

const root = join(scratchRootArg, `inc034-red-proof-${Date.now()}`);
const workspace = join(root, "workspace");
// The engine's init requires every root directory to already exist.
for (const dir of ["workspace", "transient", "evidence-locator", "release-trust"]) {
  await mkdir(join(root, dir), { recursive: true });
}

const instant = () => new Date().toISOString().replace(/\.\d+Z$/u, "Z");

/**
 * Run one engine CLI verb against the scratch chain.
 *
 * The result is mapped exactly the way the cockpit service maps it for HTTP —
 * success 200, engine refusal 409 with the engine's own message — so the judge
 * sees the same observation shape from both callers.
 */
async function engine(verb, args) {
  try {
    const { stdout } = await run(process.execPath, [ENGINE, verb, "--workspace", workspace, ...args],
      { maxBuffer: 64 * 1024 * 1024 });
    return { status: 200, json: JSON.parse(stdout) };
  } catch (error) {
    // A refusal exits 1 with its JSON on stderr (stdout is reserved for command
    // results); anything that is not the engine's own {ok:false} is a real fault.
    const emitted = (error.stderr ?? "").trim() || (error.stdout ?? "").trim();
    let body;
    try { body = JSON.parse(emitted); } catch { throw error; }
    if (body.ok === false) return { status: 409, json: body };
    throw error;
  }
}

const mutation = (verb, args) => engine(verb, [
  "--expected-version", "head", "--at", instant(), "--actor", "agent:red-proof", ...args
]);

// --- scratch chain: one project, one parentless probe record ---------------
const init = await engine("init", [
  "--framework", resolve(homedir(), ".tcrn-workflow/tcrn-workflow"),
  "--transient", join(root, "transient"),
  "--evidence-locator", join(root, "evidence-locator"),
  "--release-trust", join(root, "release-trust"),
  "--external-key", "SCRATCH-INC034-RED-PROOF",
  "--at", instant()
]);
if (init.status !== 200) {
  console.error(JSON.stringify({ ok: false, error: "scratch workspace init failed", detail: init.json }));
  process.exit(1);
}
const project = await mutation("project-create", ["--external-key", "SCRATCH-PROJ", "--name", "annotate pair red proof"]);
// Kind Initiative because the work tree is strict: only Initiatives may be parentless.
const probe = await mutation("work-create", [
  "--project-id", project.json.record.id,
  "--external-key", "SCRATCH-PROBE-001",
  "--kind", "Initiative",
  "--parent-id", "-"
]);
const probeId = probe.json.record.id;

/**
 * Perform one annotate pair against the probe record and return the judged
 * observation. `mutateReplay` lets a red case corrupt the replay before it is
 * sent; the measurement and the judge stay identical across all three cases.
 */
async function performPair(label, mutateReplay = (args) => args) {
  const before = await engine("work-show", ["--id", probeId]);
  const eventsBefore = (await engine("export", [])).json.events;

  // The label keeps consecutive pairs distinct even within the same second:
  // stamp lines carry second precision, and two pairs writing the same narrative
  // in the same second would turn the second pair's write into a no-op.
  const narrative = `${stripStampLines(before.json.advisory?.scope ?? "")}\nprobe pair ${label}`.trim();
  const scope = stampedScope(narrative, instant());
  const writeArgs = ["--id", probeId, "--scope", scope];

  const write = await mutation("work-annotate", writeArgs);
  const afterWrite = await engine("work-show", ["--id", probeId]);
  const eventsAfter = (await engine("export", [])).json.events;
  const lastEvent = eventsAfter[eventsAfter.length - 1] ?? {};

  const replay = await mutation("work-annotate", mutateReplay([...writeArgs]));
  const afterReplay = await engine("work-show", ["--id", probeId]);

  return judgeAnnotatePair({
    recordId: probeId,
    write: { status: write.status },
    before: { revision: before.json.record.revision },
    afterWrite: { revision: afterWrite.json.record.revision },
    events: {
      delta: eventsAfter.length - eventsBefore.length,
      lastOperation: lastEvent.payload?.operation ?? null,
      lastRecordId: lastEvent.payload?.record?.id ?? null
    },
    replay: {
      status: replay.status,
      message: replay.json.error ?? null,
      revisionAfter: afterReplay.json.record.revision
    }
  });
}

const failedNames = (judged) => judged.checks.filter((check) => !check.ok).map((check) => check.name);

// green — the faithful pair must pass.
const green = await performPair("green");

// red 1 — one byte changed: the engine accepts the "replay" as a new annotation,
// so the pair never held a refusal, and the judge must say so.
const red1 = await performPair("red-1", (args) => {
  args[3] = `${args[3]}X`;
  return args;
});

// red 2 — wrong record id: refused with the shared reason code but a different
// message; the judge must not read it as the no-op refusal.
const red2 = await performPair("red-2", (args) => {
  args[1] = "work:000000000000000000000000";
  return args;
});

// --- decided-by through the real MCP facade --------------------------------
//
// The safe write surface once sent decided-by in the CLI's wire format — a
// comma-joined string, "-" for empty — and the facade's `list` argument kind
// refused every such call with MCP_ARGUMENT_INVALID. The service tests observe
// the surface through a recording stand-in, which is structurally blind to
// that class of defect: the recorder accepts whatever bytes arrive. So this
// leg goes through the actual facade against the scratch chain: the surface's
// array must be accepted end to end, and the engine's own judgement on an
// empty list must come back as the engine's refusal, not the facade's.
//
// Writes through the facade need pinned operator authority (the same asymmetry
// the cockpit service lives with); the pins gate which commands the facade may
// run, and every argument here still targets only the scratch workspace.
async function decidedByFacadeLeg() {
  const { ChainClient, SafeWriteSurface, WriteRefused } = await import(
    new URL("../dist/packages/projection/src/index.js", import.meta.url).href);
  const serverPath = process.env.AOS_ENGINE_MCP
    ?? resolve(homedir(), ".tcrn-workflow/tcrn-workflow/scripts/tcrn-workflow-mcp.mjs");
  const authorityPins = process.env.TCRN_AUTHORITY_PINS
    ?? resolve(homedir(), ".tcrn-workflow/live/tcrn-platform/authority/operator-authority-pins.json");
  const authorityPinsDigest = process.env.TCRN_AUTHORITY_PINS_DIGEST
    ?? "d25ebfc1cb47310d27bdeba4749fe5728b089188a7338d6a89cfe86f1c5d5ce9";

  const client = new ChainClient({ serverPath, authorityPins, authorityPinsDigest });
  try {
    await client.start();
    const surface = new SafeWriteSurface(client, { workspacePath: workspace, actor: "agent:red-proof" });

    const decidedBy = ["minutes:0000000000000000000000aa", "minutes:0000000000000000000000bb"];
    await surface.annotate({ id: probeId, decidedBy });
    const shown = await engine("work-show", ["--id", probeId]);
    const recorded = shown.json.advisory?.decidedBy ?? null;

    // The empty list passes through as an array too; the facade converts it to
    // the CLI's "-" sentinel and the engine — not this client — refuses it as
    // an empty decided-by. The refusal must be the engine's own wording.
    let emptyRefusal = null;
    try {
      await surface.annotate({ id: probeId, decidedBy: [] });
    } catch (error) {
      if (!(error instanceof WriteRefused)) throw error;
      emptyRefusal = { reasonCode: error.reasonCode, message: error.message };
    }

    return {
      viaRealFacade: true,
      sent: decidedBy,
      recorded,
      accepted: Array.isArray(recorded)
        && recorded.length === decidedBy.length
        && recorded.every((entry, index) => entry === decidedBy[index]),
      emptyListJudgedByEngine: emptyRefusal !== null
        && emptyRefusal.reasonCode === "WORKSPACE_INPUT_INVALID"
        && emptyRefusal.message.includes("decided-by must be a non-empty list"),
      emptyRefusal
    };
  } finally {
    // The facade is a spawned process group; the proof must not outlive it.
    await client.stop();
  }
}

const decidedByLeg = await decidedByFacadeLeg();

const anchor = await engine("status", []);

const criteria = [
  {
    name: "green-pair-judged-green",
    ok: green.ok,
    detail: { failedChecks: failedNames(green) }
  },
  {
    name: "mutated-replay-turns-the-judge-red-on-replay-refused",
    ok: !red1.ok && failedNames(red1).includes("replay-refused"),
    detail: { judgeOk: red1.ok, failedChecks: failedNames(red1) }
  },
  {
    name: "wrong-id-refusal-is-not-counted-as-the-noop-refusal",
    ok: !red2.ok
      && failedNames(red2).includes("refusal-names-the-noop")
      && !failedNames(red2).includes("replay-refused"),
    detail: { judgeOk: red2.ok, failedChecks: failedNames(red2), expectedNoopMessage: NOOP_REFUSAL_MESSAGE }
  },
  {
    name: "decided-by-array-accepted-through-the-real-mcp-facade",
    ok: decidedByLeg.accepted === true && decidedByLeg.emptyListJudgedByEngine === true,
    detail: decidedByLeg
  }
];

const receipt = {
  schemaVersion: "aos.inc-034-annotate-pair.v1",
  ok: criteria.every((criterion) => criterion.ok),
  subject: "scripts/lib/annotate-pair.mjs — the annotate-pair judge; originally shared with the "
    + "mirror acceptance proof's criterion 4, and its only caller since that proof was retired "
    + "with the mirror segment (TCRN-AOS-STORY-134)",
  criteria,
  observations: { green, red1, red2 },
  engineAnchor: {
    workspaceId: anchor.json.workspaceId,
    headEventHash: anchor.json.headEventHash,
    version: anchor.json.version
  },
  notClaimed: [
    "the scratch chain is disposable and session-local; nothing here touched a live partition",
    "this proves the judge and the surface-to-facade wire format, not the HTTP route; the annotate route is exercised by service tests and by the acceptance proof's live leg",
    "the operator authority pins gate which commands the facade may run; supplying them here authorises writes to the scratch workspace only, and no live-workspace argument appears in this proof"
  ]
};

await mkdir("evidence", { recursive: true });
await writeFile("evidence/inc-034-annotate-pair-proof.json", `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ ok: receipt.ok, criteria: criteria.map((c) => ({ [c.name]: c.ok })) }, null, 2));
if (!receipt.ok) process.exitCode = 1;
