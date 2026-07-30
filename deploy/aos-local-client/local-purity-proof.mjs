#!/usr/bin/env node
// The real-machine run of the zero-artefact predicate (TCRN-AOS-STORY-133).
//
//   node deploy/aos-local-client/local-purity-proof.mjs
//        [--scratch <dir>]            also perform the revival red on a scratch copy
//        [--ceremony-receipt <file>]  fold a ceremony receipt into the artifact
//        [--emit]                     write evidence/aos-local-pure-client.json
//
// WHAT THIS RUN IS FOR. `local-purity-predicates.test.mjs` proves the judgement is
// right about data; it cannot say anything about THIS laptop, because a test file may
// not read a home directory. So the judgement is exercised twice, against two
// different kinds of input, and neither run can stand in for the other:
//
//   - the test roster judges literals, every time `pnpm test` runs;
//   - this script judges the machine, and asserts BOTH DIRECTIONS in the same run.
//
// BOTH DIRECTIONS, because this platform has shipped gates that could not fail (two
// sides sharing one inode; a fixture that could not go wrong; a predicate that
// measured whether some prose mentioned an address). A green reading on its own is
// not evidence that a green means anything. So one invocation records:
//
//   GREEN   the machine as it stands — the AOS archive dead on both faces, three
//           permitted partitions live — must satisfy the predicate;
//   RED 1   the roster tightened to home=vm for all four, judged over the SAME
//           observation, must fail and must name the three partitions still here;
//   RED 2   a live workspace belonging to no rostered partition must fail on its own,
//           so that deleting a roster row cannot make a finding disappear;
//   RED 3   (only with --scratch) the archive REVIVED per ADR 0003 ceiling 2 on a
//           disposable copy must fail. This is the expensive one and the only one
//           that touches a filesystem, which is why it is opt-in.
//
// WHY RED 3 IS OPT-IN AND THE OTHERS ARE NOT. It needs a directory that is safe to
// build a live governed workspace inside, and choosing that directory is not a
// decision a script invoked from `pnpm verify` gets to make on the way past — the
// containment assertion in red-proof.mjs is only worth anything if a person named the
// prefix it checks against. So the cheap three run always and gate `verify`; the
// revival is run by hand and its result is recorded in the artifact under
// `revivalRed`, with `ran: false` stated plainly when it was not performed. A section
// that quietly vanishes when it does not run is how "we proved that once" becomes
// unfalsifiable.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ARCHIVED_WORKSPACE, LOCAL_LIVE_PARTITIONS, PARTITION_ROSTER, RELOCATED_PARTITIONS,
  REPO_ROOT, SCAN_CEILING, WORKSPACE_CONTAINER
} from "./topology.mjs";
import { observeLocalHost } from "./scan-local.mjs";
import { judgeLocalPurity, judgeScanScope } from "./local-purity-predicates.mjs";
import { runRedProof, runTighteningRedProof, runUnattributedRedProof } from "./red-proof.mjs";
import { scrubHostPaths } from "../../scripts/lib/evidence-hygiene.mjs";

export const EVIDENCE_PATH = join(REPO_ROOT, "evidence/aos-local-pure-client.json");

const sha256Text = (text) => createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/**
 * The whole run, as one value.
 *
 * `ok` is the AND of every expectation, and each expectation is stated next to the
 * measurement that satisfies it rather than in a summary line further down — a summary
 * that is maintained separately from what it summarises is the thing that drifts.
 */
