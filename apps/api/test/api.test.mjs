import test from "node:test";
import assert from "node:assert/strict";
import { apiHealthReadback, createAosApiApp } from "../../../dist/apps/api/src/index.js";

test("API shell composes store and gateway without starting runtime services", () => {
  const app = createAosApiApp();
  const health = apiHealthReadback(app);
  assert.equal(health.ok, true);
  assert.equal(health.projectCount, 2);
  assert.equal(health.externalQueue, "none");
  assert.equal(health.liveSend, false);
  assert.equal(app.posture.payloadAdminBypass, false);
});
