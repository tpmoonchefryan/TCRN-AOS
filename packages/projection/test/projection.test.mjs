import test from "node:test";
import assert from "node:assert/strict";

import {
  ProjectionStore,
  WORK_KIND_TOKENS,
  buildActivityFeed,
  buildInbox,
  computeEffectiveUnresolved,
  digestOf,
  partitionTokenCandidates,
  reassemblePositions,
  resolveKeyTable
} from "../../../dist/packages/projection/src/index.js";

const partition = "test-partition";

function projection(overrides = {}) {
  return {
    partitionId: partition,
    chainVersion: 10,
    verifiedAt: "2026-07-26T00:00:00Z",
    work: [],
    gates: [],
    conferences: [],
    positions: [],
    minutes: [],
    events: [],
    actorAttestationFromSequence: null,
    ...overrides
  };
}

function work(id, extra = {}) {
  return {
    partitionId: partition,
    id,
    externalKey: `TEST-${id}`,
    kind: "Story",
    status: "planned",
    parentId: null,
    projectId: "project:test",
    revision: 1,
    scope: null,
    decidedBy: [],
    sprintWorkId: null,
    chainVersion: 10,
    ...extra
  };
}

function position(id, ordinal, body, actorId = "profile:a") {
  return {
    partitionId: partition,
    id,
    externalKey: `POS-${id}`,
    conferenceId: "conference:1",
    actorId,
    body,
    ordinal,
    chainVersion: 10
  };
}

function minutes(id, chainVersion, unresolvedIssues, decisions = [], summary = null) {
  return {
    partitionId: partition,
    id,
    externalKey: `MIN-${id}`,
    conferenceId: "conference:1",
    summary,
    outcomeClass: "role_decision",
    decisions,
    unresolvedIssues,
    chainVersion
  };
}

test("replacing a partition swaps its whole contents rather than merging", () => {
  const store = new ProjectionStore();
  store.replacePartition(projection({ work: [work("work:1"), work("work:2")] }));
  assert.equal(store.listWork().length, 2);

  // A record dropped from the chain projection must not survive the refresh —
  // a merge would leave it behind and the cockpit would show a ghost.
  store.replacePartition(projection({ chainVersion: 11, work: [work("work:2")] }));
  const rows = store.listWork();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "work:2");
  assert.equal(store.heldVersion(partition), 11);
  store.close();
});

test("held version reports what the store has so ingestion can skip an unmoved chain", () => {
  const store = new ProjectionStore();
  assert.equal(store.heldVersion(partition), undefined);
  store.replacePartition(projection({ chainVersion: 42 }));
  assert.equal(store.heldVersion(partition), 42);
  store.close();
});

test("full-text search reaches scope, positions, and minutes", () => {
  const store = new ProjectionStore();
  store.replacePartition(projection({
    work: [work("work:1", { scope: "harness calibration for frontier models" })],
    positions: [position("position:1", 1, "the budget ceiling is measured, not assumed")],
    minutes: [minutes("minutes:1", 10, [], ["keep the ceiling at 2048"], "budget ruling")]
  }));

  assert.equal(store.search("calibration")[0].recordType, "work");
  assert.equal(store.search("measured")[0].recordType, "position");
  assert.equal(store.search("ceiling").length, 2);
  assert.equal(store.search("").length, 0);
  store.close();
});

test("search index is rebuilt with its partition, never left behind", () => {
  const store = new ProjectionStore();
  store.replacePartition(projection({ work: [work("work:1", { scope: "obsolete wording" })] }));
  assert.equal(store.search("obsolete").length, 1);
  store.replacePartition(projection({ chainVersion: 11, work: [work("work:1", { scope: "current wording" })] }));
  assert.equal(store.search("obsolete").length, 0);
  assert.equal(store.search("current").length, 1);
  store.close();
});

test("consecutive same-author fragments rejoin into one argument", () => {
  const joined = reassemblePositions([
    position("position:1", 1, "1/2 opening clause"),
    position("position:2", 2, "2/2 closing clause")
  ]);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].fragmentCount, 2);
  assert.equal(joined[0].body, "opening clause\n\nclosing clause");
  assert.deepEqual(joined[0].fragmentIds, ["position:1", "position:2"]);
});

test("fragments from different authors are never welded together", () => {
  const joined = reassemblePositions([
    position("position:1", 1, "1/2 first author opening", "profile:a"),
    position("position:2", 2, "2/2 second author closing", "profile:b")
  ]);
  assert.equal(joined.length, 2);
  assert.ok(joined.every((entry) => entry.fragmentCount === 1));
});

test("an unfragmented position passes through unchanged", () => {
  const joined = reassemblePositions([position("position:1", 1, "a whole argument")]);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].body, "a whole argument");
  assert.equal(joined[0].fragmentCount, 1);
});

