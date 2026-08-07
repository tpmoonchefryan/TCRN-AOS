// STORY-183 — the facade WRITE face's rejection corpus + the mutation witness.
//
// The systematic rejection corpus for the facade write service
// (facade-write-service.mjs, STORY-182). It exists so the refusal surface has a
// load-bearing witness rather than a pile of tests: every rejection rule in the
// corpus carries a MUTATION that removes it, and the mutation witness proves the
// corpus item FLIPS when the rule is gone (判据两侧必须能够不同 — a refusal nobody
// can turn off is a refusal nobody can prove is on). Zero-witness red is a
// violation of this platform's closeout discipline, so the corpus and the witness
// ship as one file.
//
// TWO PROTECTION TARGETS, ONE CORPUS:
//   INC-047 — the write face's three structural requirements:
//             缺 actor   (an attributed actor — EPIC-041: every governed write
//                        says who performed it);
//             缺 occurredAt (a timestamp — a write is always stamped by the
//                        face's own clock, never by a payload);
//             缺回读     (a read-back — a write nobody read back is not proven).
//   INC-069 — in-payload smuggling (段内走私): a refused item smuggled inside an
//             otherwise-legal payload must refuse the WHOLE batch with a named
//             reason code, never be partially run; and 两侧判决函数统一: the facade
//             write face and the local ceremony (ceremony-plan.mjs) judge the
//             same family with the SAME code — the corpus proves it by running
//             the shared refusals through both surfaces and demanding the same
//             reason code.
//   INC-064 — dryRun / partition pass-through: a mutation that makes a dry run
//             actually send, or that routes a partition to the wrong chain, must
//             flip a corpus item.
//
// The corpus is DATA + the mutation machinery. The test file
// (facade-write-rejection-corpus.test.mjs) drives it: green leg = every entry
// triggers its reason code against the real service; red leg = every rule's
// mutation is caught (the corpus item flips).
//
// MUTATION MACHINERY. The witness mutates a MIRROR of the module graph, not the
// source: the mirrored tree preserves the deploy/… + scripts/… directory
// structure, so every relative import resolves exactly as it does in the repo,
// and a mutation is a deterministic byte replacement on the copy. A mutation
// whose match string is no longer found THROWS — a source change that silently
// disarms a witness is a red, not a no-op.
//
// The mutation strings are deliberately the SHAPE of the rule, not a unique
// comment: the same replacement would still fire if the rule moved to a
// differently-worded condition, and it names the branch it removes.

import { execFileSync } from "node:child_process";
import {
  mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { LOCAL_ENGINE } from "../switch-rehearsal/rehearsal-lib.mjs";
import { catalogueIndex } from "../aos-local-client/ceremony-plan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const AOS_REPO_ROOT = resolve(HERE, "..", "..");

// ── the mirror graph: every module the facade write service pulls in, by BFS ──

/**
 * Relative `from "…"` specifiers of a module, excluding node: builtins and absolute URLs.
 *
 * A single-line specifier (`[^"'\n]+`) keeps the scan honest: a real ESM import
 * always names its module on the same line as `from`, while a prose string like
 * `"... comes from "` + "…" would otherwise be captured across the line break.
 */
export function relativeImportSpecifiers(source) {
  const specifiers = [];
  for (const match of source.matchAll(/from\s+["']([^"'\n]+)["']/gu)) {
    const spec = match[1];
    if (spec.startsWith("node:") || spec.startsWith("file:") || spec.startsWith("/")) continue;
    specifiers.push(spec);
  }
  return specifiers;
}

/**
 * The set of repo files the facade write service imports, resolved to absolute
 * paths, deduped. BFS so a transitive import (remote-read-mcp → topology →
 * manifest) is mirrored too; a specifier that does not resolve is a LOUD failure,
 * because an unmirrored import would break the witness with a confusing ESM error.
 */
export function collectMirrorFiles(entryPath = join(HERE, "facade-write-service.mjs")) {
  const seen = new Set();
  const queue = [resolve(entryPath)];
  const files = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    files.push(current);
    const source = readFileSync(current, "utf8");
    for (const spec of relativeImportSpecifiers(source)) {
      const target = resolve(dirname(current), spec);
      if (!target.startsWith(AOS_REPO_ROOT)) {
        throw new Error(`STORY-183 mirror: import ${spec} in ${relative(AOS_REPO_ROOT, current)} escapes the AOS repo (${target})`);
      }
      queue.push(target);
    }
  }
  return files.sort();
}

