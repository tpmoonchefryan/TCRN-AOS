#!/usr/bin/env node
// 部署引擎身份钉合判据（TCRN-CROSS-INC-129）。
//
//   node deploy/aos-local-client/engine-pin-proof.mjs [--emit]
//
// 这道门防的是什么。2026-08-09 实测：本机部署的引擎长期停在被清洗前的旧谱系
// （HEAD 7751bec 在源仓里根本不是有效对象），而 helper 的 candidate manifest 早已
// 钉在重铸后的 7b1d140。两者不一致没有任何机构在看，直到 cross-project 分区对
// 旧引擎整条 fail-closed（它不认识新状态 pending-owner-acceptance），我才发现，
// 并且第一反应是把它误报成「链损坏」。判据缺失的代价不是没门，是把工具过旧
// 读成了数据损坏。
//
// 一次运行记录两个方向：
//   GREEN  部署引擎的 HEAD 与 tree 等于 helper manifest 所钉的 workflow.commit/tree；
//          工作树干净；dist 运行时字节与其自身源码的状态词汇表一致；两个 helper
//          安装副本都验得过。
//   RED 1  manifest 所钉 commit 与部署 HEAD 不一致 → 必须红并点名两个值。
//   RED 2  tree 不一致 → 必须红。tree 是比 commit 更强的判据：改写历史会换 commit
//          而保留 tree，只比 commit 会漏掉「同一份字节、不同谱系」。
//   RED 3  manifest 里 workflow 块被删 → 必须红。否则「删掉字段」就成了让门闭嘴的办法。
//   RED 4  dist 未随源码重建（源码里有的状态词，构建产物里没有）→ 必须红。
//          这一条是 2026-08-09 差点漏掉的那步：dist/ 被 .gitignore，git reset --hard
//          只换源码不换运行时字节，HEAD 看着已经对了而 CLI 行为完全没变。
//
// 红腿全部在内存里对读入的值做变异，不写任何文件。

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");           // TCRN-AOS
const PLATFORM_ROOT = resolve(REPO_ROOT, "..");         // TCRN Platform
const HELPER_MANIFEST = join(PLATFORM_ROOT, "tcrn-workflow-helper", "artifacts", "candidate-manifest.json");
const DEPLOYED_ENGINE = join(homedir(), ".tcrn-workflow", "tcrn-workflow");
const BOOTSTRAP = join(homedir(), ".tcrn-workflow", "trusted-bootstrap.mjs");
const TRUST_STATE = join(homedir(), ".tcrn-workflow", "state.json");
const TRUST_PROVENANCE = join(homedir(), ".tcrn-workflow", "complete-skill-archive.provenance.json");
// TCRN-CROSS-INC-212. Both rows were wrong, and wrong in different ways.
//
// The claude row addressed the classification folder, which the 2026-08-16 ruling
// emptied: harness is built at the container root and nowhere else, so that path
// stopped existing and this gate read UNREADABLE. That is not a typo — a ruling moved
// the subject out from under a gate that went on asking where it used to be.
//
// The codex row pointed at `.agents` and passed, which is worse than failing: the copy
// it validated is real, so the row was green under a host name that was not its own,
// while the actual codex copy was never asked about at all. Three copies live on this
// machine and each is asked about here under its own name.
const INSTALLED_COPIES = [
  ["claude", join(homedir(), ".claude", "skills", "tcrn-workflow-helper")],
  ["codex", join(homedir(), ".codex", "skills", "tcrn-workflow-helper")],
  ["agents", join(homedir(), ".agents", "skills", "tcrn-workflow-helper")],
];
const PROTOCOL_TS = join(DEPLOYED_ENGINE, "packages", "protocol", "src", "index.ts");
const PROTOCOL_JS = join(DEPLOYED_ENGINE, "dist", "build", "packages", "protocol", "src", "index.js");

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/** 观测一次现场。红腿对这个对象的副本做变异，不重新观测。 */
function observe() {
  const manifest = JSON.parse(readFileSync(HELPER_MANIFEST, "utf8"));
  const workStatuses = readWorkStatuses(readFileSync(PROTOCOL_TS, "utf8"));
  return {
    pinnedCommit: manifest.workflow?.commit ?? null,
    pinnedTree: manifest.workflow?.tree ?? null,
    pinnedVersion: manifest.workflow?.version ?? null,
    deployedCommit: git(["rev-parse", "HEAD"], DEPLOYED_ENGINE),
    deployedTree: git(["rev-parse", "HEAD^{tree}"], DEPLOYED_ENGINE),
    deployedDirty: git(["status", "--porcelain"], DEPLOYED_ENGINE) !== "",
    workStatuses,
    builtJs: existsSync(PROTOCOL_JS) ? readFileSync(PROTOCOL_JS, "utf8") : null,
  };
}