test("later minutes dissolve earlier open issues, and only later ones", () => {
  const computed = computeEffectiveUnresolved([
    minutes("minutes:1", 10, [
      "whether to enable actor attestation on this partition",
      "which release cadence applies to the helper payload"
    ]),
    minutes("minutes:2", 20, [], ["whether to enable actor attestation on this partition is settled: enabled"])
  ]);

  const first = computed.find((entry) => entry.minutesId === "minutes:1");
  assert.equal(first.surface.length, 2);
  assert.equal(first.effective.length, 1);
  assert.equal(first.dissolvedCount, 1);
  assert.match(first.effective[0], /release cadence/u);

  // The later minutes cannot be dissolved by the earlier one.
  const second = computed.find((entry) => entry.minutesId === "minutes:2");
  assert.equal(second.effective.length, 0);
});

test("incidental word overlap does not dissolve an open issue", () => {
  const computed = computeEffectiveUnresolved([
    minutes("minutes:1", 10, ["decide the backup destination for the projection store"]),
    minutes("minutes:2", 20, [], ["the projection store is a derivative"])
  ]);
  assert.equal(computed[0].effective.length, 1);
});

test("inbox merges gates, open deliberations, and live open issues with owner intent first", () => {
  const items = buildInbox({
    gates: [
      {
        partitionId: partition,
        id: "gate:1",
        externalKey: "TEST-GATE-1",
        title: "front-end rebuild admission",
        status: "pending",
        outcomeClass: "owner_intent_required",
        workId: "work:1",
        chainVersion: 10
      },
      {
        partitionId: partition,
        id: "gate:2",
        externalKey: "TEST-GATE-2",
        title: "already satisfied",
        status: "satisfied",
        outcomeClass: "role_decision",
        workId: "work:2",
        chainVersion: 10
      }
    ],
    conferences: [
      { partitionId: partition, id: "conference:1", externalKey: "TEST-CONF-1", title: "design collection", status: "open" },
      { partitionId: partition, id: "conference:2", externalKey: "TEST-CONF-2", title: "closed one", status: "closed" }
    ],
    effectiveUnresolved: [
      { minutesId: "minutes:1", externalKey: "TEST-MIN-1", surface: ["a", "b"], effective: ["b"], dissolvedCount: 1 },
      { minutesId: "minutes:2", externalKey: "TEST-MIN-2", surface: ["c"], effective: [], dissolvedCount: 1 }
    ],
    minutesById: new Map([
      ["minutes:1", { partitionId: partition, externalKey: "TEST-MIN-1", summary: "budget ruling" }],
      ["minutes:2", { partitionId: partition, externalKey: "TEST-MIN-2", summary: "settled" }]
    ])
  });

  // Satisfied gates, closed conferences, and fully dissolved minutes stay out.
  assert.equal(items.length, 3);
  assert.equal(items[0].severity, "owner-intent");
  assert.equal(items[0].kind, "gate");
  assert.ok(items.every((item) => item.recordId !== "gate:2"));
  assert.ok(items.every((item) => item.recordId !== "conference:2"));
  assert.ok(items.every((item) => item.recordId !== "minutes:2"));

  // `detail` carries facts, not a sentence. This layer has no reader's locale in
  // scope, so anything it phrased here could only ever be English — a row that
  // arrives at a view already worded cannot be said in the reader's language.
  // Asserting the shape is what keeps a convenient template from coming back.
  assert.deepEqual(items[0].detail, { reason: "gate-outcome", outcomeClass: "owner_intent_required" });
  assert.deepEqual(
    items.find((item) => item.kind === "conference").detail,
    { reason: "collecting-positions" }
  );
  assert.deepEqual(
    items.find((item) => item.kind === "unresolved").detail,
    { reason: "open-issues", open: 1, recorded: 2 }
  );
  assert.ok(items.every((item) => typeof item.detail !== "string"));
});


test("key recovery resolves the derivation from the ids themselves, not from an assumed record", () => {
  // Real ids from the live cross-project chain, deliberately NOT starting at
  // INIT-001: the first attempt at this assumed the first Initiative in a page
  // was INIT-001, the probe failed, and every record in the two largest chains
  // came back unnamed.
  const known = [
    ["TCRN-CROSS-INIT-012", "work:b1b2767f8f2a47ca19e4e16f"],
    ["TCRN-CROSS-STORY-105", "work:bc4ef2cf3e13d59e84698ced"],
    ["TCRN-CROSS-EPIC-033", "work:6885af8b58e7ce99e08434e6"]
  ];
  const table = resolveKeyTable("work", known.map(([, id]) => id), {
    partitionTokens: partitionTokenCandidates("cross-project"),
    kindTokens: WORK_KIND_TOKENS
  });
  for (const [key, id] of known) {
    assert.equal(table.get(digestOf(id)), key, `${id} should resolve to ${key}`);
  }
});