/**
 * Build a mirrored package tree in a fresh temp directory and apply per-module
 * mutations to the copies. The tree preserves the repo-relative layout so every
 * relative import still resolves. Caller removes `root` in a finally.
 *
 * @param {Array<{module: "ceremony-plan"|"facade-write", match: string, replace: string, replaceAll?: boolean}>} mutations
 */
export function materialiseMirror(mutations = []) {
  const root = mkdtempSync(join(tmpdir(), "story183-mirror-"));
  const files = collectMirrorFiles();
  const byName = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
  for (const mutation of mutations) {
    const source = byName.get(join(AOS_REPO_ROOT, "deploy", "aos-local-client", "ceremony-plan.mjs"));
    const facade = byName.get(join(AOS_REPO_ROOT, "deploy", "aos-resident-cockpit", "facade-write-service.mjs"));
    const target = mutation.module === "ceremony-plan" ? source : facade;
    if (target === undefined) {
      throw new Error(`STORY-183 mirror: no source recorded for module ${mutation.module}`);
    }
    const count = target.split(mutation.match).length - 1;
    if (count === 0) {
      throw new Error(
        `STORY-183 mirror: mutation match not found in ${mutation.module}.mjs: ${JSON.stringify(mutation.match)}. `
        + "A mutation whose rule can no longer be found is a disarmed witness — refuse to proceed.");
    }
    const next = mutation.replaceAll
      ? target.split(mutation.match).join(mutation.replace)
      : target.replace(mutation.match, mutation.replace);
    const key = mutation.module === "ceremony-plan"
      ? join(AOS_REPO_ROOT, "deploy", "aos-local-client", "ceremony-plan.mjs")
      : join(AOS_REPO_ROOT, "deploy", "aos-resident-cockpit", "facade-write-service.mjs");
    byName.set(key, next);
  }
  for (const [file, content] of byName) {
    const target = join(root, relative(AOS_REPO_ROOT, file));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return { root, files };
}

// ── scratch fixture: a file-backed chain the local engine seeds and the face writes ──

const SCRATCH_KEY = "FACADE-183-SCRATCH";
const SCRATCH_AT = "2026-08-06T00:00:00Z";

function engineArgs(verb, flags = {}) {
  const args = [LOCAL_ENGINE_SCRIPTS(), verb];
  for (const [flag, value] of Object.entries(flags)) args.push(`--${flag}`, String(value));
  return args;
}

function LOCAL_ENGINE_SCRIPTS() {
  return resolve(LOCAL_ENGINE, "scripts/tcrn-workflow.mjs");
}

/**
 * One scratch file-backed workspace, seeded with a project and a work item the
 * corpus can annotate. Each call is independent so a mutated service never
 * touches a chain another leg already advanced.
 */
export function makeScratchFixture() {
  // realpath: the engine binds canonical real paths, and on macOS tmpdir is a
  // /var → /private/var symlink — a non-canonical root is ROOT_PATH_ALIAS-refused.
  const base = realpathSync(mkdtempSync(join(tmpdir(), "facade-183-fixture-")));
  const workspace = join(base, "workspace");
  mkdirSync(workspace, { recursive: true });
  const framework = realpathSync(mkdirSync(join(base, "framework"), { recursive: true }));
  const transient = realpathSync(mkdirSync(join(base, "transient"), { recursive: true }));
  const evidence = realpathSync(mkdirSync(join(base, "evidence"), { recursive: true }));
  const release = realpathSync(mkdirSync(join(base, "release-trust"), { recursive: true }));
  const attestDir = realpathSync(mkdirSync(join(base, "attestations"), { recursive: true }));

  const initOut = execFileSync("node", engineArgs("init", {
    workspace,
    framework,
    transient,
    "evidence-locator": evidence,
    "release-trust": release,
    "external-key": SCRATCH_KEY,
    at: SCRATCH_AT
  }), { encoding: "utf8" });
  if (!JSON.parse(initOut).reasonCode === "WORKSPACE_COMMAND_COMPLETED") {
    throw new Error(`scratch init failed: ${initOut}`);
  }

  const projectOut = execFileSync("node", engineArgs("project-create", {
    workspace,
    "external-key": "FACADE-183-PROJECT",
    name: "Facade Rejection 183",
    actor: "agent:fable",
    at: SCRATCH_AT,
    "expected-version": 0
  }), { encoding: "utf8" });
  const project = JSON.parse(projectOut);
  if (project.reasonCode !== "WORKSPACE_COMMAND_COMPLETED") {
    throw new Error(`project-create failed: ${projectOut}`);
  }

  const workOut = execFileSync("node", engineArgs("work-create", {
    workspace,
    "project-id": project.record.id,
    "external-key": "FACADE-183-INIT",
    kind: "Initiative",
    "parent-id": "-",
    actor: "agent:fable",
    at: SCRATCH_AT,
    "expected-version": 1
  }), { encoding: "utf8" });
  const work = JSON.parse(workOut);
  if (work.reasonCode !== "WORKSPACE_COMMAND_COMPLETED") {
    throw new Error(`work-create failed: ${workOut}`);
  }

  return { workspace, attestDir, base, workId: work.record.id };
}

/** The valid ceremony payload every corpus entry mutates. */
export function validPayload(fixture, scope = "STORY-183 reject face corpus") {
  return {
    schemaVersion: "aos.local-client-ceremony.v1",
    story: "TCRN-CROSS-STORY-183",
    intent: "one governed write through the facade, read back full-value",
    steps: [{ verb: "work-annotate", flags: { id: fixture.workId, scope } }],
    readback: [{
      verb: "work-show",
      flags: { id: fixture.workId },
      recordFields: ["externalKey", "kind", "status", "scope"],
      expect: { externalKey: "FACADE-183-INIT", kind: "Initiative", status: "planned" },
      expectSameAs: [{ field: "scope", step: 0, flag: "scope" }]
    }]
  };
}

// ── the corpus ──────────────────────────────────────────────────────────────
//
// Every entry: id, target (INC-047 / INC-069 / INC-064), rule, the reasonCode it
// must trigger, the payload it POSTs (body), the mutation that removes the rule,
// and expect ("refused" or "pass"). Entries whose rule lives in ceremony-plan.mjs
// are witnessed against that module's pure functions; entries whose rule lives in
// facade-write-service.mjs are witnessed either against writeWithheldGround
// (exported) or, for genuinely behavioral rules (actor / dryRun / partition),
// against a mutated HTTP service.

export const REJECTION_CORPUS = [
  // ── INC-047: 缺回读 — a write nobody read back is not proven ──────────────
  {
    id: "REJ-001",
    target: "INC-047",
    rule: "readback-required",
    reasonCode: "PAYLOAD_INVALID",
    module: "ceremony-plan",
    witness: "plan-assert",
    describe: "an empty readback refuses the whole payload",
    body: (fx) => ({ payload: { ...validPayload(fx), readback: [] } }),
    mutation: {
      module: "ceremony-plan",
      match: "if (Array.isArray(payload?.readback) && payload.readback.length === 0) {",
      replace: "if (false) { /* STORY-183 MUTATION: readback rule removed */"
    },
    expect: "refused"
  },

  // ── INC-047: 缺 actor — every governed write says who performed it (EPIC-041) ──
  {
    id: "REJ-002",
    target: "INC-047",
    rule: "actor-attributed",
    reasonCode: "CEREMONY_THREW_BEFORE_RECEIPT",
    module: "facade-write",
    witness: "http",
    describe: "a payload naming a non-attributed actor is refused before the network",
    body: (fx) => ({ payload: { ...validPayload(fx), actor: "anonymous" } }),
    mutation: {
      module: "facade-write",
      match: "&& (/^agent:[A-Za-z0-9._:-]+$/u.test(actor) || /^person:[A-Za-z0-9._:-]+$/u.test(actor))",
      replace: "&& true"
    },
    expect: "refused"
  },

  // ── INC-047: 缺 occurredAt — a write is always stamped by the face's clock ──
  {
    id: "REJ-003",
    target: "INC-047",
    rule: "timestamp-supplied",
    reasonCode: "CEREMONY_COMPLETED_AND_READ_BACK",
    module: "ceremony-plan",
    witness: "plan-supply",
    describe: "a step verb declaring --at receives the face's own instant, never a payload one",
    body: (fx) => ({ payload: validPayload(fx) }),
    mutation: {
      module: "ceremony-plan",
      match: 'if (command.flags.has("at") && !Object.hasOwn(given, "at")) supplied.at = at;',
      replace: "/* STORY-183 MUTATION: at auto-supply removed */"
    },
    expect: "pass"
  },

  // ── INC-069: 段内走私 — a refused item smuggled inside a legal payload ───────
  {
    id: "REJ-010",
    target: "INC-069",
    rule: "reserved-expected-version",
    reasonCode: "RESERVED_FLAG_IN_PAYLOAD",
    module: "ceremony-plan",
    witness: "plan-step",
    describe: "a legal payload smuggling --expected-version in one step is refused whole",
    body: (fx) => {
      const payload = validPayload(fx);
      payload.steps[0].flags["expected-version"] = 42;
      return { payload };
    },
    stepForWitness: (fx) => ({ verb: "work-annotate", flags: { id: fx.workId, scope: "x", "expected-version": 42 } }),
    mutation: {
      module: "ceremony-plan",
      match: "if (Object.hasOwn(given, reserved)) {",
      replace: "if (false) { /* STORY-183 MUTATION: reserved-flag rule removed */"
    },
    expect: "refused"
  },
  {
    id: "REJ-011",
    target: "INC-069",
    rule: "reserved-workspace",
    reasonCode: "RESERVED_FLAG_IN_PAYLOAD",
    module: "ceremony-plan",
    witness: "plan-step",
    describe: "a legal payload smuggling --workspace is refused whole",
    body: (fx) => {
      const payload = validPayload(fx);
      payload.steps[0].flags.workspace = "/somewhere/else";
      return { payload };
    },
    stepForWitness: (fx) => ({ verb: "work-annotate", flags: { id: fx.workId, scope: "x", workspace: "/somewhere/else" } }),
    mutation: {
      module: "ceremony-plan",
      match: "if (Object.hasOwn(given, reserved)) {",
      replace: "if (false) { /* STORY-183 MUTATION: reserved-flag rule removed */"
    },
    expect: "refused"
  },
  {
    id: "REJ-012",
    target: "INC-069",
    rule: "reserved-attest-dir",
    reasonCode: "RESERVED_FLAG_IN_PAYLOAD",
    module: "ceremony-plan",
    witness: "plan-step",
    describe: "a legal payload smuggling --attest-dir is refused whole",
    body: (fx) => {
      const payload = validPayload(fx);
      payload.steps[0].flags["attest-dir"] = "/somewhere/else";
      return { payload };
    },
    stepForWitness: (fx) => ({ verb: "work-annotate", flags: { id: fx.workId, scope: "x", "attest-dir": "/somewhere/else" } }),
    mutation: {
      module: "ceremony-plan",
      match: "if (Object.hasOwn(given, reserved)) {",
      replace: "if (false) { /* STORY-183 MUTATION: reserved-flag rule removed */"
    },
    expect: "refused"
  },
  {
    id: "REJ-013",
    target: "INC-069",
    rule: "no-read-verb-in-step",
    reasonCode: "FACADE_WRITE_VERB_NOT_MUTATING",
    module: "facade-write",
    witness: "write-withheld",
    describe: "a read verb smuggled into a step is refused on the write face",
    body: (fx) => ({ payload: { ...validPayload(fx), steps: [{ verb: "work-show", flags: { id: fx.workId } }] } }),
    verbEntryForWitness: { name: "work-show", mutates: false, flags: [{ name: "id", required: true }] },
    mutation: {
      module: "facade-write",
      match: "if (entry?.mutates !== true) {",
      replace: "if (false) { /* STORY-183 MUTATION: not-mutating rule removed */"
    },
    expect: "refused"
  },
  {
    id: "REJ-014",
    target: "INC-069",
    rule: "no-authority-output-in-step",
    reasonCode: "FACADE_WRITE_AUTHORITY_OUTPUT",
    module: "facade-write",
    witness: "write-withheld",
    describe: "an authority-bearing verb smuggled into a step is refused",
    body: (fx) => ({ payload: { ...validPayload(fx), steps: [{ verb: "adapter-activation-record", flags: {} }] } }),
    verbEntryForWitness: { name: "adapter-activation-record", mutates: false, authorityBearing: true, flags: [] },
    mutation: {
      module: "facade-write",
      match: "entry?.authorityBearing === true ? WRITE_AUTHORITY_OUTPUT : WRITE_VERB_NOT_MUTATING",
      replace: "WRITE_VERB_NOT_MUTATING"
    },
    expect: "refused"
  },
  {
    id: "REJ-015",
    target: "INC-069",
    rule: "no-one-shot-verb-in-step",
    reasonCode: "VERB_REQUIRES_OUT_OF_BAND_AUTHORITY",
    module: "ceremony-plan",
    witness: "plan-step",
    describe: "a one-shot authority verb smuggled into a step is refused as its own ceremony",
    body: (fx) => ({ payload: { ...validPayload(fx), steps: [{ verb: "relocation-vacate", flags: {} }] } }),
    stepForWitness: () => ({ verb: "relocation-vacate", flags: {} }),
    mutation: {
      module: "ceremony-plan",
      match: "if (command.requiresOutOfBandAuthority) {",
      replace: "if (false) { /* STORY-183 MUTATION: out-of-band rule removed */"
    },
    expect: "refused"
  },
  {
    id: "REJ-016",
    target: "INC-069",
    rule: "no-fixture-only-in-step",
    reasonCode: "FACADE_WRITE_FIXTURE_ONLY",
    module: "facade-write",
    witness: "write-withheld",
    describe: "a fixture-only verb smuggled into a step is refused",
    body: (fx) => ({ payload: { ...validPayload(fx), steps: [{ verb: "artifact-archive-apply", flags: {} }] } }),
    verbEntryForWitness: { name: "artifact-archive-apply", mutates: true, availability: "fixture-only", flags: [] },
    mutation: {
      module: "facade-write",
      match: 'if (entry?.availability === "fixture-only") {',
      replace: "if (false) { /* STORY-183 MUTATION: fixture-only rule removed */"
    },
    expect: "refused"
  },
  {
    id: "REJ-017",
    target: "INC-069",
    rule: "flag-defined-by-verb",
    reasonCode: "FLAG_NOT_DEFINED_BY_VERB",
    module: "ceremony-plan",
    witness: "plan-step",
    describe: "an undeclared flag smuggled into a step is refused, naming the flag",
    body: (fx) => {
      const payload = validPayload(fx);
      payload.steps[0].flags["no-such-flag"] = "x";
      return { payload };
    },
    stepForWitness: (fx) => ({ verb: "work-annotate", flags: { id: fx.workId, scope: "x", "no-such-flag": "x" } }),
    mutation: {
      module: "ceremony-plan",
      match: "if (!command.flags.has(name)) {",
      replace: "if (false) { /* STORY-183 MUTATION: undefined-flag rule removed */"
    },
    expect: "refused"
  },
  {
    id: "REJ-018",
    target: "INC-069",
    rule: "required-flag-present",
    reasonCode: "REQUIRED_FLAG_MISSING",
    module: "ceremony-plan",
    witness: "plan-step",
    describe: "a step missing a required flag is refused, naming the flag",
    body: (fx) => ({ payload: { ...validPayload(fx), steps: [{ verb: "work-annotate", flags: {} }] } }),
    stepForWitness: () => ({ verb: "work-annotate", flags: {} }),
    mutation: {
      module: "ceremony-plan",
      match: "if (missing.length > 0) {",
      replace: "if (false) { /* STORY-183 MUTATION: required-flag rule removed */"
    },
    expect: "refused"
  },
  {
    id: "REJ-019",
    target: "INC-069",
    rule: "verb-in-catalogue",
    reasonCode: "VERB_NOT_IN_CATALOGUE",
    module: "ceremony-plan",
    witness: "plan-step",
    describe: "a verb absent from the host catalogue is refused, never guessed",
    body: (fx) => ({ payload: { ...validPayload(fx), steps: [{ verb: "no-such-verb", flags: {} }] } }),
    stepForWitness: () => ({ verb: "no-such-verb", flags: {} }),
    mutation: {
      module: "ceremony-plan",
      match: 'if (!command) return refuse("VERB_NOT_IN_CATALOGUE"',
      replace: 'if (false) return refuse("VERB_NOT_IN_CATALOGUE"'
    },
    expect: "refused"
  },
  {
    id: "REJ-020",
    target: "INC-069",
    rule: "readback-expectation-resolvable",
    reasonCode: "EXPECTATION_UNRESOLVABLE",
    module: "ceremony-plan",
    witness: "plan-readback",
    describe: "a read-back pointing at a step that does not exist cannot prove the write",
    body: (fx) => {
      const payload = validPayload(fx, "unresolvable-scope");
      payload.readback[0].expectSameAs = [{ field: "scope", step: 9, flag: "scope" }];
      return { payload };
    },
    readbackForWitness: {
      verb: "work-show",
      flags: { id: "x" },
      expectSameAs: [{ field: "scope", step: 9, flag: "scope" }]
    },
    mutation: {
      module: "ceremony-plan",
      match: "problems.push(`expectSameAs cannot resolve steps[${reference.step}].flags.${reference.flag}`);",
      replace: "/* STORY-183 MUTATION: expectation-resolution rule removed */"
    },
    expect: "refused"
  },

  // ── INC-069: 两侧判决函数统一 — the two faces judge with the SAME code ──────
  {
    id: "REJ-030",
    target: "INC-069",
    rule: "one-shot-judged-identically-both-sides",
    reasonCode: "VERB_REQUIRES_OUT_OF_BAND_AUTHORITY",
    module: "ceremony-plan",
    witness: "both-sides",
    describe: "the facade and the local ceremony refuse the one-shot family with the SAME reason code",
    body: (fx) => ({ payload: { ...validPayload(fx), steps: [{ verb: "relocation-vacate", flags: {} }] } }),
    stepForWitness: () => ({ verb: "relocation-vacate", flags: {} }),
    mutation: {
      module: "ceremony-plan",
      match: "if (command.requiresOutOfBandAuthority) {",
      replace: "if (false) { /* STORY-183 MUTATION: out-of-band rule removed */"
    },
    expect: "refused"
  },
  {
    id: "REJ-031",
    target: "INC-069",
    rule: "reserved-judged-identically-both-sides",
    reasonCode: "RESERVED_FLAG_IN_PAYLOAD",
    module: "ceremony-plan",
    witness: "both-sides",
    describe: "the facade and the local ceremony refuse a reserved flag with the SAME reason code",
    body: (fx) => {
      const payload = validPayload(fx);
      payload.steps[0].flags["expected-version"] = 42;
      return { payload };
    },
    stepForWitness: (fx) => ({ verb: "work-annotate", flags: { id: fx.workId, scope: "x", "expected-version": 42 } }),
    mutation: {
      module: "ceremony-plan",
      match: "if (Object.hasOwn(given, reserved)) {",
      replace: "if (false) { /* STORY-183 MUTATION: reserved-flag rule removed */"
    },
    expect: "refused"
  },

  // ── INC-064: dryRun / partition pass-through mutations ─────────────────────
  {
    id: "REJ-040",
    target: "INC-064",
    rule: "dry-run-sends-nothing",
    reasonCode: "CEREMONY_PLANNED_ONLY",
    module: "facade-write",
    witness: "http",
    describe: "a dry-run plans everything, sends nothing, and does not advance the chain",
    body: (fx) => ({ payload: validPayload(fx), dryRun: true }),
    mutation: {
      module: "facade-write",
      match: "if (dryRun) {",
      replace: "if (false && dryRun) {",
      replaceAll: true
    },
    expect: "pass"
  },
  {
    id: "REJ-041",
    target: "INC-064",
    rule: "partition-routing",
    reasonCode: "CEREMONY_COMPLETED_AND_READ_BACK",
    module: "facade-write",
    witness: "http",
    describe: "a write for a partition lands on THAT partition's chain, never a neighbour's",
    body: (fx) => ({ payload: validPayload(fx), partition: "P2" }),
    mutation: {
      module: "facade-write",
      match: "workspace: context.workspaces[partition],",
      replace: "workspace: Object.values(context.workspaces)[0],"
    },
    expect: "pass"
  },
  {
    id: "REJ-042",
    target: "INC-064",
    rule: "partition-known",
    reasonCode: "MCP_PARTITION_UNKNOWN",
    module: "facade-write",
    witness: "http",
    describe: "an unknown partition is refused by name, before anything is sent",
    body: (fx) => ({ payload: validPayload(fx), partition: "no-such-partition" }),
    mutation: {
      module: "facade-write",
      match: 'if (typeof partition !== "string" || !Object.hasOwn(context.workspaces, partition)) {',
      replace: "if (false) { /* STORY-183 MUTATION: partition-validity rule removed */"
    },
    expect: "refused"
  }
];

/** A fresh catalogueIndex of the local engine's own commands, for the planStep side. */
export async function liveCatalogueIndex() {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const { stdout } = await run("node", [LOCAL_ENGINE_SCRIPTS(), "commands"], { maxBuffer: 64 * 1024 * 1024 });
  const json = JSON.parse(stdout);
  return catalogueIndex(json.commands ?? json.result?.commands ?? []);
}

/**
 * The `scope` advisory of a record, read from the engine directly. The partition-
 * routing proof uses this instead of the receipt's (host-scrubbed) workspace path:
 * a ceremony for partition P must leave its annotate on P's OWN record, so after a
 * routed write the scope is where the write actually landed.
 */
export function recordScope(workspace, workId) {
  const out = execFileSync("node", engineArgs("work-show", { workspace, id: workId }), { encoding: "utf8" });
  const json = JSON.parse(out);
  return json.advisory?.scope ?? json.record?.scope ?? null;
}
