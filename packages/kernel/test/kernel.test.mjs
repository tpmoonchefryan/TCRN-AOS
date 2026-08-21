// The kernel, exercised against a real Postgres by principals who are NOT administrators.
//
// This file exists because of a specific, damning finding: with only the tokenizer and the
// href helper under test, deleting the entire body of `authorize()` left every gate green.
// Each server-booting gate signs in as the bootstrap account, and `dispatch` returns early
// for an instance admin — so the permission model, the thing most worth checking, was the
// one thing nothing executed.
//
// So: two ordinary members and one outsider, and the assertions below are about what each
// of them is refused.

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { dispatch } from "../../../dist/packages/kernel/src/dispatch.js";
import { hashPassword } from "../../../dist/packages/kernel/src/auth.js";
import { newId } from "../../../dist/packages/store/src/ids.js";
import { migrate } from "../../../dist/packages/store/src/migrate.js";
import "../../../dist/packages/kernel/src/index.js";

const ADMIN_URL = process.env.AOS_DATABASE_URL ?? "postgres://postgres:devpass@127.0.0.1:55432/aos";
const TEST_DB = "aos_kernel_test";
const TEST_URL = ADMIN_URL.replace(/\/[^/]+$/, `/${TEST_DB}`);

let pool;

/** An actor as the authentication layer would build one — never from request content. */
function actorFor(principal, roles = []) {
  return {
    principalId: principal.id,
    handle: principal.handle,
    displayName: principal.handle,
    kind: "human",
    isInstanceAdmin: principal.isInstanceAdmin ?? false,
    credential: "session",
    roles: new Map(roles),
  };
}

async function makePrincipal(handle, { admin = false } = {}) {
  const id = newId("pi");
  await pool.query(
    `INSERT INTO principal (id, handle, display_name, kind, password_phc, is_instance_admin)
     VALUES ($1, $2, $2, 'human', $3, $4)`,
    [id, handle, await hashPassword("a-password-long-enough"), admin],
  );
  return { id, handle, isInstanceAdmin: admin };
}

async function run(operationId, input, actor) {
  const result = await dispatch(pool, operationId, input, actor);
  return result.output;
}

async function refusal(operationId, input, actor) {
  try {
    await dispatch(pool, operationId, input, actor);
    return null;
  } catch (error) {
    return error.reasonCode ?? error.message;
  }
}

let admin;
let maintainer;
let contributor;
let viewer;
let outsider;
let project;
let story;

before(async () => {
  const bootstrap = new pg.Client({ connectionString: ADMIN_URL.replace(/\/[^/]+$/, "/postgres") });
  await bootstrap.connect();
  await bootstrap.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await bootstrap.query(`CREATE DATABASE ${TEST_DB}`);
  await bootstrap.end();

  pool = new pg.Pool({ connectionString: TEST_URL });
  await migrate(pool);
  await pool.query("INSERT INTO instance_meta (id, instance_name) VALUES (true, 'kernel-test')");

  admin = await makePrincipal("admin", { admin: true });
  maintainer = await makePrincipal("maintainer");
  contributor = await makePrincipal("contributor");
  viewer = await makePrincipal("viewer");
  outsider = await makePrincipal("outsider");

  project = await run("project.create", { key: "KT", name: "Kernel test" }, actorFor(admin));
  for (const [person, role] of [[maintainer, "maintainer"], [contributor, "contributor"], [viewer, "viewer"]]) {
    await run("project.add_member", { projectId: project.id, handle: person.handle, role }, actorFor(admin));
  }
  story = await run(
    "work_item.create",
    { projectId: project.id, kind: "story", title: "内核测试用的工作项" },
    actorFor(contributor, [[project.id, "contributor"]]),
  );
});

after(async () => {
  await pool?.end();
});

