import test from "node:test";
import assert from "node:assert/strict";

import {
  ProjectionStore,
  buildInbox,
  computeEffectiveUnresolved,
  reassemblePositions
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
});
