// STORY-161.4 — turn batch-1/cards.json into ceremony payloads (create batches).
// Usage: node docs/reports/init-019/S161/generate-payloads.mjs
// Emits S161/outputs/create-batch-1.json and create-batch-2.json (10 cards each),
// each a drive.mjs case with knowledge-create steps + a knowledge-list readback.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cards = JSON.parse(readFileSync(join(here, "batch-1/cards.json"), "utf8"));
const outputDir = join(here, "outputs");
mkdirSync(outputDir, { recursive: true });

const sha256 = (text) => createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");

function cardFlags(card) {
  const { common } = cards;
  return {
    "external-key": card["external-key"],
    scope: common.scope,
    "project-id": cards.projectId,
    "role-scopes": common["role-scopes"],
    category: card.category,
    kind: card.kind,
    tags: card.tags,
    subject: card.subject,
    summary: card.summary,
    snippet: card.snippet,
    "accountable-owner-id": cards.accountableOwner,
    "source-references": card["source-references"],
    "source-digest": sha256(card["source-references"].join("\n")),
    "work-ids": ["-"],
    "decision-ids": ["-"],
    "gate-ids": ["-"],
    "evidence-ids": card["evidence-ids"],
    lifecycle: common.lifecycle,
    retrieval: common.retrieval,
    freshness: common.freshness,
    "last-verified": common["last-verified"],
    "stale-days": common["stale-days"],
    export: common.export,
    body: card.body
  };
}

const CHUNK = 10;
function buildCase(prefix, slice, startTotal) {
  const steps = slice.map((card) => ({ verb: "knowledge-create", flags: cardFlags(card) }));
  return [{
    label: `aos-curation-${prefix}`,
    arguments: {
      partition: "cross-project",
      payload: {
        schemaVersion: "aos.local-client-ceremony.v1",
        story: "TCRN-CROSS-INIT-019-STORY-161",
        intent: `curate batch-1 ${prefix}: create ${slice.length} knowledge cards via the ceremony write face`,
        steps,
        readback: [
          { verb: "knowledge-list", flags: { selection: "all" }, expect: { total: startTotal + slice.length } }
        ]
      }
    }
  }];
}

for (let i = 0; i < cards.cards.length; i += CHUNK) {
  const slice = cards.cards.slice(i, i + CHUNK);
  const batch = i / CHUNK + 1;
  const before = i; // cross store starts empty for the first batch
  const caseFile = buildCase(`create-batch-${batch}`, slice, before);
  writeFileSync(join(outputDir, `create-batch-${batch}.json`), `${JSON.stringify(caseFile, null, 1)}\n`);
  console.log(`create-batch-${batch}.json: ${slice.length} cards, readback total ${before + slice.length}`);
}
console.log("cards total:", cards.cards.length);
