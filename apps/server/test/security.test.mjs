import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { LoginRateLimiter, isLocalRedirect } from "../../../dist/apps/server/src/security.js";

describe("login security helpers", () => {
  test("rate limits after five failures by source or handle and expires old failures", () => {
    const limiter = new LoginRateLimiter({ maxFailures: 5, windowMs: 1_000 });
    for (let index = 0; index < 4; index += 1) {
      limiter.recordFailure("10.0.0.1", "alice", index);
    }
    assert.equal(limiter.isBlocked("10.0.0.1", "alice", 4), false);
    limiter.recordFailure("10.0.0.1", "alice", 4);
    assert.equal(limiter.isBlocked("10.0.0.1", "alice", 5), true);
    assert.equal(limiter.isBlocked("10.0.0.2", "alice", 5), true, "the handle dimension must also throttle");
    assert.equal(limiter.isBlocked("10.0.0.1", "bob", 5), true, "the source dimension must also throttle");
    assert.equal(limiter.isBlocked("10.0.0.1", "alice", 1_005), false);
  });

  test("only local absolute paths are valid redirects", () => {
    assert.equal(isLocalRedirect("/work-items"), true);
    assert.equal(isLocalRedirect("/"), true);
    assert.equal(isLocalRedirect("https://evil.example"), false);
    assert.equal(isLocalRedirect("//evil.example"), false);
    assert.equal(isLocalRedirect("evil.example"), false);
  });
});
