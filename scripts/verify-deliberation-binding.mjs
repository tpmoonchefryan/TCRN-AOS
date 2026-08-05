#!/usr/bin/env node
// TCRN-CROSS-STORY-155 (S18) — does the chain hold what the isolated seats wrote?
//
// WHY THIS IS THE ACTUAL DELIVERABLE. "执行形态=多代理" has until now been a
// DISCLOSURE: an orchestrator states in the opening position that the seats were
// independent, and a reader either believes it or does not. Binding does not make
// independence provable — nothing here authenticates who produced a seat's bytes,
// and the trusted collector (EPIC-020) does not exist. What binding DOES make
// provable is the half that was previously unfalsifiable in the other direction:
// that the text standing on the chain is byte-for-byte the text the seat produced,
// rather than something the orchestrator wrote afterwards and attributed.
//
// So the claim this gate certifies is exactly:
//   for every seat, sha256(reconstruct(chain positions)) == receipts[seat].outputDigest
// and nothing stronger. A reader who wants authenticity still has to trust the
// orchestrator's freshContext self-report; that ceiling is restated below and in
// the receipts file, and it does not shrink because a gate now exists.
//
// RECONSTRUCTION is the inverse of the planner's split: strip each part's leading
// n/N marker line, strip the trailing binding-reference line from the last part,
// join the remainders with a single newline.
//
//   node scripts/verify-deliberation-binding.mjs --receipts <file> [--conference-id <id>]
//
// Exit 0 only if every seat matches. A seat whose position is missing from the
// chain, or whose bytes differ by one character, exits 1 and names the seat.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { VM_ENGINE_CLI, VM_HOST } from "./../deploy/aos-local-client/topology.mjs";
import { aosPartition } from "./../deploy/aos-local-client/aos-partitions.mjs";

const BIND_MARKER = "绑定收据: ";
const sha256Text = (text) => createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");

const argument = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
};

/** The inverse of the planner's split. Order follows the receipt's positionKeys. */
export function reconstruct(parts) {
  const bodies = parts.map((text, index) => {
    let body = text;
    if (/^\d+\/\d+\n/u.test(body)) body = body.slice(body.indexOf("\n") + 1);
    if (index === parts.length - 1) {
      const at = body.lastIndexOf(`\n\n${BIND_MARKER}`);
      if (at !== -1) body = body.slice(0, at);
    }
    return body;
  });
  return bodies.join("\n");
}

function readChainPositions(conferenceId, partition = "cross-project") {
  const target = aosPartition(partition);
  const out = execFileSync("ssh", [VM_HOST,
    `node ${VM_ENGINE_CLI} conference-position-list --workspace ${target.workspace} --conference-id ${conferenceId}`],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const parsed = JSON.parse(out);
  const rows = parsed.positions ?? parsed.records ?? [];
  return new Map(rows.map((row) => {
    const record = row.record ?? row;
    return [record.id ?? row.id, record.position ?? row.position];
  }));
}

function main() {
  const receiptsPath = argument("receipts");
  if (!receiptsPath) {
    process.stderr.write("usage: verify-deliberation-binding.mjs --receipts <file> [--conference-id <id>]\n");
    process.exit(2);
  }
  const receipts = JSON.parse(readFileSync(resolve(receiptsPath), "utf8"));
  const conferenceId = argument("conference-id")
    ?? `conference:${createHash("sha256").update(`conference\0${receipts.conferenceKey.toUpperCase()}`, "utf8").digest("hex").slice(0, 24)}`;

  const onChain = readChainPositions(conferenceId);
  const derivedId = (key) => `position:${createHash("sha256")
    .update(`position\0${key.toUpperCase()}`, "utf8").digest("hex").slice(0, 24)}`;

  const seats = receipts.receipts.map((receipt) => {
    const parts = receipt.positionKeys.map((key) => onChain.get(derivedId(key)) ?? null);
    if (parts.some((part) => part === null)) {
      return { actorId: receipt.actorId, ok: false, reasonCode: "POSITION_ABSENT_FROM_CHAIN", positionKeys: receipt.positionKeys };
    }
    const rebuilt = reconstruct(parts);
    const digest = sha256Text(rebuilt);
    return {
      actorId: receipt.actorId,
      positionKeys: receipt.positionKeys,
      ok: digest === receipt.outputDigest,
      reasonCode: digest === receipt.outputDigest ? "SEAT_BYTES_MATCH_RECEIPT" : "SEAT_BYTES_DIVERGE",
      expectedDigest: receipt.outputDigest,
      rebuiltDigest: digest,
      rebuiltBytes: Buffer.byteLength(rebuilt, "utf8"),
      receiptBytes: receipt.outputBytes
    };
  });

  const failed = seats.filter((seat) => !seat.ok);
  const verdict = {
    ok: failed.length === 0,
    reasonCode: failed.length === 0 ? "DELIBERATION_BINDING_VERIFIED" : "DELIBERATION_BINDING_BROKEN",
    gate: "conference-deliberation-binding",
    conferenceKey: receipts.conferenceKey,
    conferenceId,
    claim: "每一席在链上的立场,剥去拆片标记与绑定行后重建,其 sha256 等于收据登记的 outputDigest",
    ceiling: "只证内容一致,不证认证:freshContext 由编排者自记,可信采集方(引擎 EPIC-020)未建成;"
      + "本判据变红代表链上文本与收据不符,变绿不代表某个座位真的独立产出了它",
    seats,
    failed: failed.map((seat) => seat.actorId)
  };
  process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
  process.exit(verdict.ok ? 0 : 1);
}

if (process.argv[1] && process.argv[1].endsWith("verify-deliberation-binding.mjs")) main();