export async function runLocalPurityProof({ scratchpad = null, ceremonyReceiptPath = null } = {}) {
  const observation = await observeLocalHost();
  const scope = judgeScanScope({
    containerExists: observation.containerExists,
    rootsWalked: observation.rootsWalked,
    partitionsFoundLive: observation.partitionsFoundLive,
    roster: PARTITION_ROSTER
  });
  const green = judgeLocalPurity({ trees: observation.trees, roster: PARTITION_ROSTER, scope });

  const tighteningRed = runTighteningRedProof(observation);
  const unattributedRed = runUnattributedRedProof();

  const revivalRed = scratchpad === null
    ? {
      ran: false,
      why: "no --scratch was named. The revival builds a LIVE governed workspace on disk, so "
        + "the prefix it is contained to must be chosen by a person, not defaulted by a script.",
      howToRun: "node deploy/aos-local-client/local-purity-proof.mjs --scratch <disposable dir> --emit"
    }
    : { ran: true, ...await runRedProof({ scratchpad }) };

  const ceremonyWrite = ceremonyReceiptPath === null
    ? { folded: false, why: "no --ceremony-receipt was named" }
    : foldCeremonyReceipt(ceremonyReceiptPath);

  // The archive is named in the artifact by its own identity terms and by the engine's
  // verdict on it, never by "we left it alone". The point of retaining it is that it is
  // still readable as the source side of the hop (ARCHIVED.md §三), and a receipt that
  // only says "absent/present" cannot show that.
  const archiveRow = green.verdicts.find((verdict) =>
    verdict.partitionId === "TCRN-AOS" && verdict.address === resolve(ARCHIVED_WORKSPACE)) ?? null;

  const expectations = [
    { id: "GREEN_ON_THIS_MACHINE", met: green.ok === true,
      expected: "LOCAL_HOST_HOLDS_NO_AWAY_PARTITION_ARTEFACT", observed: green.reasonCode },
    { id: "SCOPE_ESTABLISHED", met: scope.ok === true,
      expected: "SCAN_SCOPE_ESTABLISHED", observed: scope.reasonCode },
    { id: "ARCHIVE_DEAD_ON_BOTH_FACES", met: archiveRow?.reasonCode === "ARCHIVE_RETAINED_AND_DEAD",
      expected: "ARCHIVE_RETAINED_AND_DEAD", observed: archiveRow?.reasonCode ?? "ARCHIVE_ROW_NOT_FOUND" },
    { id: "THREE_PERMITTED_PARTITIONS_LIVE", met: green.counts.permittedLiveTrees === LOCAL_LIVE_PARTITIONS.length,
      expected: LOCAL_LIVE_PARTITIONS.length, observed: green.counts.permittedLiveTrees },
    { id: "RED_WHEN_ROSTER_TIGHTENED", met: tighteningRed.wentRed === true,
      expected: "AWAY_PARTITION_ARTEFACT_PRESENT_ON_LOCAL_HOST", observed: tighteningRed.reasonCode },
    { id: "TIGHTENING_NAMES_THE_THREE",
      met: tighteningRed.namedLivePartitions.join("/") === [...LOCAL_LIVE_PARTITIONS].sort().join("/"),
      expected: [...LOCAL_LIVE_PARTITIONS].sort(), observed: tighteningRed.namedLivePartitions },
    { id: "RED_ON_AN_UNROSTERED_LIVE_TREE", met: unattributedRed.wentRed === true,
      expected: "UNATTRIBUTED_TREE_IS_LIVE", observed: unattributedRed.reasonCode }
  ];
  if (revivalRed.ran) {
    expectations.push(
      { id: "RED_WHEN_THE_ARCHIVE_IS_REVIVED", met: revivalRed.wentRed === true,
        expected: "AWAY_PARTITION_ARTEFACT_PRESENT_ON_LOCAL_HOST", observed: revivalRed.reasonCode },
      { id: "PERMITTED_PARTITIONS_UNAFFECTED_BY_THE_RED",
        met: revivalRed.permittedPartitionsStayedGreen === true,
        expected: true, observed: revivalRed.permittedPartitionsStayedGreen },
      { id: "REAL_ARCHIVE_UNTOUCHED_BYTE_FOR_BYTE",
        met: revivalRed.realArchiveUntouched.equal === true,
        expected: true, observed: revivalRed.realArchiveUntouched.equal },
      { id: "REVIVAL_REMOVED", met: revivalRed.scratchRemoved === true,
        expected: true, observed: revivalRed.scratchRemoved });
  }
  if (ceremonyWrite.folded) {
    expectations.push(
      { id: "CEREMONY_WROTE_AND_READ_BACK", met: ceremonyWrite.ok === true,
        expected: "CEREMONY_COMPLETED_AND_READ_BACK", observed: ceremonyWrite.reasonCode },
      { id: "CEREMONY_WAS_NOT_A_DRY_RUN", met: ceremonyWrite.dryRun === false,
        expected: false, observed: ceremonyWrite.dryRun },
      { id: "CEREMONY_ADVANCED_THE_REAL_CHAIN", met: (ceremonyWrite.eventsAppended ?? 0) > 0,
        expected: "> 0", observed: ceremonyWrite.eventsAppended ?? 0 });
  }

  const unmet = expectations.filter((entry) => entry.met !== true).map((entry) => entry.id);

  return {
    schemaVersion: "aos.local-pure-client-proof.v1",
    story: "TCRN-AOS-STORY-133",
    ruling: "TCRN-AOS-MIN-012 direction D — AOS carries the operating face, not the store",
    ok: unmet.length === 0,
    reasonCode: unmet.length === 0 ? "LOCAL_HOST_IS_A_PURE_CLIENT" : "LOCAL_PURITY_PROOF_INCOMPLETE",
    unmetExpectations: unmet,
    expectations,
    claim: {
      predicate: "本机不得留有任何「真值已迁走」分区的活控制树;仍以本机为家的分区其活树是资产,不是缺陷。",
      judgedPerPartition: true,
      awayPartitions: [...RELOCATED_PARTITIONS],
      permittedLocalPartitions: [...LOCAL_LIVE_PARTITIONS],
      whereTheJudgementLives: "deploy/aos-local-client/local-purity-predicates.mjs (in the pnpm test roster)",
      whereTheObservationLives: "deploy/aos-local-client/scan-local.mjs (needs a disk and the engine)"
    },
    observation: {
      observedAt: observation.observedAt,
      engineRoot: observation.engineRoot,
      workspaceContainer: WORKSPACE_CONTAINER,
      containerExists: observation.containerExists,
      rootsWalked: observation.rootsWalked,
      controlTreesFound: observation.trees.length,
      nonWorkspaceCandidates: observation.nonWorkspaceCandidates,
      trees: observation.trees,
      ceiling: SCAN_CEILING
    },
    green: { scope, verdict: green },
    tighteningRed,
    unattributedRed,
    revivalRed,
    ceremonyWrite,
    tightening: green.tightening
  };
}

