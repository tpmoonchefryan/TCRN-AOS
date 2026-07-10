import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AosSqliteRepository, assertRouteOwnedSqliteRoot } from "../dist/packages/db/src/index.js";
import { AosStore, applyExecutionLedgerCommand, createDefaultSeed, digest } from "../dist/packages/domain/src/index.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const migrationsDir = fileURLToPath(new URL("../packages/db/migrations/sqlite", import.meta.url));
const databaseFileName = "aos-plan-projection.sqlite";
const sqliteMarkerFile = ".tcrn-aos-phase1-root";

export async function runExecutionLedgerCli(argv = process.argv.slice(2)) {
  const inputs = await parseInputs(argv);
  const { prepareRuntimeRoot } = await import("../dist/packages/db/src/index.js");
  const rootReadback = await prepareRuntimeRoot({
    runtimeRoot: inputs.profileRoot,
    repoRoot,
    ownerMarker: inputs.ownerMarker
  });
  await writeFile(resolve(inputs.profileRoot, sqliteMarkerFile), "route-owned-execution-ledger\n", "utf8");
  const sqliteRoot = assertRouteOwnedSqliteRoot(inputs.profileRoot, repoRoot, sqliteMarkerFile);
  assertReadbackInsideProfile(inputs.readbackPath, inputs.profileRoot);
  const command = await readCommand(inputs.commandPath);
  const first = openProfile(inputs.profileRoot);
  const commandReadback = applyExecutionLedgerCommand(first.store, command, inputs.ownerMarker);
  const databaseDigestBeforeReopen = first.repository.databaseDigest();
  first.repository.close();

  const restarted = openProfile(inputs.profileRoot);
  const targetExists = command.targetType === "initiative"
    ? restarted.store.listInitiatives().some((record) => record.id === command.targetId && record.status === command.nextStatus)
    : command.targetType === "epic"
      ? restarted.store.listEpics().some((record) => record.id === command.targetId && record.status === command.nextStatus)
      : restarted.store.listStories().some((record) => record.id === command.targetId && record.status === command.nextStatus);
  const restartPersistence = {
    ok: targetExists && commandReadback.eventReadbacks.every((event) =>
      restarted.store.queryAudit({ targetId: command.targetId }).some((audit) => audit.id === event.auditEventId)
    ),
    targetExists,
    databaseDigestBeforeReopen,
    databaseDigestAfterReopen: restarted.repository.databaseDigest(),
    auditEventsForTarget: restarted.store.queryAudit({ targetId: command.targetId }).length,
    commentsForTarget: commentCount(restarted.store, command.targetType, command.targetId)
  };
  restarted.repository.close();

  const readback = {
    schema: "tcrn.aos.executionLedgerCliReadback.v1",
    ok: rootReadback.ok && sqliteRoot.ok && commandReadback.ok && restartPersistence.ok,
    command: "pnpm --dir TCRN-AOS execution:ledger --command <json> --profile-root <dir> --owner-marker <json-or-file> --readback <json>",
    profile: {
      profileId: inputs.ownerMarker.profileId,
      routeId: inputs.ownerMarker.routeId,
      ownerMarkerDigest: digest(inputs.ownerMarker),
      runtimeRootDigest: rootReadback.runtimeRootDigest,
      sqliteRootDigest: sqliteRoot.rootDigest,
      ownerMarkerStatus: rootReadback.ownerMarkerStatus,
      rawPathRecorded: false
    },
    commandDigest: digest(command),
    executionReadback: commandReadback,
    restartPersistence,
    noOverclaim: {
      workflowMutation: false,
      designSystemMutation: false,
      tmsMutation: false,
      frontendImplemented: false,
      httpWriteApiImplemented: false,
      liveDispatch: false,
      ownerIntentExecuted: false,
      readinessClaimed: false,
      releaseClaimed: false,
      acceptanceClaimed: false,
      rawDatabaseDumpRecorded: false,
      secretsOrPiiRecorded: false,
      committedDatabaseArtifact: false
    }
  };
  if (!readback.ok) {
    throw new Error("execution_ledger_cli_readback_not_ok");
  }
  await writeMetadataReadback(inputs.readbackPath, readback);
  return readback;
}