describe("authorization", () => {
  test("an outsider cannot list the project's work items", async () => {
    const listed = await run("work_item.list", {}, actorFor(outsider));
    assert.equal(listed.total, 0, "a non-member must not see another project's items in a list");
  });

  test("an outsider cannot read a work item by its key", async () => {
    // The list was already scoped; this is the path that was not, and a guessable key
    // (PROJ-1) is all an outsider would need.
    assert.equal(await refusal("work_item.get", { key: story.key }, actorFor(outsider)), "forbidden");
  });

  test("a viewer can read but cannot write", async () => {
    const seen = await run("work_item.get", { key: story.key }, actorFor(viewer, [[project.id, "viewer"]]));
    assert.equal(seen.key, story.key);
    assert.equal(
      await refusal(
        "work_item.update",
        { key: story.key, expectedVersion: seen.version, title: "viewer edit" },
        actorFor(viewer, [[project.id, "viewer"]]),
      ),
      "forbidden",
    );
  });

  test("a contributor cannot delete, a maintainer can", async () => {
    const doomed = await run(
      "work_item.create",
      { projectId: project.id, kind: "story", title: "to be removed" },
      actorFor(contributor, [[project.id, "contributor"]]),
    );
    assert.equal(
      await refusal("work_item.delete", { key: doomed.key }, actorFor(contributor, [[project.id, "contributor"]])),
      "forbidden",
    );
    const removed = await run(
      "work_item.delete",
      { key: doomed.key },
      actorFor(maintainer, [[project.id, "maintainer"]]),
    );
    assert.equal(removed.ok, true);
  });

  test("only an admin can add a member", async () => {
    assert.equal(
      await refusal(
        "project.add_member",
        { projectId: project.id, handle: outsider.handle, role: "viewer" },
        actorFor(maintainer, [[project.id, "maintainer"]]),
      ),
      "forbidden",
    );
  });

  test("an instance-admin-only operation refuses everyone else", async () => {
    assert.equal(
      await refusal("admin.list_accounts", {}, actorFor(maintainer, [[project.id, "maintainer"]])),
      "forbidden",
    );
  });

  test("an unauthenticated caller is refused before anything else", async () => {
    const anonymous = { principalId: "", handle: "anonymous", displayName: "", kind: "human", isInstanceAdmin: false, credential: "session", roles: new Map() };
    assert.equal(await refusal("work_item.list", {}, anonymous), "unauthenticated");
  });
});

describe("optimistic concurrency", () => {
  test("a stale version is refused and reports the current one", async () => {
    const actor = actorFor(contributor, [[project.id, "contributor"]]);
    const current = await run("work_item.get", { key: story.key }, actor);
    await run("work_item.update", { key: story.key, expectedVersion: current.version, title: "first" }, actor);
    try {
      await dispatch(pool, "work_item.update", { key: story.key, expectedVersion: current.version, title: "second" }, actor);
      assert.fail("the second write should have been refused");
    } catch (error) {
      assert.equal(error.reasonCode, "stale_version");
      assert.equal(error.detail.currentVersion, current.version + 1);
    }
  });
});

describe("the status machine", () => {
  test("a permitted transition is allowed and an unpermitted one names what is possible", async () => {
    const actor = actorFor(contributor, [[project.id, "contributor"]]);
    let item = await run("work_item.get", { key: story.key }, actor);
    item = await run("work_item.transition", { key: story.key, expectedVersion: item.version, status: "active" }, actor);
    assert.equal(item.status, "active");

    try {
      await dispatch(pool, "work_item.transition", { key: story.key, expectedVersion: item.version, status: "planned" }, actor);
      assert.fail("active -> planned is not in the transition table");
    } catch (error) {
      assert.equal(error.reasonCode, "transition_not_permitted");
      assert.ok(Array.isArray(error.detail.permitted) && error.detail.permitted.length > 0,
        "a refusal must say what IS possible from here");
    }
  });

  test("done is not terminal: an item can be reopened", async () => {
    const actor = actorFor(contributor, [[project.id, "contributor"]]);
    let item = await run("work_item.get", { key: story.key }, actor);
    item = await run("work_item.transition", { key: story.key, expectedVersion: item.version, status: "done" }, actor);
    assert.equal(item.status, "done");
    item = await run("work_item.transition", { key: story.key, expectedVersion: item.version, status: "active" }, actor);
    assert.equal(item.status, "active", "reopening is ordinary, not exceptional");
  });
});

describe("the audit split", () => {
  test("a change records the field NAMES and keeps the old values only in the revision row", async () => {
    const actor = actorFor(contributor, [[project.id, "contributor"]]);
    const before = await run("work_item.get", { key: story.key }, actor);
    await run("work_item.update", { key: story.key, expectedVersion: before.version, bodyMd: "一段新的正文" }, actor);

    const event = await pool.query(
      `SELECT field_names, revision_ref, actor_label FROM activity_event
        WHERE subject_id = $1 AND action = 'updated' ORDER BY id DESC LIMIT 1`,
      [before.id],
    );
    const row = event.rows[0];
    assert.deepEqual(row.field_names, ["bodyMd"]);
    assert.ok(row.revision_ref, "the event must point at the revision holding the old value");
    assert.equal(row.actor_label, `human:${contributor.handle}`);

    const revision = await pool.query("SELECT prev FROM work_item_revision WHERE id = $1", [row.revision_ref]);
    assert.equal(revision.rows[0].prev.bodyMd, before.bodyMd, "the previous value lives here and nowhere else");

    const stream = await pool.query("SELECT * FROM activity_event WHERE subject_id = $1", [before.id]);
    for (const entry of stream.rows) {
      assert.ok(!JSON.stringify(entry).includes("一段新的正文"), "no activity row may carry a field VALUE");
    }
  });

  test("the activity stream refuses to be rewritten", async () => {
    await assert.rejects(
      () => pool.query("UPDATE activity_event SET action = 'tampered' WHERE id = (SELECT min(id) FROM activity_event)"),
      /AOS_APPEND_ONLY/,
    );
  });
});

