#!/usr/bin/env node
// Assemble evidence/aos-relocation-rehearsal.json from the stage receipts.
//
// Redaction runs in two layers and both are asserted, not hoped for:
//   1. the rehearsal's own roots (session scratchpad, governed copy, repo) are
//      replaced with structural placeholders — a path that never leaves this
//      machine has no business in a receipt that does;
//   2. `scripts/lib/evidence-hygiene.mjs` scrubs anything left, and the emitter
//      then re-scans its own output and refuses to write if a host path survived.

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  LOCAL_ENGINE, REPO_ROOT, SCRATCHPAD, STATE_DIR, VM_ENGINE, VM_HOST,
  instant, loadState, hasState, sha256Text, ssh
} from "./relocation-lib.mjs";

const hygiene = await import(pathToFileURL(resolve(REPO_ROOT, "scripts/lib/evidence-hygiene.mjs")).href);

const REPLACEMENTS = [
  [SCRATCHPAD, "<local-scratch-root>"],
  [LOCAL_ENGINE, "<local-governed-copy>"],
  [REPO_ROOT, "<repo-root>"]
].sort((a, b) => b[0].length - a[0].length);

function redact(value) {
  if (typeof value === "string") {
    let text = value;
    for (const [from, to] of REPLACEMENTS) text = text.split(from).join(to);
    return text;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [redact(key), redact(entry)]));
  }
  return value;
}

const paths = loadState("paths");
const prepare = loadState("prepare");
const vacate = loadState("vacate");
const transfer = loadState("transfer");
const adopt = loadState("adopt");
const verify = loadState("verify");
const closeout = loadState("closeout");
const abort = loadState("abort");
const teardown = hasState("teardown") ? loadState("teardown") : null;

const localEngineVersion = JSON.parse(readFileSync(join(LOCAL_ENGINE, "package.json"), "utf8")).version;
const vmEngineVersion = (await ssh(["sh", "-c",
  `'node -e "process.stdout.write(require(\\"${VM_ENGINE}/package.json\\").version)"'`])).stdout.trim();

