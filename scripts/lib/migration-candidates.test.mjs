import test from "node:test";
import assert from "node:assert/strict";
import { selectMigrationCandidates, FORWARD, BACKWARD } from "./migration-candidates.mjs";

/**
 * The migration candidate selection policy, judged as a unit.
 *
 * This policy used to live inline in scripts/mirror-acceptance-proof.mjs, where
 * no test could reach it: an adversarial review inverted the kind exclusion
 * (`!== "Initiative"` to `===`) and the whole suite stayed green. These tests
 * exist so that exact mutation — and its neighbours on the partition and status
 * predicates — go red.
 *
 * ORPHANED CALLER, stated rather than left to be discovered. That acceptance
 * proof was retired with the mirror segment (TCRN-AOS-STORY-134) and it was the
 * policy's only caller, so `selectMigrationCandidates` is now a tested library
 * nothing invokes. It is kept rather than deleted because the question it answers
 * — which chain records are legally movable forward, without mirroring the
 * engine's state machine — is the question any future write-surface acceptance
 * will ask, and the paid-for lesson in these cases is not cheap to re-derive. It
 * is a candidate for deletion the moment somebody decides that future is not
 * coming; leaving it undeclared is the part that would not be acceptable.
 */

const row = (overrides) => ({
  id: "work:0000000000000000000000aa",
  externalKey: "TCRN-AOS-STORY-001",
  partitionId: "TCRN-AOS",
  kind: "Story",
  status: "planned",
  ...overrides
});

test("a non-Initiative record in a movable status is selected, with the forward move derived", () => {
  const selected = selectMigrationCandidates([row({ status: "active" })], "TCRN-AOS");
  assert.deepEqual(selected, [{
    recordId: "work:0000000000000000000000aa",
    externalKey: "TCRN-AOS-STORY-001",
    from: "active",
    to: "done"
  }]);
});

test("an Initiative is excluded even when its status would otherwise be movable", () => {
  // The exclusion is the ruling's, not an accident of data: the top of the work
  // tree stays out of a proof that permanently advances a real record.
  const selected = selectMigrationCandidates(
    [row({ kind: "Initiative", externalKey: "TCRN-AOS-INIT-001", status: "planned" })], "TCRN-AOS");
  assert.deepEqual(selected, []);
});

test("kind decides between two otherwise identical rows: the Story is in, the Initiative is out", () => {
  // Both sides of the kind predicate in one observation, so inverting the
  // comparison cannot survive by trading one assertion against another.
  const selected = selectMigrationCandidates([
    row({ id: "work:0000000000000000000000ab", externalKey: "TCRN-AOS-INIT-001", kind: "Initiative" }),
    row({ id: "work:0000000000000000000000ac", externalKey: "TCRN-AOS-STORY-002", kind: "Story" })
  ], "TCRN-AOS");
  assert.deepEqual(selected.map((entry) => entry.externalKey), ["TCRN-AOS-STORY-002"]);
});

test("terminal-status rows and rows of other partitions are not candidates", () => {
  const selected = selectMigrationCandidates([
    row({ id: "work:0000000000000000000000ad", status: "done" }),
    row({ id: "work:0000000000000000000000ae", partitionId: "TCRN-DS", externalKey: "TCRN-DS-STORY-001" })
  ], "TCRN-AOS");
  assert.deepEqual(selected, []);
});

test("absent work rows select nothing rather than throwing", () => {
  assert.deepEqual(selectMigrationCandidates(undefined, "TCRN-AOS"), []);
});

test("the forward and backward edge maps are mutual inverses over the movable states", () => {
  for (const [from, to] of Object.entries(FORWARD)) {
    assert.equal(BACKWARD[to], from, `BACKWARD must undo FORWARD's ${from}->${to}`);
  }
});
