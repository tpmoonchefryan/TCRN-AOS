#!/usr/bin/env node
// TCRN-AOS-INC-049 — is what the read face SHOWS current? Asked of the service.
//
// scripts/read-face-gate.mjs states what the read face may not DO: no chain-write
// machinery, no write methods, no pins. Nothing stated that what it SHOWS is
// current — and the read face serves a BUILD-TIME snapshot. apply.mjs projects the
// governed chains into cockpit-data.generated, esbuild bundles that module into
// assets/aos-client.js, app.tsx server-renders the shell around it into index.html,
// and rsync drops the result under AOS_STATIC_ROOT (/srv/tcrn/aos-cockpit/runtime/web,
// shared with the resident cockpit). Every governed write after that build is
// invisible on both faces until the next deploy, so a months-old board passes every
// gate this repository had.
//
// Four constraints shaped this, all of them paid for:
//
//  1. ASK THE SERVICE, NOT THE DISK. A second, dead copy of the same data module
//     sits at /srv/tcrn/aos-read/runtime/dist/apps/web/src/cockpit-data.generated.js
//     — never read by the read runner, which serves static from the cockpit's web
//     root — and it has already fooled one probe into reporting on bytes nobody is
//     served. So this gate fetches over HTTP, at the URL a browser uses, and judges
//     the bytes the service handed back. Reading a directory would re-open exactly
//     the hole this incident is about.
//
//  2. BOTH CARRIERS OF THE STAMP, NOT ONE. The same generation stamp is deployed
//     twice into the same web root by two independent build outputs: inside the JS
//     bundle (cockpitData.generatedAt) and, server-rendered at build time, as text
//     inside index.html (apps/web/src/cockpit-mirror-banner.tsx renders it; app.tsx
//     calls renderToStaticMarkup). The second one is the one a human actually reads.
//     A half-landed rsync can leave a fresh bundle beside a stale shell, and judging
//     only the bundle would call that green while the page says another date — the
//     same class of error as reporting on bytes nobody is served. So this fetches
//     both and requires them to agree.
//
//  3. A GATE THAT CANNOT RUN ITS CROSS-MACHINE PART SAYS SO. The read face is a
//     LAN address on another host. When it cannot be reached, this exits non-zero
//     with `probed: false` and a reason. It never reports green for a check it did
//     not perform — an unreachable service is the one case where silence looks
//     exactly like success. "Cannot be reached" includes a subtler case: the read
//     face's static handler is an SPA fallback (apps/cockpit-read/src/read-service.ts
//     — `extname(candidate) && existsSync(candidate) ? candidate : index.html`), so a
//     MISSING OR RENAMED /assets/aos-client.js is answered 200 with index.html, never
//     404 and never 500. Those bytes carry no `generatedAt:` and judging them would
//     report a broken deploy as stale data. The content-type is therefore asserted on
//     every fetch: HTML where JavaScript was asked for is a probe fault (exit 2), not
//     a data-age verdict.
//
//  4. THE MOVING REFERENCE IS DELIBERATE, AND NARROW. Elsewhere in this repository
//     dating something against the wall clock is a defect; here elapsed time IS the
//     quantity, measured between the snapshot's own stamp and now. Be clear about
//     what that does and does not say: age answers "is this recent", NOT "does this
//     match the chain". The served per-partition chainVersions are carried into the
//     receipt so a reader can compare them against the live engine, but they are
//     context here, not the predicate.
//
// NOT part of `pnpm verify`. Its truth lives on a LAN host that CI cannot reach, so
// wiring it into CI would make a permanently red predicate — a gate nobody can
// satisfy is a gate everybody learns to ignore. Run it at deploy time, from the
// refresh runbook, and from whatever schedules the refresh.
//
// REACHABILITY — a gate reachable from nothing is INC-030's opening state, so this
// one carries a name. This repository has already paid for the alternative:
// apps/web/mirror fell three source commits behind with both its builder and its
// acceptance gate present in the tree and reachable from no script, and nothing
// signalled it (TCRN-AOS-INC-030; the standing guard is
// deploy/aos-mirror-retirement/retirement-guard.mjs, whose own finding is that
// "presence in the tree told nobody anything; reachability from a script is the
// property with teeth"). The name a runbook and the refresh scheduler call is
//   pnpm read-face:freshness
// deliberately OUTSIDE the `verify` chain for the reason above. Measured 2026-08-04:
// present in package.json `scripts`, absent from `verify` — recheck with
//   grep -n 'read-face:freshness' package.json
// TCRN-AOS-INC-049 part C is what schedules the call.
//
// Usage:
//   node scripts/read-face-freshness.mjs [--out <path>] [--max-age-hours <n>]
//
// Flags:
//   --max-age-hours <n>                override the freshness window (default 9).
//                                      Highest precedence: a value given on the
//                                      command line beats AOS_READ_FACE_MAX_DATA_AGE_HOURS,
//                                      which beats the built-in default.
//
// Environment:
//   AOS_READ_FACE_URL                  base URL of the read face; defaults to the
//                                      manifest's LAN address. Point it at an SSH
//                                      tunnel, or at a fixture, to run elsewhere.
//                                      Empty or blank is treated as unset, and any
//                                      trailing slashes are trimmed.
//   AOS_READ_FACE_MAX_DATA_AGE_HOURS   override the freshness window (testing, and
//                                      the red proof). Lower precedence than the
//                                      --max-age-hours flag.
//
// Exit codes — 0 fresh · 1 RED · 2 could not judge, never a silent pass:
//   0  the data asset and the shell were both served, both carry the stamp, they
//      agree, and it is inside the freshness window.
//   1  RED: a judgeable answer that fails — no stamp in the served bundle, a stamp
//      dated ahead of now, a stamp past the window, or shell and bundle disagreeing
//      about which snapshot is deployed.
//   2  could not judge: the read face was unreachable; it answered something other
//      than the data asset or the shell (the static handler's fallback); bad
//      arguments or environment; or the receipt file could not be written.

