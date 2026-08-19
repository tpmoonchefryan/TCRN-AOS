import assert from "node:assert/strict";
import test from "node:test";
import { buildHref, hrefResetConditions, hrefWithout } from "../../../../dist/apps/web/src/url.js";

test("a query string is merged, never appended", () => {
  // The regression: appending produced a second '?', and the browser read everything
  // after the first one as a single value.
  const href = buildHref("/work-items", new URLSearchParams("project=TMS"), { status: "active" });
  assert.equal(href.split("?").length - 1, 1, "exactly one question mark");
  assert.equal(href, "/work-items?project=TMS&status=active");
});

test("every key appears exactly once even when the caller repeats it", () => {
  const href = buildHref("/work-items", new URLSearchParams("status=done&status=active"), { status: "blocked" });
  const params = new URLSearchParams(href.split("?")[1]);
  assert.deepEqual(params.getAll("status"), ["blocked"]);
});

test("a changed value wins over the seeded one", () => {
  const href = buildHref("/work-items", { project: "TMS", status: "done" }, { status: "active" });
  assert.equal(new URL(href, "http://x").searchParams.get("status"), "active");
});

test("null, undefined and empty remove a key rather than writing it", () => {
  const href = buildHref("/work-items", new URLSearchParams("project=TMS&q=hello"), { q: null });
  assert.equal(href, "/work-items?project=TMS");
  assert.equal(buildHref("/x", {}, { a: undefined, b: "" }), "/x");
});

test("values are encoded, so a value that contains a separator cannot forge a parameter", () => {
  const href = buildHref("/work-items", {}, { q: "a&status=done" });
  const params = new URL(href, "http://x").searchParams;
  assert.equal(params.get("q"), "a&status=done");
  assert.equal(params.get("status"), null, "the injected key must not exist");
});

test("a CJK query round-trips through the href", () => {
  const href = buildHref("/work-items", {}, { q: "工单" });
  assert.equal(new URL(href, "http://x").searchParams.get("q"), "工单");
});

test("removing one condition leaves the others alone", () => {
  const current = new URLSearchParams("project=TMS&status=active&kind=story");
  assert.equal(hrefWithout("/work-items", current, "status"), "/work-items?kind=story&project=TMS");
});

test("resetting conditions keeps the scope, because scope is not a condition", () => {
  const current = new URLSearchParams("project=TMS&status=active&q=x&kind=story");
  assert.equal(hrefResetConditions("/work-items", current), "/work-items?project=TMS");
});

test("a href with no parameters carries no question mark at all", () => {
  assert.equal(buildHref("/work-items", {}), "/work-items");
});

test("key order is stable regardless of insertion order", () => {
  const a = buildHref("/x", { b: "2", a: "1" });
  const b = buildHref("/x", { a: "1", b: "2" });
  assert.equal(a, b);
});
