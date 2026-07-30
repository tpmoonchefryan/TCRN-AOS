#!/usr/bin/env node
// TCRN-AOS-STORY-134 — the repository half of the retirement, measured and merged
// into the same receipt the cluster half wrote.
//
// `retire.mjs` recorded what happened on the VM. This records what happened here:
// which repository assets were retired and whether each is recoverable, which
// gates went and where the properties they guarded are guarded now, and the
// close-out of a banner that had been making a false statement to the Owner.
//
// Everything below is MEASURED rather than asserted. A disposition table typed by
// hand is a claim; the same table with an existence check, a `git cat-file` and a
// rendered page behind each row is a reading. The distinction is the whole reason
// this file exists instead of a paragraph in the receipt.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RECEIPT = join(REPO_ROOT, "evidence", "aos-mirror-retirement.json");
const at = (relative) => join(REPO_ROOT, relative);

if (!existsSync(RECEIPT)) {
  throw new Error("run deploy/aos-mirror-retirement/retire.mjs first; this merges into its receipt");
}
const receipt = JSON.parse(readFileSync(RECEIPT, "utf8"));
if (receipt.ok !== true) {
  throw new Error("the cluster half of the retirement is not green; refusing to record repository "
    + "dispositions on top of an unfinished removal");
}

/** Whether a path is retrievable from the commit this branch is on. */
function recoverableFromHead(path) {
  try {
    execFileSync("git", ["cat-file", "-e", `HEAD:${path}`], { cwd: REPO_ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function headFileCount(path) {
  try {
    const out = execFileSync("git", ["ls-tree", "-r", "HEAD", "--name-only", "--", path],
      { cwd: REPO_ROOT, encoding: "utf8" });
    return out.trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

/* ── the control the absence proof needs ────────────────────────────────────── */

/**
 * A different LAN host through the same address, so "nothing answers" is known to
 * be about `aos.tcrn.lan` and not about a dead ingress controller.
 *
 * This belongs conceptually in `retire.mjs`'s verification and is here for a
 * practical reason worth stating rather than hiding: `retire.mjs` is deliberately
 * not re-runnable — its forensics read a bundle this story deleted — so a control
 * added there could never be run again. The absence claim is only as good as this,
 * and it must live somewhere that can still execute.
 */
const CONTROL_HOST = "grafana.tcrn.lan";
const LAN_ADDRESS = "192.168.51.249";
const probe = (host) => {
  try {
    const out = execFileSync("curl", ["-s", "-m", "8", "-o", "/dev/null",
      "-H", `Host: ${host}`, "-w", "%{http_code}", `http://${LAN_ADDRESS}/`], { encoding: "utf8" });
    return Number(out.trim()) || 0;
  } catch {
    return 0;
  }
};
const controlStatus = probe(CONTROL_HOST);
const retiredStatus = probe("aos.tcrn.lan");
receipt.verification.lanControlProbe = {
  question: "is the ingress controller itself still routing, so that the retired host's answer "
    + "means 'no route for this name' rather than 'this address is dead'?",
  controlHost: CONTROL_HOST,
  controlStatus,
  controlRouted: controlStatus !== 0 && controlStatus !== 404,
  retiredHost: "aos.tcrn.lan",
  retiredStatus,
  retiredUnrouted: retiredStatus === 404,
  ok: controlStatus !== 0 && controlStatus !== 404 && retiredStatus === 404
};

/* ── repository asset dispositions ──────────────────────────────────────────── */

const RETIRED = [
  {
    path: "apps/web/mirror",
    what: "the committed static bundle, 16 files",
    disposition: "retired — removed from the working tree",
    because: "its only consumer was the hostPath the cluster half deleted. INC-030's own "
      + "instruction for this case was to remove it rather than leave a copy that will lie: with "
      + "the freshness gate gone too, it would drift from source the first time anybody touched "
      + "apps/web/src and nothing would notice"
  },
  {
    path: "scripts/build-mirror.mjs",
    what: "the per-route server-render builder (pnpm mirror:build)",
    disposition: "retired — removed, and the npm script with it",
    because: "its target is gone. Residual applicability: the mirror's one use the resident "
      + "cockpit does not cover is a browser on the LAN with no ssh, which is exactly the case "
      + "CONF-007 D7 prohibits — foreclosed by the ruling, not waived for convenience. The "
      + "runtime `surface: \"mirror\"` state it drove is NOT retired: cockpit-mirror-banner.tsx "
      + "still resolves it by probing for the service, which is what a saved page should say "
      + "about itself"
  },
  {
    path: "scripts/mirror-freshness-proof.mjs",
    what: "the committed-bundle-equals-a-rebuild gate (pnpm mirror:freshness-proof, in pnpm verify)",
    disposition: "retired — replaced in verify by mirror:retirement-proof, not dropped from it",
    because: "its subject no longer exists, but emptying the verify slot would repeat INC-030: "
      + "removing a thing and removing the only mechanism that would notice it coming back are "
      + "two different acts, and only the first was ruled"
  },
  {
    path: "scripts/mirror-acceptance-proof.mjs",
    what: "the five D9 acceptance criteria against a live mirror and a live local service",
    disposition: "retired — removed",
    because: "it could no longer run at all: criteria 1/2/5 address http://aos.tcrn.lan, "
      + "criteria 3/4 address a cockpit service on this machine's loopback that moved to the VM "
      + "under STORY-131, and its default workspace is the vacated local chain path. By this "
      + "repository's own doctrine that makes it a FALSE proof, not a weak one — the receipt on "
      + "disk still reads ok:true. It was also a live hazard: CONF-007 recorded that criterion "
      + "4's candidate selection would advance TCRN-AOS-INIT-002 out of planned on its next run"
  }
];

const KEPT = [
  {
    path: "deploy/aos-mirror.yaml",
    disposition: "kept — annotated as retired, with revival prerequisites",
    because: "it is the artefact a future reader finds by searching for aos.tcrn.lan, and a "
      + "manifest that looks applicable is worse than none: re-applying it republishes a LAN "
      + "route in front of a cockpit D7 confines to loopback"
  },
  {
    path: "evidence/aos-mirror-acceptance.json",
    disposition: "kept — byte-untouched",
    because: "chain annotations cite this path. Editing bytes the chain points at, even to add "
      + "an honest retirement note, corrupts a citation for the sake of tidiness. The pointer "
      + "lives in docs/retired-proof-scripts.md instead"
  },
  {
    path: "scripts/lib/annotate-pair.mjs",
    disposition: "kept — still has a caller",
    because: "scripts/inc-034-annotate-pair-proof.mjs (pnpm inc034:annotate-pair-proof) runs the "
      + "same judge, and is now its only caller — so that red-proof matters more than before"
  },
  {
    path: "scripts/lib/migration-candidates.mjs",
    disposition: "kept — ORPHANED, and declared so",
    because: "the retired acceptance proof was its only caller, so it is a tested library nothing "
      + "invokes. Kept because the question it answers — which records are legally movable "
      + "forward without mirroring the engine's state machine — is what any future write-surface "
      + "acceptance will ask, and its lesson was expensive. A deletion candidate the day somebody "
      + "rules that future is not coming; the unacceptable option was leaving it undeclared"
  }
];

const retiredRows = RETIRED.map((row) => ({
  ...row,
  presentNow: existsSync(at(row.path)),
  recoverableFromHead: recoverableFromHead(row.path) || headFileCount(row.path) > 0,
  filesInHead: headFileCount(row.path)
}));
const keptRows = KEPT.map((row) => ({ ...row, presentNow: existsSync(at(row.path)) }));

receipt.repoAssets = {
  retired: retiredRows,
  kept: keptRows,
  ok: retiredRows.every((row) => row.presentNow === false && row.recoverableFromHead)
    && keptRows.every((row) => row.presentNow)
};

/* ── gate dispositions, with successor coverage measured ────────────────────── */

const walkthrough = readFileSync(at("deploy/aos-resident-cockpit/walkthrough.mjs"), "utf8");
const D9 = [
  { criterion: "1 — URL reachable and server-rendered", successorSteps: ["root-ssr"] },
  {
    criterion: "2 — every module renders chain data",
    successorSteps: ["eleven-modules"],
    stronger: "each route must render ITS OWN view at THIS chain version, with the committed "
      + "projection as the red control; the retired gate accepted any view"
  },
  { criterion: "3 — a domain field write round-trips", successorSteps: ["domain-store-round-trip"] },
  {
    criterion: "4 — a chain write succeeds AND an illegal one is refused",
    successorSteps: ["four-write-routes", "record-reads-back", "refusal-and-ceremony-404"],
    stronger: "four write routes against the real chain on the real host, then a backward move "
      + "refused 409 INVALID_TRANSITION plus the ceremonial-verb 404 boundary; the retired gate "
      + "ran one transition pair or an annotate-pair fallback"
  },
  {
    criterion: "5 — freshness stated, and no write control offered",
    successorSteps: [],
    partial: "HALF retires with its subject. 'Freshness stated rather than implied live' survives "
      + "in the per-partition as-of chips and in the walkthrough's chain-version discriminator. "
      + "'Offers no write control' had a read-only surface as its subject; the resident cockpit IS "
      + "the write face, so there is nothing left for that half to be true of"
  }
];
const gateRows = D9.map((row) => ({
  ...row,
  successorFile: "deploy/aos-resident-cockpit/walkthrough.mjs",
  successorStepsPresent: row.successorSteps.every((name) => walkthrough.includes(`step("${name}"`)),
  ok: row.successorSteps.length === 0 || row.successorSteps.every(
    (name) => walkthrough.includes(`step("${name}"`))
}));

receipt.gates = {
  retired: [
    {
      gate: "mirror:freshness-proof",
      wasIn: "pnpm verify",
      successor: "mirror:retirement-proof (deploy/aos-mirror-retirement/retirement-guard.mjs)",
      successorInVerify: JSON.parse(readFileSync(at("package.json"), "utf8"))
        .scripts.verify.includes("pnpm mirror:retirement-proof")
    },
    {
      gate: "mirror-acceptance-proof (D9, TCRN-CROSS-MIN-052)",
      wasIn: "no npm script — the INC-030 finding; run by hand",
      successor: "deploy/aos-resident-cockpit/walkthrough.mjs (STORY-132), by hand",
      honestNote: "the successor is also a deliberate ceremony rather than a verify step, so the "
        + "guard STATUS of this property did not improve and did not degrade. Claiming it is now "
        + "covered by verify would be the 'delivered once, then never verified again' shape this "
        + "repository keeps rediscovering",
      earlierSuccessor: "deploy/switch-rehearsal/act3-product-walkthrough.mjs (STORY-125) "
        + "re-decided the same criteria against the rehearsal topology"
    }
  ],
  d9CriteriaCoverage: gateRows,
  ok: gateRows.every((row) => row.ok)
};

/* ── the stale banner, closed out ───────────────────────────────────────────── */

const { cockpitData } = await import(
  pathToFileURL(at("dist/apps/web/src/cockpit-data.generated.js")).href);
const { renderAosShellHtml } = await import(pathToFileURL(at("dist/apps/web/src/app.js")).href);

const FALSE_SENTENCES = {
  positionsAndMinutesNotRead: /Positions and minutes were not read for/u,
  inboxMinutesCaveat: /Partial coverage: minutes were not read for/u,
  decisionDetailIncomplete: /Positions and minutes were not read for this project/u
};

/** What the projection actually holds, per partition — the arithmetic that falsifies the claim. */
const confPartition = new Map(cockpitData.conferences.map((row) => [row.id, row.partitionId]));
const workPartition = new Map(cockpitData.work.map((row) => [row.id, row.partitionId]));
const held = {};
const bump = (partitionId, key, by) => {
  held[partitionId] ??= { positions: 0, minutes: 0, activityEvents: 0 };
  held[partitionId][key] += by;
};
for (const [conferenceId, rows] of Object.entries(cockpitData.threads ?? {})) {
  bump(confPartition.get(conferenceId) ?? "?", "positions", rows.length);
}
for (const conferenceId of Object.keys(cockpitData.minutesByConference ?? {})) {
  bump(confPartition.get(conferenceId) ?? "?", "minutes", 1);
}
for (const [workId, rows] of Object.entries(cockpitData.activityByWork ?? {})) {
  bump(workPartition.get(workId) ?? "?", "activityEvents", rows.length);
}

const detailSample = cockpitData.work.find((row) => row.externalKey
  && row.partitionId === "cross-project"
  && (cockpitData.activityByWork[row.id]?.length ?? 0) === 0);
const ROUTES = ["/my-work", "/inbox", "/deliberations",
  ...(detailSample ? [`/work-items/${detailSample.externalKey}`] : [])];

const scan = (route) => {
  const html = renderAosShellHtml({ path: route, surface: "local" });
  return {
    route,
    notices: [...new Set(html.match(/data-cockpit-notice="[a-z-]+"/gu) ?? [])],
    ...Object.fromEntries(Object.entries(FALSE_SENTENCES)
      .map(([name, pattern]) => [name, pattern.test(html)])),
    activityLogGapStated: /event log was not read/u.test(html)
  };
};

const afterFix = ROUTES.map(scan);

/**
 * The red drill, in the same run.
 *
 * A predicate that stopped firing is not automatically a predicate that is right —
 * it could simply have been made constantly false, which is the shape this
 * platform has produced three times in one day and caught with red proofs. So one
 * partition is marked genuinely unreadable in memory and every sentence must come
 * back.
 */
const target = cockpitData.partitions.find((row) => row.id === "cross-project");
const before = target.unavailable;
target.unavailable = ["positions", "minutes", "events"];
const underDrill = ROUTES.map(scan);
target.unavailable = before;
const restored = ROUTES.map(scan);

receipt.staleBanner = {
  claim: receipt.preRetirement?.staleBannerAsServed?.sentence ?? null,
  observedServedByTheMirror: receipt.preRetirement?.staleBannerAsServed?.present === true,
  falsifiedBy: {
    method: "counted in the same generated projection the page renders from",
    heldPerPartition: held,
    readVia: Object.fromEntries(cockpitData.partitions.map((row) => [row.id, row.readVia])),
    unavailablePerPartition: Object.fromEntries(
      cockpitData.partitions.map((row) => [row.id, [...row.unavailable]]))
  },
  rootCause: "the notice fired on `unavailable.length > 0` while its sentence named positions and "
    + "minutes specifically. Workflow v0.7.0 gave those two their own paged reads, so the list "
    + "narrowed to [\"events\"] — still non-empty, so every sentence gated on its LENGTH kept "
    + "rendering, now asserting the opposite of the truth. The fix landed on the producer "
    + "(ingest.ts, unavailableFamilies) and stopped there; four consumers and the field's own doc "
    + "comment were not carried across, and that doc comment sat two lines above a `readVia` "
    + "comment that described the new behaviour correctly",
  whyTheReasonWasFalseFromTheStart: "the sentence blamed chain volume — 'those chains exceed the "
    + "read surface ceiling'. That named a symptom as the cause. The operative cause was that no "
    + "PAGED read for positions existed, so the only route to them was `export` and `export` has a "
    + "one-MiB ceiling. When v0.7.0 supplied the paged verbs, nothing about the chains' size "
    + "changed and the gap closed — which is the proof size was never the cause. Naming a property "
    + "of the data rather than a gap in our tooling is also why the sentence went unexamined: "
    + "nobody reopens a question whose stated answer is a law of nature. The same shape was found "
    + "one layer down in this story and fixed with it — the activity-log notice said the fallback "
    + "read surface 'has no event verb', which stopped being true when v0.8.0 shipped `event-list`; "
    + "it now names the real gap, which is that this product's projection does not use it yet",
  fix: "four render sites now ask the family they name, through named helpers "
    + "(deliberationContentRead / activityLogRead in cockpit-types.ts) rather than a length test: "
    + "cockpit-views.tsx UnavailableNotice, cockpit-deliberation.tsx threads-unread, "
    + "cockpit-global.tsx inbox-coverage, cockpit-detail.tsx partial-projection",
  afterFix,
  redDrill: {
    method: "cross-project marked unavailable: [positions, minutes, events] in memory, the same "
      + "routes re-rendered, then restored",
    underDrill,
    restored,
    everySentenceReturned: underDrill.some((row) => row.positionsAndMinutesNotRead)
      && underDrill.some((row) => row.inboxMinutesCaveat)
      && underDrill.some((row) => row.notices.includes('data-cockpit-notice="threads-unread"')),
    restoredToQuiet: restored.every((row) => !row.positionsAndMinutesNotRead && !row.inboxMinutesCaveat)
  },
  trueGapStillStated: {
    where: "the work item's activity panel, which is where the event-log gap is actually visible",
    route: detailSample ? `/work-items/${detailSample.externalKey}` : null,
    stated: afterFix.some((row) => row.activityLogGapStated)
  },
  ok: afterFix.every((row) => !row.positionsAndMinutesNotRead && !row.inboxMinutesCaveat)
    && afterFix.some((row) => row.activityLogGapStated)
};
receipt.staleBanner.ok = receipt.staleBanner.ok
  && receipt.staleBanner.redDrill.everySentenceReturned
  && receipt.staleBanner.redDrill.restoredToQuiet;

/* ── the standing guard, and the ways it was driven red ─────────────────────── */

const guardRun = (() => {
  try {
    return { exitCode: 0, report: JSON.parse(execFileSync(process.execPath,
      [at("deploy/aos-mirror-retirement/retirement-guard.mjs")], { encoding: "utf8" })) };
  } catch (error) {
    return { exitCode: error.status ?? 1, report: JSON.parse(String(error.stdout ?? "{}")) };
  }
})();

const drillRoot = at("apps/web/mirror");
mkdirSync(drillRoot, { recursive: true });
writeFileSync(join(drillRoot, "index.html"), "<html>a copy nobody asked for</html>\n");
const guardUnderDrill = (() => {
  try {
    execFileSync(process.execPath, [at("deploy/aos-mirror-retirement/retirement-guard.mjs")],
      { encoding: "utf8" });
    return { exitCode: 0, findings: [] };
  } catch (error) {
    const parsed = JSON.parse(String(error.stdout ?? "{}"));
    return { exitCode: error.status ?? 1, findings: (parsed.findings ?? []).map((row) => row.id) };
  }
})();
rmSync(drillRoot, { recursive: true, force: true });

receipt.retirementGuard = {
  script: "deploy/aos-mirror-retirement/retirement-guard.mjs",
  npmScript: "mirror:retirement-proof",
  inVerify: JSON.parse(readFileSync(at("package.json"), "utf8"))
    .scripts.verify.includes("pnpm mirror:retirement-proof"),
  green: guardRun.exitCode === 0,
  checks: (guardRun.report.checks ?? []).map((row) => ({ id: row.id, ok: row.ok })),
  redDrills: [
    {
      mutation: "recreate a file under apps/web/mirror",
      reproducedInThisRun: true,
      exitCode: guardUnderDrill.exitCode,
      findings: guardUnderDrill.findings,
      restoredToGreen: guardRun.exitCode === 0
    },
    {
      mutation: 'restore a "mirror:build" npm script to package.json',
      reproducedInThisRun: false,
      observedFindings: ["no-npm-script-reaches-the-mirror", "no-mirror-namespaced-scripts"],
      howToRepeat: 'add scripts["mirror:build"] to package.json, run pnpm mirror:retirement-proof, remove it'
    },
    {
      mutation: "strip the retirement marker from deploy/aos-mirror.yaml",
      reproducedInThisRun: false,
      observedFindings: ["manifest-declares-itself-retired"],
      howToRepeat: 'replace the "RETIRED — 2026-07-30, TCRN-AOS-STORY-134" line, run the gate, restore it'
    }
  ],
  selfCaught: "on its first run the prefix check flagged its own entry point, mirror:retirement-proof. "
    + "The exclusion is named in the code rather than quietly widened",
  ok: guardRun.exitCode === 0 && guardUnderDrill.exitCode !== 0
};

/* ── residual items, named rather than left to be found ─────────────────────── */

receipt.residual = [
  {
    item: "the /etc/hosts entry for aos.tcrn.lan on the Owner's machine still resolves to the "
      + "cluster address, where traefik now answers 404 for that host",
    disposition: "left in place — editing a system file is the Owner's call, not a deployment recipe's",
    impact: "cosmetic; the name resolves and nothing serves it. The LAN absence proof addresses the "
      + "cluster by IP with the name in the Host header precisely so it does not depend on this line"
  },
  {
    item: "scripts/lib/migration-candidates.mjs has no caller (its unit tests still run in pnpm test)",
    disposition: "kept and declared; see repoAssets.kept for the reasoning"
  },
  {
    item: "the three paginated partitions still report unavailable: [\"events\"] — the engine has a "
      + "paged event reader (event-list, v0.8.0) and this projection does not use it",
    disposition: "out of this story's scope and NOT closed here. The notice now names it as this "
      + "product's gap rather than the engine's ceiling, which is the honest statement of an open item"
  }
];

receipt.ok = receipt.ok
  && receipt.verification.lanControlProbe.ok
  && receipt.repoAssets.ok
  && receipt.gates.ok
  && receipt.staleBanner.ok
  && receipt.retirementGuard.ok;
receipt.dispositionsRecordedAt = new Date().toISOString().replace(/\.\d+Z$/u, "Z");

writeFileSync(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({
  ok: receipt.ok,
  lanControlProbe: receipt.verification.lanControlProbe.ok,
  repoAssets: receipt.repoAssets.ok,
  gates: receipt.gates.ok,
  staleBanner: receipt.staleBanner.ok,
  retirementGuard: receipt.retirementGuard.ok
}, null, 2));
if (!receipt.ok) process.exitCode = 1;
