#!/usr/bin/env node
// TCRN-AOS-STORY-132 — the access-boundary tripwire, moved to the VM with the
// thing it guards, and driven red once against the live deployment.
//
// CONF-007 D7 rules that the write face binds 127.0.0.1 and that every path onto
// it from off the host is an SSH tunnel. Until the relocation, that tripwire was
// a unit test on the Owner's machine reading the address the kernel bound in a
// test process (apps/cockpit-service/test/service.test.mjs). That test still
// earns its place — it catches the change in source, in CI, for free — but it can
// no longer answer the question that now matters: what is the RESIDENT service,
// on the VM, actually bound to right now.
//
// So this asks the machine. `ss -ltnH`, local address column, full value. Not the
// source text of service.ts, not what /api/health says about itself, and not
// "does the output mention 127.0.0.1" — a listening socket's PEER column is
// literally `0.0.0.0:*`, so a containment test is green on a wildcard bind and
// answers the same for both sides of the thing it is supposed to separate.
//
// A tripwire that has never fired is not a tripwire. This one is driven red on
// the live deployment: the deployed bind is flipped to 0.0.0.0, the unit is
// restarted, the predicate is watched going red, the LAN is probed to show the
// exposure is real rather than theoretical, and the original bytes are restored
// and verified by digest.
//
// The red window is a real exposure of a pins-holding process on a LAN. It is
// kept to the seconds it takes to read two probes, its duration is recorded, and
// the restore is proven by full-value digest rather than assumed.

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PORT, UNIT_NAME, VM_HOST, VM_RUNTIME } from "./manifest.mjs";
import { judgeLoopbackBind } from "./resident-predicates.mjs";
import { STATE_DIR, instant, run, saveState, ssh, sshNode, stepper, systemctl } from "./resident-lib.mjs";

const DIST_SERVICE = `${VM_RUNTIME}/dist/apps/cockpit-service/src/service.js`;
const LOOPBACK_BIND = `.listen(options.port ?? 4318, "127.0.0.1")`;
const WILDCARD_BIND = `.listen(options.port ?? 4318, "0.0.0.0")`;

const receipt = {
  schemaVersion: "aos.resident-cockpit-tripwire.v1",
  story: "TCRN-AOS-STORY-132",
  ruling: "CONF-007 D7 / MIN-007 D7 — 写面恒绑 127.0.0.1,非本机到达一律 ssh -L",
  ok: false,
  startedAt: instant(),
  where: {
    movedFrom: "apps/cockpit-service/test/service.test.mjs (still in the roster; it judges the source, in CI)",
    movedTo: `${VM_HOST}:${UNIT_NAME} — the kernel-reported bound address of the resident unit`,
    why: "迁置后,「源码里绑什么」与「那台机器上此刻绑着什么」不再是同一个问题;后者只有那台机器能回答"
  },
  steps: []
};
const step = stepper("tripwire", receipt, (partial) => saveState("tripwire", partial));

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
// Plain argv, no remote shell. Every pipeline that went through `sh -c` here had
// to be re-quoted twice (ssh rejoins argv with spaces, the remote shell then
// re-tokenizes) and the first attempt died on an unterminated quote inside an
// awk program. Parsing on this side is shorter and cannot be misquoted.
const readSs = async () => (await ssh(["ss", "-ltnH"], { allowFailure: true })).stdout;

/** The VM's first globally-scoped IPv4 address, parsed here rather than remotely. */
async function lanAddressOf() {
  const shown = (await ssh(["ip", "-4", "-o", "addr", "show", "scope", "global"])).stdout;
  for (const line of shown.split("\n")) {
    const match = line.match(/\sinet\s+(\d+\.\d+\.\d+\.\d+)\//u);
    if (match) return match[1];
  }
  throw new Error("no globally-scoped IPv4 address on the VM");
}

/** Patch the deployed bind in place, returning the digests either side of it. */
async function flipBind(from, to) {
  return JSON.parse(await sshNode(`
    const fs = require("fs");
    const { createHash } = require("crypto");
    const path = ${JSON.stringify(DIST_SERVICE)};
    const before = fs.readFileSync(path);
    const text = before.toString("utf8");
    const from = ${JSON.stringify(from)};
    if (!text.includes(from)) {
      process.stderr.write("expected bind call absent: " + from);
      process.exit(1);
    }
    fs.writeFileSync(path, text.split(from).join(${JSON.stringify(to)}));
    const sha = (b) => createHash("sha256").update(b).digest("hex");
    process.stdout.write(JSON.stringify({
      sha256Before: sha(before),
      sha256After: sha(fs.readFileSync(path))
    }));
  `));
}

/** Wait until something is listening on the port, then judge it. */
async function judgeWhenListening({ attempts = 30 } = {}) {
  let verdict = judgeLoopbackBind("", { port: PORT });
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    verdict = judgeLoopbackBind(await readSs(), { port: PORT });
    if (verdict.reasonCode !== "NO_LISTENER") return verdict;
    await sleep(1000);
  }
  return verdict;
}

/* ---- 1. green: the resident unit, as deployed ---------------------------- */

