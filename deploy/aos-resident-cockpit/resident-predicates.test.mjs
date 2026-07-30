import test from "node:test";
import assert from "node:assert/strict";

import {
  judgeArchiveRetained, judgeDomainMigration, judgeLoopbackBind, judgeOffsiteCopy, judgePairing,
  judgeUnitBytes, judgeUnpairedDisciplineRetired, listenersOnPort
} from "./resident-predicates.mjs";
import { MODULE_VIEWS, VM_HOST, renderUnit, unitEnvironment } from "./manifest.mjs";
import { VM_HOST as TRANSPORT_HOST } from "../switch-rehearsal/rehearsal-lib.mjs";

test("the host the manifest names is the host the imported transport talks to", () => {
  // The transport helpers are imported from the retired switchover segment's
  // library (MIN-011 kept those instruments in service), and they carry their own
  // host constant. Two constants that must agree are one too many, so this is the
  // gate rather than a comment asking someone to remember.
  assert.equal(VM_HOST, TRANSPORT_HOST);
});

// Real `ss -ltnH` output shapes. The peer column of a listening socket is
// `0.0.0.0:*` in every one of them, which is the whole reason the predicate
// parses columns instead of searching the line.
const LOOPBACK = "LISTEN 0      511          127.0.0.1:4318      0.0.0.0:*";
const WILDCARD = "LISTEN 0      511            0.0.0.0:4318      0.0.0.0:*";
const V6_ANY = "LISTEN 0      511               [::]:4318         [::]:*";
const OTHER_PORT = "LISTEN 0      4096   127.0.0.53%lo:53          0.0.0.0:*";

test("the loopback tripwire reads the local address column, and a wildcard bind turns it red", () => {
  const green = judgeLoopbackBind(`${OTHER_PORT}\n${LOOPBACK}\n`, { port: 4318 });
  assert.equal(green.ok, true);
  assert.equal(green.reasonCode, "BOUND_TO_LOOPBACK_ONLY");
  assert.equal(green.boundAddress, "127.0.0.1");

  // The one flip the tripwire exists to catch. Note this line also contains the
  // string "0.0.0.0" twice and the green line's peer column contains it once —
  // a containment test would answer the same for both.
  const red = judgeLoopbackBind(`${OTHER_PORT}\n${WILDCARD}\n`, { port: 4318 });
  assert.equal(red.ok, false);
  assert.equal(red.reasonCode, "BOUND_OFF_LOOPBACK");
  assert.equal(red.boundAddress, "0.0.0.0");

  const v6 = judgeLoopbackBind(V6_ANY, { port: 4318 });
  assert.equal(v6.reasonCode, "BOUND_OFF_LOOPBACK");
  assert.equal(v6.boundAddress, "[::]");
});

test("a stopped service and a doubly-bound one are refused by their own names", () => {
  assert.equal(judgeLoopbackBind(`${OTHER_PORT}\n`, { port: 4318 }).reasonCode, "NO_LISTENER");
  assert.equal(judgeLoopbackBind(`${LOOPBACK}\n${WILDCARD}\n`, { port: 4318 }).reasonCode, "MULTIPLE_LISTENERS");
});

test("the port match is anchored: 14318 is not 4318", () => {
  const neighbour = "LISTEN 0      511          127.0.0.1:14318     0.0.0.0:*";
  assert.deepEqual(listenersOnPort(neighbour, 4318), []);
  assert.equal(listenersOnPort(neighbour, 14318).length, 1);
});

