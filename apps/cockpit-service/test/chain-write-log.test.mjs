import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { startCockpitService, CHAIN_WRITE_ROUTES } from "../../../dist/apps/cockpit-service/src/service.js";

/**
 * The replayable chain-write log (STORY-113, ruling MIN-007 T6: the write log
 * is a precondition at the same rank as the consistency matrix).
 *
 * A recording chain client sits where the governed MCP facade would: the real
 * routes, the real write surface, and the real domain store all run, and the
 * only substitution is the process boundary. That is the honest scope — these
 * tests prove what this service logs matches what it sends, byte for byte;
 * they do not prove the engine accepted anything (the live proof does that).
 */

/** Receipts shaped like the engine's writeState output. */
function recordingClient() {
  const calls = [];
  let version = 10;
  return {
    calls,
    callTool: async (tool, args) => {
      // Serialized at the receiving side, before returning to the caller —
      // the same bytes a real facade would frame into its RPC envelope.
      calls.push({ tool, argsJson: JSON.stringify(args) });
      version += 1;
      return {
        reasonCode: "WORKSPACE_COMMAND_COMPLETED",
        workspaceId: "workspace:test",
        version,
        headEventHash: "e".repeat(64),
        record: { id: "work:logged" }
      };
    }
  };
}

async function withLoggingService(run, { client = recordingClient(), scratch } = {}) {
  const ownScratch = scratch ?? await mkdtemp(join(tmpdir(), "aos-write-log-test-"));
  const service = await startCockpitService({
    port: 0,
    domainDatabasePath: join(ownScratch, "domain.db"),
    workspaces: { "TCRN-AOS": join(ownScratch, "workspace") },
    actor: "agent:test",
    chainClient: client
  });
  try {
    const post = async (path, body) => {
      const response = await fetch(`${service.url}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      return { status: response.status, json: await response.json() };
    };
    const get = async (path) => {
      const response = await fetch(`${service.url}${path}`);
      return { status: response.status, json: await response.json() };
    };
    const put = async (path, body) => {
      const response = await fetch(`${service.url}${path}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      return { status: response.status, json: await response.json() };
    };
    await run({ service, post, get, put, client, scratch: ownScratch });
  } finally {
    await service.close();
    if (!scratch) await rm(ownScratch, { recursive: true, force: true });
  }
}

function readLogRows(scratch) {
  const db = new DatabaseSync(join(scratch, "domain.db"));
  try {
    return db.prepare("SELECT * FROM aos_chain_write_log ORDER BY seq").all();
  } finally {
    db.close();
  }
}

test("every chain-write route leaves a log row, in strictly monotonic sequence", async () => {
  await withLoggingService(async ({ post, scratch }) => {
    // One request per route. `work` carries a title, so it is two engine calls
    // (create + scope annotation) and must be two rows — the unit of the log
    // is the engine call, because that is the unit a replay re-issues.
    assert.deepEqual([...CHAIN_WRITE_ROUTES].sort(), ["annotate", "enrol", "transition", "work"]);
    const ok = [];
    ok.push(await post("/api/chain/transition", { partitionId: "TCRN-AOS", recordId: "work:x", status: "ready" }));
    ok.push(await post("/api/chain/annotate", { partitionId: "TCRN-AOS", recordId: "work:x", scope: "s" }));
    ok.push(await post("/api/chain/work", { partitionId: "TCRN-AOS", projectId: "project:p", externalKey: "K-1", kind: "Story", parentId: null, title: "titled" }));
    ok.push(await post("/api/chain/enrol", { partitionId: "TCRN-AOS", recordId: "work:x", workspaceId: "workspace:w", trainWorkId: "work:t" }));
    for (const { status } of ok) assert.equal(status, 200);

    const rows = readLogRows(scratch);
    assert.equal(rows.length, 5, "four routes, five engine calls (work = create + title)");
    assert.deepEqual(rows.map((row) => row.verb), [
      "tcrn_workflow_work_transition",
      "tcrn_workflow_work_annotate",
      "tcrn_workflow_work_create",
      "tcrn_workflow_work_annotate",
      "tcrn_workflow_work_annotate"
    ]);
    for (const [index, row] of rows.entries()) {
      if (index > 0) {
        assert.ok(row.seq > rows[index - 1].seq, "seq must be strictly increasing");
      }
      assert.equal(row.partition_id, "TCRN-AOS");
      // Receipt essentials, as the receipt stated them.
      assert.equal(row.record_id, "work:logged");
      assert.equal(row.head_event_hash, "e".repeat(64));
      assert.equal(typeof row.chain_version, "number");
      // The anchor column exists and is honestly empty: no switchover ceremony
      // has minted an anchor, so NULL is the correct value, not a missing one.
      assert.equal(row.switch_anchor, null);
      assert.match(String(row.at), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u);
    }
  });
});

test("logged args are byte-identical to the wire serialization the client received", async () => {
  await withLoggingService(async ({ post, client, scratch }) => {
    await post("/api/chain/transition", { partitionId: "TCRN-AOS", recordId: "work:x", status: "ready" });
    await post("/api/chain/annotate",
      { partitionId: "TCRN-AOS", recordId: "work:x", scope: "text", decidedBy: ["minutes:a", "minutes:b"] });
    await post("/api/chain/enrol",
      { partitionId: "TCRN-AOS", recordId: "work:x", workspaceId: "workspace:w", trainWorkId: "work:t" });

    const rows = readLogRows(scratch);
    assert.equal(rows.length, client.calls.length);
    for (const [index, row] of rows.entries()) {
      // Byte comparison, not deep-equal of parsed values: the log's claim is
      // "these are the bytes that were sent", serialized exactly once and never
      // re-ordered — the engine stays the only judge of canonical form.
      assert.equal(row.verb, client.calls[index].tool);
      assert.ok(
        Buffer.from(row.args_json, "utf8").equals(Buffer.from(client.calls[index].argsJson, "utf8")),
        `row ${row.seq}: logged bytes must equal the wire bytes for ${row.verb}`
      );
      // And the wire form itself still carries the surface's base fields.
      const parsed = JSON.parse(row.args_json);
      assert.equal(parsed["expected-version"], "head");
      assert.equal(parsed.actor, "agent:test");
    }
  });
});

test("a refused write leaves no log row: the log holds what moved the chain", async () => {
  const refusing = {
    calls: [],
    callTool: async () => {
      const error = new Error("INVALID_TRANSITION refused");
      error.reasonCode = "INVALID_TRANSITION";
      throw error;
    }
  };
  await withLoggingService(async ({ post, scratch }) => {
    const refused = await post("/api/chain/transition",
      { partitionId: "TCRN-AOS", recordId: "work:x", status: "planned" });
    assert.equal(refused.status, 409);
    assert.equal(refused.json.reasonCode, "INVALID_TRANSITION");
    assert.equal(readLogRows(scratch).length, 0);
  }, { client: refusing });
});

test("a log failure after engine acceptance is 502 CHAIN_ACCEPTED_LOG_FAILED with the receipt, never a retryable-looking refusal", async () => {
  await withLoggingService(async ({ post, scratch }) => {
    // Block the log table out-of-band: the (recorded) engine call succeeds,
    // the append does not. This is the survived half of the crash window —
    // the chain moved and the log could not say so.
    const db = new DatabaseSync(join(scratch, "domain.db"));
    try {
      db.exec(`CREATE TRIGGER aos_test_block_log BEFORE INSERT ON aos_chain_write_log
        BEGIN SELECT RAISE(ABORT, 'aos_test_block_log'); END`);
    } finally {
      db.close();
    }

    const result = await post("/api/chain/transition",
      { partitionId: "TCRN-AOS", recordId: "work:x", status: "ready" });
    // Not 409: nothing was refused. Not a bare 500: the caller must be able to
    // tell "the chain moved, reconcile" apart from "something broke, maybe
    // retry" — a blind retry here would mutate the chain twice.
    assert.equal(result.status, 502);
    assert.equal(result.json.reasonCode, "CHAIN_ACCEPTED_LOG_FAILED");
    // The engine receipt rides along, so the caller can see what the chain now holds.
    assert.deepEqual(result.json.receipt, {
      verb: "tcrn_workflow_work_transition",
      recordId: "work:logged",
      chainVersion: 11,
      headEventHash: "e".repeat(64)
    });
    assert.equal(readLogRows(scratch).length, 0, "the failed append left no partial row");
  });
});

test("the log is append-only: UPDATE and DELETE are rejected by the triggers", async () => {
  await withLoggingService(async ({ post, scratch }) => {
    await post("/api/chain/transition", { partitionId: "TCRN-AOS", recordId: "work:x", status: "ready" });

    const db = new DatabaseSync(join(scratch, "domain.db"));
    try {
      const before = db.prepare("SELECT * FROM aos_chain_write_log ORDER BY seq").all();
      assert.equal(before.length, 1);
      // Both mutations against a real row — a trigger cannot reject an UPDATE
      // that matches nothing, and that rejection would prove nothing.
      assert.throws(
        () => db.exec("UPDATE aos_chain_write_log SET verb = 'tampered'"),
        /aos_chain_write_log_append_only_update_denied/u
      );
      assert.throws(
        () => db.exec("DELETE FROM aos_chain_write_log"),
        /aos_chain_write_log_append_only_delete_denied/u
      );
      const after = db.prepare("SELECT * FROM aos_chain_write_log ORDER BY seq").all();
      assert.deepEqual(after, before, "the row must survive both attempts unchanged");
    } finally {
      db.close();
    }
  });
});

test("GET /api/domain/export answers with the export document, write log included", async () => {
  // TCRN-AOS-INC-036: the log had no HTTP read face. The export branch existed
  // but nothing could reach it — dispatch's first branch was an unconditional
  // `method === "GET"` that read "export" as a partition id and answered with
  // the un-scoped annotation listing, 200 and all. Backup and rollback both had
  // to bypass the service and open domain.db directly.
  await withLoggingService(async ({ post, get, put, client }) => {
    // Domain-side content first, so every family in the document has something
    // in it: a family that is empty in every case cannot tell "exported" from
    // "absent".
    await put("/api/domain/annotation",
      { partitionId: "TCRN-AOS", recordId: "work:x", labels: ["exported"] });
    await post("/api/domain/comment",
      { partitionId: "TCRN-AOS", recordId: "work:x", body: "a comment to export" });
    await post("/api/domain/relation",
      { partitionId: "TCRN-AOS", recordId: "work:x", relation: "relates_to",
        targetPartitionId: "TCRN-AOS", targetRecordId: "work:y" });

    // Chain writes, counted the way the caller counts them: transition 1,
    // annotate 1, work-with-a-title 2 (create + scope), enrol 1 — five engine
    // calls. That number is stated here from the request list, not read back
    // from the store the export reads, so the two sides of the comparison do
    // not share a source.
    await post("/api/chain/transition", { partitionId: "TCRN-AOS", recordId: "work:x", status: "ready" });
    await post("/api/chain/annotate", { partitionId: "TCRN-AOS", recordId: "work:x", scope: "s" });
    await post("/api/chain/work", { partitionId: "TCRN-AOS", projectId: "project:p",
      externalKey: "K-1", kind: "Story", parentId: null, title: "titled" });
    await post("/api/chain/enrol", { partitionId: "TCRN-AOS", recordId: "work:x",
      workspaceId: "workspace:w", trainWorkId: "work:t" });
    const expectedChainWrites = 5;

    const exported = await get("/api/domain/export");
    assert.equal(exported.status, 200);
    // The key set, asserted as a set: the export is the read side of the backup
    // obligation, so a family quietly missing from the document is a family
    // quietly missing from the backup.
    assert.deepEqual(
      Object.keys(exported.json).sort(),
      ["annotations", "chainWriteLog", "comments", "ok", "relations", "schemaVersion"],
      "the export document must carry every family, chainWriteLog among them"
    );
    assert.equal(exported.json.schemaVersion, "aos.domain.v2");
    assert.equal(exported.json.annotations.length, 1);
    assert.equal(exported.json.comments.length, 1);
    assert.equal(exported.json.relations.length, 1);

    // Row count against the independently-stated expectation, and again against
    // the recording client's own tally — neither of which is the domain store.
    assert.equal(exported.json.chainWriteLog.length, expectedChainWrites);
    assert.equal(exported.json.chainWriteLog.length, client.calls.length);
    assert.deepEqual(exported.json.chainWriteLog.map((row) => row.verb), [
      "tcrn_workflow_work_transition",
      "tcrn_workflow_work_annotate",
      "tcrn_workflow_work_create",
      "tcrn_workflow_work_annotate",
      "tcrn_workflow_work_annotate"
    ]);
    // And the bytes, per row, against what the client received.
    for (const [index, row] of exported.json.chainWriteLog.entries()) {
      assert.equal(row.argsJson, client.calls[index].argsJson,
        `exported row ${row.seq} must carry the wire bytes for ${row.verb}`);
    }
  });
});

test("the record read and the un-scoped listing keep their meaning beside the export route", async () => {
  // The other side of the INC-036 repair: `<partition>/<recordId>` is still the
  // catch-all it always was, and the listing still answers at the bare prefix.
  await withLoggingService(async ({ post, get, put }) => {
    await put("/api/domain/annotation",
      { partitionId: "TCRN-AOS", recordId: "work:x", assignee: "owner:governance", labels: ["kept"] });
    await post("/api/domain/comment",
      { partitionId: "TCRN-AOS", recordId: "work:x", body: "still readable" });
    await put("/api/domain/annotation",
      { partitionId: "TCRN-TMS", recordId: "work:z", labels: ["other-partition"] });

    const record = await get("/api/domain/TCRN-AOS/work%3Ax");
    assert.equal(record.status, 200);
    assert.equal(record.json.annotation.assignee, "owner:governance");
    assert.deepEqual(record.json.annotation.labels, ["kept"]);
    assert.equal(record.json.comments.length, 1);
    assert.deepEqual(record.json.relations, []);
    // A record read must never answer with the export document's shape.
    assert.equal(record.json.chainWriteLog, undefined);

    const listing = await get("/api/domain/");
    assert.equal(listing.status, 200);
    assert.equal(listing.json.annotations.length, 2, "the un-scoped listing spans partitions");
    const scoped = await get("/api/domain/?partition=TCRN-TMS");
    assert.equal(scoped.json.annotations.length, 1);
    assert.equal(scoped.json.annotations[0].partitionId, "TCRN-TMS");

    // An operation name is not a partition: GET on one is 404, not the listing
    // wearing a record read's clothes.
    const notARecord = await get("/api/domain/annotation");
    assert.equal(notARecord.status, 404);
  });
});

test("sequence numbers stay monotonic across a service restart", async () => {
  // AUTOINCREMENT, not bare rowid: a restart must continue the ordinal line,
  // never reuse it, or "replay in seq order" becomes ambiguous history.
  const scratch = await mkdtemp(join(tmpdir(), "aos-write-log-test-"));
  try {
    await withLoggingService(async ({ post }) => {
      await post("/api/chain/transition", { partitionId: "TCRN-AOS", recordId: "work:x", status: "ready" });
    }, { scratch });
    const firstRows = readLogRows(scratch);
    await withLoggingService(async ({ post }) => {
      await post("/api/chain/transition", { partitionId: "TCRN-AOS", recordId: "work:x", status: "active" });
    }, { scratch });
    const rows = readLogRows(scratch);
    assert.equal(rows.length, 2);
    assert.ok(rows[1].seq > firstRows[0].seq, "the second life of the service continues the sequence");
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