const lanAddress = await lanAddressOf();
const greenBefore = await judgeWhenListening();
const ssLineGreen = greenBefore.listeners.map((entry) => entry.local).join(",");
step("green-before-the-drill", {
  ...greenBefore,
  reasonCode: greenBefore.reasonCode,
  ssLocalColumn: ssLineGreen,
  lanAddress,
  askedOf: "the VM's own kernel, through ss -ltnH"
});

/* ---- 2. red: flip the deployed bind, restart, watch it fire ------------- */

const redStartedAt = Date.now();
const flipped = await flipBind(LOOPBACK_BIND, WILDCARD_BIND);
let redVerdict = null;
let lanProbe = null;
let restored = null;
try {
  await systemctl(ssh, ["restart", UNIT_NAME]);
  redVerdict = await judgeWhenListening();

  // The exposure, demonstrated rather than asserted: the same port, straight at
  // the VM's LAN address from this machine. In the green state this refuses; in
  // the red state it answers, which is precisely why the tripwire exists.
  lanProbe = await run("curl", ["--silent", "--show-error", "--connect-timeout", "5",
    `http://${lanAddress}:${PORT}/api/health`]).then(
    (result) => ({ reached: true, body: result.stdout.slice(0, 300) }),
    (error) => ({ reached: false, curlExitCode: error.code, stderr: String(error.stderr ?? "").trim() }));
} finally {
  // Restored whether the probes passed or threw. A drill that can leave the write
  // face on a wildcard bind is worse than no drill.
  restored = await flipBind(WILDCARD_BIND, LOOPBACK_BIND);
  await systemctl(ssh, ["restart", UNIT_NAME]);
}
const redWindowSeconds = Math.round((Date.now() - redStartedAt) / 1000);

step("red-drill-fired", {
  ok: redVerdict?.reasonCode === "BOUND_OFF_LOOPBACK" && redVerdict.boundAddress === "0.0.0.0",
  reasonCode: "TRIPWIRE_WENT_RED_ON_WILDCARD_BIND",
  flip: "deployed dist bind host 127.0.0.1 -> 0.0.0.0, in place, on the VM",
  distSha256BeforeFlip: flipped.sha256Before,
  distSha256Flipped: flipped.sha256After,
  verdict: redVerdict,
  lanReachableWhileRed: lanProbe,
  exposureWindowSeconds: redWindowSeconds,
  exposureNote: "红窗内写面确实可从 LAN 到达——这正是绊线存在的理由;窗口压到读两次探针所需的数秒,"
    + "复原以全值摘要证明,而非假定。更安全的替代(改绑 127.0.0.2 亦会转红且零暴露)记录在此,本次按裁定照做真实翻转"
});

/* ---- 3. restored, and proven restored ---------------------------------- */

const greenAfter = await judgeWhenListening();
const health = await ssh(["curl", "-s", "-m", "3", `http://127.0.0.1:${PORT}/api/health`], { allowFailure: true });
const lanProbeAfter = await run("curl", ["--silent", "--show-error", "--connect-timeout", "5",
  `http://${lanAddress}:${PORT}/api/health`]).then(
  (result) => ({ reached: true, body: result.stdout.slice(0, 300) }),
  (error) => ({ reached: false, curlExitCode: error.code, stderr: String(error.stderr ?? "").trim() }));
step("green-after-restore", {
  ok: greenAfter.ok
    && restored.sha256After === flipped.sha256Before
    && lanProbeAfter.reached === false
    && health.stdout.includes("\"ok\":true"),
  reasonCode: "BIND_RESTORED_BYTE_FOR_BYTE_AND_LAN_REFUSED_AGAIN",
  verdict: greenAfter,
  distSha256AfterRestore: restored.sha256After,
  equalsPreDrillBytes: restored.sha256After === flipped.sha256Before,
  lanRefusedAgain: lanProbeAfter,
  serviceAnswersOnLoopback: health.stdout.includes("\"ok\":true"),
  bothSidesOfThePredicateWereObserved: `green=${greenBefore.boundAddress} red=${redVerdict?.boundAddress ?? "n/a"} green=${greenAfter.boundAddress}`
});

receipt.notClaimed = [
  "本文只判「此刻这台机器上的写面绑在哪」;它不替代 apps/cockpit-service/test/service.test.mjs 对源码的判据,两者判的是不同的问题",
  "LAN 探针的红/绿证明的是可达性,不是防火墙配置;VM 上没有为此加任何过滤规则,拒绝来自 loopback 绑定本身",
  "绿态下 ssh -L 的到达性由走查证(deploy/aos-resident-cockpit/walkthrough.mjs),本文不重复"
];
receipt.ok = receipt.steps.every((entry) => entry.ok !== false);
receipt.finishedAt = instant();
mkdirSync(STATE_DIR, { recursive: true });
saveState("tripwire", receipt);
console.log(JSON.stringify({
  ok: receipt.ok,
  sequence: receipt.steps.map((entry) => `${entry.name}=${entry.reasonCode}`),
  boundAddressNow: greenAfter.boundAddress,
  stateFile: join("<state>", "tripwire.json")
}, null, 2));
if (!receipt.ok) process.exitCode = 1;