test("the rendered unit states every value the runner requires, and refuses an unverifiable authority", () => {
  const digest = "a".repeat(64);
  const unit = renderUnit({ pinsFileDigest: digest });
  const environment = unitEnvironment(unit);
  for (const key of ["AOS_ACTOR", "AOS_PORT", "AOS_STATIC_ROOT", "AOS_DOMAIN_DB", "AOS_WORKSPACE",
    "AOS_ATTEST_DIR", "AOS_ENGINE_MCP", "AOS_AUTHORITY_PINS", "AOS_AUTHORITY_PINS_DIGEST"]) {
    assert.ok(environment[key], `${key} must be stated by the unit`);
  }
  assert.equal(environment.AOS_AUTHORITY_PINS_DIGEST, digest);
  // The precious store is outside the tree a redeploy rsyncs with --delete.
  assert.ok(!environment.AOS_DOMAIN_DB.startsWith(`${environment.AOS_STATIC_ROOT}/`));
  assert.match(unit, /^WantedBy=multi-user\.target$/mu, "the unit must start with the machine");
  // The attestation sidecar must be OUTSIDE the workspace root; the engine
  // refuses an --attest-dir that resolves inside it.
  assert.ok(!environment.AOS_ATTEST_DIR.startsWith(`${environment.AOS_WORKSPACE}/`));

  assert.throws(() => renderUnit({ pinsFileDigest: "not-a-digest" }), /pins file sha256/u);
  assert.throws(() => renderUnit({}), /pins file sha256/u);
});

test("the unit-bytes judgement needs all three copies to agree, and names which pair broke", () => {
  const rendered = "X";
  const base = { rendered, requiredEnvKeys: ["A"], environment: { A: "1" } };
  assert.equal(judgeUnitBytes({ ...base, committed: "X", installed: "X" }).reasonCode, "UNIT_BYTES_AGREE_THREE_WAYS");
  assert.equal(judgeUnitBytes({ ...base, committed: "Y", installed: "X" }).reasonCode,
    "COMMITTED_UNIT_DIFFERS_FROM_RENDERED");
  assert.equal(judgeUnitBytes({ ...base, committed: "X", installed: "Y" }).reasonCode,
    "INSTALLED_UNIT_DIFFERS_FROM_RENDERED");
  assert.equal(judgeUnitBytes({ ...base, committed: "X", installed: "X", environment: {} }).reasonCode,
    "UNIT_ENVIRONMENT_INCOMPLETE");
});

test("the module roster is the eleven cockpit views, each expecting its own", () => {
  assert.equal(MODULE_VIEWS.length, 11);
  const views = MODULE_VIEWS.map(([, view]) => view);
  assert.equal(new Set(views).size, 11, "no two routes may expect the same view");
  for (const [route, view] of MODULE_VIEWS) assert.equal(route, `/${view}`);
});

test("the domain migration judgement can fail on each half independently", () => {
  const tables = [
    { family: "annotations", table: "aos_domain_annotation" },
    { family: "comments", table: "aos_domain_comment" },
    { family: "relations", table: "aos_domain_relation" },
    { family: "chainWriteLog", table: "aos_chain_write_log" }
  ];
  const exportText = JSON.stringify({
    annotations: [{ recordId: "work:a" }, { recordId: "work:b" }],
    comments: [{ id: "comment:1" }],
    relations: [],
    chainWriteLog: [{ seq: 1 }]
  });
  const sqlCounts = {
    aos_domain_annotation: 2, aos_domain_comment: 1, aos_domain_relation: 0, aos_chain_write_log: 1
  };
  const sha = "b".repeat(64);
  const whole = judgeDomainMigration({
    localExportText: exportText, remoteExportText: exportText, remoteSqlCounts: sqlCounts,
    localFileSha256: sha, remoteFileSha256: sha, expectedTables: tables
  });
  assert.equal(whole.reasonCode, "DOMAIN_STORE_MIGRATED_WHOLE");
  assert.deepEqual(whole.exportedCounts, { annotations: 2, comments: 1, relations: 0, chainWriteLog: 1 });

  assert.equal(judgeDomainMigration({
    localExportText: exportText, remoteExportText: exportText, remoteSqlCounts: sqlCounts,
    localFileSha256: sha, remoteFileSha256: "c".repeat(64), expectedTables: tables
  }).reasonCode, "DOMAIN_STORE_BYTES_DIVERGENT");

  assert.equal(judgeDomainMigration({
    localExportText: exportText, remoteExportText: `${exportText} `, remoteSqlCounts: sqlCounts,
    localFileSha256: sha, remoteFileSha256: sha, expectedTables: tables
  }).reasonCode, "DOMAIN_STORE_LOGICAL_EXPORT_DIVERGENT");

  // The independent judge earning its place: identical exports on both sides,
  // and the destination's own tables holding one row fewer.
  assert.equal(judgeDomainMigration({
    localExportText: exportText, remoteExportText: exportText,
    remoteSqlCounts: { ...sqlCounts, aos_domain_comment: 0 },
    localFileSha256: sha, remoteFileSha256: sha, expectedTables: tables
  }).reasonCode, "DOMAIN_STORE_ROW_COUNTS_DIVERGENT");

  // A table the destination does not report at all is divergent, not absent-ok.
  assert.equal(judgeDomainMigration({
    localExportText: exportText, remoteExportText: exportText,
    remoteSqlCounts: { aos_domain_annotation: 2, aos_domain_comment: 1, aos_domain_relation: 0 },
    localFileSha256: sha, remoteFileSha256: sha, expectedTables: tables
  }).reasonCode, "DOMAIN_STORE_ROW_COUNTS_DIVERGENT");
});

