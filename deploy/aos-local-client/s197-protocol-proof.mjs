#!/usr/bin/env node
// INIT-020 TCRN-CROSS-STORY-197 — document protocol proof.
// The freeze protocol is intentionally a document contract, not a machine gate
// that pretends to intercept every future engine commit. This read-only proof
// checks that both named governing documents carry the same minimum clauses.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const PLATFORM_ROOT = resolve(HERE, "../../..");

export const PROTOCOL_DOCUMENTS = Object.freeze([
  Object.freeze({ id: "platform-claude", path: "CLAUDE.md" }),
  Object.freeze({ id: "init-020-handover", path: "TCRN-AOS/docs/reports/init-020/HANDOVER-2026-08-08-final-codex.md" }),
]);

export const PROTOCOL_CLAUSES = Object.freeze([
  Object.freeze({ id: "date", pattern: /2026-08-08/u }),
  Object.freeze({ id: "freeze", pattern: /非紧急开发冻结/u }),
  Object.freeze({ id: "emergency-fail-closed", pattern: /fail-closed 事故/u }),
  Object.freeze({ id: "emergency-integrity", pattern: /数据完整性或备份失效/u }),
  Object.freeze({ id: "emergency-security", pattern: /安全事件/u }),
  Object.freeze({ id: "local-mcp-cli", pattern: /本地 MCP 面与引擎 CLI/u }),
  Object.freeze({ id: "ssh-boundary", pattern: /SSH.{0,12}(严禁日常化|不得日常化)/su }),
  Object.freeze({ id: "trigger-100", pattern: /100/u }),
  Object.freeze({ id: "trigger-300", pattern: /300/u }),
  Object.freeze({ id: "trigger-12-weeks", pattern: /12.{0,4}周/u }),
  Object.freeze({ id: "failure-pattern", pattern: /failure-pattern register/u }),
  Object.freeze({ id: "review-initiative", pattern: /运行复盘 Initiative/u }),
  Object.freeze({ id: "weekly-gate", pattern: /prod:ready/u }),
  Object.freeze({ id: "owner", pattern: /Owner/u }),
]);

function readDocument(path) {
  try {
    return { ok: true, text: readFileSync(resolve(PLATFORM_ROOT, path), "utf8") };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

export function judgeS197Protocol({ documents = PROTOCOL_DOCUMENTS, clauses = PROTOCOL_CLAUSES, read = readDocument } = {}) {
  const rows = documents.map((document) => {
    const loaded = read(document.path);
    const missing = loaded.ok
      ? clauses.filter((clause) => !clause.pattern.test(loaded.text)).map((clause) => clause.id)
      : clauses.map((clause) => clause.id);
    return {
      id: document.id,
      path: document.path,
      ok: loaded.ok && missing.length === 0,
      missing,
      ...(loaded.ok ? {} : { error: loaded.error }),
    };
  });
  const ok = rows.every((row) => row.ok);
  return {
    schemaVersion: "tcrn.s197-protocol-proof.v1",
    ok,
    reasonCode: ok ? "S197_PROTOCOL_VERIFIED" : "S197_PROTOCOL_INCOMPLETE",
    documents: rows,
  };
}

if (process.argv[1]?.endsWith("s197-protocol-proof.mjs")) {
  const result = judgeS197Protocol();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  for (const row of result.documents) {
    process.stderr.write(`${row.id}: ${row.ok ? "green" : `red (${row.missing.join(", ")})`}\n`);
  }
  if (!result.ok) process.exitCode = 1;
}
