#!/usr/bin/env node
// The real-machine run of the documentation-topology predicate (TCRN-AOS-STORY-136).
//
//   node deploy/aos-local-client/doc-topology-proof.mjs
//        [--probe-vm]   also ask the away host itself (instrument discipline rule 4)
//        [--emit]       write evidence/aos-topology-doc-sync.json
//
// WHAT THIS RUN IS FOR. `doc-topology-predicates.test.mjs` proves the judgement is right
// about data. It cannot say anything about the documents on THIS platform, because a test
// file may not depend on files outside its own repository. So the judgement is exercised
// twice against two kinds of input, and one invocation records BOTH DIRECTIONS:
//
//   GREEN   every registered document's claims agree with the roster, and the roster
//           agrees with what the engine answers at each address;
//   RED 1   one claim's `home` flipped in a real document's real text — the same parser,
//           the same judge — must red and must name that document and partition;
//   RED 2   one claim's `address` altered by a single path segment must red;
//   RED 3   a required claim block deleted must red, so removing the block cannot be the
//           way to silence RED 1;
//   RED 4   the away partition's address pasted into a document body outside the block
//           must red, so a stale sentence beside a correct table is still caught;
//   RED 5   measurement contradicting the roster must red — synthesised on the observation,
//           not on the documents, because that is the term no document edit can reach.
//
// The reds mutate the real documents' TEXT IN MEMORY. Nothing here writes to a document,
// and that is the only reason it is safe to run from `pnpm verify`. A real on-disk red was
// performed once by hand for STORY-136 and its transcript is in the evidence artifact
// under `onDiskRed`.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { PARTITION_ROSTER, PLATFORM_ROOT, REPO_ROOT, VM_HOST, WORKSPACE_CONTAINER }
  from "./topology.mjs";
import { probeReadFace } from "./scan-local.mjs";
import {
  CEILING, DOC_REGISTRY, absoluteDocPath, forbiddenOutsideClaimBlocks
} from "./doc-topology-registry.mjs";
import {
  CLAIM_BLOCK_BEGIN, CLAIM_BLOCK_END, judgeDocTopology, parseClaimBlocks
} from "./doc-topology-predicates.mjs";
import { scrubHostPaths } from "../../scripts/lib/evidence-hygiene.mjs";

export const EVIDENCE_PATH = join(REPO_ROOT, "evidence/aos-topology-doc-sync.json");
export const SSH_BREAKGLASS_ALLOWLIST_PATH = join(
  REPO_ROOT, "deploy/aos-local-client/ssh-breakglass-allowlist.json");
const runFile = promisify(execFile);

/** The SSH break-glass allowlist (STORY-158.1), read once, consumed by the access-form guard. */
export function readSshBreakglassAllowlist(path = SSH_BREAKGLASS_ALLOWLIST_PATH) {
  if (!existsSync(path)) return { path: "MISSING", classes: [], entries: [] };
  let parsed = null;
  try { parsed = JSON.parse(readFileSync(path, "utf8")); } catch { parsed = null; }
  return {
    path,
    classes: Array.isArray(parsed?.classes) ? parsed.classes : [],
    entries: Array.isArray(parsed?.entries) ? parsed.entries : []
  };
}

/** The local siting convention, as the claims write it: relative to the platform root. */
export const localAddressOf = (partitionId) => `.tcrn-workspace/${partitionId}/workspace`;

/** Registered documents, read as bytes. A missing one is a row, not an exception. */
export function readRegisteredDocuments(registry = DOC_REGISTRY) {
  return registry.map((rule) => {
    const absolute = absoluteDocPath(rule.path);
    if (!existsSync(absolute)) return { path: rule.path, exists: false, text: "" };
    return { path: rule.path, exists: true, text: readFileSync(absolute, "utf8") };
  });
}