/**
 * A ceremony receipt, folded in as a summary rather than whole.
 *
 * Whole would be worse, not better: the receipt carries the full scope text twice (as
 * the flag that was sent and as the value that was read back), and a second copy of
 * that inside this artifact would make the two files drift the first time either is
 * regenerated. What is kept is what cannot be re-derived — the chain versions either
 * side of the write, the record id, the read-back's field-by-field verdict — plus the
 * receipt's own digest, which is how the summary is tied to a specific receipt.
 */
export function foldCeremonyReceipt(path) {
  const text = readFileSync(path, "utf8");
  const receipt = JSON.parse(text);
  const step = receipt.steps?.[0] ?? null;
  const readback = receipt.readback?.[0] ?? null;
  return {
    folded: true,
    ok: receipt.ok === true,
    reasonCode: receipt.reasonCode ?? null,
    dryRun: receipt.dryRun === true,
    receiptSha256: sha256Text(text),
    host: receipt.host ?? null,
    topology: receipt.topology ?? null,
    hostEngineCatalogue: receipt.hostEngineCatalogue ?? null,
    chainBefore: receipt.chainBefore ?? null,
    chainAfter: receipt.chainAfter ?? null,
    eventsAppended: receipt.eventsAppended ?? null,
    write: step === null ? null : {
      verb: step.verb,
      mutates: step.mutates === true,
      executed: step.executed === true,
      accepted: step.accepted === true,
      reasonCode: step.reasonCode ?? null,
      headAtPlanning: step.headAtPlanning ?? null,
      autoSupplied: step.autoSupplied ?? [],
      fromPayload: step.fromPayload ?? []
    },
    readback: readback === null ? null : {
      verb: readback.verb,
      accepted: readback.accepted === true,
      reasonCode: readback.reasonCode ?? null,
      verdict: readback.verdict === undefined || readback.verdict === null ? null : {
        ok: readback.verdict.ok === true,
        reasonCode: readback.verdict.reasonCode ?? null,
        unequal: readback.verdict.unequal ?? [],
        // Field by field, as a DIGEST pair rather than a value pair. The comparison
        // itself was full-value and it happened in the ceremony, where both sides were
        // in hand; what this artifact has to carry is which fields were compared and
        // whether they matched. Carrying the values would put the 1000-character scope
        // in this file twice more, and a scope that lives in four places is a scope
        // that will disagree with itself.
        compared: (readback.verdict.compared ?? []).map((entry) => ({
          field: entry.field,
          equal: entry.equal === true,
          expectedSha256: sha256Text(String(entry.expected)),
          observedSha256: sha256Text(String(entry.observed)),
          characters: String(entry.observed ?? "").length
        }))
      }
    },
    // Named here because it is the one thing the receipt proves that nothing else in
    // this artifact can: the write was performed FROM this laptop, against the chain
    // on the host that now owns it, and the value was read back full-value afterwards.
    whatWasProven:
      "本机作为纯客户端仍能对已迁走的真链做受治写:仪式从一处拓扑取五值、按主机引擎自己的 commands 名录校验载荷、"
      + "以写前现读的 --expected-version 作哨兵,写入后经 work-show 逐字段全值回读。写面在 VM,发起在本机。"
  };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  const result = await runLocalPurityProof({
    scratchpad: argument("scratch") ?? null,
    ceremonyReceiptPath: argument("ceremony-receipt")
      ? resolve(argument("ceremony-receipt"))
      : null
  });
  // Scrubbed before it is printed as well as before it is written. The scan's rows are
  // absolute local paths by construction — that is what an address is — so the console
  // copy of this artifact must not be the clean one only by accident of where it went.
  const artifact = scrubHostPaths(result);
  const text = `${JSON.stringify(artifact, null, 2)}\n`;
  if (process.argv.includes("--emit")) {
    mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
    writeFileSync(EVIDENCE_PATH, text);
  }
  process.stdout.write(text);
  if (result.ok !== true) process.exitCode = 1;
  if (!existsSync(WORKSPACE_CONTAINER)) process.exitCode = 1;
}