import { writeFileSync } from "node:fs";
import { READ_HOST, READ_PORT } from "../deploy/aos-resident-cockpit/read-face-manifest.mjs";
import { HOST_PATH_RULES, scrubHostPaths, scrubHostPathsInText } from "./lib/evidence-hygiene.mjs";

/**
 * How old the served snapshot may be before this gate is red.
 *
 * 9 hours = two refresh shifts plus an hour. The refresh scheduler runs a 4-hourly
 * shift, so a 48-hour window let eleven missed shifts pass the gate while the read
 * face silently showed a week-old board (TCRN-AOS-INC-051, measured 7.23h of
 * staleness judged fresh with zero findings). 9h is short enough that a missed
 * overnight shift is caught by the next run, and still leaves headroom for a single
 * deliberately-skipped shift over a weekend without alerting. It is a POLICY number
 * and a ruling may move it — `--max-age-hours <n>` and
 * AOS_READ_FACE_MAX_DATA_AGE_HOURS exist precisely so the gate can be run at a
 * window the operator chose, and so its red can be proven.
 */
const DEFAULT_MAX_DATA_AGE_HOURS = 9;

/**
 * How far into the future a stamp may sit before it is a finding.
 *
 * The stamp is written on the deploying machine and read on this one; a few minutes
 * of disagreement between two clocks is not evidence of anything. More than that is
 * — a snapshot dated ahead of now cannot have been projected from a chain, and the
 * age it reports is meaningless, so it must not be allowed to pass as "very fresh".
 */
const CLOCK_SKEW_TOLERANCE_MINUTES = 5;

/** The asset a browser loads; it carries the bundled cockpit data module. */
const DATA_ASSET_PATH = "/assets/aos-client.js";
/** The document a browser opens; it carries the same stamp, server-rendered as text. */
const SHELL_PATH = "/";
/**
 * Asked only to explain a fetch that produced nothing judgeable.
 *
 * It separates "the service is down" from "the service is up and handed back
 * something that is not the artifact asked for". It is CONTEXT in the receipt and
 * never an input to the exit code — the exit code says whether a freshness verdict
 * was reached, and both of those cases are the same answer to that question.
 */
const HEALTH_PATH = "/api/health";

