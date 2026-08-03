#!/usr/bin/env node
// Multi-agent deliberation planner for the local-side remote ceremony
// (TCRN-AOS-INIT-004 / CONF-014 paid for this file's existence).
//
//   node deploy/aos-local-client/deliberation-multi-agent.mjs --spec <file> [--verify-only]
//
// WHY THIS EXISTS. ceremony.mjs is a synthesis-only driver: one context writes
// one or more steps and reads them back. It has no notion of a seat that must be
// produced by an INDEPENDENT context and bound to a receipt. That is the gap this
// file closes on the AOS side (the engine-side trusted collector, EPIC-020, is
// still pending; freshContext below is orchestrator-self-recorded, so the binding
// proves consistency, never authenticity — that ceiling is restated in the
// receipts file it writes).
//
// WHAT IT PLANS. It takes a multi-agent deliberation spec and turns it into the
// two artifacts the ceremony needs, the way conf-007 / CONF-014 were produced by
// hand:
//
//   1. an execution-receipts file: per seat, positionKeys, actorId, freshContext,
//      outputDigest (sha256 of the seat .txt original) and outputBytes;
//   2. a ceremony payload: conference-open plus one append-position per seat
//      (plus an opening position from the orchestrator). Positions over 2048
//      bytes are split into sequential parts with n/N marker lines; the last
//      part carries the trailing binding-reference line. The outputDigest is
//      computed over the seat .txt original ONLY — see the reconstruction field
//      for the exact verification path.
//
// It does NOT spawn the sub-agents: that is the orchestrator's job (a Node script
// cannot spawn a Claude seat). The orchestrator runs the independent seats, saves
// each original to a .txt, then runs this planner to produce receipts + payload,
// fills the conference-id placeholder after conference-open, and drives ceremony.mjs.
//
// A spec that names more participant-ids than seats that will actually produce a
// position is a nominal-multiplicity trap (CONF-013 listed verity without letting
// verity speak). The planner refuses a participant that has no seat and warns on a
// seat that has no participant, so a spec cannot silently over-claim independence.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_POSITION_BYTES = 2048;
const BIND_MARKER = "绑定收据: ";
const SCHEMA = "aos.multi-agent-deliberation-spec.v1";

const sha256Text = (text) => createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");

function refuse(message) {
  process.stderr.write(`spec invalid: ${message}\n`);
  process.exit(2);
}

function loadSpec(path) {
  const text = readFileSync(resolve(path), "utf8");
  const spec = JSON.parse(text);
  if (spec.schemaVersion !== SCHEMA) refuse(`schemaVersion must be ${SCHEMA}`);
  for (const key of ["conferenceKey", "projectId", "type", "title", "desiredOutcome",
    "participantIds", "opening", "seats", "receiptsOut", "payloadOut"]) {
    if (spec[key] === undefined) refuse(`${key} is required`);
  }
  return spec;
}

function bindLine(receiptsPath) {
  return `${BIND_MARKER}${receiptsPath}(摘要值因自指省略,见开场立场)`;
}

/** Split text into two parts at a paragraph boundary near the byte midpoint. */
function splitPosition(body) {
  const paras = body.split("\n\n");
  let acc = "";
  const half = Buffer.byteLength(body, "utf8") / 2;
  for (let i = 0; i < paras.length; i++) {
    if (i > 0 && Buffer.byteLength(acc + paras[i], "utf8") >= half) break;
    acc = acc ? `${acc}\n\n${paras[i]}` : paras[i];
  }
  const back = body.slice(acc.length + 2);
  return [acc, back];
}

/** One seat -> one or two (key, positionBody) tuples, all <= 2048B. */
function planSeatPosition({ seat, actorId, file, receiptsPath, positionPrefix }) {
  if (!existsSync(file)) refuse(`seat ${seat}: file not found: ${file}`);
  const body = readFileSync(file, "utf8");
  const digest = sha256Text(body);
  const bytes = Buffer.byteLength(body, "utf8");
  const bind = bindLine(receiptsPath);
  const full = `${body}\n\n${bind}`;
  if (Buffer.byteLength(full, "utf8") <= MAX_POSITION_BYTES) {
    return { positionKeys: [positionPrefix], digest, bytes, parts: [[positionPrefix, full]] };
  }
  const [front, back] = splitPosition(body);
  const p1 = `1/2\n${front}`;
  const p2 = `2/2\n${back}\n\n${bind}`;
  for (const part of [p1, p2]) {
    if (Buffer.byteLength(part, "utf8") > MAX_POSITION_BYTES) {
      refuse(`seat ${seat}: a split part still exceeds ${MAX_POSITION_BYTES}B`);
    }
  }
  return { positionKeys: [positionPrefix, `${positionPrefix}-2`], digest, bytes, parts: [[positionPrefix, p1], [`${positionPrefix}-2`, p2]] };
}