/**
 * The SAME documents as the reader of the repository sees them — i.e. at HEAD.
 *
 * WHY THIS EXISTS (TCRN-CROSS-INC-039). Everything above reads the working tree, and
 * for two days that was enough to keep this gate green while the committed record was
 * wrong: TCRN-TMS and TCRN-Design-System had their claim blocks corrected in the tree
 * on 2026-08-03 and left uncommitted, so `git show HEAD:CLAUDE.md` went on telling
 * every reader that those partitions were `home = local` and inviting them to run a
 * local engine against an address that now answers WORKSPACE_RELOCATION_VACATED. A gate
 * that reads only the tree cannot see that, and this one was cited as evidence that the
 * documents were in order.
 *
 * The predicate is deliberately plain: for a registered document that lives inside a git
 * repository, the committed claim block must equal the working-tree claim block. An
 * uncommitted claim edit therefore REDS — which is correct rather than inconvenient: a
 * topology claim that is right only on the author's disk is a claim no reader can act on.
 *
 * A document outside any git repository (the platform root is not a repository) has no
 * committed form to compare. That is reported as `tracked: false` and is a stated
 * ceiling of this check, not a silent pass — see CEILING.gitCoverage.
 */
export function readCommittedDocuments(registry = DOC_REGISTRY) {
  return registry.map((rule) => {
    const absolute = absoluteDocPath(rule.path);
    // The repository a document belongs to is the nearest ancestor that git owns.
    let repoRoot = null;
    try {
      repoRoot = execFileSync("git", ["-C", dirname(absolute), "rev-parse", "--show-toplevel"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch { repoRoot = null; }
    if (repoRoot === null) return { path: rule.path, tracked: false, text: null };
    const relativeToRepo = relative(repoRoot, absolute).split(sep).join("/");
    try {
      const text = execFileSync("git", ["-C", repoRoot, "show", `HEAD:${relativeToRepo}`],
        { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
      return { path: rule.path, tracked: true, repoRoot, text };
    } catch {
      // Present in the tree, absent from HEAD: a new document nobody has committed.
      return { path: rule.path, tracked: true, repoRoot, text: null };
    }
  });
}

/** Do the committed claim blocks say what the working tree's do? */
export function judgeCommittedClaims({ worktree = readRegisteredDocuments(), committed = readCommittedDocuments() } = {}) {
  const rows = worktree.map((doc) => {
    const head = committed.find((candidate) => candidate.path === doc.path);
    if (head === undefined || head.tracked !== true) {
      return { path: doc.path, tracked: false, agrees: null, note: "outside any git repository" };
    }
    if (head.text === null) {
      return { path: doc.path, tracked: true, agrees: false, note: "present in the tree, absent from HEAD" };
    }
    const inTree = JSON.stringify(parseClaimBlocks(doc.text));
    const atHead = JSON.stringify(parseClaimBlocks(head.text));
    return { path: doc.path, tracked: true, agrees: inTree === atHead,
      note: inTree === atHead ? null : "the committed claim block differs from the working tree's" };
  });
  const divergent = rows.filter((row) => row.agrees === false).map((row) => row.path);
  return {
    ok: divergent.length === 0,
    reasonCode: divergent.length === 0 ? "COMMITTED_CLAIMS_MATCH_THE_TREE" : "COMMITTED_CLAIMS_DIVERGE_FROM_THE_TREE",
    divergent,
    untracked: rows.filter((row) => row.tracked === false).map((row) => row.path),
    rows
  };
}

/**
 * Ask the away host itself.
 *
 * `BatchMode=yes` so an unreachable or unauthenticated host FAILS rather than blocking a
 * `verify` on a password prompt, and the failure is recorded as a probe outcome instead of
 * being swallowed. A probe that cannot run is reported as `vmProbed: true` with an
 * unaccepted answer — which reds — rather than quietly downgrading to the cheap path. The
 * downgrade decision belongs to the caller who chose not to pass `--probe-vm`.
 */
export async function probeAwayHost({ host = VM_HOST, address, engineCli }) {
  const command = `node ${engineCli} status --workspace ${address}`;
  try {
    const { stdout } = await runFile("ssh",
      ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", host, command],
      { maxBuffer: 8 * 1024 * 1024 });
    const json = JSON.parse(stdout);
    return {
      accepted: true,
      reasonCode: json.reasonCode ?? null,
      workspaceId: json.workspaceId ?? null,
      version: json.version ?? null,
      headEventHash: json.headEventHash ?? null
    };
  } catch (error) {
    const emitted = String(error?.stdout ?? "").trim() || String(error?.stderr ?? "").trim();
    let reasonCode = null;
    try { reasonCode = JSON.parse(emitted).reasonCode ?? null; } catch { reasonCode = null; }
    return {
      accepted: false,
      reasonCode: reasonCode ?? "AWAY_HOST_UNREACHABLE_OR_NON_JSON",
      detail: emitted.slice(0, 200)
    };
  }
}

/**
 * One observation per rostered partition.
 *
 * The local half always runs, for EVERY partition including the away one — the away
 * partition's local address is exactly where a resurrected tree would appear, so skipping
 * it because "the truth moved" would remove the only measurement that can catch that.
 */
export async function observeDocTopology({ roster = PARTITION_ROSTER, probeVm = false } = {}) {
  const observations = {};
  for (const entry of roster) {
    const localAddress = resolve(PLATFORM_ROOT, localAddressOf(entry.partitionId));
    const local = await probeReadFace(localAddress);
    let localWorkspaceId = null;
    const metadataPath = join(localAddress, ".tcrn-workflow/workspace.json");
    if (existsSync(metadataPath)) {
      try { localWorkspaceId = JSON.parse(readFileSync(metadataPath, "utf8")).workspaceId ?? null; }
      catch { localWorkspaceId = null; }
    }

    const observation = {
      partitionId: entry.partitionId,
      home: entry.home,
      localAddressRelative: localAddressOf(entry.partitionId),
      localAccepted: local.accepted === true,
      localReasonCode: local.reasonCode ?? null,
      localVersion: local.version ?? null,
      localWorkspaceId,
      vmProbed: false
    };

    if (entry.home === "vm" && probeVm) {
      const away = await probeAwayHost({
        address: entry.liveAddress,
        engineCli: "/srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs"
      });
      observation.vmProbed = true;
      observation.vmAddress = entry.liveAddress;
      observation.vmAccepted = away.accepted === true;
      observation.vmReasonCode = away.reasonCode ?? null;
      observation.vmWorkspaceId = away.workspaceId ?? null;
      observation.vmVersion = away.version ?? null;
      observation.vmHeadEventHash = away.headEventHash ?? null;
    }
    observations[entry.partitionId] = observation;
  }
  return observations;
}

/**
 * A red, produced by mutating one document's text and re-judging.
 *
 * `mutate` receives the documents array and returns a new one. The judge, the roster, the
 * literals and the observations are the SAME objects the green used, so a red here is the
 * real code path going red — not a fixture arranged to fail. The `names` assertion is what
 * makes it a useful red: a gate that goes red without saying where is a gate that gets
 * disabled the first time it fires on a Friday.
 */
function redProof({ id, why, documents, mutate, expectCode, names, base }) {
  const mutated = mutate(documents.map((document) => ({ ...document })));
  const verdict = judgeDocTopology({ ...base, documents: mutated });
  const hits = verdict.findings.filter((finding) => finding.code === expectCode);
  return {
    id,
    why,
    wentRed: verdict.ok === false,
    reasonCode: verdict.reasonCode,
    expectedCode: expectCode,
    raisedExpectedCode: hits.length > 0,
    named: hits.map((finding) => ({
      path: finding.path ?? null,
      partitionId: finding.partitionId ?? null,
      line: finding.line ?? null,
      expected: finding.expected ?? null,
      observed: finding.observed ?? null
    })),
    namesWhatItShould: names === undefined ? null : names(hits),
    findingCodes: verdict.findingCodes
  };
}

export const ON_DISK_RED_PATH = join(
  REPO_ROOT, "deploy/aos-local-client/on-disk-red-2026-07-30.json");

/**
 * The one red that was performed against real bytes on disk, folded in from its transcript.
 *
 * This script never writes a document — that is the only reason it is safe in `pnpm verify`
 * — so the in-memory reds above cannot cover the path "somebody edited a committed file".
 * That path was walked once by hand (green → edit one `home` cell → red → restore → green,
 * restore verified byte-identical) and its transcript is a tracked file rather than a
 * sentence in a commit message.
 *
 * The transcript is READ, not trusted blindly: if the file is gone, this reports
 * `ran: false` with the reason, which unmets an expectation rather than quietly dropping
 * the claim. A record whose absence changes nothing is not a record.
 */
export function foldOnDiskRed() {
  if (!existsSync(ON_DISK_RED_PATH)) {
    return {
      ran: false,
      why: "转录文件不在:deploy/aos-local-client/on-disk-red-2026-07-30.json",
      howToRun: "改 AGENTS.md 声明块里任一行的 home 或 address → 跑本脚本 → 期望红 → 改回 → 期望绿"
    };
  }
  const transcript = JSON.parse(readFileSync(ON_DISK_RED_PATH, "utf8"));
  const arc = Array.isArray(transcript.arc) ? transcript.arc : [];
  const states = arc.map((step) => step.state).join("→");
  return {
    ran: true,
    transcriptPath: "deploy/aos-local-client/on-disk-red-2026-07-30.json",
    performedAt: transcript.performedAt ?? null,
    target: transcript.target ?? null,
    arcStates: states,
    // The shape a real red must have. Two greens around one red, because a red that was
    // never restored proves the gate fires and leaves the tree broken, and a lone red
    // proves nothing about whether green was ever reachable.
    arcIsGreenRedGreen: states === "green→red→green",
    // This transcript predates the S217 canonical-document flip. Keep its historical
    // target intact: the artifact itself records that the red named CLAUDE.md's row.
    redNamedTheRow: arc.some((step) => step.state === "red"
      && (step.findings ?? []).some((finding) =>
        finding.code === "CLAIMED_HOME_CONTRADICTS_ROSTER"
        && finding.path === transcript.target?.document)),
    restoredByteIdentical: transcript.restoredByteIdentical === true,
    arc
  };
}

/** Replace the first occurrence of `from` with `to` inside one registered document. */
const editDocument = (path, from, to) => (documents) => documents.map((document) =>
  document.path === path
    ? { ...document, text: document.text.replace(from, to) }
    : document);

export async function runDocTopologyProof({ probeVm = false } = {}) {
  const literals = forbiddenOutsideClaimBlocks(PARTITION_ROSTER);
  const documents = readRegisteredDocuments();
  const observations = await observeDocTopology({ probeVm });
  const sshBreakglass = readSshBreakglassAllowlist();
  const base = {
    registry: DOC_REGISTRY, roster: PARTITION_ROSTER, literals, observations, localAddressOf,
    sshAllowlist: sshBreakglass.entries
  };
  const green = judgeDocTopology({ ...base, documents });

  // The mutations target the platform AGENTS.md, which is required to carry every
  // primary claim — so the red legs exercise the canonical file a reader is meant to trust.
  const platform = documents.find((document) => document.path === "AGENTS.md") ?? null;
  const awayEntry = PARTITION_ROSTER.find((entry) => entry.home === "vm") ?? null;
  const targetEntry = PARTITION_ROSTER[0] ?? null;
  // INC-045: the red suite must run under both topology directions. Previously it was
  // guarded by an away-only row, so returning every partition to local silently removed
  // the in-memory reds. Pick the first registered primary as the mutation target and use
  // the actual home direction for the observation contradiction.
  const platformParsed = platform === null
    ? { spans: [] }
    : parseClaimBlocks(platform.text, { path: "AGENTS.md" });

  const reds = [];
  if (platform !== null && targetEntry !== null) {
    const expectedAddress = targetEntry.home === "vm"
      ? targetEntry.liveAddress : localAddressOf(targetEntry.partitionId);
    const flippedHome = targetEntry.home === "vm" ? "local" : "vm";
    const alteredAddress = expectedAddress.includes("/governance/")
      ? expectedAddress.replace("/governance/", "/governance-old/")
      : expectedAddress.replace(/\/workspace$/u, "/workspace-old");
    const canonicalClaimBlock = `${CLAIM_BLOCK_BEGIN}\n\n| 分区 | home | 真值地址 | 复核命令 |\n| --- | --- | --- | --- |\n`
      + `| \`${targetEntry.partitionId}\` | \`${targetEntry.home}\` | \`${expectedAddress}\` | status --workspace ${expectedAddress} |\n\n`
      + `${CLAIM_BLOCK_END}`;
    reds.push(redProof({
      id: "HOME_FLIPPED_IN_A_REAL_DOCUMENT",
      why: `AGENTS.md 把 ${targetEntry.partitionId} 的 home 改写成 ${flippedHome}——`
        + "即把当前拓扑的真值位置写成相反方向。",
      documents, base,
      mutate: editDocument("AGENTS.md",
        `| \`${targetEntry.partitionId}\` | \`${targetEntry.home}\` |`,
        `| \`${targetEntry.partitionId}\` | \`${flippedHome}\` |`),
      expectCode: "CLAIMED_HOME_CONTRADICTS_ROSTER",
      names: (hits) => hits.some((finding) =>
        finding.path === "AGENTS.md" && finding.partitionId === targetEntry.partitionId)
    }));

    reds.push(redProof({
      id: "ADDRESS_ALTERED_BY_ONE_SEGMENT",
      why: `AGENTS.md 把 ${targetEntry.partitionId} 的真值地址改掉一段路径——`
        + "地址错一段与错整条同样致命,因为读者会照着它跑命令。",
      documents, base,
      mutate: editDocument("AGENTS.md",
        expectedAddress,
        alteredAddress),
      expectCode: "CLAIMED_ADDRESS_CONTRADICTS_ROSTER",
      names: (hits) => hits.some((finding) =>
        finding.path === "AGENTS.md" && finding.partitionId === targetEntry.partitionId)
    }));

    reds.push(redProof({
      id: "REQUIRED_BLOCK_DELETED",
      why: "整块声明被删掉。若删块能让上面两条红消失,这道门就只是一条建议。",
      documents, base,
      mutate: (all) => all.map((document) => document.path !== "AGENTS.md"
        ? document
        : {
          ...document,
          text: document.text.slice(0, platformParsed.spans[0]?.start ?? 0)
            + document.text.slice(platformParsed.spans[0]?.end ?? 0)
        }),
      expectCode: "REQUIRED_CLAIM_BLOCK_ABSENT",
      names: (hits) => hits.some((finding) => finding.path === "AGENTS.md")
    }));

    reds.push(redProof({
      id: "CLAUDE_CLAIM_BLOCK_RESIDUAL",
      why: "把声明块塞回 CLAUDE.md 会重新制造第二正本,必须红而不能靠 @AGENTS.md import 的表面相似蒙混过去。",
      documents, base,
      mutate: (all) => all.map((document) => document.path !== "CLAUDE.md"
        ? document
        : { ...document, text: `${document.text}\n${canonicalClaimBlock}\n` }),
      expectCode: "CLAIM_BLOCK_IN_NON_CANONICAL_DOCUMENT",
      names: (hits) => hits.some((finding) => finding.path === "CLAUDE.md")
    }));

    reds.push(redProof({
      id: "STALE_SENTENCE_BESIDE_A_CORRECT_TABLE",
      why: "声明块保持正确,却在正文里另写一句带具体地址的话——这正是本会话栽过的那个形状:"
        + "一处更新了,另一处没有,而两处都在同一份文档里。",
      documents, base,
      mutate: (all) => all.map((document) => document.path !== "AGENTS.md"
        ? document
        : { ...document, text: `${document.text}\n事件链在 ${expectedAddress} 下。\n` }),
      expectCode: "ADDRESS_STATED_OUTSIDE_A_CLAIM_BLOCK",
      names: (hits) => hits.some((finding) =>
        finding.path === "AGENTS.md" && finding.literal === expectedAddress)
    }));

    reds.push(redProof({
      id: "SSH_DIRECT_ENGINE_COMMAND_NOT_ALLOWLISTED",
      why: "STORY-157.3:复核命令列教人 SSH 直驱引擎——访问形态错,不管地址对不对。"
        + "一条没进 break-glass 白名单的 ssh 直驱命令必须红并点名文件与行号。"
        + "(用写动词 work-transition,避免命中 mcp-unreachable-fallback 的 status 条目。)",
      documents, base,
      mutate: editDocument("AGENTS.md",
        "## 三、治理入口",
        `## 三、治理入口\n\n复核走 \`ssh tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs `
        + `work-transition --id work:x --status done --workspace ${expectedAddress}"\`。\n`),
      expectCode: "SSH_DIRECT_ENGINE_COMMAND_NOT_ALLOWLISTED",
      names: (hits) => hits.some((finding) => finding.path === "AGENTS.md")
    }));
  }

  // The fifth red is on the OBSERVATION, and it is the one no document edit can produce:
  // documents and roster in perfect agreement, both wrong about the machine. For a local
  // row, make the local engine stop answering; for an away row, make the local address
  // answer. Both are genuine contradictions the judge must red on.
  const contradicted = targetEntry === null ? null : {
    ...observations,
    [targetEntry.partitionId]: targetEntry.home === "local"
      ? {
        ...observations[targetEntry.partitionId],
        localAccepted: false,
        localReasonCode: "WORKSPACE_RELOCATION_VACATED",
        localWorkspaceId: null
      }
      : {
        ...observations[targetEntry.partitionId],
        localAccepted: true,
        localReasonCode: "WORKSPACE_COMMAND_COMPLETED"
      }
  };
  const measurementRed = contradicted === null ? null : (() => {
    const verdict = judgeDocTopology({ ...base, documents, observations: contradicted });
    const code = targetEntry.home === "local"
      ? "ROSTER_SAYS_LOCAL_BUT_ENGINE_DOES_NOT_ANSWER_HERE"
      : "ROSTER_SAYS_AWAY_BUT_A_LIVE_TREE_ANSWERS_LOCALLY";
    const hits = verdict.findings.filter((finding) => finding.code === code);
    return {
      id: "MEASUREMENT_CONTRADICTS_A_CONSISTENT_ROSTER",
      why: targetEntry.home === "local"
        ? "名册与全部文档一致,但本应在家的分区本机地址拒答——要么树消失了,要么观测错了。"
          + "此时错的是名册/文档与机器三者之一,单靠两份陈述自洽不足为证。"
        : "名册与全部文档一致,但 home:vm 分区的本机地址答活——要么树复活了,要么观测错了。"
          + "此时错的是名册/文档与机器三者之一,单靠两份陈述自洽不足为证。",
      wentRed: verdict.ok === false,
      reasonCode: verdict.reasonCode,
      expectedCode: code,
      raisedExpectedCode: hits.length > 0,
      namesWhatItShould: hits.some((finding) => finding.partitionId === targetEntry.partitionId),
      named: hits.map((finding) => ({ partitionId: finding.partitionId, observed: finding.observed }))
    };
  })();

  const allReds = measurementRed === null ? reds : [...reds, measurementRed];

  const expectations = [
    // The local half of the measurement always runs, so the green here is always the
    // measured one. `probeVm` changes how STRONG the away row's evidence is, not whether a
    // machine was consulted — and that distinction is carried by `observations[*].vmProbed`
    // rather than by this reason code.
    { id: "GREEN_ON_THIS_PLATFORM", met: green.ok === true,
      expected: "DOC_TOPOLOGY_CLAIMS_MATCH_MEASUREMENT", observed: green.reasonCode },
    { id: "EVERY_REGISTERED_DOCUMENT_PRESENT",
      met: green.perDocument.every((row) => row.exists === true),
      expected: DOC_REGISTRY.length,
      observed: green.perDocument.filter((row) => row.exists === true).length },
    { id: "EVERY_REQUIRED_BLOCK_CARRIES_ITS_PARTITIONS",
      met: DOC_REGISTRY.filter((rule) => rule.mustCarryClaims).every((rule) => {
        const row = green.perDocument.find((candidate) => candidate.path === rule.path);
        return row !== undefined
          && row.partitions.join("/") === [...rule.expectedPartitions].sort().join("/");
      }),
      expected: "each required document declares exactly its registered partition set",
      observed: green.perDocument.filter((row) => row.mustCarryClaims)
        .map((row) => `${row.path}=${row.partitions.join("+")}`) },
    { id: "MEASUREMENT_RAN", met: green.measured === true, expected: true, observed: green.measured },
    { id: "NO_NON_ALLOWLISTED_SSH_DIRECT_COMMANDS",
      met: green.findings.filter((finding) => finding.code === "SSH_DIRECT_ENGINE_COMMAND_NOT_ALLOWLISTED").length === 0,
      expected: "registered documents carry no SSH-direct-engine command outside the break-glass allowlist",
      observed: green.findings.filter((finding) => finding.code === "SSH_DIRECT_ENGINE_COMMAND_NOT_ALLOWLISTED")
        .map((finding) => `${finding.path}:${finding.line}`) },
    { id: "SSH_BREAKGLASS_ALLOWLIST_PRESENT",
      met: sshBreakglass.path !== "MISSING" && sshBreakglass.classes.length === 2,
      expected: "ssh-breakglass-allowlist.json with the two residual classes",
      observed: `${sshBreakglass.path} (${sshBreakglass.classes.length} classes, ${sshBreakglass.entries.length} entries)` },
    // INC-060 item 3: a lower bound on the red-proof count, so an all-local roster (or
    // any future guard change) that silently stops running the in-memory reds is a red
    // expectation, not a vanished one. INC-045's silent-skip class must not recur.
    { id: "RED_PROOF_COUNT_FLOOR",
      met: allReds.length >= 5,
      expected: "≥5 in-memory red proofs actually ran",
      observed: allReds.length },
    ...allReds.map((red) => ({
      id: `RED_${red.id}`,
      met: red.wentRed === true && red.raisedExpectedCode === true
        && (red.namesWhatItShould === null || red.namesWhatItShould === true),
      expected: red.expectedCode,
      observed: red.wentRed ? red.findingCodes ?? red.reasonCode : "STAYED_GREEN"
    }))
  ];

  // TCRN-CROSS-INC-039: the tree being right is not the same as the record being right.
  const committedClaims = judgeCommittedClaims();
  expectations.push(
    { id: "COMMITTED_CLAIMS_MATCH_THE_TREE", met: committedClaims.ok === true,
      expected: "COMMITTED_CLAIMS_MATCH_THE_TREE", observed: committedClaims.reasonCode },
    { id: "COMMITTED_CLAIM_DIVERGENCE_NAMES_ITS_DOCUMENT",
      met: committedClaims.ok === true || committedClaims.divergent.length > 0,
      expected: "a divergence names the document it is in",
      observed: committedClaims.divergent });

  const onDiskRed = foldOnDiskRed();
  expectations.push(
    { id: "ON_DISK_RED_WAS_PERFORMED", met: onDiskRed.ran === true,
      expected: true, observed: onDiskRed.ran },
    { id: "ON_DISK_RED_WENT_GREEN_RED_GREEN", met: onDiskRed.arcIsGreenRedGreen === true,
      expected: "green→red→green", observed: onDiskRed.arcStates ?? "NO_TRANSCRIPT" },
    { id: "ON_DISK_RED_NAMED_THE_ROW_IT_BROKE", met: onDiskRed.redNamedTheRow === true,
      expected: "CLAIMED_HOME_CONTRADICTS_ROSTER at CLAUDE.md", observed: onDiskRed.redNamedTheRow ?? false },
    { id: "ON_DISK_RED_RESTORED_THE_DOCUMENT", met: onDiskRed.restoredByteIdentical === true,
      expected: true, observed: onDiskRed.restoredByteIdentical ?? false });

  if (probeVm && awayEntry !== null) {
    const away = observations[awayEntry.partitionId];
    expectations.push({
      id: "AWAY_HOST_ANSWERED_FOR_ITSELF",
      met: away?.vmAccepted === true && away?.vmWorkspaceId === awayEntry.workspaceId,
      expected: awayEntry.workspaceId,
      observed: away?.vmWorkspaceId ?? away?.vmReasonCode ?? "NOT_PROBED"
    });
  }

  const unmet = expectations.filter((entry) => entry.met !== true).map((entry) => entry.id);

  return {
    schemaVersion: "aos.topology-doc-sync-proof.v1",
    story: "TCRN-AOS-STORY-136",
    ruling: "TCRN-AOS-MIN-012 direction D — 本机持有本地 file 真值;文档必须能被机器核对",
    ok: unmet.length === 0,
    reasonCode: unmet.length === 0 ? "DOC_TOPOLOGY_IN_SYNC" : "DOC_TOPOLOGY_PROOF_INCOMPLETE",
    unmetExpectations: unmet,
    expectations,
    claim: {
      predicate: "平台内任何登记文档若声称某分区的真值位置,该声明须写在声明块内、与名册一致,"
        + "且名册须与引擎在该地址上的实测答复一致。具体地址出现在块外即为缺陷。",
      threeTerms: ["文档声明", "名册(topology.mjs)", "引擎实测(权威)"],
      whereTheJudgementLives: "deploy/aos-local-client/doc-topology-predicates.mjs (in the pnpm test roster)",
      whereTheRegistryLives: "deploy/aos-local-client/doc-topology-registry.mjs",
      awayHost: VM_HOST,
      awayWorkspaceFromManifest: awayEntry?.liveAddress ?? null
    },
    observedAt: new Date().toISOString().replace(/\.\d+Z$/u, "Z"),
    probeVm,
    observations,
    green,
    reds: allReds,
    // Recorded as a row rather than omitted when it did not happen: a section that
    // vanishes when it does not run is how "we proved that once" becomes unfalsifiable.
    onDiskRed,
    ceiling: CEILING
  };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  const result = await runDocTopologyProof({ probeVm: process.argv.includes("--probe-vm") });
  const artifact = scrubHostPaths(result);
  const text = `${JSON.stringify(artifact, null, 2)}\n`;
  if (process.argv.includes("--emit")) {
    mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
    writeFileSync(EVIDENCE_PATH, text);
  }
  process.stdout.write(text);
  if (result.ok !== true) process.exitCode = 1;
  // Same fail-closed as local-purity-proof: this gate judges documents that live in the
  // platform working tree, so a checkout without that context must red rather than pass
  // vacuously. A gate that goes green when it cannot see its subject has a one-clone life.
  if (!existsSync(WORKSPACE_CONTAINER)) process.exitCode = 1;
}
