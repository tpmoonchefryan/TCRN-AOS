#!/usr/bin/env node
// Build the read-only mirror that gets deployed to the VM.
//
// The local build emits one index.html — the server-render of "/" — because the
// local service serves every route from it and the client re-renders from
// window.location. A static mirror behind nginx cannot do that: it would serve
// the "/" render for every URL and only become correct after hydration, so a
// deep link would flash the wrong screen and a scriptless reader would see the
// wrong one permanently.
//
// So the mirror gets a real server-render per route, plus the same client bundle
// for interaction. Every module, plus one detail and one deliberation room so
// those layouts are reachable in the mirror rather than 404.
//
// What the mirror deliberately does not get: a write surface. The panel probes
// for the local service and finds nothing here, so it renders read-only and says
// where writes actually happen. That is checked below rather than assumed.

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const { renderAosShellHtml } = await import(resolve(process.cwd(), "dist/apps/web/src/app.js"));
const { cockpitData } = await import(resolve(process.cwd(), "dist/apps/web/src/cockpit-data.generated.js"));

const outRoot = resolve(process.cwd(), "apps/web/mirror");
const buildRoot = resolve(process.cwd(), "apps/web/dist");

// Samples chosen by property, not by hard-coded key: a mirror rebuilt after the
// chains move must still land on a record that has children and a deliberation
// that has a thread, rather than silently shipping an empty screen.
const detailSample = cockpitData.work.find((row) =>
  row.externalKey && (cockpitData.activityByWork[row.id]?.length ?? 0) >= 3);
const roomSample = cockpitData.conferences.find((row) =>
  (cockpitData.threads[row.id]?.length ?? 0) >= 3);

const routes = [
  "/", "/my-work", "/inbox", "/dashboard", "/projects", "/work-items",
  "/board", "/release-trains", "/knowledge", "/deliberations", "/audit", "/snapshots",
  ...(detailSample ? [`/work-items/${detailSample.externalKey}`] : []),
  ...(roomSample ? [`/deliberations/${roomSample.externalKey ?? roomSample.id}`] : [])
];

await rm(outRoot, { recursive: true, force: true });
await mkdir(outRoot, { recursive: true });
await cp(join(buildRoot, "assets"), join(outRoot, "assets"), { recursive: true });

const written = [];
for (const route of routes) {
  const html = renderAosShellHtml({ path: route });
  const target = route === "/"
    ? join(outRoot, "index.html")
    : join(outRoot, route.replace(/^\//u, ""), "index.html");
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, html);
  written.push({ route, bytes: html.length });
}

// The mirror must not carry a write control. The panel decides that at runtime
// by probing for the service, so what is checked here is that nothing in the
// built markup claims a write surface — the assertion the deployment rests on.
const indexHtml = renderAosShellHtml({ path: routes[5] ?? "/work-items" });
const claimsWrite = /data-domain-availability="writable"/.test(indexHtml);

console.log(JSON.stringify({
  ok: !claimsWrite,
  outRoot,
  routes: written.length,
  samples: {
    detail: detailSample?.externalKey ?? null,
    room: roomSample?.externalKey ?? roomSample?.id ?? null
  },
  chainVersions: cockpitData.partitions.map((row) => `${row.id}@v${row.chainVersion}`),
  generatedAt: cockpitData.generatedAt,
  writeSurfaceInMirror: claimsWrite,
  notClaimed: [
    "the mirror is read-only: operator authority never leaves the local machine",
    "freshness here is the projection's, not the chain's live state"
  ]
}, null, 2));
if (claimsWrite) process.exitCode = 1;