function main() {
  const specArg = process.argv.indexOf("--spec");
  if (specArg < 0) {
    process.stderr.write("usage: deliberation-multi-agent.mjs --spec <file> [--verify-only]\n");
    process.exit(2);
  }
  const spec = loadSpec(process.argv[specArg + 1]);
  const verifyOnly = process.argv.includes("--verify-only");
  const receiptsPath = spec.receiptsOut;
  const bind = bindLine(receiptsPath);

  // Participant/seat coherence: a participant without a seat is nominal-multiplicity.
  const seatActors = new Set(spec.seats.map((s) => s.actorId));
  const openingActor = spec.opening.actorId;
  for (const participant of spec.participantIds) {
    const hasSeat = seatActors.has(participant) || participant === openingActor
      || participant === "owner:governance";
    if (!hasSeat) {
      refuse(`participant ${participant} has no seat and is not owner/opening — nominal-multiplicity trap`);
    }
  }

  const receipts = [];
  const appendSteps = [];
  for (const { seat, actorId, file } of spec.seats) {
    const confKeyShort = spec.conferenceKey.replace(/^TCRN-AOS-/, "");
    const prefix = spec.positionPrefix
      ? spec.positionPrefix.replace("<SEAT>", seat.toUpperCase())
      : `POS-${confKeyShort}-${seat.toUpperCase()}-1`;
    const plan = planSeatPosition({ seat, actorId, file, receiptsPath, positionPrefix: prefix });
    receipts.push({
      positionKeys: plan.positionKeys,
      actorId,
      subagentLabel: `seat:${seat}`,
      freshContext: true,
      outputDigest: plan.digest,
      outputBytes: plan.bytes
    });
    for (const [key, position] of plan.parts) {
      appendSteps.push({
        verb: "conference-append-position",
        flags: {
          "conference-id": spec.conferenceIdPlaceholder ?? "<CONFERENCE_ID>",
          "external-key": key,
          "actor-id": actorId,
          position,
          risks: spec.seatRisks ?? "读面放 LAN 的治理记录机密性暴露与注入升级风险",
          recommendations: spec.seatRecommendations ?? "按本立场裁读面边界",
          "evidence-ids": "-"
        }
      });
    }
  }

  const receiptsDoc = {
    schemaVersion: "aos.conference-execution-receipts.v1",
    conferenceKey: spec.conferenceKey,
    mode: spec.mode ?? "multi-agent-deliberative",
    collector: spec.collector ?? "orchestrator-self-recorded; no trusted collector exists (engine EPIC-020 pending) - binding proves consistency, never authenticity",
    workflowRunId: spec.workflowRunId ?? "orchestrator-session (no workflow run)",
    capturedAt: spec.capturedAt ?? null,
    reconstruction: spec.reconstruction ?? (
      "positions >2048B are split into sequential chain positions POS-<KEY>-1 and POS-<KEY>-1-2; "
      + "each part body starts with a marker line n/N; the LAST part carries a trailing binding-reference line. "
      + "To verify outputDigest: strip each leading marker line, strip the trailing binding-reference line from the last part, "
      + "join the remainders with a single newline - the result must equal the seat .txt original whose sha256 is outputDigest."
    ),
    receipts
  };

  // The receipts digest must be known BEFORE the opening position is rendered, so
  // the opening can bind to the exact receipts file this run produces. CONF-014 ran
  // this as two passes by hand and paid for it with a stale-sha correction position;
  // the placeholder makes the tool self-consistent in one pass.
  const digest = sha256Text(JSON.stringify(receiptsDoc, null, 1));

  const opening = spec.opening;
  if (typeof opening.text !== "string") refuse("opening.text is required");
  const openingText = opening.text.includes("{receiptsSha256}")
    ? opening.text.replaceAll("{receiptsSha256}", digest)
    : opening.text;
  const openingStep = {
    verb: "conference-append-position",
    flags: {
      "conference-id": spec.conferenceIdPlaceholder ?? "<CONFERENCE_ID>",
      "external-key": opening.externalKey,
      "actor-id": opening.actorId,
      position: openingText,
      risks: spec.openingRisks ?? "读面放 LAN 使治理记录对局域网可读",
      recommendations: spec.openingRecommendations ?? "按各视角立场裁读面边界",
      "evidence-ids": "-"
    }
  };
  const openStep = {
    verb: "conference-open",
    flags: {
      "external-key": spec.conferenceKey,
      "project-id": spec.projectId,
      type: spec.type,
      title: spec.title,
      "work-ids": Array.isArray(spec.workIds) ? spec.workIds.join(",") : spec.workIds,
      "desired-outcome": spec.desiredOutcome,
      "participant-ids": spec.participantIds.join(",")
    }
  };

  const payload = {
    schemaVersion: "aos.local-client-ceremony.v1",
    story: spec.story ?? spec.conferenceKey,
    intent: spec.intent ?? `multi-agent 审议:${spec.conferenceKey}`,
    steps: [openStep, openingStep, ...appendSteps],
    readback: spec.readback ?? []
  };

  if (!verifyOnly) {
    mkdirSync(dirname(resolve(receiptsPath)), { recursive: true });
    writeFileSync(receiptsPath, `${JSON.stringify(receiptsDoc, null, 1)}\n`);
    mkdirSync(dirname(resolve(spec.payloadOut)), { recursive: true });
    writeFileSync(spec.payloadOut, `${JSON.stringify(payload, null, 2)}\n`);
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    conferenceKey: spec.conferenceKey,
    receiptsFile: receiptsPath,
    receiptsSha256: digest,
    seatsPlanned: receipts.length,
    appendPositionSteps: appendSteps.length,
    positions: receipts.map((r) => ({ keys: r.positionKeys, bytes: r.outputBytes, digest: r.outputDigest.slice(0, 16) }))
  }, null, 2) + "\n");
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main();
}
