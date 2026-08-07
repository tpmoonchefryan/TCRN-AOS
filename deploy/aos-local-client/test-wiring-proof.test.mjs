// SPDX-License-Identifier: Apache-2.0
// INC-079 red-leg fixture: the wiring proof must inspect the canonical test
// command, not merely find a filename in any package script.

import assert from "node:assert/strict";
import { test } from "node:test";

import { judgeAosTestWiring } from "./test-wiring-proof.mjs";

test("AOS test wiring enumerates exactly the canonical node --test command", () => {
  const result = judgeAosTestWiring();
  assert.equal(result.ok, true, JSON.stringify(result.problems));
  assert.equal(result.reasonCode, "TEST_WIRING_VERIFIED");
  assert.equal(result.orphaned.length, 0);
  assert.ok(result.testCommandFiles.includes("deploy/aos-local-client/test-wiring-proof.test.mjs"));
});