test("key recovery yields nothing rather than wrong names when ids do not match", () => {
  const table = resolveKeyTable("work", ["work:0000000000000000000000ff"], {
    partitionTokens: ["CROSS"],
    kindTokens: WORK_KIND_TOKENS
  });
  assert.equal(table.size, 0);
});

function event(sequence, extra = {}) {
  return {
    partitionId: partition,
    id: `event:${sequence}`,
    sequence,
    occurredAt: "2026-07-26T00:00:00Z",
    operation: "work.updated",
    subjectId: "work:1",
    actorId: null,
    chainVersion: 10,
    ...extra
  };
}

test("an unattributed event says whether the chain could have recorded an actor", () => {
  // Same blank actor, two different facts: TMS never enabled attestation, while
  // AOS's early events simply predate the day it did. A feed that showed both as
  // "unknown" would hide that one of the two chains can never improve.
  const neverEnabled = buildActivityFeed([event(1), event(2)], null);
  assert.deepEqual(neverEnabled.map((entry) => entry.attribution), ["not-enabled", "not-enabled"]);

  const enabledLater = buildActivityFeed(
    [event(1), event(2), event(3, { actorId: "owner:governance" })], 3);
  assert.deepEqual(
    enabledLater.map((entry) => `${entry.sequence}:${entry.attribution}`),
    ["3:recorded", "2:predates-attestation", "1:predates-attestation"]);
});

test("activity is ordered by sequence, not by the second-precision timestamp", () => {
  // Three writes inside one second share a timestamp, so sorting by time would
  // reorder them arbitrarily and show a work item being closed before it was
  // opened. Sequence is the only ordering the chain guarantees.
  const sameSecond = [
    event(7, { operation: "work.created" }),
    event(8, { operation: "work.annotated" }),
    event(9, { operation: "work.updated" })
  ];
  const feed = buildActivityFeed(sameSecond, null);
  assert.deepEqual(feed.map((entry) => entry.sequence), [9, 8, 7]);
});

test("events are stored per subject and replaced with their partition", () => {
  const store = new ProjectionStore();
  store.replacePartition(projection({
    events: [event(1, { subjectId: "work:1" }), event(2, { subjectId: "work:2" })],
    actorAttestationFromSequence: 2
  }));
  assert.equal(store.listEvents({ subjectId: "work:1" }).length, 1);
  assert.equal(store.attestationFromSequence(partition), 2);

  // A chain that has never enabled attestation records null, which must stay
  // distinguishable from a partition the store has simply never seen.
  store.replacePartition(projection({ events: [event(3, { subjectId: "work:1" })] }));
  assert.equal(store.listEvents({ subjectId: "work:2" }).length, 0);
  assert.equal(store.attestationFromSequence(partition), null);
  assert.equal(store.attestationFromSequence("never-projected"), undefined);
  store.close();
});