const FETCH_TIMEOUT_MS = 30_000;
/**
 * A ceiling on what this will read, enforced while reading rather than after.
 *
 * The bundle is ~5 MB today and this is not a size gate — the ceiling exists so a
 * URL pointed at something that streams forever cannot turn a freshness check into
 * an unbounded read on the machine running it.
 */
const MAX_ASSET_BYTES = 64 * 1024 * 1024;
/** The same ceiling, for the server-rendered document (~440 KB today). */
const MAX_SHELL_BYTES = 16 * 1024 * 1024;

/**
 * Content types that mean "this is the JavaScript bundle", by essence.
 *
 * Asserted rather than assumed: the read face answers 200 + text/html for a missing
 * or renamed asset (constraint 3 above), and without this the gate happily scans the
 * 437 KB shell for a `generatedAt:` it cannot contain and calls the deploy stale.
 */
const JAVASCRIPT_CONTENT_TYPES = Object.freeze(new Set([
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "text/ecmascript",
  "application/ecmascript"
]));
const HTML_CONTENT_TYPES = Object.freeze(new Set(["text/html", "application/xhtml+xml"]));

/** `text/javascript; charset=utf-8` -> `text/javascript`; a missing header -> null. */
function contentTypeEssence(raw) {
  if (typeof raw !== "string") return null;
  const essence = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  return essence === "" ? null : essence;
}

// The address comes from the manifest the live systemd unit was rendered from —
// never hand-typed, or the first person to move the read face leaves the service
// and this gate pointing at different machines with nothing going red.
//
// The override is resolved ONCE, and both the address and the receipt's account of
// where the address came from are derived from that one decision. They used to be
// decided separately, with `??` on one line and truthiness on another, so
// `AOS_READ_FACE_URL=""` produced a receipt reading `baseUrl: ""` alongside
// `urlSource: "…read-face-manifest.mjs"` — the receipt claiming the manifest supplied
// an address the manifest never supplied. Blank is unset, which is also how
// `resolveMaxAgeHours` treats the other override in this file.
//
// Trailing slashes are trimmed because the paths below are concatenated raw, and
// `http://host:4319/` + `/assets/aos-client.js` is a protocol-relative URL: Node's
// URL parser reads `//assets/…` as host `assets`, the read face receives
// `/aos-client.js`, its SPA fallback answers 200 + index.html, and the gate went RED
// on a live, perfectly fresh deploy. VERIFIED before the fix: bare URL exit 0,
// one trailing slash exit 1 on the same host in the same minute.
const readFaceUrlOverride = process.env.AOS_READ_FACE_URL;
const hasReadFaceUrlOverride = typeof readFaceUrlOverride === "string" && readFaceUrlOverride.trim() !== "";
const BASE_URL = (hasReadFaceUrlOverride ? readFaceUrlOverride.trim() : `http://${READ_HOST}:${READ_PORT}`)
  .replace(/\/+$/u, "");
const urlSource = hasReadFaceUrlOverride
  ? "env:AOS_READ_FACE_URL"
  : "deploy/aos-resident-cockpit/read-face-manifest.mjs";

const EXIT_FRESH = 0;
const EXIT_RED = 1;
const EXIT_NOT_JUDGED = 2;

/* ---- emission hygiene --------------------------------------------------- */

/**
 * The last pass before any string leaves this process.
 *
 * `scrubHostPaths` rewrites the host shapes that HAVE a safe rewrite. Two rules in
 * evidence-hygiene.mjs are `detectOnly`: they name a shape with no safe rewrite (a
 * dash-encoded home directory is ambiguous, so any placeholder would be a guess),
 * they pass through the scrubber untouched, and the evidence gate reds on them. That
 * module's own note says what an emitter should do instead — report the SHAPE, not
 * the address — so the matched span becomes a named marker here.
 *
 * The marker is deliberately NOT a `<local-…>` placeholder: those are contracted to
 * rehydrate back into a concrete host path (`rehydrateHostPathsInText` throws on one
 * that cannot), and this shape cannot. It also contains no quote or backslash, so
 * running this over serialized JSON cannot damage the JSON.
 *
 * Without this the header's own invariant is false the moment `--out` points into a
 * Claude Code scratch directory: those are named after the project path with `/`
 * rewritten to `-`, so a write failure would print `-Users-<name>-…` verbatim.
 */
