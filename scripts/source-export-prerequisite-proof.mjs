import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROUTE_ID = "route_59ad_source_export_prerequisite_review_repair";
const EXPECTED_SOURCE_HEAD = "cd9abd9def734fb290d539d8fd2d193fbb5504c8";
const ROUTE_REQUIRES_RAW_SOURCE_BLOCKED = true;

const ROOT_FILES_ALLOWED = new Set([
  ".gitignore",
  "LICENSE",
  "README.md",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json"
]);
const ALLOWED_PREFIXES = ["apps/", "docs/", "packages/", "scripts/"];
const EVIDENCE_PREFIX = "evidence/";
const FORBIDDEN_PATH_PARTS = new Set([
  ".git",
  ".cache",
  ".turbo",
  "coverage",
  "dist",
  "node_modules"
]);
const FORBIDDEN_FILE_NAMES = new Set([
  ".npmrc",
  "npmrc",
  ".DS_Store",
  ".bash_history",
  ".zsh_history",
  ".history"
]);
const FORBIDDEN_EXTENSIONS = [
  ".log",
  ".pem",
  ".key",
  ".p12",
  ".pfx",
  ".crt",
  ".cer"
];
const FORBIDDEN_NEGATIVE_CASES = [
  ["secret", "docs/private/secret-notes.md"],
  ["credential", "docs/private/credential-bundle.json"],
  ["password", "docs/private/password-reset.json"],
  ["token", "docs/private/token-cache.json"],
  ["auth_session", "runtime/auth/session.json"],
  ["cookie", "browser/cookies.sqlite"],
  ["keychain", "browser/keychain-dump.txt"],
  ["shell_history", ".zsh_history"],
  ["raw_scanner_output", "evidence/raw-scanner-output.json"],
  ["raw_secret_scan_output", "evidence/raw-secret-scan-output.json"]
];
const REVIEWED_ALLOWED_CASES = [
  "docs/security-boundaries.md",
  "docs/source-export-prerequisite.md",
  "packages/adapter-codex/src/adapter.ts"
];

const repoRoot = await realpath(resolve(fileURLToPath(new URL("..", import.meta.url))));
const sourceHead = await gitText(["rev-parse", "HEAD"]);
const sourceHeadDescendsFromExpectedBasis = await gitOk(["merge-base", "--is-ancestor", EXPECTED_SOURCE_HEAD, "HEAD"]);
const rawStatus = await gitLines(["status", "--ignored", "--short"]);
const trackedStatus = await gitLines(["status", "--porcelain=v1", "--untracked-files=no"]);
const treeEntries = await gitTreeEntries(sourceHead);
const trackedFiles = treeEntries.map((entry) => entry.path);
const ignoredFiles = await gitZ(["ls-files", "--others", "--ignored", "--exclude-standard", "-z"]);
const untrackedFiles = await gitZ(["ls-files", "--others", "--exclude-standard", "-z"]);
const trackedSymlinks = treeEntries.filter((entry) => entry.mode === "120000").map((entry) => entry.path);
const trackedForbidden = trackedFiles.filter(isForbiddenTransferPath);
const ignoredForbidden = ignoredFiles.filter(isForbiddenTransferPath);
const untrackedForbidden = untrackedFiles.filter(isForbiddenTransferPath);
const rawSourceArchiveAllowed = ignoredForbidden.length === 0
  && untrackedForbidden.length === 0
  && trackedForbidden.length === 0
  && trackedSymlinks.length === 0;
const rawSourceBlockingSupported = !rawSourceArchiveAllowed;

const forbiddenNegativeRows = buildForbiddenNegativeRows();
const reviewedAllowedRows = buildReviewedAllowedRows();
const exportPlan = buildExportPlan(treeEntries);
const exportIncludedForbidden = exportPlan.included.map((entry) => entry.path).filter(isForbiddenTransferPath);
const manifestDigest = createManifestDigest(exportPlan.included);
const proofRoot = await mkdtemp(join(await realpath(tmpdir()), "tcrn-aos-59ad-clean-export-"));
const stagingRoot = join(proofRoot, "candidate");
const archivePath = join(proofRoot, "tcrn-aos-clean-source-export.tar");