test("re-verification judges retention, so a live store that has grown is not a divergent one", () => {
  const tables = [
    { family: "annotations", table: "aos_domain_annotation" },
    { family: "chainWriteLog", table: "aos_chain_write_log" }
  ];
  const archive = JSON.stringify({
    annotations: [{ partitionId: "TCRN-AOS", recordId: "work:a", labels: ["old"] }],
    chainWriteLog: [{ seq: 1, verb: "tcrn_workflow_work_create", chainVersion: 800 }]
  });
  // The live store after the cockpit has been used: the annotation's labels
  // CHANGED (a legitimate edit), a comment-era row was appended, and the log grew.
  const live = JSON.stringify({
    annotations: [
      { partitionId: "TCRN-AOS", recordId: "work:a", labels: ["new", "resident"] },
      { partitionId: "TCRN-AOS", recordId: "work:b", labels: [] }
    ],
    chainWriteLog: [
      { seq: 1, verb: "tcrn_workflow_work_create", chainVersion: 800 },
      { seq: 2, verb: "tcrn_workflow_work_transition", chainVersion: 801 }
    ]
  });
  const sqlCounts = { aos_domain_annotation: 2, aos_chain_write_log: 2 };

  const retained = judgeArchiveRetained({
    archiveExportText: archive, liveExportText: live, remoteSqlCounts: sqlCounts, expectedTables: tables
  });
  assert.equal(retained.ok, true, retained.reasonCode);
  assert.equal(retained.reasonCode, "ARCHIVE_FULLY_RETAINED_IN_THE_LIVE_STORE");
  // And an equality check over the SAME two readings fails — which is the whole
  // reason this predicate exists rather than reusing the transfer one.
  assert.equal(judgeDomainMigration({
    localExportText: archive, remoteExportText: live, remoteSqlCounts: sqlCounts,
    localFileSha256: "d".repeat(64), remoteFileSha256: "d".repeat(64), expectedTables: tables
  }).reasonCode, "DOMAIN_STORE_LOGICAL_EXPORT_DIVERGENT");

  // A dropped archived row is loss, and is named as such.
  assert.equal(judgeArchiveRetained({
    archiveExportText: archive,
    liveExportText: JSON.stringify({
      annotations: [{ partitionId: "TCRN-AOS", recordId: "work:b", labels: [] }],
      chainWriteLog: JSON.parse(live).chainWriteLog
    }),
    remoteSqlCounts: { aos_domain_annotation: 1, aos_chain_write_log: 2 },
    expectedTables: tables
  }).reasonCode, "ARCHIVE_ROWS_MISSING_FROM_LIVE_STORE");

  // An append-only row that changed is corruption, not an edit — and unlike the
  // annotation above, a value change here is refused.
  assert.equal(judgeArchiveRetained({
    archiveExportText: archive,
    liveExportText: JSON.stringify({
      annotations: JSON.parse(live).annotations,
      chainWriteLog: [{ seq: 1, verb: "tcrn_workflow_work_create", chainVersion: 999 },
        { seq: 2, verb: "tcrn_workflow_work_transition", chainVersion: 801 }]
    }),
    remoteSqlCounts: sqlCounts,
    expectedTables: tables
  }).reasonCode, "ARCHIVE_APPEND_ONLY_ROWS_ALTERED");

  // Two readers of the same live file must agree, or something is reading past
  // the other's blind spot.
  assert.equal(judgeArchiveRetained({
    archiveExportText: archive, liveExportText: live,
    remoteSqlCounts: { aos_domain_annotation: 5, aos_chain_write_log: 2 },
    expectedTables: tables
  }).reasonCode, "LIVE_STORE_READERS_DISAGREE");

  assert.throws(() => judgeArchiveRetained({
    archiveExportText: "{}", liveExportText: "{}", remoteSqlCounts: {},
    expectedTables: [{ family: "unknownFamily", table: "t" }]
  }), /identity rule/u);
});

