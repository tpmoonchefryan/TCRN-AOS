#!/usr/bin/env node
// TCRN-AOS-STORY-134 — retire the mirror segment.
//
// MIN-012 decision 7: the truth host carries a resident cockpit, so the static
// snapshot stand-in is no longer needed. This recipe removes the k3s workload and
// the LAN route that served it, and it writes down what was there first.
//
// Why the forensics come before the removal, and are not optional: a deleted
// deployment cannot be asked what it was. Every later question about this segment
// — what image, what route, which bytes, was the deployed copy the committed one —
// has exactly one chance to be answered, and it is now.
//
// The route is removed rather than repointed at the resident cockpit. That is not
// a preference: the cockpit binds 127.0.0.1 and is reachable only through an SSH
// tunnel (CONF-007 D7), so a LAN ingress in front of it would be the overturn of
// that ruling wearing the costume of a configuration change. The mirror's one
// residual use — a browser on the LAN with no ssh — is precisely the case D7
// prohibits, so it is foreclosed by the ruling and not by convenience.
//
// Removal is declarative: the committed `deploy/aos-mirror.yaml` is streamed to
// `kubectl delete -f -`, so what is removed is exactly what was declared. Nothing
// is installed on the VM and no name list is retyped here.
//
// `--forensics-only` takes the pre-state and stops before touching anything.