try {
  if (!sourceHeadDescendsFromExpectedBasis) {
    throw new Error("source_export_source_head_not_descended_from_expected_basis");
  }
  if (ROUTE_REQUIRES_RAW_SOURCE_BLOCKED && rawSourceArchiveAllowed) {
    throw new Error("source_export_raw_source_blocker_not_observed");
  }
  if (exportIncludedForbidden.length > 0 || exportPlan.unresolved.length > 0) {
    throw new Error("source_export_manifest_has_unresolved_or_forbidden_tracked_files");
  }
  if (!forbiddenNegativeRows.every((row) => row.rejected) || reviewedAllowedRows.some((row) => row.rejected)) {
    throw new Error("source_export_forbidden_matcher_self_test_failed");
  }

  await mkdir(stagingRoot, { recursive: true });
  await materializeCandidate(exportPlan.included, stagingRoot);
  const candidateReadback = await inspectCandidate(stagingRoot);
  if (!candidateReadback.ok) {
    throw new Error("source_export_candidate_failed_closed");
  }
  await execFileAsync("tar", ["-cf", archivePath, "-C", stagingRoot, "."]);
  const cleanup = await cleanupRouteOwnedRoot(proofRoot);

  const proof = {
    ok: true,
    routeId: ROUTE_ID,
    sourceHead,
    expectedSourceBasis: EXPECTED_SOURCE_HEAD,
    sourceHeadDescendsFromExpectedBasis,
    exportContentSource: {
      type: "git_commit_object",
      ref: sourceHead,
      trackedWorktreeAndIndexClean: trackedStatus.length === 0,
      trackedStatusEntryCount: trackedStatus.length
    },
    rawSourceArchiveAllowed,
    rawSourceBlockingRequired: ROUTE_REQUIRES_RAW_SOURCE_BLOCKED,
    rawSourceBlockingSupported,
    rawSourceBlockerCounts: {
      ignoredForbidden: ignoredForbidden.length,
      untrackedForbidden: untrackedForbidden.length,
      trackedForbidden: trackedForbidden.length,
      trackedSymlink: trackedSymlinks.length,
      ignoredRootsVisible: rawStatus.filter((line) => line.startsWith("!! ")).slice(0, 8)
    },
    manifest: {
      trackedFiles: trackedFiles.length,
      includedFiles: exportPlan.included.length,
      evidenceExcludedFiles: exportPlan.evidenceExcluded.length,
      includedForbiddenFiles: exportIncludedForbidden.length,
      ignoredAndUntrackedExcludedByConstruction: ignoredFiles.length + untrackedFiles.length,
      allowedRoots: [...ALLOWED_PREFIXES, ...ROOT_FILES_ALLOWED].sort()
    },
    forbiddenMatcher: {
      negativeRows: forbiddenNegativeRows,
      reviewedAllowedRows
    },
    cleanExportCandidate: candidateReadback,
    deterministicDigest: manifestDigest,
    archive: {
      createdFromCleanCandidateOnly: true,
      retained: false,
      digestMaterial: "deterministic_git_tree_manifest",
      sha256: manifestDigest.sha256
    },
    cleanup,
    noOverclaim: {
      targetHostActionPerformed: false,
      sourceTransferPerformed: false,
      targetExtractionPerformed: false,
      installBuildOnTarget: false,
      serviceLifecycleAction: false,
      srvWrite: false,
      deploymentReadiness: "not_claimed",
      productAcceptance: "not_claimed",
      finalMvpAcceptance: "not_claimed",
      batchPushGate: "not_routed"
    }
  };

  console.log(JSON.stringify(proof, null, 2));
  if (!proof.sourceHeadDescendsFromExpectedBasis
    || !proof.rawSourceBlockingSupported
    || !proof.cleanup.routeOwnedTempRootRemoved) {
    process.exit(1);
  }
} catch (error) {
  const cleanup = await cleanupRouteOwnedRoot(proofRoot).catch((cleanupError) => ({
    routeOwnedTempRootRemoved: false,
    readbackAmbiguous: true,
    errorCode: cleanupError?.code ?? "unknown_cleanup_error"
  }));
  console.error(JSON.stringify({
    ok: false,
    routeId: ROUTE_ID,
    reason: error instanceof Error ? error.message : "source_export_unknown_error",
    cleanup
  }, null, 2));
  throw error;
}