function redactForEmission(text) {
  let out = scrubHostPathsInText(String(text));
  for (const rule of HOST_PATH_RULES) {
    if (!rule.detectOnly) continue;
    out = out.replace(rule.pattern, `<redacted-host-shape:${rule.id}>`);
  }
  return out;
}

/* ---- arguments and threshold ------------------------------------------- */

function parseArguments(argv) {
  let out = null;
  let maxAgeHours = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--out") {
      out = argv[index + 1];
      index += 1;
      if (!out) throw new Error("--out needs a path");
      continue;
    }
    if (argument.startsWith("--out=")) {
      out = argument.slice("--out=".length);
      if (!out) throw new Error("--out= needs a path");
      continue;
    }
    if (argument === "--max-age-hours") {
      maxAgeHours = argv[index + 1];
      index += 1;
      if (maxAgeHours === undefined) throw new Error("--max-age-hours needs a number");
      continue;
    }
    if (argument.startsWith("--max-age-hours=")) {
      maxAgeHours = argument.slice("--max-age-hours=".length);
      if (maxAgeHours === "") throw new Error("--max-age-hours= needs a number");
      continue;
    }
    throw new Error(`unknown argument ${JSON.stringify(argument)}; usage: read-face-freshness.mjs [--out <path>] [--max-age-hours <n>]`);
  }
  return { out, maxAgeHours };
}

/**
 * The freshness window, and where it came from.
 *
 * Precedence is command line, then environment, then the built-in default — a
 * flag the operator typed on this invocation is the most specific thing to say,
 * and it must beat a value the environment carried in. A malformed override
 * throws rather than falling back to the default: a gate whose threshold
 * silently reverts cannot be trusted to have run at the threshold you asked
 * for, and the whole point of the override is to run it at a threshold you
 * chose (that is how this gate's red is proven).
 */
function parsePositiveHours(raw, source) {
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${source}=${JSON.stringify(raw)} is not a positive number of hours`);
  }
  return parsed;
}

function resolveMaxAgeHours(environment, cliOverride) {
  const cliValue = parsePositiveHours(cliOverride, "--max-age-hours");
  if (cliValue !== null) {
    return { maxAgeHours: cliValue, maxAgeSource: "flag:--max-age-hours" };
  }
  const envValue = parsePositiveHours(environment.AOS_READ_FACE_MAX_DATA_AGE_HOURS, "AOS_READ_FACE_MAX_DATA_AGE_HOURS");
  if (envValue !== null) {
    return { maxAgeHours: envValue, maxAgeSource: "env:AOS_READ_FACE_MAX_DATA_AGE_HOURS" };
  }
  return { maxAgeHours: DEFAULT_MAX_DATA_AGE_HOURS, maxAgeSource: "default" };
}

/* ---- the probe ---------------------------------------------------------- */

async function fetchText(url, { limitBytes }) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: "*/*" },
    // A redirect would hand this probe bytes some other server chose, and the
    // question is what THIS service serves at THIS path. The read face issues
    // none; if one ever appears, it should surface as a failed probe.
    redirect: "manual"
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText || ""}`.trim());
  }
  // Carried out with the bytes, because WHICH artifact answered is part of the
  // answer: 200 is not the same as "the thing you asked for".
  const contentType = contentTypeEssence(response.headers.get("content-type"));
  const chunks = [];
  let bytes = 0;
  const reader = response.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limitBytes) {
      await reader.cancel();
      throw new Error(`response exceeds the ${limitBytes}-byte ceiling`);
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(buffer), bytes, contentType };
}

/** Whether the service answers at all — asked only to explain an unjudgeable read. */
async function probeHealth() {
  try {
    const { text } = await fetchText(`${BASE_URL}${HEALTH_PATH}`, { limitBytes: 1024 * 1024 });
    // Reachability is the question; a body that is not JSON still answers it.
    let health = null;
    try { health = JSON.parse(text); } catch { health = null; }
    return { reachable: true, health };
  } catch (error) {
    return { reachable: false, health: null, error: String(error?.message ?? error) };
  }
}