export function parseExecutionLedgerCliArguments(argv) {
  if (argv.length === 0) {
    throw new Error("execution_ledger_cli_required_argument_missing:command");
  }
  const allowed = new Set(["command", "profile-root", "owner-marker", "readback"]);
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    const value = argv[index + 1];
    if (!token?.startsWith("--")) {
      throw new Error("execution_ledger_cli_argument_invalid");
    }
    const key = token.slice(2);
    if (!allowed.has(key) || !value || value.startsWith("--") || values[key] !== undefined) {
      throw new Error("execution_ledger_cli_argument_invalid");
    }
    values[key] = value;
  }
  for (const key of allowed) {
    if (!values[key]) {
      throw new Error(`execution_ledger_cli_required_argument_missing:${key}`);
    }
  }
  return values;
}

export function safeExecutionLedgerCliError(error) {
  if (error instanceof Error && /^[a-z0-9_:-]+$/i.test(error.message)) {
    return error.message;
  }
  return "execution_ledger_cli_failed";
}

async function parseInputs(argv) {
  const args = parseExecutionLedgerCliArguments(argv);
  return {
    commandPath: requireAbsolutePath(args.command, "command"),
    profileRoot: requireAbsolutePath(args["profile-root"], "profile_root"),
    ownerMarker: await parseOwnerMarker(args["owner-marker"]),
    readbackPath: requireAbsolutePath(args.readback, "readback")
  };
}

function requireAbsolutePath(value, name) {
  if (!value || !isAbsolute(value)) {
    throw new Error(`execution_ledger_cli_${name}_path_must_be_absolute`);
  }
  return resolve(value);
}

async function parseOwnerMarker(value) {
  if (!value) {
    throw new Error("execution_ledger_cli_required_argument_missing:owner-marker");
  }
  let parsed;
  try {
    parsed = value.trim().startsWith("{")
      ? JSON.parse(value)
      : JSON.parse(await readFile(requireAbsolutePath(value, "owner_marker"), "utf8"));
  } catch {
    throw new Error("execution_ledger_cli_owner_marker_invalid");
  }
  const keys = ["profileId", "routeId", "runContext", "owner"];
  if (!parsed || typeof parsed !== "object" || keys.some((key) => typeof parsed[key] !== "string" || parsed[key].trim().length === 0)) {
    throw new Error("execution_ledger_cli_owner_marker_invalid");
  }
  return Object.fromEntries(keys.map((key) => [key, parsed[key]]));
}

async function readCommand(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error("execution_ledger_cli_command_invalid_json");
  }
}

function openProfile(profileRoot) {
  const databasePath = resolve(profileRoot, "db", databaseFileName);
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  repository.applyMigrations();
  repository.seedAiEmployees(createDefaultSeed().employees, "execution-ledger-cli-seed-v1");
  const store = new AosStore(createDefaultSeed(), { persistence: repository });
  return { repository, store };
}

function commentCount(store, targetType, targetId) {
  if (targetType === "story") {
    return store.listStories().find((story) => story.id === targetId)?.comments.length ?? 0;
  }
  const target = targetType === "initiative"
    ? store.listInitiatives().find((initiative) => initiative.id === targetId)
    : store.listEpics().find((epic) => epic.id === targetId);
  return target?.storyIds[0]
    ? store.listStories().find((story) => story.id === target.storyIds[0])?.comments.length ?? 0
    : 0;
}

function assertReadbackInsideProfile(readbackPath, profileRoot) {
  const profile = resolve(profileRoot);
  const output = resolve(readbackPath);
  if (relative(profile, output).startsWith("..") || relative(profile, output) === "") {
    throw new Error("execution_ledger_cli_readback_must_be_inside_profile_root");
  }
}

async function writeMetadataReadback(path, readback) {
  await writeFile(path, `${JSON.stringify(readback, null, 2)}\n`, "utf8");
  const serialized = await readFile(path, "utf8");
  if (serialized.includes("/Users/") || serialized.includes("BEGIN PRIVATE")) {
    throw new Error("execution_ledger_cli_readback_privacy_violation");
  }
}

export function stableExecutionLedgerCommandDigest(command) {
  return createHash("sha256").update(JSON.stringify(command)).digest("hex");
}