function buildExportPlan(entries) {
  const included = [];
  const evidenceExcluded = [];
  const unresolved = [];
  for (const entry of entries) {
    if (entry.path.startsWith(EVIDENCE_PREFIX)) {
      evidenceExcluded.push(entry.path);
      continue;
    }
    if (isAllowedSourcePath(entry.path)) {
      included.push(entry);
      continue;
    }
    unresolved.push(entry.path);
  }
  return { included, evidenceExcluded, unresolved };
}

async function materializeCandidate(entries, destinationRoot) {
  for (const entry of entries) {
    assertSafeRelativePath(entry.path);
    if (isForbiddenTransferPath(entry.path)) {
      throw new Error(`source_export_forbidden_path:${entry.path}`);
    }
    if (entry.type !== "blob") {
      throw new Error(`source_export_non_blob_rejected:${entry.path}`);
    }
    if (entry.mode === "120000") {
      throw new Error(`source_export_symlink_rejected:${entry.path}`);
    }
    if (entry.mode !== "100644" && entry.mode !== "100755") {
      throw new Error(`source_export_unsupported_mode_rejected:${entry.path}`);
    }
    const destinationPath = join(destinationRoot, entry.path);
    await mkdir(dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, await gitBlob(entry.oid));
    await chmod(destinationPath, parseInt(entry.mode, 8) & 0o777);
  }
}

async function inspectCandidate(candidateRoot) {
  const candidateFiles = await listFiles(candidateRoot);
  const forbidden = candidateFiles.filter(isForbiddenTransferPath);
  const evidence = candidateFiles.filter((file) => file.startsWith(EVIDENCE_PREFIX));
  const symlinks = await collectSymlinks(candidateRoot, candidateFiles);
  const pathEscapes = candidateFiles.filter((file) => !isInside(candidateRoot, join(candidateRoot, file)));
  return {
    ok: forbidden.length === 0 && evidence.length === 0 && symlinks.length === 0 && pathEscapes.length === 0,
    files: candidateFiles.length,
    forbiddenCandidates: forbidden.length,
    forbiddenByClass: summarizeForbiddenClasses(forbidden),
    evidenceCandidates: evidence.length,
    symlinks: symlinks.length,
    pathEscapes: pathEscapes.length
  };
}

async function collectSymlinks(root, files) {
  const symlinks = [];
  for (const file of files) {
    const fileStat = await lstat(join(root, file));
    if (fileStat.isSymbolicLink()) {
      symlinks.push(file);
    }
  }
  return symlinks;
}

async function listFiles(root) {
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      const relativePath = relative(root, absolutePath).split(sep).join("/");
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else {
        files.push(relativePath);
      }
    }
  }
  await visit(root);
  return files.sort();
}

async function cleanupRouteOwnedRoot(root) {
  await rm(root, { recursive: true, force: true });
  return readRemovedPath(root);
}

async function readRemovedPath(path) {
  try {
    await stat(path);
    return {
      routeOwnedTempRootRemoved: false,
      readbackAmbiguous: false,
      errorCode: null
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        routeOwnedTempRootRemoved: true,
        readbackAmbiguous: false,
        errorCode: "ENOENT"
      };
    }
    return {
      routeOwnedTempRootRemoved: false,
      readbackAmbiguous: true,
      errorCode: error?.code ?? "unknown_stat_error"
    };
  }
}

function buildForbiddenNegativeRows() {
  return FORBIDDEN_NEGATIVE_CASES.map(([label, path]) => {
    const classes = classifyForbiddenTransferPath(path);
    return {
      label,
      path: redactProofPath(path),
      rejected: classes.length > 0,
      classes
    };
  });
}

function buildReviewedAllowedRows() {
  return REVIEWED_ALLOWED_CASES.map((path) => {
    const classes = classifyForbiddenTransferPath(path);
    return {
      path,
      rejected: classes.length > 0,
      classes
    };
  });
}

function createManifestDigest(entries) {
  const rows = entries
    .map((entry) => `${entry.mode} ${entry.oid} ${entry.path}\n`)
    .sort();
  const sha256 = createHash("sha256").update(rows.join("")).digest("hex");
  return {
    sha256: `sha256:${sha256}`,
    material: "git_tree_path_mode_blob_oid_v1",
    rows: rows.length
  };
}

