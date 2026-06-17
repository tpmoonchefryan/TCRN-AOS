import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, copyFile, lstat, mkdir, mkdtemp, readdir, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROUTE_ID = "route_59ad_source_transfer_clean_export_prerequisite_repair";
const EXPECTED_SOURCE_HEAD = "89691da6f13fe8bd742536e04662bc96eb830c71";

const ROOT_FILES_ALLOWED = new Set([
  ".gitignore",
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
  ".DS_Store"
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

const repoRoot = await realpath(resolve(fileURLToPath(new URL("..", import.meta.url))));
const sourceHead = await gitText(["rev-parse", "HEAD"]);
const sourceHeadDescendsFromExpectedBasis = await gitOk(["merge-base", "--is-ancestor", EXPECTED_SOURCE_HEAD, "HEAD"]);
const rawStatus = await gitLines(["status", "--ignored", "--short"]);
const trackedFiles = await gitZ(["ls-files", "-z"]);
const ignoredFiles = await gitZ(["ls-files", "--others", "--ignored", "--exclude-standard", "-z"]);
const untrackedFiles = await gitZ(["ls-files", "--others", "--exclude-standard", "-z"]);
const trackedSymlinks = await collectTrackedSymlinks(trackedFiles);
const trackedForbidden = trackedFiles.filter(isForbiddenTransferPath);
const ignoredForbidden = ignoredFiles.filter(isForbiddenTransferPath);
const untrackedForbidden = untrackedFiles.filter(isForbiddenTransferPath);
const rawSourceArchiveAllowed = ignoredForbidden.length === 0
  && untrackedForbidden.length === 0
  && trackedForbidden.length === 0
  && trackedSymlinks.length === 0;

const exportPlan = buildExportPlan(trackedFiles);
const proofRoot = await mkdtemp(join(await realpath(tmpdir()), "tcrn-aos-59ad-clean-export-"));
const stagingRoot = join(proofRoot, "candidate");
const archivePath = join(proofRoot, "tcrn-aos-clean-source-export.tar");

let cleanupSucceeded = false;
let archiveDigest = "";
try {
  if (trackedForbidden.length > 0 || exportPlan.unresolved.length > 0) {
    throw new Error("source_export_manifest_has_unresolved_or_forbidden_tracked_files");
  }
  await mkdir(stagingRoot, { recursive: true });
  await materializeCandidate(exportPlan.included, stagingRoot);
  const candidateReadback = await inspectCandidate(stagingRoot);
  if (!candidateReadback.ok) {
    throw new Error("source_export_candidate_failed_closed");
  }
  await execFileAsync("tar", ["-cf", archivePath, "-C", stagingRoot, "."]);
  archiveDigest = await sha256File(archivePath);
  await rm(proofRoot, { recursive: true, force: true });
  cleanupSucceeded = !await pathExists(proofRoot);

  const proof = {
    ok: true,
    routeId: ROUTE_ID,
    sourceHead,
    expectedSourceBasis: EXPECTED_SOURCE_HEAD,
    sourceHeadDescendsFromExpectedBasis,
    rawSourceDirectArchiveAllowed: false,
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
      ignoredAndUntrackedExcludedByConstruction: ignoredFiles.length + untrackedFiles.length,
      allowedRoots: [...ALLOWED_PREFIXES, ...ROOT_FILES_ALLOWED].sort()
    },
    cleanExportCandidate: candidateReadback,
    archive: {
      createdFromCleanCandidateOnly: true,
      retained: false,
      sha256: archiveDigest
    },
    cleanup: {
      routeOwnedTempRootRemoved: cleanupSucceeded
    },
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
  if (!proof.sourceHeadDescendsFromExpectedBasis || !cleanupSucceeded) {
    process.exit(1);
  }
} catch (error) {
  await rm(proofRoot, { recursive: true, force: true });
  throw error;
}

function buildExportPlan(files) {
  const included = [];
  const evidenceExcluded = [];
  const unresolved = [];
  for (const file of files) {
    if (file.startsWith(EVIDENCE_PREFIX)) {
      evidenceExcluded.push(file);
      continue;
    }
    if (isAllowedSourcePath(file)) {
      included.push(file);
      continue;
    }
    unresolved.push(file);
  }
  return { included, evidenceExcluded, unresolved };
}

async function materializeCandidate(files, destinationRoot) {
  for (const file of files) {
    assertSafeRelativePath(file);
    if (isForbiddenTransferPath(file)) {
      throw new Error(`source_export_forbidden_path:${file}`);
    }
    const sourcePath = join(repoRoot, file);
    const destinationPath = join(destinationRoot, file);
    const sourceStat = await lstat(sourcePath);
    if (sourceStat.isSymbolicLink()) {
      throw new Error(`source_export_symlink_rejected:${file}`);
    }
    if (!sourceStat.isFile()) {
      throw new Error(`source_export_non_file_rejected:${file}`);
    }
    await mkdir(dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
    await chmod(destinationPath, sourceStat.mode & 0o777);
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
    evidenceCandidates: evidence.length,
    symlinks: symlinks.length,
    pathEscapes: pathEscapes.length
  };
}

async function collectTrackedSymlinks(files) {
  const symlinks = [];
  for (const file of files) {
    const fileStat = await lstat(join(repoRoot, file));
    if (fileStat.isSymbolicLink()) {
      symlinks.push(file);
    }
  }
  return symlinks;
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

function isAllowedSourcePath(file) {
  return ROOT_FILES_ALLOWED.has(file) || ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isForbiddenTransferPath(file) {
  const normalized = file.split(sep).join("/");
  const parts = normalized.split("/");
  const basename = parts[parts.length - 1] ?? "";
  return parts.some((part) => FORBIDDEN_PATH_PARTS.has(part))
    || FORBIDDEN_FILE_NAMES.has(basename)
    || basename === ".env"
    || basename.startsWith(".env.")
    || FORBIDDEN_EXTENSIONS.some((extension) => basename.endsWith(extension));
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

async function sha256File(path) {
  const hash = createHash("sha256");
  await new Promise((resolvePromise, rejectPromise) => {
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", rejectPromise)
      .on("end", resolvePromise);
  });
  return `sha256:${hash.digest("hex")}`;
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

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
