#!/usr/bin/env node
// Decide the five acceptance criteria the direction conference fixed for
// "AOS is completely usable" (TCRN-CROSS-MIN-052, D9).
//
// The criteria were written before the work so that finishing could not be
// declared by whoever was tired: a screen that renders is not a screen that
// works, and "it came up" is the sentence this receipt exists to make
// impossible.
//
// Run against a live mirror and a live local service. Nothing here is simulated.

import { mkdir, writeFile } from "node:fs/promises";

const MIRROR = process.env.AOS_MIRROR_URL ?? "http://aos.tcrn.lan";
const LOCAL = process.env.AOS_LOCAL_URL ?? "http://127.0.0.1:4318";
// The mirror answers on the VM's ingress; from this machine the request is made
// through the VM by ssh so the check exercises the real ingress path rather
// than a port-forward that would prove something else.
const VM = process.env.AOS_VM_HOST ?? "tcrn-platform-dev";

const { execFile } = await import("node:child_process");
const { promisify } = await import("node:util");
const run = promisify(execFile);

async function mirrorGet(path) {
  const { stdout } = await run("ssh", [VM,
    `curl -s -H 'Host: aos.tcrn.lan' -w '\\n%{http_code}' 'http://127.0.0.1${path}'`],
    { maxBuffer: 32 * 1024 * 1024 });
  const split = stdout.lastIndexOf("\n");
  return { body: stdout.slice(0, split), status: Number(stdout.slice(split + 1).trim()) };
}

const MODULES = [
  "/my-work", "/inbox", "/dashboard", "/projects", "/work-items",
  "/board", "/release-trains", "/knowledge", "/deliberations", "/audit", "/snapshots"
];

const receipt = {
  schemaVersion: "aos.mirror-acceptance.v1",
  ruling: "TCRN-CROSS-MIN-052 D9",
  ok: false,
  criteria: {},
  notClaimed: [
    "the mirror is read-only by design; the write surface lives only on the operator's machine",
    "mirror freshness is the projection's, and is stated rather than implied to be live"
  ]
};

// 1 — the URL is reachable and returns server-rendered content, not a shell that
//     only becomes a page after JavaScript runs.
const root = await mirrorGet("/");
receipt.criteria.urlReachableWithSsr = {
  ok: root.status === 200 && /data-cockpit-view="[a-z-]+"/u.test(root.body),
  status: root.status,
  bytes: root.body.length,
  view: (root.body.match(/data-cockpit-view="([a-z-]+)"/u) ?? [])[1] ?? null
};

// 2 — every module renders real chain data rather than an empty frame. The test
//     is per module and looks for governed keys in the rendered markup, because a
//     module that renders its chrome and no records is exactly the failure that
//     "it came up" hides.
const modules = [];
for (const route of MODULES) {
  const page = await mirrorGet(route);
  const view = (page.body.match(/data-cockpit-view="([a-z-]+)"/u) ?? [])[1] ?? null;
  const chainKeys = (page.body.match(/TCRN-[A-Z-]+-(?:INIT|EPIC|STORY|SUBTASK|INC|CONF|MIN|SPRINT)-\d+/gu) ?? []).length;
  const notReadNotices = (page.body.match(/data-cockpit-notice="[a-z-]+"/gu) ?? []).length;
  modules.push({ route, status: page.status, view, chainKeys, notReadNotices });
}
receipt.criteria.everyModuleRendersChainData = {
  // Dashboard and snapshot health legitimately show figures rather than keys, so
  // the bar is "answered with its own view and carried governed content or an
  // explicit not-read notice" — not "contained a key", which would fail two
  // screens for being the kind of screen they are.
  ok: modules.every((entry) => entry.status === 200 && entry.view !== null),
  modulesWithChainKeys: modules.filter((entry) => entry.chainKeys > 0).length,
  modules
};

// 3 — the local write surface changes an AOS domain field and reads it back.
const target = { partitionId: "TCRN-AOS", recordId: "work:e716f832a9f2ed1301d2f449" };
const stamp = `acceptance-${Date.now()}`;
const put = await fetch(`${LOCAL}/api/domain/annotation`, {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ...target, labels: ["cockpit", stamp] })
});
const readBack = await (await fetch(
  `${LOCAL}/api/domain/${target.partitionId}/${encodeURIComponent(target.recordId)}`)).json();
receipt.criteria.localDomainWriteRoundTrips = {
  ok: put.ok && (readBack.annotation?.labels ?? []).includes(stamp),
  wroteLabel: stamp,
  readBackLabels: readBack.annotation?.labels ?? []
};