function summarizeForbiddenClasses(files) {
  const summary = {};
  for (const file of files) {
    for (const label of classifyForbiddenTransferPath(file)) {
      summary[label] = (summary[label] ?? 0) + 1;
    }
  }
  return summary;
}

function isAllowedSourcePath(file) {
  return ROOT_FILES_ALLOWED.has(file) || ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isForbiddenTransferPath(file) {
  return classifyForbiddenTransferPath(file).length > 0;
}

function classifyForbiddenTransferPath(file) {
  const normalized = file.split(sep).join("/");
  const lower = normalized.toLowerCase();
  const parts = lower.split("/").filter(Boolean);
  const basename = parts[parts.length - 1] ?? "";
  const tokens = lower.split(/[\/._ -]+/).filter(Boolean);
  const classes = new Set();

  if (parts.some((part) => FORBIDDEN_PATH_PARTS.has(part))) {
    classes.add("forbidden_directory");
  }
  if (FORBIDDEN_FILE_NAMES.has(basename)) {
    classes.add("forbidden_filename");
  }
  if (basename === ".env" || basename.startsWith(".env.")) {
    classes.add("env_file");
  }
  if (FORBIDDEN_EXTENSIONS.some((extension) => basename.endsWith(extension))) {
    classes.add("sensitive_extension");
  }
  if (tokens.includes("secret") || tokens.includes("secrets")) {
    classes.add("secret");
  }
  if (tokens.includes("credential") || tokens.includes("credentials")) {
    classes.add("credential");
  }
  if (tokens.includes("password") || tokens.includes("passwords")) {
    classes.add("password");
  }
  if (tokens.includes("token") || tokens.includes("tokens")) {
    classes.add("token");
  }
  if (tokens.includes("auth") || tokens.includes("session") || tokens.includes("sessions")) {
    classes.add("auth_session");
  }
  if (tokens.includes("cookie") || tokens.includes("cookies")) {
    classes.add("cookie");
  }
  if (tokens.includes("keychain")) {
    classes.add("keychain");
  }
  if (tokens.includes("shell") && tokens.includes("history")) {
    classes.add("shell_history");
  }
  if (tokens.includes("scanner") && tokens.includes("output")) {
    classes.add("raw_scanner_output");
  }
  if (tokens.includes("secret") && tokens.includes("scan") && tokens.includes("output")) {
    classes.add("raw_secret_scan_output");
  }
  if (tokens.includes("raw") && tokens.includes("source") && tokens.includes("dump")) {
    classes.add("raw_source_dump");
  }

  return [...classes].sort();
}

function redactProofPath(path) {
  return path.replaceAll("\\", "/");
}

function assertSafeRelativePath(file) {
  if (file.length === 0 || file.startsWith("/") || file.includes("\0") || file.split("/").includes("..")) {
    throw new Error(`source_export_path_escape_rejected:${file}`);
  }
}

function isInside(parent, candidate) {
  const rel = relative(resolve(parent), resolve(candidate));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function gitText(args) {
  const { stdout } = await execFileAsync("git", args, { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 });
  return stdout.trim();
}

async function gitOk(args) {
  try {
    await execFileAsync("git", args, { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

async function gitLines(args) {
  const { stdout } = await execFileAsync("git", args, { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 });
  return stdout.split(/\r?\n/).filter(Boolean);
}

async function gitZ(args) {
  const { stdout } = await execFileAsync("git", args, { cwd: repoRoot, encoding: "buffer", maxBuffer: 50 * 1024 * 1024 });
  return stdout.toString("utf8").split("\0").filter(Boolean);
}

async function gitTreeEntries(ref) {
  const { stdout } = await execFileAsync("git", ["ls-tree", "-rz", "--full-tree", ref], {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 50 * 1024 * 1024
  });
  return stdout.toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((row) => {
      const match = row.match(/^(\d+) (\w+) ([0-9a-f]+)\t(.+)$/);
      if (!match) {
        throw new Error("source_export_unparseable_git_tree_row");
      }
      return {
        mode: match[1],
        type: match[2],
        oid: match[3],
        path: match[4]
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

async function gitBlob(oid) {
  const { stdout } = await execFileAsync("git", ["cat-file", "blob", oid], {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 100 * 1024 * 1024
  });
  return stdout;
}