// ————————————————————————————————————————————————————————————————————————————
// The pairing judgement (TCRN-AOS-INC-045)
// ————————————————————————————————————————————————————————————————————————————

/** A pair manifest and the facts recomputed from its bytes, both green. */
function pairFixture() {
  const pairManifest = {
    schemaVersion: "aos.paired-backup.v2",
    pairedAt: "2026-07-30T09:00:00Z",
    partition: "TCRN-AOS",
    halves: {
      chain: { host: "tcrn-platform-dev", live: true, engineReasonCode: "WORKSPACE_COMMAND_COMPLETED" },
      domain: { host: "tcrn-platform-dev", live: true, archiveSentinelPresent: false }
    },
    pairing: {
      domainSnapshotDigest: "a".repeat(64),
      domainExportDigest: "b".repeat(64),
      chainManifestDigest: "c".repeat(64),
      chainHeadEventHash: "d".repeat(64),
      chainVersion: 840,
      attestationSetDigest: "e".repeat(64)
    }
  };
  const observed = {
    domainSnapshotSha256: "a".repeat(64),
    domainExportSha256: "b".repeat(64),
    chainManifestSha256: "c".repeat(64),
    chainManifestHeadEventHash: "d".repeat(64),
    chainManifestVersion: 840,
    domainSnapshotManifestCreatedAt: "2026-07-30T09:00:00Z",
    domainSnapshotManifestSnapshotDigest: "a".repeat(64),
    attestationSetDigest: "e".repeat(64),
    chainVerifyReasonCode: "SNAPSHOT_VERIFIED",
    restoreDrillOk: true
  };
  return { pairManifest, observed };
}

test("a pair is bound only when both halves were live, on one host, at one instant", () => {
  const green = judgePairing(pairFixture());
  assert.equal(green.ok, true);
  assert.equal(green.reasonCode, "PAIR_BOUND_AND_BOTH_HALVES_PROVEN");
  assert.equal(Object.values(green.checks).every(Boolean), true);
});

test("the INC-045 condition itself is red: halves read on two different machines", () => {
  // This is the incident, as data. The chain relocated to the VM while the domain
  // store was still on the laptop, and for that window a directory containing both
  // was two snapshots rather than one pair. Every file in it could be intact.
  const { pairManifest, observed } = pairFixture();
  pairManifest.halves.domain.host = "operator-laptop";
  const red = judgePairing({ pairManifest, observed });
  assert.equal(red.ok, false);
  assert.equal(red.reasonCode, "PAIR_HALVES_ON_DIFFERENT_HOSTS");
  assert.deepEqual(red.hosts, { chain: "tcrn-platform-dev", domain: "operator-laptop" });
});

test("a pair of two dead halves is red, though every file in it is present and intact", () => {
  // The failure mode that would have gone unnoticed: after the relocation both
  // halves still EXIST at their old addresses — a vacated workspace the engine
  // refuses to read, and an archived store with a sentinel beside it. A backup
  // that only asked "are the files there" would have been green on both, and
  // rotation would then have deleted the last live pair to make room for it.
  const vacated = pairFixture();
  vacated.pairManifest.halves.chain.live = false;
  vacated.pairManifest.halves.chain.engineReasonCode = "WORKSPACE_RELOCATION_VACATED";
  assert.equal(judgePairing(vacated).reasonCode, "PAIR_CHAIN_HALF_WAS_NOT_LIVE");

  const archived = pairFixture();
  archived.pairManifest.halves.domain.live = false;
  archived.pairManifest.halves.domain.archiveSentinelPresent = true;
  assert.equal(judgePairing(archived).reasonCode, "PAIR_DOMAIN_HALF_WAS_NOT_LIVE");
});

