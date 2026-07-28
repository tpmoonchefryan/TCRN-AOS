// Unit tests for the consistency-matrix driver's pure judgment layer
// (EPIC-033). These need no engine, no chain, and no build: they pin the
// three-state cell logic (equal / mismatch / not-applicable-declared), the
// closure of the n/a whitelist, and the evidence-hygiene scrubber — the
// pieces whose failure modes are silent rather than loud.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  ALL_CELLS, FORBIDDEN_NA_CELLS,
  judgeCell, assertWhitelistClosure, whitelistLookup, WHITELIST_PREDICATES,
  streamDigest, fileSetDigest, scrubAbsolutePaths, sha256Text
} from "./run-matrix.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const whitelist = JSON.parse(readFileSync(resolve(here, "na-whitelist.json"), "utf8"));

test("matrix cell grid is exactly 5x4", () => {
  assert.equal(ALL_CELLS.length, 20);
  assert.equal(new Set(ALL_CELLS).size, 20);
  // R1/R3 acceptance gates: 8 cells, all present in the forbidden list.
  assert.equal(FORBIDDEN_NA_CELLS.length, 8);
  for (const cell of FORBIDDEN_NA_CELLS) {
    assert.ok(cell.startsWith("R1") || cell.startsWith("R3"));
  }
});

test("judgeCell: equal only when both sides ok and full digests match", () => {
  const digest = sha256Text("x");
  assert.equal(judgeCell({ cell: "R1C1", fDigest: digest, aDigest: digest }).verdict, "equal");
  const red = judgeCell({ cell: "R1C1", fDigest: digest, aDigest: sha256Text("y"), reasonCodeOnRed: "EVENT_STREAM_BYTES_DIVERGENT" });
  assert.equal(red.verdict, "mismatch");
  assert.equal(red.reasonCodeOnRed, "EVENT_STREAM_BYTES_DIVERGENT");
  // Same digests but a failed side predicate still cannot be green.
  assert.equal(judgeCell({ cell: "R1C1", fDigest: digest, aDigest: digest, aOk: false }).verdict, "mismatch");
  // A missing digest is unjudgeable, not silently equal.
  assert.equal(judgeCell({ cell: "R1C1", fDigest: digest, aDigest: null }).verdict, "mismatch");
});

test("judgeCell: execution-time n/a outside any authority is a MISMATCH", () => {
  const cell = judgeCell({
    cell: "R2C1",
    notApplicable: { authorized: false, reason: "operator felt like skipping it" }
  });
  assert.equal(cell.verdict, "mismatch");
  assert.equal(cell.reasonCodeOnRed, "NA_OUT_OF_WHITELIST");
});

test("judgeCell: authorized n/a is recorded with its authority, not as a pass", () => {
  const cell = judgeCell({
    cell: "R4C1",
    notApplicable: { authorized: true, reason: "mirror holds no views documents", authority: "na-whitelist:NA-R4C1-MIRROR-NO-VIEWS" }
  });
  assert.equal(cell.verdict, "not-applicable-declared");
  assert.equal(cell.naAuthority, "na-whitelist:NA-R4C1-MIRROR-NO-VIEWS");
});

test("the shipped na-whitelist passes closure", () => {
  assert.equal(assertWhitelistClosure(whitelist), whitelist);
  // Every predicate referenced actually exists in the closed predicate set.
  for (const entry of whitelist.entries) {
    assert.ok(entry.predicateId in WHITELIST_PREDICATES, entry.predicateId);
  }
});

test("closure rejects any entry that touches an R1/R3 A-side acceptance gate", () => {
  for (const forbidden of ["R1C1", "R1C3", "R3C3", "R3C4"]) {
    const poisoned = {
      ...whitelist,
      entries: [...whitelist.entries, {
        id: `NA-POISON-${forbidden}`,
        cells: [forbidden],
        predicateId: "mirror-holds-no-views-documents",
        structuralAbsence: "an attempt to declare an acceptance gate away",
        executablePredicate: "always"
      }]
    };
    assert.throws(() => assertWhitelistClosure(poisoned), /acceptance gate/u);
  }
});

