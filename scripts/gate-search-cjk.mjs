#!/usr/bin/env node
// Prove Chinese search works, against a real Postgres, on a fixed corpus.
//
// The reason this gate exists at all: `to_tsvector('simple','工单管理系统')` produces ONE
// lexeme for the whole run, so searching 工单 — a two-character word, and two characters
// is the dominant Chinese word form — matches nothing. pg_trgm does not rescue it either;
// its index cannot accelerate a pattern shorter than three characters.
//
// The analyzer is bespoke text processing on the critical path of the product's primary
// language, with no upstream and no test corpus but this one. So this gate holds the
// corpus, and it also asserts the NAIVE behaviour still fails — if a Postgres upgrade ever
// makes the plain configuration work, the note above stops being true and someone should
// find out from a red gate rather than from folklore.

import pg from "pg";
import { upsertSearchDoc } from "../dist/packages/kernel/src/audit.js";
import { toQuery } from "../dist/packages/store/src/search-text.js";

const DB = process.env.AOS_DATABASE_URL ?? "postgres://postgres:devpass@127.0.0.1:55432/aos";

const CORPUS = [
  { id: "c1", title: "AOS 工单管理系统", body: "支持看板、检索与知识库。" },
  { id: "c2", title: "知识库页面版本历史", body: "每次编辑写入前像，可以逐版回滚。" },
  { id: "c3", title: "Postgres storage backend", body: "Raw SQL, no ORM, migrations codegen'd into the artifact." },
  { id: "c4", title: "中文分词与检索", body: "二元切分让两个汉字的查询可以命中。" },
];

const CASES = [
  { q: "工单", expect: ["c1"], why: "a two-character word in a longer run" },
  { q: "管理", expect: ["c1"], why: "a two-character word in the middle of a run" },
  { q: "知识", expect: ["c1", "c2"], why: "a term in one document's title and another's body — both are hits, and expecting only one was the test being wrong rather than the analyzer" },
  { q: "版本", expect: ["c2"], why: "a term inside the title" },
  { q: "检索", expect: ["c1", "c4"], why: "a term appearing in two documents, one in body one in title" },
  { q: "中文 检索", expect: ["c4"], why: "two terms are ANDed, not ORed" },
  { q: "storage", expect: ["c3"], why: "Latin still works and is case-insensitive" },
  { q: "Postgres", expect: ["c3"], why: "mixed case matches" },
  { q: "无关词汇", expect: [], why: "a term in no document matches nothing, rather than everything" },
  { q: "工单 storage", expect: [], why: "AND across scripts finds nothing when no document has both" },
];

async function main() {
  const client = new pg.Client({ connectionString: DB });
  await client.connect();
  const prefix = `gate-cjk-${Date.now()}-${Math.random().toString(36).slice(2)}-`;

  const failures = [];
  let naiveHits = null;
  try {
    // Exercise the same write helper the product uses. A hand-copied INSERT here would
    // let the gate stay green after the real index construction changed.
    for (const document of CORPUS) {
      await upsertSearchDoc(client, {
        subjectType: "work_item",
        subjectId: `${prefix}${document.id}`,
        title: document.title,
        body: document.body,
      });
    }

    for (const testCase of CASES) {
      const query = toQuery(testCase.q);
      const found = query
        ? (
            await client.query(
              "SELECT subject_id FROM search_doc WHERE subject_type = 'work_item' AND subject_id LIKE $1 AND search_vec @@ to_tsquery('simple', $2) ORDER BY subject_id",
              [`${prefix}%`, query],
            )
          ).rows.map((row) => row.subject_id.slice(prefix.length))
        : [];
      const expected = [...testCase.expect].sort();
      if (JSON.stringify(found) !== JSON.stringify(expected)) {
        failures.push({ query: testCase.q, why: testCase.why, expected, found });
      }
    }

    // The control: the same search with the plain configuration, which must still fail.
    const naive = await client.query(
      "SELECT count(*)::int AS hits FROM (SELECT to_tsvector('simple', $1) AS v) t WHERE t.v @@ to_tsquery('simple', $2)",
      ["工单管理系统", "工单"],
    );
    naiveHits = naive.rows[0].hits;
    if (naiveHits !== 0) {
      failures.push({
        query: "control",
        why: "the plain configuration now matches a two-character CJK query, so the analyzer's stated reason for existing is out of date",
        expected: 0,
        found: naiveHits,
      });
    }
  } finally {
    await client.query("DELETE FROM search_doc WHERE subject_type = 'work_item' AND subject_id LIKE $1", [`${prefix}%`]);
    await client.end();
  }

  const report = { ok: failures.length === 0, cases: CASES.length, corpus: CORPUS.length, naiveControlHits: naiveHits, failures };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reasonCode: "GATE_ERROR", message: error.message }));
  process.exit(1);
});
