#!/usr/bin/env node
// The red proof for the tunnel-reclaim predicate.
//
// The walkthrough used to declare its tunnel reclaimed by counting `ssh -N -L`
// processes. That count reads zero while the forward is still open, because
// this host is configured `ControlMaster auto` + `ControlPersist`: the client
// asks the multiplexed master for a forward and the master keeps it after the
// client dies. The consequence was found at cleanup — a listener on the tunnel
// port owned by a master older than the run that "reclaimed" it.
//
// This script makes that failure happen on purpose and records both readings
// side by side: the old predicate green while the new one is red, then both
// green after the reclaim that asks the master to cancel.
//
// It touches no chain, no workspace and no VM state — only a local forward.

import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, instant, reclaimLocalTunnel } from "./rehearsal-lib.mjs";

const runFile = promisify(execFile);
const TUNNEL_PORT = 14319;
const VM_PORT = 14318;

const listeners = () => runFile("lsof", ["-nP", `-iTCP:${TUNNEL_PORT}`, "-sTCP:LISTEN"])
  .then((result) => result.stdout.trim().split("\n").filter((line) => line && !line.startsWith("COMMAND")).length,
    () => 0);
const clients = () => runFile("pgrep", ["-f", `ssh -N -L ${TUNNEL_PORT}`])
  .then((result) => result.stdout.trim().split("\n").filter(Boolean).length, () => 0);

const receipt = {
  schemaVersion: "aos.tunnel-reclaim-red-proof.v1",
  story: "TCRN-AOS-STORY-125 (演练收尾发现)",
  at: instant(),
  ok: false,
  sshConfig: "Host tcrn-platform-dev: ControlMaster auto, ControlPersist 10m",
  stages: []
};

// 1 — open the forward the walkthrough opens.
const tunnel = spawn("ssh", ["-N", "-L", `${TUNNEL_PORT}:127.0.0.1:${VM_PORT}`, "tcrn-platform-dev"],
  { stdio: "ignore", detached: true });
let up = 0;
for (let attempt = 0; attempt < 20 && up === 0; attempt += 1) {
  await new Promise((r) => setTimeout(r, 500));
  up = await listeners();
}
receipt.stages.push({ stage: "forward-open", listenersOnPort: up, clientProcesses: await clients() });

// 2 — kill ONLY the client, exactly as the old reclaim did.
try { process.kill(-tunnel.pid, "SIGTERM"); } catch { /* group gone */ }
try { tunnel.kill("SIGTERM"); } catch { /* gone */ }
await new Promise((r) => setTimeout(r, 1500));
const afterClientKill = { listenersOnPort: await listeners(), clientProcesses: await clients() };
receipt.stages.push({
  stage: "client-killed-only",
  ...afterClientKill,
  oldPredicate: { name: "no `ssh -N -L` process remains", verdict: afterClientKill.clientProcesses === 0 ? "GREEN" : "RED" },
  newPredicate: { name: "nothing is listening on the tunnel port", verdict: afterClientKill.listenersOnPort === 0 ? "GREEN" : "RED" }
});

// 3 — the reclaim that asks the master.
const reclaimed = await reclaimLocalTunnel({ tunnelPort: TUNNEL_PORT, vmPort: VM_PORT, tunnelPid: null });
receipt.stages.push({ stage: "master-forward-cancelled", ...reclaimed });

receipt.divergenceObserved = afterClientKill.clientProcesses === 0 && afterClientKill.listenersOnPort > 0;
receipt.ok = up > 0 && receipt.divergenceObserved && reclaimed.ok;
receipt.reading = receipt.divergenceObserved
  ? "旧判据在转发仍然开着的时候读到绿(进程为零),新判据同一时刻读到红(端口仍有监听者)——两者不等价,旧判据量错了东西"
  : "本次未复现分歧(master 未持有该转发);如实记录,不据此声称旧判据可用";
receipt.notClaimed = [
  "本证只谈本机 ssh 转发的回收判据,与链、工作区、VM 状态无关",
  "ControlMaster 本身不是泄漏(它是配置登记在册的常驻连接);泄漏的是它替一个已死客户端继续持有的那个端口转发"
];

mkdirSync(join(REPO_ROOT, "evidence"), { recursive: true });
writeFileSync(join(REPO_ROOT, "evidence", "aos-tunnel-reclaim-red-proof.json"),
  `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.ok) process.exitCode = 1;
