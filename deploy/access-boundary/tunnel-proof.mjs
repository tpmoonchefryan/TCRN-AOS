#!/usr/bin/env node
// TCRN AOS — access-boundary proof for MIN-007 D7 (EPIC-034-S119).
//
// D7 rules that the write face stays bound to 127.0.0.1 and is reached from
// anywhere that is not the host itself exclusively through an SSH tunnel, and
// that the tripwire for "an address left the Owner's device" is escalated to
// write-face level. One run of this script produces the whole evidence body:
//
//   1. tripwire drill — the loopback-bind test in
//      apps/cockpit-service/test/service.test.mjs is run green, the built dist
//      bind is flipped to 0.0.0.0 in place, the same test is watched going red,
//      the original bytes are restored, and the test is watched going green
//      again. A tripwire that has never fired is not a tripwire;
//   2. tunnel proof — a disposable node listener stands in for the write face
//      on the VM, bound to 127.0.0.1 on a high port exactly as the ruling
//      binds the real service. The same port is then knocked on twice:
//        red:   TCP from this machine straight at the VM's LAN address — must
//               not connect, while the listener is verifiably alive;
//        green: the same request through `ssh -L` — must answer with the
//               nonce this run baked into the listener, proving the tunnel
//               reached that exact process;
//   3. reclaim — the listener's whole process group is killed (it was started
//      with setsid, so the group is its own), the group is verified empty, the
//      port verified closed, the scratch directory removed and verified absent,
//      and the local forward client verified gone.
//
// The receipt lands in evidence/aos-access-boundary-proof.json and never
// carries a machine-local absolute path.
//
// Prerequisite: `pnpm build` (the tripwire drill patches and restores dist).

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const receiptPath = join(repoRoot, "evidence", "aos-access-boundary-proof.json");