test("two halves taken at different moments are red even when every digest matches", () => {
  const { pairManifest, observed } = pairFixture();
  observed.domainSnapshotManifestCreatedAt = "2026-07-30T08:00:00Z";
  assert.equal(judgePairing({ pairManifest, observed }).reasonCode, "PAIR_HALVES_NOT_CO_INSTANT");
});

test("a directory assembled from two different pairs is red, with no corrupt file in it", () => {
  // The case the cross-reference exists for, and the reason the timestamp is not
  // the binding: swap in the chain manifest from a neighbouring pair and every
  // file still verifies against its own digest. Only the chain manifest's OWN
  // head/version disagreeing with what `pairing` claims catches it.
  const { pairManifest, observed } = pairFixture();
  observed.chainManifestHeadEventHash = "f".repeat(64);
  assert.equal(judgePairing({ pairManifest, observed }).reasonCode, "PAIR_CROSS_REFERENCE_BROKEN");

  const versionDrift = pairFixture();
  versionDrift.observed.chainManifestVersion = 839;
  assert.equal(judgePairing(versionDrift).reasonCode, "PAIR_CROSS_REFERENCE_BROKEN");

  // The domain manifest's own snapshotDigest is the mirror of that check.
  const domainDrift = pairFixture();
  domainDrift.observed.domainSnapshotManifestSnapshotDigest = "9".repeat(64);
  assert.equal(judgePairing(domainDrift).reasonCode, "PAIR_CROSS_REFERENCE_BROKEN");
});

test("each recomputed digest, the chain verdict and the drill can each turn the pair red", () => {
  const cases = [
    [(f) => { f.observed.domainSnapshotSha256 = "0".repeat(64); }, "PAIR_DOMAIN_DIGEST_MISMATCH"],
    [(f) => { f.observed.domainExportSha256 = "0".repeat(64); }, "PAIR_DOMAIN_DIGEST_MISMATCH"],
    [(f) => { f.observed.chainManifestSha256 = "0".repeat(64); }, "PAIR_CHAIN_DIGEST_MISMATCH"],
    [(f) => { f.observed.attestationSetDigest = "0".repeat(64); }, "PAIR_ATTESTATION_SET_DIGEST_MISMATCH"],
    [(f) => { f.observed.chainVerifyReasonCode = "SNAPSHOT_DIGEST_MISMATCH"; }, "PAIR_CHAIN_COPY_NOT_VERIFIED"],
    [(f) => { f.observed.restoreDrillOk = false; }, "PAIR_RESTORE_DRILL_FAILED"]
  ];
  for (const [mutate, expected] of cases) {
    const fixture = pairFixture();
    mutate(fixture);
    assert.equal(judgePairing(fixture).reasonCode, expected);
  }
});

test("an empty or absent pair manifest is red rather than vacuously green", () => {
  assert.equal(judgePairing({}).ok, false);
  assert.equal(judgePairing({ pairManifest: {}, observed: {} }).reasonCode, "PAIR_CHAIN_HALF_WAS_NOT_LIVE");
  // Undefined on both sides of a digest comparison must not read as agreement.
  const blankHosts = judgePairing({
    pairManifest: { halves: { chain: { live: true }, domain: { live: true } }, pairing: {} },
    observed: {}
  });
  assert.equal(blankHosts.reasonCode, "PAIR_HALVES_ON_DIFFERENT_HOSTS");
});

// ————————————————————————————————————————————————————————————————————————————
// The off-site leg, after the direction reversed
// ————————————————————————————————————————————————————————————————————————————

const GREEN_LEDGER = {
  ok: true, compared: 660, missingOnVm: [], extraOnVm: [], mismatched: [],
  fileSetDigest: { local: "1".repeat(64), remote: "1".repeat(64) }
};