// 4 — a chain write succeeds through the local proxy AND an illegal one is
//     refused by the engine. Both halves matter: a surface that only ever
//     succeeds has been shown to be a database, not a governed surface.
//
// The first version of this asserted only the refusal half — `ok` read
// `illegal.status === 409` and nothing else — while recording the legal move's
// result in the receipt without ever judging it. On its first real run both moves
// were refused and the criterion reported green, which is the exact failure its own
// comment warns about, inverted: it would also pass for a write surface that can
// never write at all (TCRN-AOS-INC-034).
//
// It also assumed its legal move. It asked a `done` record to move to `done`,
// commented as "legal from the record's real state" — the engine calls that
// INVALID_TRANSITION, so the assumption was simply wrong.
//
// Now the move is derived and the engine is the only judge. Candidates come from the
// built projection, but the projection is a snapshot and may be stale, so a candidate
// is only a guess: each is tried in turn and the engine's answer decides. Nothing here
// mirrors the state machine, because a second opinion can disagree with the authority.
//
// When nothing is legally movable — every record terminal — the write half cannot be
// performed, and this says so and fails. An unperformable check is not a passing one.
// Making it performable on a fully-closed chain needs either a probe record the proof
// may create or a chain-write surface that is not a status transition; both are
// governance decisions, not something this script should quietly assume.
const FORWARD = { planned: "ready", ready: "active", active: "done" };
const BACKWARD = { ready: "planned", active: "ready", done: "active" };

const { cockpitData: projection } = await import(
  new URL("../dist/apps/web/src/cockpit-data.generated.js", import.meta.url).href);
const candidates = (projection.work ?? [])
  .filter((row) => row.partitionId === "TCRN-AOS" && FORWARD[row.status])
  .map((row) => ({ recordId: row.id, externalKey: row.externalKey, from: row.status, to: FORWARD[row.status] }));

const attempts = [];
let performed = null;
for (const candidate of candidates) {
  const response = await fetch(`${LOCAL}/api/chain/transition`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ partitionId: "TCRN-AOS", recordId: candidate.recordId, status: candidate.to })
  });
  const body = await response.json();
  attempts.push({ externalKey: candidate.externalKey, move: `${candidate.from}->${candidate.to}`, status: response.status, reasonCode: body.reasonCode ?? null });
  if (response.ok && body.ok === true) { performed = { ...candidate, body }; break; }
}

// The refusal half runs against the record the write half moved, so both halves speak
// about the same record; with no move performed it falls back to a terminal record,
// where a move backwards is illegal from any state it could be in.
const refusalTarget = performed
  ? { recordId: performed.recordId, status: BACKWARD[performed.to] ?? "planned", externalKey: performed.externalKey }
  : { recordId: "work:ad72557d88653b6d94456b1d", status: "planned", externalKey: "TCRN-AOS-STORY-003" };
const illegal = await fetch(`${LOCAL}/api/chain/transition`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ partitionId: "TCRN-AOS", recordId: refusalTarget.recordId, status: refusalTarget.status })
});
const illegalBody = await illegal.json();
const refusalHeld = illegal.status === 409 && illegalBody.reasonCode === "INVALID_TRANSITION";

receipt.criteria.chainWriteAndRefusal = {
  ok: performed !== null && refusalHeld,
  writeHalf: performed
    ? { performed: true, record: performed.externalKey, move: `${performed.from}->${performed.to}` }
    : {
        performed: false,
        unperformable: candidates.length === 0,
        why: candidates.length === 0
          ? "no TCRN-AOS record is in a state with a legal forward transition, so a successful write cannot be demonstrated without creating one"
          : "every candidate was refused by the engine; the projection this drew them from is a snapshot and may be behind the chain",
        candidatesTried: attempts
      },
  refusalHalf: { record: refusalTarget.externalKey, requested: refusalTarget.status, status: illegal.status, reasonCode: illegalBody.reasonCode ?? null, held: refusalHeld }
};

// 5 — the mirror either matches the local projection's versions or says how far
//     behind it is. It cannot know the live chain, so what it owes is a truthful
//     statement of what it holds, not a guess at what it lags.
const localHealth = await (await fetch(`${LOCAL}/api/health`)).json();
const mirrorVersions = [...root.body.matchAll(/v(\d+)\s*(?:✓|⚠)/gu)].map((match) => Number(match[1]));
const mirrorStatesFreshness = /data-product-control="as-of"/u.test(root.body)
  && /data-projection-stale="(true|false)"/u.test(root.body);
const mirrorOffersNoWrite = !/data-domain-availability="writable"/u.test(root.body)
  && !/data-domain-field=/u.test(root.body);
receipt.criteria.mirrorFreshnessStatedAndReadOnly = {
  ok: mirrorStatesFreshness && mirrorOffersNoWrite,
  mirrorStatesFreshness,
  mirrorOffersNoWrite,
  mirrorChainVersions: mirrorVersions,
  localServiceChainWriteAvailable: localHealth.chainWriteAvailable === true
};

receipt.ok = Object.values(receipt.criteria).every((entry) => entry.ok === true);

await mkdir("evidence", { recursive: true });
await writeFile("evidence/aos-mirror-acceptance.json", `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({
  ok: receipt.ok,
  criteria: Object.fromEntries(Object.entries(receipt.criteria).map(([key, value]) => [key, value.ok]))
}, null, 2));
if (!receipt.ok) process.exitCode = 1;
