import assert from "node:assert/strict";
import test from "node:test";
import { analyze, toQuery, toPrefixQuery } from "../../../dist/packages/store/src/search-text.js";

test("Latin text becomes lowercased whole words", () => {
  assert.deepEqual(analyze("Work Item Search"), ["work", "item", "search"]);
  assert.deepEqual(analyze("PROJ-123"), ["proj", "123"]);
});

test("a CJK run becomes overlapping bigrams", () => {
  // 工单管理 -> 工单, 单管, 管理. The overlap is what makes a two-character query
  // findable no matter where it sits in the run.
  assert.deepEqual(analyze("工单管理"), ["工单", "单管", "管理"]);
});

test("a lone CJK character is emitted as itself", () => {
  assert.deepEqual(analyze("单"), ["单"]);
  assert.deepEqual(analyze("查 单"), ["查", "单"]);
});

test("mixed scripts split at the boundary", () => {
  assert.deepEqual(analyze("AOS 工单"), ["aos", "工单"]);
  assert.deepEqual(analyze("工单v2"), ["工单", "v2"]);
});

test("punctuation separates runs rather than joining them", () => {
  assert.deepEqual(analyze("工单，知识库"), ["工单", "知识", "识库"]);
});

test("a two-character Chinese query produces one lexeme, not zero", () => {
  // This is the whole reason the analyzer exists: to_tsvector('simple','工单管理')
  // yields a single token and a 工单 search against it matches nothing.
  assert.equal(toQuery("工单"), "'工单'");
});

test("multi-term queries are ANDed", () => {
  assert.equal(toQuery("aos 工单"), "'aos' & '工单'");
});

test("empty and punctuation-only input yields no query rather than a query matching all", () => {
  assert.equal(toQuery(""), null);
  assert.equal(toQuery("   ,,,  "), null);
});

test("typeahead marks only the final token as a prefix", () => {
  assert.equal(toPrefixQuery("work it"), "'work' & 'it':*");
});

test("an apostrophe separates words rather than reaching the query as a quote", () => {
  // The tokenizer only ever emits letters, digits, underscore and CJK, so no lexeme can
  // carry a quote into the tsquery. `quoteLexeme`'s escaping is a belt on top of that,
  // not the thing keeping the query well-formed.
  assert.deepEqual(analyze("o'brien"), ["o", "brien"]);
  assert.equal(toQuery("o'brien"), "'o' & 'brien'");
});