test("an off-site copy on the host that holds the truth is not off-site", () => {
  // This could not go wrong by accident under the old topology, where the truth was
  // on the laptop and the copy went to the VM. Now the host that TAKES the pair is
  // the host that holds the truth, so the two sides of this check can be equal.
  const red = judgeOffsiteCopy({
    primaryHost: "tcrn-platform-dev",
    offsiteHost: "tcrn-platform-dev",
    ledger: GREEN_LEDGER,
    offsitePairVerdict: { ok: true, reasonCode: "PAIR_BOUND_AND_BOTH_HALVES_PROVEN" }
  });
  assert.equal(red.ok, false);
  assert.equal(red.reasonCode, "OFFSITE_COPY_IS_ON_THE_PRIMARY_HOST");
});

test("the off-site leg is green only when the set matches AND the copy re-proved itself", () => {
  const green = judgeOffsiteCopy({
    primaryHost: "tcrn-platform-dev", offsiteHost: "operator-laptop",
    ledger: GREEN_LEDGER,
    offsitePairVerdict: { ok: true, reasonCode: "PAIR_BOUND_AND_BOTH_HALVES_PROVEN" }
  });
  assert.equal(green.ok, true);
  assert.equal(green.reasonCode, "OFFSITE_COPY_ARRIVED_AND_WAS_REPROVEN");

  assert.equal(judgeOffsiteCopy({
    primaryHost: "tcrn-platform-dev", offsiteHost: "operator-laptop",
    ledger: { ...GREEN_LEDGER, ok: false, mismatched: ["domain/domain.db"] },
    offsitePairVerdict: { ok: true, reasonCode: "PAIR_BOUND_AND_BOTH_HALVES_PROVEN" }
  }).reasonCode, "OFFSITE_FILE_SET_DIVERGENT");

  // Arrival is not restorability. A byte-perfect copy whose pair judgement failed
  // on the far side is still a red leg — that separation is the whole point of
  // re-proving with a second engine rather than trusting the transfer.
  assert.equal(judgeOffsiteCopy({
    primaryHost: "tcrn-platform-dev", offsiteHost: "operator-laptop",
    ledger: GREEN_LEDGER,
    offsitePairVerdict: { ok: false, reasonCode: "PAIR_CHAIN_COPY_NOT_VERIFIED" }
  }).reasonCode, "OFFSITE_COPY_NOT_INDEPENDENTLY_REPROVEN");

  assert.equal(judgeOffsiteCopy({}).reasonCode, "OFFSITE_COPY_IS_ON_THE_PRIMARY_HOST");
});

test("the not-paired discipline is lifted only by the run's own verdicts, never by assertion", () => {
  const green = {
    halvesShareOneHost: true,
    pairVerdict: { ok: true, checks: { coInstant: true, crossReference: true } },
    offsiteVerdict: { ok: true },
    restoreDrillOk: true
  };
  const lifted = judgeUnpairedDisciplineRetired(green);
  assert.equal(lifted.retired, true);
  assert.equal(lifted.reasonCode, "UNPAIRED_DISCIPLINE_MAY_BE_LIFTED");
  assert.deepEqual(lifted.unmet, []);

  // Each condition alone keeps it in force, and the receipt names which one.
  const reds = [
    [{ ...green, halvesShareOneHost: false }, "domainStoreRelocatedBesideTheChain"],
    [{ ...green, pairVerdict: { ok: false, checks: { coInstant: true, crossReference: true } } },
      "pairedBackupRewiredAndProven"],
    [{ ...green, pairVerdict: { ok: true, checks: { coInstant: false, crossReference: true } } },
      "coInstantPairingDemonstrated"],
    [{ ...green, restoreDrillOk: false }, "restoreDrilled"],
    // A pair that never left the machine holding the truth is not a cadence yet.
    [{ ...green, offsiteVerdict: { ok: false } }, "offsiteCopyLandedOffTheTruthHost"]
  ];
  for (const [input, expected] of reds) {
    const verdict = judgeUnpairedDisciplineRetired(input);
    assert.equal(verdict.retired, false);
    assert.equal(verdict.reasonCode, "UNPAIRED_DISCIPLINE_STILL_IN_FORCE");
    assert.ok(verdict.unmet.includes(expected), `${expected} must be named as unmet`);
  }

  // Nothing supplied must not read as everything satisfied.
  assert.equal(judgeUnpairedDisciplineRetired({}).retired, false);
});
