import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../../dist/apps/server/src/app.js";

test("readyz does not expose a driver's raw connection error", async () => {
  const secret = "postgres://user:password@db.internal/private";
  const app = await buildApp({
    pool: { query: async () => { throw new Error(`driver leaked ${secret}`); } },
    allowedHosts: [],
    version: "test",
    secureCookies: false,
    schemaStatus: async () => ({ applied: null, expected: null }),
  });
  const response = await app.inject({ method: "GET", url: "/readyz" });
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 503);
  assert.equal(body.reasonCode, "database_unreachable");
  assert.equal("message" in body, false);
  assert.equal(response.body.includes(secret), false);
  await app.close();
});