test("closure rejects unfrozen, structurally silent, or predicate-less entries", () => {
  assert.throws(() => assertWhitelistClosure({ ...whitelist, frozen: false }), /frozen/u);
  const noStructure = {
    ...whitelist,
    entries: [{ id: "NA-X", cells: ["R4C1"], predicateId: "mirror-holds-no-views-documents", structuralAbsence: "", executablePredicate: "x" }]
  };
  assert.throws(() => assertWhitelistClosure(noStructure), /structuralAbsence/u);
  const unknownPredicate = {
    ...whitelist,
    entries: [{ id: "NA-Y", cells: ["R4C1"], predicateId: "vibes", structuralAbsence: "x", executablePredicate: "x" }]
  };
  assert.throws(() => assertWhitelistClosure(unknownPredicate), /unknown predicateId/u);
});

test("whitelistLookup fires only when the bound predicate is true in context", () => {
  const withAttestation = {
    aContainer: "event-row-mirror", aAttestDirPresent: true, fAttestDirPresent: true,
    attestationEnabledSequence: 2
  };
  // R5C2 has whitelist coverage only through the never-enabled entry, whose
  // predicate is false here — so no entry may fire.
  assert.equal(whitelistLookup(whitelist, "R5C2", withAttestation), null);
  const neverEnabled = { ...withAttestation, attestationEnabledSequence: null };
  assert.equal(whitelistLookup(whitelist, "R5C2", neverEnabled)?.id, "NA-R5-ROW-ATTESTATION-NEVER-ENABLED");
  // R1 cells can never be looked up successfully, whatever the context says.
  assert.equal(whitelistLookup(whitelist, "R1C3", neverEnabled), null);
});

test("no whitelist predicate keys on the A side's own absence (no self-authorized exemption)", () => {
  // The reviewed hole: an entry whose predicate was "the migrated copy is
  // missing" authorized its own n/a. The predicate set must not offer that.
  assert.ok(!("a-attest-dir-input-absent" in WHITELIST_PREDICATES));
  // F-side sidecar present, A-side migrated copy absent: NO entry may fire —
  // that situation is the named mismatch ATTESTATION_SIDECAR_NOT_MIGRATED,
  // judged by the driver, never an n/a.
  const fHasSidecarANone = {
    aContainer: "event-row-mirror", aAttestDirPresent: false, fAttestDirPresent: true,
    attestationEnabledSequence: 2
  };
  assert.equal(whitelistLookup(whitelist, "R5C1", fHasSidecarANone), null);
  assert.equal(whitelistLookup(whitelist, "R5C4", fHasSidecarANone), null);
  // Structural absence proven on the SOURCE side still authorizes.
  const sourceAbsent = { ...fHasSidecarANone, fAttestDirPresent: false };
  assert.equal(whitelistLookup(whitelist, "R5C1", sourceAbsent)?.id, "NA-R5-SIDECAR-SOURCE-DIR-ABSENT");
});

test("the views-absence predicate is falsifiable: a non-mirror container kind defeats it", () => {
  // aContainer is now DERIVED from the opened database's schema; a container
  // that carries more than the mirror table must not satisfy the entry.
  const derivedNonMirror = {
    aContainer: "sqlite:aos_event_mirror,aos_views_snapshot",
    aAttestDirPresent: true, fAttestDirPresent: true, attestationEnabledSequence: 2
  };
  assert.equal(whitelistLookup(whitelist, "R4C1", derivedNonMirror), null);
  const derivedMirror = { ...derivedNonMirror, aContainer: "event-row-mirror" };
  assert.equal(whitelistLookup(whitelist, "R4C1", derivedMirror)?.id, "NA-R4C1-MIRROR-NO-VIEWS");
});

test("streamDigest is sequence-keyed: a reorder cannot cancel out", () => {
  const forward = streamDigest(["a", "b"]);
  const reversed = streamDigest(["b", "a"]);
  assert.notEqual(forward, reversed);
  assert.notEqual(streamDigest(["a"]), streamDigest(["a", "a"]));
});

test("fileSetDigest changes when a member is removed", () => {
  const full = fileSetDigest([{ name: "1.json", sha256: "aa" }, { name: "2.json", sha256: "bb" }]);
  const partial = fileSetDigest([{ name: "2.json", sha256: "bb" }]);
  assert.notEqual(full, partial);
});

test("scrubAbsolutePaths replaces known roots and refuses survivors", () => {
  const clean = scrubAbsolutePaths(
    { path: "/Users/someone/code/repo/evidence", note: "ok" },
    [["/Users/someone/code/repo", "<repo>"]]);
  assert.equal(clean.path, "<repo>/evidence");
  assert.throws(() => scrubAbsolutePaths({ leak: "/Users/someone/secret" }, []), /hygiene/u);
  assert.throws(() => scrubAbsolutePaths({ leak: "/private/tmp/session/scratch" }, []), /hygiene/u);
});