import { execFile, execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { VM_HOST, instant, sha256Text, ssh } from "../switch-rehearsal/rehearsal-lib.mjs";
import { stepper } from "../aos-resident-cockpit/resident-lib.mjs";
import {
  MIRROR_HOST, MIRROR_LAN_ADDRESS, MIRROR_MANIFEST, NAMESPACE, OBJECTS, REPO_BUNDLE,
  RESIDENT_PORT, RESIDENT_UNIT, VM_CONTENT_ROOT,
  classifyGet, hostClaimedByIngress, isMirrorAnswering
} from "./manifest.mjs";

const runFile = promisify(execFile);
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FORENSICS_ONLY = process.argv.includes("--forensics-only");

const receipt = {
  schemaVersion: "aos.mirror-retirement.v1",
  story: "TCRN-AOS-STORY-134",
  ruling: "TCRN-AOS-MIN-012 decision 7 — the truth host carries a resident cockpit, so the static "
    + "snapshot stand-in is no longer needed",
  accessRuling: "CONF-007 D7 — the cockpit binds 127.0.0.1 and every off-host path onto it is an SSH tunnel",
  startedAt: instant(),
  ok: false,
  preRetirement: {},
  removal: {},
  verification: {},
  residentCockpitUnaffected: {},
  steps: []
};

function emit() {
  mkdirSync(join(REPO_ROOT, "evidence"), { recursive: true });
  writeFileSync(join(REPO_ROOT, "evidence", "aos-mirror-retirement.json"),
    `${JSON.stringify(receipt, null, 2)}\n`);
}

const step = stepper("retire-mirror", receipt, emit);

/** kubectl on the VM, exit code kept: `NotFound` is an answer, not a failure. */
const kubectl = (args) => ssh(["sudo", "k3s", "kubectl", ...args], { allowFailure: true });

/**
 * ssh that feeds the remote command on stdin.
 *
 * The shared helper passes `-n` (stdin from /dev/null) and that is deliberate
 * there: a remote command that spawns a background process can otherwise leave
 * ssh waiting on a channel nobody closes. It cannot be used for the declarative
 * delete, which needs the manifest ON stdin, and the hazard does not apply —
 * `kubectl delete --wait` is foreground and returns on its own.
 *
 * `spawn` and an explicit `stdin.end()`, not `execFile` with `input`: async
 * `execFile` has no `input` option — that belongs to the *Sync* variants — and
 * passing one is silently ignored. The first run of this recipe did exactly that
 * and `kubectl delete -f -` sat waiting on a stdin nobody would ever close, with
 * no error and nothing deleted. The close is the payload here as much as the
 * bytes are.
 */
async function sshStdin(args, input) {
  const child = spawn("ssh", [VM_HOST, ...args], { stdio: ["pipe", "pipe", "pipe"] });
  const out = [];
  const err = [];
  child.stdout.on("data", (chunk) => out.push(chunk));
  child.stderr.on("data", (chunk) => err.push(chunk));
  child.stdin.end(input);
  const code = await new Promise((resolveExit, rejectExit) => {
    child.on("error", rejectExit);
    child.on("close", resolveExit);
  });
  return {
    code: code ?? 1,
    stdout: Buffer.concat(out).toString("utf8"),
    stderr: Buffer.concat(err).toString("utf8")
  };
}

/**
 * One HTTP probe made FROM THIS MACHINE over the LAN — the reader's own path.
 *
 * Addressed by the IP the hostname resolves to, with the name in the Host header,
 * so the probe measures the cluster's routing rather than this machine's resolver:
 * the name resolves from a local hosts entry, and a probe that failed because the
 * entry went away would prove nothing about the route.
 */
async function lanProbe(path) {
  try {
    const { stdout } = await runFile("curl", [
      "-s", "-m", "8", "--http1.1", "-H", `Host: ${MIRROR_HOST}`,
      "-w", "\n%{http_code}", `http://${MIRROR_LAN_ADDRESS}${path}`
    ], { maxBuffer: 32 * 1024 * 1024 });
    const cut = stdout.lastIndexOf("\n");
    return { reached: true, status: Number(stdout.slice(cut + 1).trim()), body: stdout.slice(0, cut) };
  } catch (error) {
    return { reached: false, status: 0, body: "", error: String(error?.message ?? error).slice(0, 200) };
  }
}

/**
 * The same question asked on the VM's own loopback, through the same ingress.
 *
 * The remote command is one single-quoted `sh -c` string, not an argv list: the
 * shared ssh helper hands its arguments to the remote shell, so a `-w` format
 * carrying a newline arrives mangled and the status parses as 0 — which reads as
 * "unreachable" for a route that answered perfectly.
 */
async function ingressProbe(path) {
  const out = await ssh(["sh", "-c",
    `'curl -s -m 8 -H "Host: ${MIRROR_HOST}" -w "\\n%{http_code}" "http://127.0.0.1${path}"'`],
    { allowFailure: true });
  const cut = out.stdout.lastIndexOf("\n");
  return { status: Number(out.stdout.slice(cut + 1).trim()) || 0, body: out.stdout.slice(0, Math.max(cut, 0)) };
}

/**
 * Response size in BYTES.
 *
 * `String.length` counts UTF-16 units, and these documents are full of Chinese
 * governance text: the same page measured that way reads 380,234 against a real
 * 412,653, and two probes of the identical document would appear to disagree.
 */
const byteLength = (text) => Buffer.byteLength(String(text ?? ""), "utf8");

/** A per-file sha256 ledger of a directory tree, keyed by path relative to it. */
function localLedger(root) {
  return execFileSync("/bin/sh", ["-c",
    'cd "$1" && find . -type f | sed "s|^\\./||" | LC_ALL=C sort '
    + '| while read -r r; do printf "%s  %s\\n" "$(shasum -a 256 "$r" | cut -d" " -f1)" "$r"; done',
    "sh", root], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

/* ── 1. forensics, taken while the thing still exists ───────────────────────── */

const inventory = [];
for (const object of OBJECTS) {
  const got = await kubectl(object.namespaced
    ? ["get", object.kind, object.name, "-n", NAMESPACE, "-o", "json"]
    : ["get", object.kind, object.name, "-o", "json"]);
  const state = classifyGet(got);
  let detail = {};
  if (state === "present") {
    const parsed = JSON.parse(got.stdout);
    detail = {
      uid: parsed.metadata?.uid ?? null,
      creationTimestamp: parsed.metadata?.creationTimestamp ?? null,
      resourceVersion: parsed.metadata?.resourceVersion ?? null,
      specDigest: sha256Text(JSON.stringify(parsed.spec ?? parsed.data ?? {}))
    };
  }
  inventory.push({ kind: object.kind, name: object.name, state, ...detail });
}
receipt.preRetirement.objects = inventory;
step("inventory-before", {
  ok: inventory.every((row) => row.state !== "unknown"),
  reasonCode: "INVENTORY_READ",
  present: inventory.filter((row) => row.state === "present").length,
  objects: inventory
});

const pods = await kubectl(["get", "pods", "-n", NAMESPACE, "-o", "json"]);
receipt.preRetirement.pods = classifyGet(pods) === "present"
  ? JSON.parse(pods.stdout).items.map((pod) => ({
    name: pod.metadata.name,
    uid: pod.metadata.uid,
    phase: pod.status?.phase ?? null,
    startedAt: pod.status?.startTime ?? null,
    restarts: pod.status?.containerStatuses?.[0]?.restartCount ?? null,
    image: pod.status?.containerStatuses?.[0]?.image ?? null,
    imageID: pod.status?.containerStatuses?.[0]?.imageID ?? null
  }))
  : [];

const ingressBefore = await kubectl(["get", "ingress", "-A", "-o", "json"]);
const ingressHosts = (json) => json.items.flatMap((item) =>
  (item.spec?.rules ?? []).map((rule) => ({
    namespace: item.metadata.namespace, name: item.metadata.name, host: rule.host ?? null,
    address: (item.status?.loadBalancer?.ingress ?? []).map((row) => row.ip ?? row.hostname).join(",") || null
  })));
receipt.preRetirement.clusterIngressHosts = classifyGet(ingressBefore) === "present"
  ? ingressHosts(JSON.parse(ingressBefore.stdout)) : [];

/**
 * The bundle ledger, computed on the VM and here by the same recipe, compared full-value.
 *
 * The point is not tidiness. It decides whether this removal destroys anything: if
 * the deployed bytes equal the committed bytes, every byte deleted below is
 * recoverable from this repository's history, and the retirement removes a copy
 * rather than an original.
 */
const vmLedger = await ssh(["sh", "-c",
  `'cd ${VM_CONTENT_ROOT} && sudo find . -type f | sed "s|^\\./||" | LC_ALL=C sort `
  + `| while read -r r; do printf "%s  %s\\n" "$(sudo sha256sum "$r" | cut -d" " -f1)" "$r"; done'`],
  { allowFailure: true });
const committedLedger = localLedger(join(REPO_ROOT, REPO_BUNDLE));
step("deployed-equals-committed", {
  ok: vmLedger.stdout.trim().length > 0 && vmLedger.stdout === committedLedger,
  reasonCode: "DEPLOYED_BUNDLE_IS_THE_COMMITTED_BUNDLE",
  files: vmLedger.stdout.trim().split("\n").filter(Boolean).length,
  vmRoot: VM_CONTENT_ROOT,
  committedRoot: REPO_BUNDLE,
  ledgerDigest: sha256Text(committedLedger),
  vmLedgerDigest: sha256Text(vmLedger.stdout),
  meaning: "every byte removed below is recoverable from this repository's history at the commit "
    + "this retirement was performed from; the removals are working-tree changes, not a rewrite"
});
receipt.preRetirement.bundleLedger = vmLedger.stdout.trim().split("\n").filter(Boolean)
  .map((line) => {
    const at = line.indexOf("  ");
    return { sha256: line.slice(0, at), path: line.slice(at + 2) };
  });

/** What the mirror actually served, module by module, read through the real ingress. */
const MODULES = ["/", "/my-work", "/inbox", "/dashboard", "/projects", "/work-items", "/board",
  "/release-trains", "/knowledge", "/deliberations", "/audit", "/snapshots"];
const served = [];
for (const route of MODULES) {
  const page = await ingressProbe(route);
  served.push({
    route,
    status: page.status,
    bytes: byteLength(page.body),
    view: (page.body.match(/data-cockpit-view="([a-z-]+)"/u) ?? [])[1] ?? null,
    chainKeys: (page.body.match(/TCRN-[A-Z-]+-(?:INIT|EPIC|STORY|SUBTASK|INC|CONF|MIN|SPRINT)-\d+/gu) ?? []).length,
    notices: [...new Set(page.body.match(/data-cockpit-notice="[a-z-]+"/gu) ?? [])]
  });
}
receipt.preRetirement.servedRoutes = served;

/**
 * The stale banner, captured from the deployed bytes before they go.
 *
 * The sentence claims positions and minutes were not read for three partitions.
 * The projection this very page renders from holds 138, 85 and 42 positions for
 * those three. The claim is false in the mirror's own document, and the evidence
 * for that is these bytes — which is why it is taken here rather than asserted
 * from memory afterwards.
 */
const staleSource = await ingressProbe("/my-work");
const staleSentence = (staleSource.body.match(
  /Positions and minutes were not read for [^<]{0,240}/u) ?? [])[0] ?? null;
receipt.preRetirement.staleBannerAsServed = {
  route: "/my-work",
  present: staleSentence !== null,
  sentence: staleSentence
};

const lanBefore = await lanProbe("/");
receipt.preRetirement.lanProbe = {
  from: "this machine, over the LAN, addressed by IP with the hostname in the Host header",
  status: lanBefore.status,
  bytes: byteLength(lanBefore.body),
  view: (lanBefore.body.match(/data-cockpit-view="([a-z-]+)"/u) ?? [])[1] ?? null,
  answering: isMirrorAnswering(lanBefore)
};
step("mirror-answered-on-the-lan", {
  ok: isMirrorAnswering(lanBefore),
  reasonCode: "MIRROR_REACHABLE_BEFORE",
  ...receipt.preRetirement.lanProbe,
  why: "the absence predicate below is only worth reading because this side of it was observed green"
});

if (FORENSICS_ONLY) {
  receipt.ok = true;
  receipt.removal = { performed: false, reason: "--forensics-only" };
  receipt.finishedAt = instant();
  emit();
  console.log(JSON.stringify({ ok: true, forensicsOnly: true }, null, 2));
  process.exit(0);
}

/* ── 2. removal, from the committed declaration ─────────────────────────────── */

const manifestBytes = readFileSync(join(REPO_ROOT, MIRROR_MANIFEST), "utf8");
const deleted = await sshStdin(
  ["sudo", "k3s", "kubectl", "delete", "-f", "-", "--ignore-not-found=true", "--wait=true", "--timeout=120s"],
  manifestBytes);
receipt.removal = {
  performed: true,
  method: `kubectl delete -f - fed the committed ${MIRROR_MANIFEST}`,
  manifestDigest: sha256Text(manifestBytes),
  exitCode: deleted.code,
  output: deleted.stdout.trim().split("\n").filter(Boolean),
  stderr: deleted.stderr.trim().slice(0, 500) || null
};
step("objects-deleted", {
  ok: deleted.code === 0,
  reasonCode: "DECLARED_OBJECTS_DELETED",
  deleted: receipt.removal.output
});

const contentRemoved = await ssh(["sudo", "rm", "-rf", VM_CONTENT_ROOT], { allowFailure: true });
step("content-root-removed", {
  ok: contentRemoved.code === 0,
  reasonCode: "HOSTPATH_CONTENT_REMOVED",
  path: VM_CONTENT_ROOT,
  why: "governance HTML with no declared owner left on disk is residue, not a backup; the ledger "
    + "above established full-value that these bytes are the committed ones"
});

/* ── 3. verification: absence, asked of the authority ───────────────────────── */

const after = [];
for (const object of OBJECTS) {
  const got = await kubectl(object.namespaced
    ? ["get", object.kind, object.name, "-n", NAMESPACE]
    : ["get", object.kind, object.name]);
  after.push({ kind: object.kind, name: object.name, state: classifyGet(got) });
}
receipt.verification.objects = after;
step("objects-absent", {
  ok: after.every((row) => row.state === "absent"),
  reasonCode: "DECLARED_OBJECTS_ABSENT",
  objects: after,
  note: "each object asked for individually; from the delete's exit code alone, a cascade that left "
    + "one object behind reads the same as one that worked"
});

const ingressAfter = await kubectl(["get", "ingress", "-A", "-o", "json"]);
const afterJson = classifyGet(ingressAfter) === "present" ? JSON.parse(ingressAfter.stdout) : { items: [] };
receipt.verification.clusterIngressHosts = ingressHosts(afterJson);
step("hostname-unclaimed-cluster-wide", {
  ok: hostClaimedByIngress(afterJson, MIRROR_HOST) === false,
  reasonCode: "NO_INGRESS_CLAIMS_THE_HOSTNAME",
  host: MIRROR_HOST,
  remainingHosts: receipt.verification.clusterIngressHosts.map((row) => row.host),
  note: "asked of the whole cluster rather than the deleted namespace: 'is this name claimed "
    + "somewhere else' is not a question a namespace delete can answer"
});

const lanAfter = await lanProbe("/");
receipt.verification.lanProbe = {
  from: "this machine, over the LAN, addressed by IP with the hostname in the Host header",
  reached: lanAfter.reached,
  status: lanAfter.status,
  bytes: byteLength(lanAfter.body),
  bodyHead: lanAfter.body.slice(0, 120),
  answering: isMirrorAnswering(lanAfter)
};
step("lan-hostname-no-longer-serves-the-cockpit", {
  ok: isMirrorAnswering(lanAfter) === false,
  reasonCode: "LAN_HOSTNAME_DOES_NOT_ANSWER",
  predicate: "status 200 AND a server-rendered data-cockpit-view marker",
  before: receipt.preRetirement.lanProbe,
  after: receipt.verification.lanProbe,
  bothSidesObserved: true,
  note: "traefik still accepts the connection and answers for a host it has no rule for, so "
    + "'the request failed' would be the wrong predicate: it would read red today for the wrong "
    + "reason and green the moment any other service took that address"
});

const contentGone = await ssh(["test", "-e", VM_CONTENT_ROOT], { allowFailure: true });
step("content-root-absent", {
  ok: contentGone.code !== 0,
  reasonCode: "HOSTPATH_CONTENT_ABSENT",
  path: VM_CONTENT_ROOT,
  testExitCode: contentGone.code
});

/* ── 4. the resident cockpit is untouched ───────────────────────────────────── */

const unit = await ssh(["systemctl", "is-active", RESIDENT_UNIT], { allowFailure: true });
const listener = await ssh(["sudo", "ss", "-ltnH"], { allowFailure: true });
const health = await ssh(["curl", "-s", "-m", "8", "-o", "/dev/null", "-w", "%{http_code}",
  `http://127.0.0.1:${RESIDENT_PORT}/api/health`], { allowFailure: true });
const cockpitListeners = listener.stdout.split("\n")
  .map((line) => line.trim().split(/\s+/u)[3] ?? "")
  .filter((address) => address.endsWith(`:${RESIDENT_PORT}`));

receipt.residentCockpitUnaffected = {
  unit: RESIDENT_UNIT,
  activeState: unit.stdout.trim(),
  healthStatus: Number(health.stdout.trim()) || 0,
  listeningAddresses: cockpitListeners
};
step("resident-cockpit-unaffected", {
  ok: unit.stdout.trim() === "active"
    && Number(health.stdout.trim()) === 200
    && cockpitListeners.length > 0
    && cockpitListeners.every((address) => address.startsWith("127.0.0.1:")),
  reasonCode: "RESIDENT_COCKPIT_STILL_LOOPBACK_ONLY",
  ...receipt.residentCockpitUnaffected,
  why: "this retirement removed a LAN surface, so the D7 boundary on the surviving one is re-read "
    + "from the kernel rather than assumed to have been left alone"
});

receipt.ok = receipt.steps.every((entry) => entry.ok !== false);
receipt.finishedAt = instant();
emit();
console.log(JSON.stringify({
  ok: receipt.ok,
  steps: receipt.steps.map((entry) => `${entry.name}:${entry.ok ? "ok" : "FAILED"}`)
}, null, 2));
if (!receipt.ok) process.exitCode = 1;
