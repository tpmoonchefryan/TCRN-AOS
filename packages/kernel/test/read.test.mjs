import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseQuery } from "../../../dist/packages/kernel/src/read.js";

describe("read query discipline", () => {
  const allowed = new Set(["status", "limit"]);

  test("rejects unknown filters by name", () => {
    assert.throws(
      () => parseQuery(new URLSearchParams("statuss=done"), allowed),
      (error) => error.reasonCode === "unsupported_filter" && error.detail.unsupportedKeys[0] === "statuss",
    );
  });

  test("rejects authority-shaped keys before the allow-list", () => {
    assert.throws(
      () => parseQuery(new URLSearchParams("actor=x"), allowed),
      (error) => error.reasonCode === "client_authority_denied" && error.detail.forbiddenKeys[0] === "actor",
    );
  });

  test("keeps ordinary filters and rejects ambiguous values", () => {
    assert.deepEqual(
      [...parseQuery(new URLSearchParams("status=done&limit=10"), allowed).entries()],
      [["status", "done"], ["limit", "10"]],
    );
    assert.throws(
      () => parseQuery(new URLSearchParams("status=done&status=active"), allowed),
      (error) => error.reasonCode === "unsupported_filter",
    );
  });
});
