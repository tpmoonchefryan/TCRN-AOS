import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { describe, test } from "node:test";
import { authenticatePassword, hashPassword } from "../../../dist/packages/kernel/src/auth.js";

function clientFor(row) {
  return {
    async query(sql) {
      if (sql.includes("FROM principal WHERE lower(handle)")) return { rows: row ? [row] : [] };
      if (sql.includes("SELECT project_id, role FROM project_member")) return { rows: [] };
      throw new Error(`unexpected query in auth test: ${sql}`);
    },
  };
}

describe("password authentication", () => {
  test("a missing account still performs work comparable to a wrong password", async () => {
    const phc = await hashPassword("correct-password");
    const row = {
      id: "pi-existing",
      handle: "existing",
      display_name: "Existing",
      kind: "human",
      is_instance_admin: false,
      disabled_at: null,
      must_change_password: false,
      password_phc: phc,
    };

    const timedFailure = async (client, handle) => {
      const started = performance.now();
      await assert.rejects(
        () => authenticatePassword(client, handle, "wrong-password"),
        (error) => error.reasonCode === "unauthenticated",
      );
      return performance.now() - started;
    };

    const wrongPasswordMs = await timedFailure(clientFor(row), "existing");
    const missingAccountMs = await timedFailure(clientFor(null), "missing");
    assert.ok(
      missingAccountMs >= wrongPasswordMs * 0.2,
      `missing-account work was ${missingAccountMs.toFixed(1)}ms versus ${wrongPasswordMs.toFixed(1)}ms for a wrong password`,
    );
  });
});