/* ---- reading the snapshot out of the served bytes ----------------------- */

// The served module is NOT JSON, and reading it as JSON is the obvious wrong turn.
// build-cockpit-data.mjs writes JSON, but by the time the bytes reach a browser
// esbuild has re-printed the initializer as a JavaScript object literal: measured
// on the live bundle, its strings carry `\xB7`-style escapes (illegal in JSON) and
// the printer picks its own quote character per string, so both `JSON.parse` and
// naive brace matching desync on the first quote it chose differently. Executing
// served bytes to read them is not an option either — this is a gate, and a gate
// does not run the thing it is judging. So the stamp is scanned for, textually,
// with a pattern tolerant of either quote style and of an unquoted key.
const STAMP_PATTERN = /["']?\bgeneratedAt["']?\s*:\s*["'](\d{4}-\d{2}-\d{2}T[^"']{1,40})["']/gu;

/**
 * `id` + `chainVersion` pairs sitting close together, near the stamp.
 *
 * Best-effort CONTEXT, never a predicate: this reports what the served board says
 * each chain stood at when it was built, so a reader can compare with the live
 * engine. Bounded to a window after the stamp (the partition roster is the field
 * right after it) and to a short span between the two keys, so it cannot wander
 * off and pair unrelated values from elsewhere in a 4.6 MB bundle. Finding nothing
 * here is reported as nothing found — it is never a finding, because a bundler
 * that reformats this region would otherwise turn a cosmetic change into a red.
 */
const PARTITION_PATTERN = /["']?\bid["']?\s*:\s*["']([^"']{1,64})["'][\s\S]{0,600}?["']?\bchainVersion["']?\s*:\s*(\d+)/gu;
const PARTITION_SCAN_WINDOW = 32_000;

function scanPartitionsNear(bundle, stampIndex) {
  const window = bundle.slice(stampIndex, stampIndex + PARTITION_SCAN_WINDOW);
  const seen = new Map();
  for (const match of window.matchAll(PARTITION_PATTERN)) {
    if (!seen.has(match[1])) seen.set(match[1], { id: match[1], chainVersion: Number(match[2]) });
  }
  return [...seen.values()];
}

/**
 * The generation stamp as served, plus whatever roster sits beside it.
 *
 * When more than one candidate stamp is present the OLDEST wins, never the
 * newest: a tie broken in the deployment's favour would let a stale snapshot hide
 * behind any fresher-looking timestamp that happens to share the file.
 */
function extractServedSnapshot(bundle) {
  const stamps = [...bundle.matchAll(STAMP_PATTERN)]
    .map((match) => ({ value: match[1], index: match.index, at: Date.parse(match[1]) }))
    .filter((entry) => Number.isFinite(entry.at));
  if (stamps.length === 0) {
    return { via: null, generatedAt: null, candidateStamps: 0, partitions: [] };
  }
  const oldest = stamps.reduce((left, right) => (right.at < left.at ? right : left));
  return {
    via: "served-bundle-stamp-scan",
    generatedAt: oldest.value,
    candidateStamps: stamps.length,
    partitions: scanPartitionsNear(bundle, oldest.index)
  };
}

/* ---- reading the stamp out of the served shell -------------------------- */

// The shell's stamp is rendered INTO TRANSLATED PROSE ("Data as of {0} · {1}" in en,
// "数据截至 {0} · {1}" in zh-CN, and three more), so anchoring on the English words
// would make this gate go red the day the prerender locale changes. It anchors on
// structure instead: the banner's own element attribute, which is what the component
// emits regardless of locale, and then the first ISO instant inside it.
const SHELL_BANNER_ANCHOR = "data-cockpit-surface=";
const SHELL_BANNER_WINDOW = 4_000;
const SHELL_STAMP_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})/gu;

/**
 * The stamp the served document SHOWS, or an honest report that it shows none.
 *
 * Two routes, in order of precision: the banner element if it is there, and
 * otherwise the whole document — but only if the whole document contains exactly
 * ONE distinct instant, because two candidates with no anchor is a guess and a gate
 * does not guess. Zero, or more than one without an anchor, returns `stamp: null`,
 * and the caller reports that as a finding rather than as agreement. "I found
 * nothing" must never be spent as "there is nothing wrong".
 */
function extractShellStamp(html) {
  const anchor = html.indexOf(SHELL_BANNER_ANCHOR);
  if (anchor !== -1) {
    const window = html.slice(anchor, anchor + SHELL_BANNER_WINDOW);
    const inBanner = window.match(SHELL_STAMP_PATTERN);
    if (inBanner && inBanner.length > 0) {
      return { stamp: inBanner[0], via: "served-shell-banner-element", distinctStamps: null };
    }
  }
  const distinct = [...new Set(html.match(SHELL_STAMP_PATTERN) ?? [])];
  if (distinct.length === 1) {
    return { stamp: distinct[0], via: "served-shell-sole-instant", distinctStamps: 1 };
  }
  return { stamp: null, via: null, distinctStamps: distinct.length };
}

/* ---- run ---------------------------------------------------------------- */

const GATE = "aos-read-face-data-freshness";
const SCHEMA_VERSION = "aos.read-face-freshness.v1";
const INVARIANTS = Object.freeze([
  "the read face answered over HTTP and served the data asset a browser loads, as JavaScript rather than the shell fallback",
  "the served bytes carry a generation stamp",
  "the stamp is not dated ahead of now beyond clock-skew tolerance",
  "the snapshot's age is within the freshness window",
  "the served shell and the served bundle carry the same stamp"
]);

async function judge(threshold) {
  const assetUrl = `${BASE_URL}${DATA_ASSET_PATH}`;
  const shellUrl = `${BASE_URL}${SHELL_PATH}`;
  const observedAt = new Date();
  const common = {
    gate: GATE,
    schemaVersion: SCHEMA_VERSION,
    maxAgeHours: threshold.maxAgeHours,
    maxAgeSource: threshold.maxAgeSource,
    invariants: INVARIANTS,
    observedAt: observedAt.toISOString()
  };
  const source = {
    baseUrl: BASE_URL,
    assetPath: DATA_ASSET_PATH,
    shellPath: SHELL_PATH,
    urlSource
  };

  /**
   * The bytes this gate judges never arrived, or were not the bytes asked for.
   * Report that; do not judge. `probed: false` and a non-zero exit, so a check
   * that did not happen can never read as a check that passed.
   */
  const notJudged = async (reason, finding, extra = {}) => {
    const health = await probeHealth();
    return {
      exitCode: EXIT_NOT_JUDGED,
      receipt: {
        ok: false,
        verdict: "not-probed",
        probed: false,
        ...common,
        reason,
        serviceReachable: health.reachable,
        serviceHealth: health.health,
        serviceProbeError: health.error ?? null,
        source,
        ...extra,
        // Carried as a finding too, so `ok: false` never arrives with an empty
        // findings list — a consumer reading only findings must not see silence.
        findings: [finding]
      }
    };
  };

  let served;
  try {
    served = await fetchText(assetUrl, { limitBytes: MAX_ASSET_BYTES });
  } catch (error) {
    const detail = String(error?.message ?? error);
    return notJudged(
      `could not read ${assetUrl}: ${detail}`,
      { id: "read-face-answered-over-http", detail: `no bytes to judge: ${detail}` }
    );
  }

  if (!JAVASCRIPT_CONTENT_TYPES.has(served.contentType ?? "")) {
    // 200 + text/html at the asset path is the static handler's SPA fallback: the
    // asset is missing or renamed and index.html answered in its place. Those bytes
    // are a DEPLOY fault, and scanning them for a stamp would report it as stale
    // data — the wrong alarm, on the most likely real failure.
    const seen = served.contentType ?? "(no content-type header)";
    // Name the fallback only when the bytes actually look like it. Anything else
    // that is not JavaScript is still unjudgeable, but calling it "the shell
    // fallback" would be a claim about a cause this gate did not observe.
    const because = HTML_CONTENT_TYPES.has(served.contentType ?? "")
      ? "that is the shell fallback, not the data asset"
      : "that is not the data asset";
    return notJudged(
      `the read face answered ${seen} at ${DATA_ASSET_PATH}; ${because}`,
      {
        id: "read-face-served-the-data-asset",
        detail: `${served.bytes} bytes of ${seen} came back from ${DATA_ASSET_PATH}, which serves JavaScript; the static handler answers 200 + index.html for an asset that is missing or renamed, so no data-age verdict is possible from these bytes`
      },
      { servedContentType: served.contentType, servedBytes: served.bytes }
    );
  }

  const snapshot = extractServedSnapshot(served.text);
  const stampMs = snapshot.generatedAt === null ? Number.NaN : Date.parse(snapshot.generatedAt);
  const hasStamp = Number.isFinite(stampMs);
  const ageMs = hasStamp ? observedAt.getTime() - stampMs : null;
  const ageHours = ageMs === null ? null : ageMs / 3_600_000;
  const bundleContext = {
    servedGeneratedAt: snapshot.generatedAt,
    servedBytes: served.bytes
  };

  let shell;
  try {
    shell = await fetchText(shellUrl, { limitBytes: MAX_SHELL_BYTES });
  } catch (error) {
    const detail = String(error?.message ?? error);
    return notJudged(
      `read ${DATA_ASSET_PATH} but could not read ${shellUrl}: ${detail}`,
      { id: "read-face-answered-over-http", detail: `the document a reader opens never arrived: ${detail}` },
      bundleContext
    );
  }

  if (!HTML_CONTENT_TYPES.has(shell.contentType ?? "")) {
    const seen = shell.contentType ?? "(no content-type header)";
    return notJudged(
      `the read face answered ${seen} at ${SHELL_PATH}; that is not the document a reader opens`,
      {
        id: "read-face-served-the-shell",
        detail: `${shell.bytes} bytes of ${seen} came back from ${SHELL_PATH}, which serves HTML; what a reader is shown cannot be established from these bytes`
      },
      { ...bundleContext, shellContentType: shell.contentType, shellBytes: shell.bytes }
    );
  }

  const shellStamp = extractShellStamp(shell.text);

  const findings = [];
  const record = (id, ok, detail) => {
    if (!ok) findings.push({ id, detail });
  };

  record(
    "served-bytes-carry-a-generation-stamp",
    hasStamp,
    hasStamp
      ? `served snapshot is stamped ${snapshot.generatedAt} (read via ${snapshot.via})`
      : `no parseable generation stamp in the ${served.bytes} bytes served at ${DATA_ASSET_PATH}`
  );

  if (hasStamp) {
    const skewMs = -CLOCK_SKEW_TOLERANCE_MINUTES * 60_000;
    record(
      "served-stamp-is-not-in-the-future",
      ageMs >= skewMs,
      ageMs >= skewMs
        ? `stamp is ${ageHours.toFixed(2)}h behind now`
        : `stamp is ${(-ageHours).toFixed(2)}h AHEAD of now, past the ${CLOCK_SKEW_TOLERANCE_MINUTES}-minute skew tolerance; its age says nothing`
    );
    record(
      "served-snapshot-is-within-the-freshness-window",
      ageHours <= threshold.maxAgeHours,
      ageHours <= threshold.maxAgeHours
        ? `served data is ${ageHours.toFixed(2)}h old, within the ${threshold.maxAgeHours}h window`
        : `served data is ${ageHours.toFixed(2)}h old, past the ${threshold.maxAgeHours}h window — the read face is showing the snapshot built at ${snapshot.generatedAt}, and every governed write since is invisible on it`
    );
  }

  // The two carriers must agree. A stamp the shell does not show is not agreement
  // either: an unreadable shell is reported as a finding, never spent as a pass.
  record(
    "served-shell-and-bundle-agree-on-the-stamp",
    shellStamp.stamp !== null && shellStamp.stamp === snapshot.generatedAt,
    shellStamp.stamp === null
      ? `the ${shell.bytes} bytes served at ${SHELL_PATH} show no readable generation stamp (${shellStamp.distinctStamps} distinct instants found, no banner anchor to disambiguate), so what a reader is shown cannot be checked against the ${DATA_ASSET_PATH} stamp ${snapshot.generatedAt ?? "(none)"}`
      : shellStamp.stamp === snapshot.generatedAt
        ? `shell and bundle agree: both stamped ${shellStamp.stamp} (shell read via ${shellStamp.via})`
        : `the shell at ${SHELL_PATH} shows ${shellStamp.stamp} but the bundle at ${DATA_ASSET_PATH} is stamped ${snapshot.generatedAt ?? "(none)"} — two independently deployed carriers of the same stamp disagree, so a reader is being shown one date while the data is another (a half-landed deploy)`
  );

  const ok = findings.length === 0;
  return {
    exitCode: ok ? EXIT_FRESH : EXIT_RED,
    receipt: {
      ok,
      // "not-fresh", not "stale": a snapshot whose stamp cannot be read is not
      // known to be stale, it is known not to be established as fresh, and the
      // receipt must not claim the stronger thing. The findings say which it was.
      verdict: ok ? "fresh" : "not-fresh",
      probed: true,
      ...common,
      source: {
        ...source,
        servedBytes: served.bytes,
        servedContentType: served.contentType,
        shellBytes: shell.bytes,
        shellContentType: shell.contentType
      },
      generatedAt: snapshot.generatedAt,
      extractedVia: snapshot.via,
      candidateStamps: snapshot.candidateStamps ?? null,
      shellGeneratedAt: shellStamp.stamp,
      shellExtractedVia: shellStamp.via,
      ageHours: ageHours === null ? null : Number(ageHours.toFixed(4)),
      clockSkewToleranceMinutes: CLOCK_SKEW_TOLERANCE_MINUTES,
      // Context, not predicate: what the served board claims each chain stood at
      // when it was built. Compare with the live engine to answer that question.
      servedPartitions: snapshot.partitions,
      findings
    }
  };
}

let options;
let threshold;
try {
  options = parseArguments(process.argv.slice(2));
  threshold = resolveMaxAgeHours(process.env, options.maxAgeHours);
} catch (error) {
  process.stderr.write(`${redactForEmission(String(error?.message ?? error))}\n`);
  // Could not judge — same class as an unreachable face, and never a pass.
  process.exitCode = EXIT_NOT_JUDGED;
}

if (process.exitCode === undefined) {
  const { receipt, exitCode } = await judge(threshold);
  // Hygiene (INC-037): nothing this gate emits — receipt, stdout, or the stderr
  // summary — may carry a path off this machine. A URL handed in by environment
  // and a bundler's baked source comment can both arrive inside an error string,
  // so the scrub happens once, here, and every channel prints the scrubbed copy.
  const clean = scrubHostPaths(receipt);
  const text = redactForEmission(`${JSON.stringify(clean, null, 2)}\n`);

  // STDOUT FIRST, and unconditionally. The receipt is the verdict; a `--out` path
  // that cannot be written must not be able to swallow it. An unguarded write here
  // used to throw ENOENT, which exits 1 — the code this file reserves for "the read
  // face is stale" — so a scheduler read a failed receipt write as a stale deploy,
  // and got no receipt to check it against.
  process.stdout.write(text);

  let receiptWriteError = null;
  if (options.out) {
    try {
      writeFileSync(options.out, text);
    } catch (error) {
      receiptWriteError = String(error?.message ?? error);
    }
  }

  if (receiptWriteError !== null) {
    // Could not write the receipt is an ENVIRONMENT fault, which this file's exit
    // contract puts in class 2 alongside an unreachable face — not class 1, which
    // asserts something about the deploy.
    process.stderr.write(`${redactForEmission(`could not write the receipt to ${options.out}: ${receiptWriteError}`)}\n`);
    process.exitCode = EXIT_NOT_JUDGED;
  } else {
    if (exitCode === EXIT_NOT_JUDGED) {
      process.stderr.write(`\nread-face data freshness NOT judged: ${redactForEmission(clean.reason)}\n`);
    } else if (exitCode !== EXIT_FRESH) {
      process.stderr.write(`\n${clean.findings.length} read-face data-freshness invariant(s) fail.\n`);
    }
    // Set rather than exit(): the receipt goes to a pipe often enough that an
    // immediate exit could truncate it.
    process.exitCode = exitCode;
  }
}