test("the domain store round-trips through its export, which is what a backup rests on", async () => {
  // The backup path exports to JSON and restores by replaying it. If that round
  // trip is lossy the backup is a file that looks like insurance and is not, so
  // the property is tested here rather than trusted at restore time.
  const { DomainStore, loadDomainMigrationSql } = await import("../../../dist/packages/projection/src/index.js");
  const { fileURLToPath } = await import("node:url");
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");

  // The full migration directory, exactly as the service and both backup
  // scripts now load it — a schema file this loader missed would fail here too.
  const migration = loadDomainMigrationSql(
    fileURLToPath(new URL("../../db/migrations/domain", import.meta.url)));
  const scratch = mkdtempSync(join(tmpdir(), "aos-domain-test-"));
  const first = new DomainStore(join(scratch, "a.db"), migration);
  try {
    first.setAnnotation({
      partitionId: "TCRN-AOS", recordId: "work:abc", externalKey: "TCRN-AOS-STORY-001",
      assignee: "owner:governance", priority: "high", labels: ["one", "two"],
      updatedAt: "2026-07-27T00:00:00Z", updatedBy: "agent:test"
    });
    first.addComment({ id: "comment:1", partitionId: "TCRN-AOS", recordId: "work:abc",
      author: "agent:test", body: "kept", createdAt: "2026-07-27T00:00:01Z" });
    first.addRelation({ id: "relation:1", partitionId: "TCRN-AOS", recordId: "work:abc",
      relation: "blocks", targetPartitionId: "cross-project", targetRecordId: "work:def",
      createdAt: "2026-07-27T00:00:02Z", createdBy: "agent:test" });
    first.appendChainWrite({ partitionId: "TCRN-AOS", verb: "tcrn_workflow_work_transition",
      argsJson: JSON.stringify({ id: "work:abc", status: "ready" }), recordId: "work:abc",
      chainVersion: 7, headEventHash: "a".repeat(64), at: "2026-07-27T00:00:03Z", switchAnchor: null });

    // Before the round trip, the export is judged against this test's OWN
    // record of what it wrote. The deepEqual below compares exportAll to
    // exportAll — two readings of the same code path, which agree with each
    // other even when both are wrong (an exportAll whose chainWriteLog went
    // silently empty would round-trip an empty log perfectly). These literals
    // are the independent side of the predicate: they cannot drift with the
    // implementation because they never call it.
    const exported = first.exportAll();
    assert.equal(exported.annotations.length, 1);
    assert.equal(exported.comments.length, 1);
    assert.equal(exported.relations.length, 1);
    assert.deepEqual(exported.chainWriteLog, [{
      seq: 1,
      partitionId: "TCRN-AOS",
      verb: "tcrn_workflow_work_transition",
      argsJson: JSON.stringify({ id: "work:abc", status: "ready" }),
      recordId: "work:abc",
      chainVersion: 7,
      headEventHash: "a".repeat(64),
      at: "2026-07-27T00:00:03Z",
      switchAnchor: null
    }]);

    const restored = new DomainStore(join(scratch, "b.db"), migration);
    try {
      for (const annotation of exported.annotations) restored.setAnnotation(annotation);
      for (const comment of exported.comments) restored.addComment(comment);
      for (const relation of exported.relations) restored.addRelation(relation);
      // The restore path keeps the original seq — replayed history is the same
      // history, not a renumbered one.
      for (const entry of exported.chainWriteLog) restored.restoreChainWrite(entry);
      assert.deepEqual(restored.exportAll(), exported);
    } finally {
      restored.close();
    }
  } finally {
    first.close();
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("every domain table is exported or excluded by name — a new precious table cannot silently miss the logical backup", async () => {
  // The failure mode this guards against is not "export breaks" but "export
  // stays green while a newly added table quietly holds data no backup ever
  // sees". So the schema itself is enumerated (sqlite_master, the authority on
  // what tables exist) and every table must be claimed by exactly one of two
  // lists: the export surface, or a deliberate exclusion recorded here with
  // its reason. Adding a migration without touching either list goes red.
  const { DomainStore, loadDomainMigrationSql } = await import("../../../dist/packages/projection/src/index.js");
  const { fileURLToPath } = await import("node:url");
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { DatabaseSync } = await import("node:sqlite");

  // Table -> the exportAll() family that carries its rows.
  const exportSurface = {
    aos_domain_annotation: "annotations",
    aos_domain_comment: "comments",
    aos_domain_relation: "relations",
    aos_chain_write_log: "chainWriteLog"
  };
  // Deliberate exclusions, each with the reason it is allowed to stay out of
  // the logical export. Currently empty on purpose: everything the domain
  // database holds is precious, so everything is exported.
  const excludedByName = new Map([]);

  const migration = loadDomainMigrationSql(
    fileURLToPath(new URL("../../db/migrations/domain", import.meta.url)));
  const scratch = mkdtempSync(join(tmpdir(), "aos-domain-tables-test-"));
  const path = join(scratch, "tables.db");
  const store = new DomainStore(path, migration);
  let exported;
  try {
    exported = store.exportAll();
  } finally {
    store.close();
  }
  const db = new DatabaseSync(path);
  let tables;
  try {
    tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all().map((row) => String(row.name));
  } finally {
    db.close();
    rmSync(scratch, { recursive: true, force: true });
  }

  assert.ok(tables.length > 0, "the schema must actually contain tables to enumerate");
  for (const table of tables) {
    const family = exportSurface[table];
    if (family !== undefined) {
      assert.ok(Array.isArray(exported[family]),
        `export surface maps ${table} to '${family}' but exportAll() has no such array`);
      continue;
    }
    assert.ok(excludedByName.has(table),
      `table ${table} is neither in the export surface nor excluded by name — `
      + "a precious table outside the logical backup. Add it to exportAll() "
      + "(and both backup scripts' counts), or record its exclusion with a reason.");
  }
  // The predicate's other side must also be able to differ: neither list may
  // name a table the schema no longer has, or the lists rot into folklore.
  for (const table of Object.keys(exportSurface)) {
    assert.ok(tables.includes(table), `export surface names ${table} but the schema has no such table`);
  }
  for (const table of excludedByName.keys()) {
    assert.ok(tables.includes(table), `exclusion list names ${table} but the schema has no such table`);
  }
});

test("a dangling qualified ref is kept rather than repaired away", () => {
  // A chain record can be tombstoned after someone annotated it. Deleting the
  // annotation would be a foreign key deciding that a person's comment stops
  // existing because its subject did, which is the wrong repair.
  const store = new ProjectionStore();
  assert.doesNotThrow(() => store.listWork({ partitionIds: ["never-projected"] }));
  store.close();
});
