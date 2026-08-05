// A local stand-in for the read face, serving a generation stamp at a chosen age.
//
// The freshness gate (scripts/read-face-freshness.mjs) fetches exactly two served
// bytes: the data asset at /assets/aos-client.js and the document at /. This server
// answers both with the SAME ISO instant, offset from now by a caller-chosen number
// of hours, so the gate can be run green (fresh offset) or red (stale offset) without
// touching the live host. It also answers /api/health so an unjudgeable probe has
// something to explain itself with.
//
//   node scripts/lib/freshness-fixture-server.mjs --port 4399 --offset-hours -20
//
// is the standalone form, used by scripts/read-face-freshness.test.mjs for the
// one-red-one-green fixtures and by the R1 evidence capture.
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

function isoInstant(offsetHours) {
  return new Date(Date.now() + offsetHours * 3_600_000).toISOString();
}

export async function startFreshnessFixture({ port = 0, offsetHours = -1 } = {}) {
  const stamp = isoInstant(offsetHours);
  const bundle = `export const cockpitData = { generatedAt: "${stamp}", partitions: [{ id: "TCRN-AOS", chainVersion: 1557 }] };`;
  const shell = `<!doctype html><html><body><div data-cockpit-surface="Data as of ${stamp}">Data as of ${stamp}</div></body></html>`;
  const server = createServer((request, response) => {
    if (request.url === "/assets/aos-client.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(bundle);
      return;
    }
    if (request.url === "/") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(shell);
      return;
    }
    if (request.url === "/api/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, service: "tcrn-aos-read", readonly: true }));
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    stamp,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  let port = 0;
  let offsetHours = -1;
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--port") port = Number(argv[index + 1]);
    if (argv[index] === "--offset-hours") offsetHours = Number(argv[index + 1]);
  }
  const fixture = await startFreshnessFixture({ port, offsetHours });
  process.stdout.write(`${JSON.stringify({ url: fixture.url, stamp: fixture.stamp })}\n`);
}