const receipt = {
  schemaVersion: "aos.relocation-rehearsal.v1",
  story: "TCRN-AOS-STORY-130",
  direction: "TCRN-AOS-MIN-012 — engine and chains relocate to the AOS host; this machine becomes a pure client; no authoritative artefact stays local",
  recordedAt: instant(),
  authorization:
    "本证物不含授权。这是一次性链上的搬迁彩排,不搬迁、不发布、不迁移任何真值;真值链(.tcrn-workspace/*)在本阶段只读,任何 mutating 动词(含搬迁动词)一律未对其执行。",
  containment: {
    liveChainsTouched: "none — no mutating verb was pointed at .tcrn-workspace/* at any point",
    localWrites: "<local-scratch-root>/relocation-rehearsal-* and <local-scratch-root>/relocation-abort-drill-* only",
    vmWrites: "/srv/tcrn/scratch-relocation-* only",
    predicate: "assertScratchWorkspace() is asserted on every mutating engine call on both hosts; it is a refusal, not a convention",
    worktrees: "none created in any repository"
  },
  instruments: {
    localGovernedCopy: { locator: "<local-governed-copy>", version: localEngineVersion },
    vmEngine: { host: VM_HOST, path: VM_ENGINE, version: vmEngineVersion },
    versionsAgree: localEngineVersion === vmEngineVersion,
    relocationVerbs: ["relocation-plan", "relocation-vacate", "relocation-adopt", "relocation-abort", "relocation-inspect"],
    adr: "tcrn-workflow docs/adr/0003-workspace-relocation.md (accepted, WSR-1, v0.9.0)"
  },
  arc: {
    source: { host: "this machine", role: "vacated" },
    destination: { host: VM_HOST, role: "adopted" },
    relocationId: paths.relocationId,
    workspaceId: paths.workspaceId,
    order: ["relocation-plan", "mint vacate permit (source host)", "mint adopt permit (destination host)",
      "relocation-vacate", "operator moves the bytes", "relocation-adopt",
      "two-sided relocation-inspect close-out"]
  },
  stages: {
    prepare: redact(prepare),
    vacate: redact(vacate),
    transfer: redact(transfer),
    adopt: redact(adopt),
    verify: redact(verify),
    closeout: redact(closeout),
    abortDrill: redact(abort)
  },
  twoSidedCloseout: redact(closeout.verdict),
  matrix: redact(verify.matrix),
  teardown: teardown ? redact(teardown) : null,
  findings: [
    {
      id: "F1",
      finding: "The plain CLI `snapshot-verify` can NEVER be green against a vacate-time control manifest.",
      why: "`relocation-plan`/`relocation-vacate` compute the manifest under the lease BEFORE appending the ledger entry, and appending it rewrites `workspace.json`. The vacate is therefore the last writer of the one file its own manifest describes.",
      measured: "the CLI verb answers SNAPSHOT_MISMATCH naming exactly one file — `workspace.json` — while the engine's own verifySnapshotManifest(..., { excludePaths: ['workspace.json'] }), which is literally the call relocation-adopt makes, answers SNAPSHOT_VERIFIED.",
      consequenceForTheRunbook: "a runbook step that says 'run snapshot-verify after the vacate and expect SNAPSHOT_VERIFIED' would be a step that can only ever fail. State the exclusion, or state that the single named file IS the expected delta."
    },
    {
      id: "F2",
      finding: "Copy-first (adopt before vacate) is refused with WORKSPACE_RELOCATION_NOT_PENDING, not with a root-identity error.",
      why: "a pre-vacate copy carries no `relocations` field at all, so `readMetadata`'s relocation admission never runs; adopt then finds no trailing hop.",
      note: "the ordering is enforced, which is what matters — but an operator diagnosing the failure will be told 'nothing to adopt' rather than 'this tree is not bound here', and the runbook should say so."
    },
    {
      id: "F3",
      finding: "The relocation authority document's permits must be in the engine's canonical order (`actorId relocationId stage`), or the document is refused as WORKSPACE_RELOCATION_AUTHORITY_MALFORMED before any permit is matched.",
      measured: "a document listing vacate before abort for one hop was refused with reason `permits order`; the same permits sorted admitted cleanly.",
      consequenceForTheRunbook: "mint every authority through the engine's own `canonicalRelocationAuthority` — a hand-written document that looks correct will be rejected on ordering alone."
    },
    {
      id: "F4",
      finding: "The ledger cap is spent by ATTEMPTS. The abort drill's hop moved zero bytes and permanently consumed two of sixteen ledger entries.",
      measured: "relocation-inspect reports ledgerEntriesRemaining 14 at the revived source; there is no compaction verb and deliberately will not be one.",
      consequenceForTheRealHop: "the real all-partition relocation must be planned against a budget of eight attempts per workspace, and rehearsals must never be run on the real chains."
    }
  ],
  ceilings: [
    "This mechanism cannot prevent a fork; it can only make one legible at the two addresses its ledger names. Every claim stronger than that is false.",
    "The two-sided close-out proven here is a statement about TWO ADDRESSES ON THE HOSTS WHERE IT RAN, never about the relocationId globally: one adopt permit presented at the same destination path on N hosts yields N live authorities and the close-out passes at every one of them (ADR 0003 ceiling 4).",
    "`workspace.json` is the one part of the control tree the event hash chain does not cover. Anyone with write access to a vacated source can restore its pre-vacate bytes and the address is fully alive again; the engine cannot detect this.",
    "The abort-stage permit and its vacateCommitmentSha256 are a review device, not a barrier: they buy two documents and two approvals where there was one. This rehearsal measured exactly that and claims nothing more.",
    "This rehearsal proves the CEREMONY is executable. It does not authorize the real hop, and it says nothing about a chain whose export exceeds the engine's one-MiB ceiling or whose partitions share the framework and release-trust roots — the OD-D sequencing question is named in ADR 0003 and is not exercised here."
  ]
};

const scrubbed = hygiene.scrubHostPaths(receipt);
const text = `${JSON.stringify(scrubbed, null, 2)}\n`;
const survivors = hygiene.findHostPaths(text);
if (survivors.length > 0) {
  console.error(JSON.stringify({ ok: false, reasonCode: "EVIDENCE_HYGIENE_HOST_PATH_SURVIVED", survivors }, null, 2));
  process.exit(1);
}
const target = resolve(REPO_ROOT, "evidence/aos-relocation-rehearsal.json");
writeFileSync(target, text);
console.log(JSON.stringify({
  ok: true, target: "evidence/aos-relocation-rehearsal.json",
  bytes: Buffer.byteLength(text, "utf8"), sha256: sha256Text(text),
  hostPathsSurviving: survivors.length
}, null, 2));