describe("gates", () => {
  test("an unsatisfied gate refuses the transition it names, and says which gate", async () => {
    const adminActor = actorFor(admin);
    const governed = await run("project.create", { key: "KTG", name: "Governed", governanceEnabled: true }, adminActor);
    const item = await run("work_item.create", { projectId: governed.id, kind: "story", title: "gated" }, adminActor);
    await run(
      "gate.create",
      { projectId: governed.id, workItemKey: item.key, title: "sign-off", outcomeClass: "role_decision" },
      adminActor,
    );
    const active = await run("work_item.transition", { key: item.key, expectedVersion: item.version, status: "active" }, adminActor);
    try {
      await dispatch(pool, "work_item.transition", { key: item.key, expectedVersion: active.version, status: "done" }, adminActor);
      assert.fail("an unsatisfied gate must block done");
    } catch (error) {
      assert.equal(error.reasonCode, "gate_pending");
      assert.ok(error.detail.gates?.[0]?.title, "the refusal must name the gate standing in the way");
    }
  });
});

describe("paging", () => {
  test("a second page returns the rows the first one did not, with none skipped or repeated", async () => {
    const adminActor = actorFor(admin);
    const paged = await run("project.create", { key: "KTP", name: "Paging" }, adminActor);
    // Created in one burst so several rows share a timestamp — the case a row-wise cursor
    // comparison silently skips.
    const made = [];
    for (let index = 0; index < 7; index += 1) {
      made.push(await run("work_item.create", { projectId: paged.id, kind: "story", title: `item ${index}` }, adminActor));
    }
    const first = await run("work_item.list", { projectId: paged.id, limit: 3 }, adminActor);
    assert.equal(first.items.length, 3);
    assert.ok(first.nextCursor, "there are more rows, so there must be a cursor");

    const second = await run("work_item.list", { projectId: paged.id, limit: 3, cursor: first.nextCursor }, adminActor);
    const third = second.nextCursor
      ? await run("work_item.list", { projectId: paged.id, limit: 3, cursor: second.nextCursor }, adminActor)
      : { items: [] };

    const seen = [...first.items, ...second.items, ...third.items].map((item) => item.key);
    assert.equal(new Set(seen).size, seen.length, "no row may appear on two pages");
    assert.equal(seen.length, made.length, `every row must appear on some page (saw ${seen.length} of ${made.length})`);
  });

  test("a cursor is refused once the filters change", async () => {
    const adminActor = actorFor(admin);
    const first = await run("work_item.list", { limit: 2 }, adminActor);
    if (!first.nextCursor) return;
    assert.equal(
      await refusal("work_item.list", { limit: 2, cursor: first.nextCursor, status: "done" }, adminActor),
      "cursor_filter_mismatch",
    );
  });
});

describe("form-shaped input", () => {
  test("an empty optional field means absent, and an empty required one still fails", async () => {
    const actor = actorFor(contributor, [[project.id, "contributor"]]);
    // parentId="" is what a browser sends for an untouched optional box.
    const made = await run(
      "work_item.create",
      { projectId: project.id, kind: "story", title: "from a form", parentId: "", bodyMd: "" },
      actor,
    );
    assert.equal(made.parentId, null);
    assert.equal(
      await refusal("work_item.create", { projectId: project.id, kind: "story", title: "" }, actor),
      "validation_failed",
    );
  });

  test("a textarea's lines become a list", async () => {
    const actor = actorFor(contributor, [[project.id, "contributor"]]);
    const result = await run("work_item.set_labels", { key: story.key, labels: "alpha\nbeta\n\n" }, actor);
    assert.deepEqual(result.labels, ["alpha", "beta"]);
  });
});

describe("sign-out", () => {
  test("logging out revokes the session the caller is on", async () => {
    const session = await pool.query(
      `INSERT INTO session (id, principal_id, token_sha256, csrf_secret, expires_at)
       VALUES ($1, $2, $3, 'secret', now() + interval '1 day') RETURNING id`,
      [newId("se"), contributor.id, "digest-for-test"],
    );
    const sessionId = session.rows[0].id;
    const actor = { ...actorFor(contributor, [[project.id, "contributor"]]), sessionId };
    const result = await run("auth.logout", {}, actor);
    assert.equal(result.revoked, 1, "exactly the caller's own session must be revoked");
    const after = await pool.query("SELECT revoked_at FROM session WHERE id = $1", [sessionId]);
    assert.ok(after.rows[0].revoked_at, "the row must actually carry a revocation time");
  });
});