/** protocol 源码里声明的工作状态词汇表。dist 必须认得全部。 */
function readWorkStatuses(source) {
  const block = source.match(/WORK_STATUSES[^=]*=\s*(?:Object\.freeze\()?\[([\s\S]*?)\]/);
  const from = block ? block[1] : source;
  const found = [...from.matchAll(/"([a-z][a-z-]*)"/g)].map((m) => m[1]);
  // 兜底：至少要认出这四个，否则说明解析没命中，判据会变成恒真门。
  const required = ["planned", "active", "done", "cancelled"];
  const all = [...new Set(found)];
  return required.every((r) => all.includes(r)) ? all : null;
}

/** 判断一次观测。返回 { ok, findings[] }，findings 逐条点名。 */
function judge(o) {
  const findings = [];
  if (!o.pinnedCommit || !o.pinnedTree) {
    findings.push(`helper manifest 缺 workflow.commit/tree —— 无法判断部署引擎是否对得上（读自 ${HELPER_MANIFEST}）`);
  } else {
    if (o.pinnedCommit !== o.deployedCommit) {
      findings.push(`部署引擎 HEAD ${o.deployedCommit} ≠ helper 所钉 commit ${o.pinnedCommit}`);
    }
    if (o.pinnedTree !== o.deployedTree) {
      findings.push(`部署引擎 tree ${o.deployedTree} ≠ helper 所钉 tree ${o.pinnedTree}`);
    }
  }
  if (o.deployedDirty) findings.push(`部署引擎工作树不干净：${DEPLOYED_ENGINE}`);
  if (o.workStatuses === null) {
    findings.push("解析不出 protocol 的工作状态词汇表 —— 判据无法成立，按红处理");
  } else if (o.builtJs === null) {
    findings.push(`构建产物缺失：${PROTOCOL_JS}（dist/ 被 gitignore，需 pnpm build）`);
  } else {
    const missing = o.workStatuses.filter((s) => !o.builtJs.includes(`"${s}"`));
    if (missing.length > 0) {
      findings.push(`dist 未随源码重建：源码有而构建产物没有的状态 ${missing.join(", ")} —— 运行时仍是旧字节，需 pnpm build`);
    }
  }
  return { ok: findings.length === 0, findings };
}

function verifyInstalledCopies() {
  return INSTALLED_COPIES.map(([host, dir]) => {
    try {
      const out = execFileSync("node", [BOOTSTRAP, "verify-installed-copy",
        "--installed-dir", dir, "--provenance", TRUST_PROVENANCE, "--state", TRUST_STATE],
        { encoding: "utf8" });
      return { host, dir, reasonCode: JSON.parse(out).reasonCode };
    } catch (error) {
      const raw = String(error.stdout || error.message);
      let code = "UNREADABLE";
      try { code = JSON.parse(raw).reasonCode ?? code; } catch { /* 原样 */ }
      return { host, dir, reasonCode: code };
    }
  });
}

// ---------------------------------------------------------------- run
const observed = observe();
const green = judge(observed);
const copies = verifyInstalledCopies();
const copiesOk = copies.every((c) => c.reasonCode === "INSTALLED_COPY_VALIDATED");

// 红腿：对观测副本做变异，判据必须转红并点名。
const reds = [
  ["RED 1 commit 不一致", { ...observed, deployedCommit: "0".repeat(40) }, /HEAD .* ≠ helper 所钉 commit/],
  ["RED 2 tree 不一致", { ...observed, deployedTree: "1".repeat(40) }, /tree .* ≠ helper 所钉 tree/],
  ["RED 3 manifest 缺 workflow 块", { ...observed, pinnedCommit: null, pinnedTree: null }, /缺 workflow\.commit\/tree/],
  ["RED 4 dist 未重建", { ...observed, builtJs: (observed.builtJs ?? "").split('"done"').join('"XX"') }, /dist 未随源码重建/],
].map(([label, mutated, expect]) => {
  const verdict = judge(mutated);
  const named = verdict.findings.some((f) => expect.test(f));
  return { label, wentRed: !verdict.ok, named, ok: !verdict.ok && named, findings: verdict.findings };
});

const allRedsOk = reds.every((r) => r.ok);
const ok = green.ok && copiesOk && allRedsOk;

const report = {
  ok,
  reasonCode: ok ? "ENGINE_PIN_IN_SYNC"
    : !allRedsOk ? "ENGINE_PIN_PREDICATE_UNFALSIFIABLE"
    : !copiesOk ? "HELPER_INSTALLED_COPY_RED"
    : "ENGINE_PIN_DRIFTED",
  pinned: { commit: observed.pinnedCommit, tree: observed.pinnedTree, version: observed.pinnedVersion },
  deployed: { commit: observed.deployedCommit, tree: observed.deployedTree, dirty: observed.deployedDirty },
  workStatuses: observed.workStatuses,
  findings: green.findings,
  installedCopies: copies,
  redLegs: reds.map(({ label, wentRed, named, ok: legOk }) => ({ label, wentRed, named, ok: legOk })),
};

if (process.argv.includes("--emit")) {
  const out = join(REPO_ROOT, "evidence", "engine-pin-proof.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(ok ? 0 : 1);
