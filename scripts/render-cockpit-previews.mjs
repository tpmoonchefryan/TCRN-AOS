#!/usr/bin/env node
// Render every cockpit screen to a standalone HTML file for design review.
//
// These are the files the Owner reviews against the confirmed v2/v3/v4 designs,
// so producing them has to be repeatable rather than something someone did once
// in a shell. Re-running this after any change regenerates the whole set from
// the same build the product ships.
//
// What a preview is and is not: it is server-rendered markup with tokens and
// component CSS inlined, opened straight from disk. It shows layout, copy, and
// every state the URL can express. It cannot show client behaviour — the row
// click, the search box, the batch bar — because the client bundle is served by
// the app, not embedded here. Interaction is verified against the running build,
// never against these files.
//
// Usage: node scripts/render-cockpit-previews.mjs [--out <dir>]
// Default output is the platform's design folder, where the v2/v3/v4 mockups
// these are compared against already live.

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const { renderAosShellHtml } = await import(resolve(process.cwd(), "dist/apps/web/src/app.js"));
const { cockpitData } = await import(resolve(process.cwd(), "dist/apps/web/src/cockpit-data.generated.js"));

const outFlag = process.argv.indexOf("--out");
const outDir = outFlag >= 0 && process.argv[outFlag + 1]
  ? resolve(process.argv[outFlag + 1])
  : resolve(process.cwd(), "..", "docs/aos-design/preview");

// Sample records are chosen by property rather than hard-coded, so a preview set
// regenerated after the chains move still lands on a work item that has children
// and a deliberation that has a thread — instead of silently rendering an empty
// screen because yesterday's key no longer resolves.
const detailSample = cockpitData.work.find((row) =>
  row.externalKey && (cockpitData.activityByWork[row.id]?.length ?? 0) >= 3
  && cockpitData.work.some((child) => child.parentId === row.id));
const roomSample = cockpitData.conferences.find((row) =>
  (cockpitData.threads[row.id]?.length ?? 0) >= 3 && cockpitData.minutesByConference[row.id]);
const trainSample = cockpitData.work.find((row) => row.kind === "Release" && row.externalKey);

if (!detailSample || !roomSample) {
  console.error(JSON.stringify({
    ok: false,
    error: "no sample record matched; regenerate cockpit data first",
    detailSample: detailSample?.externalKey ?? null,
    roomSample: roomSample?.externalKey ?? null
  }));
  process.exit(1);
}

const screens = [
  ["cockpit-root", "/"],
  ["cockpit-my-work", "/my-work"],
  ["cockpit-inbox", "/inbox"],
  ["cockpit-dashboard", "/dashboard"],
  ["cockpit-projects", "/projects"],
  ["cockpit-work-items", "/work-items"],
  // The split pane with something in it, which is the state the design shows.
  ["cockpit-work-items-selected", `/work-items?selected=${detailSample.externalKey}`],
  ["cockpit-work-items-owner-intent", "/work-items?view=owner-intent"],
  ["cockpit-detail", `/work-items/${detailSample.externalKey}`],
  ["cockpit-board", "/board"],
  ["cockpit-board-tms", "/board?project=TCRN-TMS"],
  ["cockpit-release-trains", "/release-trains"],
  ["cockpit-knowledge", "/knowledge"],
  ["cockpit-deliberations", "/deliberations"],
  ["cockpit-room", `/deliberations/${roomSample.externalKey ?? roomSample.id}`],
  ["cockpit-audit", "/audit"],
  ["cockpit-snapshots", "/snapshots"]
];

await mkdir(outDir, { recursive: true });
const written = [];
for (const [name, path] of screens) {
  const html = renderAosShellHtml({ path });
  await writeFile(resolve(outDir, `${name}.html`), html);
  written.push({ name, path, bytes: html.length });
}

console.log(JSON.stringify({
  ok: true,
  outDir,
  samples: {
    detail: detailSample.externalKey,
    room: roomSample.externalKey ?? roomSample.id,
    train: trainSample?.externalKey ?? null
  },
  chainVersions: cockpitData.partitions.map((row) => `${row.id}@v${row.chainVersion}`),
  screens: written
}, null, 2));