const host = "tcrn-platform-dev";
const lanAddress = "192.168.51.249";
const log = (line) => process.stderr.write(`${line}\n`);
const instant = () => new Date().toISOString().replace(/\.\d+Z$/u, "Z");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function ssh(args, { allowFailure = false } = {}) {
  try {
    const { stdout, stderr } = await run("ssh", [host, ...args], { maxBuffer: 8 * 1024 * 1024 });
    return { code: 0, stdout, stderr };
  } catch (error) {
    if (allowFailure && typeof error.code === "number") {
      return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ *
 * 1. Tripwire drill: the loopback-bind test must be able to go red.  *
 * ------------------------------------------------------------------ */

const testFile = "apps/cockpit-service/test/service.test.mjs";
const distService = join(repoRoot, "dist", "apps", "cockpit-service", "src", "service.js");
const tripwireTestName = "the write face binds 127.0.0.1 and nothing else — the access-boundary tripwire";

async function runServiceTests() {
  try {
    const { stdout } = await run("node", ["--test", testFile], { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 });
    return { passed: true, output: stdout };
  } catch (error) {
    return { passed: false, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

async function tripwireDrill() {
  const original = await readFile(distService, "utf8");
  const bindCall = `.listen(options.port ?? 4318, "127.0.0.1")`;
  if (!original.includes(bindCall)) {
    throw new Error("dist service.js does not contain the expected loopback bind; run pnpm build first");
  }

  const green = await runServiceTests();
  if (!green.passed) throw new Error(`service tests are not green before the drill:\n${green.output.slice(-2000)}`);

  // The flip is exactly the change the tripwire exists to catch: same call,
  // wildcard address. Written to dist only; the source stays untouched.
  let red;
  try {
    await writeFile(distService, original.replace(bindCall, `.listen(options.port ?? 4318, "0.0.0.0")`));
    red = await runServiceTests();
  } finally {
    await writeFile(distService, original);
  }
  if (red.passed) throw new Error("flipping the dist bind to 0.0.0.0 did not turn the test suite red");
  if (!red.output.includes(tripwireTestName)) {
    throw new Error("the suite went red, but not on the tripwire test");
  }
  const failLine = red.output.split("\n").find((line) => line.includes("loopback only")) ?? "";

  const restored = await runServiceTests();
  if (!restored.passed) throw new Error("tests did not return to green after restoring dist");

  return {
    executed: true,
    test: tripwireTestName,
    predicate: "net.Server#address().address === \"127.0.0.1\" (kernel-reported bound address)",
    flip: "dist bind host 127.0.0.1 -> 0.0.0.0 (in place, restored from the original bytes)",
    wentRed: true,
    redSampleLine: failLine.trim().slice(0, 200),
    restoredGreen: true,
  };
}

/* ------------------------------------------------------------------ *
 * 2. Tunnel proof: loopback refuses the LAN, answers the tunnel.     *
 * ------------------------------------------------------------------ */

async function tunnelProof() {
  const scratchRoot = `/srv/tcrn/scratch-s119-${Date.now()}`;
  const nonce = randomBytes(16).toString("hex");
  const remotePort = 41200 + Math.floor(Math.random() * 4000);
  const localPort = 45200 + Math.floor(Math.random() * 4000);

  // Note on quoting: ssh joins argv with spaces and the remote shell
  // re-tokenizes, so every compound command below travels as ONE string.
  const portFree = await ssh([`ss -ltn | grep -q ':${remotePort} ' && echo taken || echo free`]);
  if (!portFree.stdout.includes("free")) throw new Error(`remote port ${remotePort} is already in use; rerun`);

  // The listener stands in for the write face: same bind address family the
  // ruling fixes for cockpit-service, one JSON answer carrying this run's
  // nonce, pid written out so the group can be reclaimed by number.
  const listenerSource = [
    `import { createServer } from "node:http";`,
    `import { writeFileSync } from "node:fs";`,
    `const server = createServer((request, response) => {`,
    `  response.setHeader("content-type", "application/json");`,
    `  response.end(JSON.stringify({ ok: true, role: "write-face-sim", nonce: ${JSON.stringify(nonce)} }));`,
    `});`,
    `server.listen(${remotePort}, "127.0.0.1", () => {`,
    `  writeFileSync(${JSON.stringify(`${scratchRoot}/listener.pid`)}, String(process.pid));`,
    `});`,
  ].join("\n");

  await ssh(["mkdir", "-p", scratchRoot]);
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("ssh", [host, `cat > ${scratchRoot}/listener.mjs`], { stdio: ["pipe", "ignore", "inherit"] });
    child.on("close", (code) => (code === 0 ? resolvePromise() : rejectPromise(new Error(`listener upload exited ${code}`))));
    child.stdin.end(listenerSource);
  });
  // setsid makes the listener its own session and process-group leader, so the
  // reclaim below can kill the whole group by the number in the pid file.
  await ssh([`setsid node ${scratchRoot}/listener.mjs </dev/null >${scratchRoot}/listener.log 2>&1 & exit 0`]);

  let pid = null;
  for (let attempt = 0; attempt < 20 && pid === null; attempt += 1) {
    const read = await ssh(["cat", `${scratchRoot}/listener.pid`], { allowFailure: true });
    if (read.code === 0) pid = Number(read.stdout.trim());
    else await sleep(250);
  }
  if (pid === null) throw new Error("listener did not come up on the VM");
  const pgid = Number((await ssh(["ps", "-o", "pgid=", "-p", String(pid)])).stdout.trim());
  if (pgid !== pid) throw new Error(`listener is not its own group leader (pid ${pid}, pgid ${pgid})`);

  const boundLine = (await ssh([`ss -ltnp | grep ':${remotePort} '`])).stdout.trim();
  if (!boundLine.includes(`127.0.0.1:${remotePort}`)) {
    throw new Error(`listener is not bound to loopback: ${boundLine}`);
  }

  let receipt;
  const forward = spawn("ssh", ["-N", "-L", `${localPort}:127.0.0.1:${remotePort}`, host], { stdio: "ignore" });
  // Created before anything can close the child, so the finally below cannot
  // wait on a "close" event that already fired.
  const forwardClosed = new Promise((done) => forward.on("close", done));
  try {
    log(`  listener up on VM loopback :${remotePort} (pid ${pid}, own group)`);
    // RED — the same port, straight at the LAN address, while the listener is
    // provably alive (boundLine above and aliveDuringRed below). curl exit 7 is
    // connection refused, 28 is a timeout under a dropping firewall; both are
    // "the LAN cannot reach the write face", and any HTTP answer is a failure.
    const red = await run("curl", ["--silent", "--show-error", "--connect-timeout", "5",
      `http://${lanAddress}:${remotePort}/`]).then(
      (result) => ({ connected: true, body: result.stdout }),
      (error) => ({ connected: false, exitCode: error.code, stderr: (error.stderr ?? "").trim() }),
    );
    if (red.connected) throw new Error(`the LAN reached the loopback listener: ${red.body.slice(0, 200)}`);
    const aliveDuringRed = (await ssh(["kill", "-0", String(pid)], { allowFailure: true })).code === 0;
    if (!aliveDuringRed) throw new Error("listener died before the red probe completed; red proves nothing");
    log(`  red: LAN direct ${lanAddress}:${remotePort} refused (curl exit ${red.exitCode}), listener alive`);

    // GREEN — the same request through ssh -L must answer with this run's nonce.
    let green = null;
    for (let attempt = 0; attempt < 20 && green === null; attempt += 1) {
      green = await run("curl", ["--silent", "--connect-timeout", "2", `http://127.0.0.1:${localPort}/`])
        .then((result) => JSON.parse(result.stdout), () => null);
      if (green === null) await sleep(300);
    }
    if (green === null) throw new Error("the tunnel never answered");
    if (green.nonce !== nonce) throw new Error("the tunnel answered with a foreign nonce");
    log(`  green: ssh -L answered with this run's nonce`);

    receipt = {
      listener: {
        bind: `127.0.0.1:${remotePort}`,
        stoodUpAs: "one-shot node http server under <vm-scratch>, session leader via setsid",
        ssLine: boundLine.replace(/\s+/gu, " "),
      },
      lanDirect: {
        target: `${lanAddress}:${remotePort}`,
        connected: false,
        curlExitCode: red.exitCode,
        curlError: red.stderr,
        listenerAliveDuringProbe: aliveDuringRed,
        verdict: "red — the LAN cannot reach the loopback-bound port",
      },
      tunnel: {
        route: `ssh -L ${localPort}:127.0.0.1:${remotePort} ${host}`,
        answered: green,
        nonceMatched: true,
        verdict: "green — the same port answers through the SSH tunnel with this run's nonce",
      },
    };
  } finally {
    forward.kill("SIGTERM");
    await Promise.race([forwardClosed, sleep(3000)]);
  }

  // Reclaim: the group, the port, the scratch tree — each verified, not assumed.
  await ssh([`kill -- -${pgid} 2>/dev/null; exit 0`]);
  let groupEmpty = false;
  for (let attempt = 0; attempt < 20 && !groupEmpty; attempt += 1) {
    groupEmpty = (await ssh(["pgrep", "-g", String(pgid)], { allowFailure: true })).code !== 0;
    if (!groupEmpty) await sleep(250);
  }
  if (!groupEmpty) throw new Error(`process group ${pgid} still has members on the VM`);
  const portClosed = (await ssh([`ss -ltn | grep -q ':${remotePort} ' && echo open || echo closed`]))
    .stdout.includes("closed");
  if (!portClosed) throw new Error(`port ${remotePort} is still listening after reclaim`);
  await ssh(["rm", "-rf", scratchRoot]);
  const scratchGone = (await ssh(["test", "!", "-e", scratchRoot], { allowFailure: true })).code === 0;
  if (!scratchGone) throw new Error(`scratch ${scratchRoot} survived cleanup`);
  const localForwards = await run("pgrep", ["-f", `ssh -N -L ${localPort}:`]).then(
    (result) => result.stdout.trim().split("\n").filter(Boolean).length,
    () => 0,
  );

  receipt.reclaim = {
    processGroupKilled: pgid === pid ? "own group (setsid), killed by group id" : `group ${pgid}`,
    processGroupEmpty: groupEmpty,
    portClosed,
    scratchRemoved: scratchGone,
    localForwardClientsLeft: localForwards,
    // The multiplexed ControlMaster from ~/.ssh/config is registered operator
    // configuration shared with concurrent governed sessions on this VM — an
    // owned record, not a leak — so this run does not tear it down.
    controlMasterLeftToOwner: true,
  };
  return receipt;
}

/* ------------------------------------------------------------------ */

const startedAt = instant();
log("[1/3] tripwire drill (green -> red on 0.0.0.0 -> green)");
const tripwire = await tripwireDrill();
log("[2/3] tunnel proof on the VM (LAN red, ssh -L green)");
const tunnel = await tunnelProof();
log("[3/3] writing receipt");

const receipt = {
  schemaVersion: "aos.access-boundary-proof.v1",
  ruling: "TCRN-AOS-MIN-007 D7",
  ok: true,
  startedAt,
  finishedAt: instant(),
  boundary: {
    statement:
      "the AOS write face binds 127.0.0.1 only; any path onto it from off the host is an SSH "
      + "tunnel; an address leaving the Owner's device is handled at external-release grade "
      + "(deploy/access-boundary/README.md)",
    writeFaceBindSite: "apps/cockpit-service/src/service.ts (server.listen host argument)",
    tripwireTest: `${testFile} — "${tripwireTestName}"`,
  },
  tripwireDrill: tripwire,
  tunnelProof: tunnel,
};

let text = `${JSON.stringify(receipt, null, 2)}\n`;
text = text.split(repoRoot).join("<repo-root>");
text = text.split(homedir()).join("<operator-home>");
if (text.includes("/Users/")) throw new Error("a machine-local absolute path survived scrubbing; refusing to write");
await mkdir(dirname(receiptPath), { recursive: true });
await writeFile(receiptPath, text);
log("receipt written to evidence/aos-access-boundary-proof.json");
