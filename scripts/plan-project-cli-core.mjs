import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AosSqliteRepository, assertRouteOwnedSqliteRoot } from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed, digest, projectPlanManifest } from "../dist/packages/domain/src/index.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const migrationsDir = fileURLToPath(new URL("../packages/db/migrations/sqlite", import.meta.url));
const sqliteMarkerFile = ".tcrn-aos-phase1-root";
const databaseFileName = "aos-plan-projection.sqlite";

export async function runPlanProjectionCli(argv = process.argv.slice(2)) {
  const inputs = await parseInputs(argv);
  const { prepareRuntimeRoot } = await import("../dist/packages/db/src/index.js");
  const rootReadback = await prepareRuntimeRoot({
    runtimeRoot: inputs.profileRoot,
    repoRoot,
    ownerMarker: inputs.ownerMarker
  });
  await writeFile(resolve(inputs.profileRoot, sqliteMarkerFile), "route-owned-plan-projection\n", "utf8");
  const sqliteRoot = assertRouteOwnedSqliteRoot(inputs.profileRoot, repoRoot, sqliteMarkerFile);
  assertReadbackInsideProfile(inputs.readbackPath, inputs.profileRoot);
  const manifest = await readManifest(inputs.manifestPath);
  const first = projectProfile(inputs.profileRoot, manifest);
  const firstDatabaseDigest = first.repository.databaseDigest();
  const firstRecordIds = first.readback.recordIds;
  first.repository.close();

  const restarted = openProfile(inputs.profileRoot);
  const restartPersistence = {
    ok: recordIdsPersisted(restarted.store, firstRecordIds),
    recordIdsPersisted: recordIdsPersisted(restarted.store, firstRecordIds),
    databaseDigestBeforeReopen: firstDatabaseDigest,
    databaseDigestAfterReopen: restarted.repository.databaseDigest()
  };
  restarted.repository.close();

  const readback = {
    schema: "tcrn.aos.planProjectionCliReadback.v1",
    ok: rootReadback.ok && sqliteRoot.ok && first.readback.ok && restartPersistence.ok,
    command: "pnpm --dir TCRN-AOS plan:project -- --manifest <json> --profile-root <dir> --owner-marker <json-or-file> --readback <json>",
    profile: {
      profileId: inputs.ownerMarker.profileId,
      routeId: inputs.ownerMarker.routeId,
      ownerMarkerDigest: digest(inputs.ownerMarker),
      runtimeRootDigest: rootReadback.runtimeRootDigest,
      sqliteRootDigest: sqliteRoot.rootDigest,
      ownerMarkerStatus: rootReadback.ownerMarkerStatus,
      rawPathRecorded: false
    },
    manifest: {
      schemaVersion: manifest.schemaVersion,
      projectionId: manifest.projectionId,
      sourceDigest: manifest.sourceDigest,
      manifestDigest: digest(manifest),
      rawPlanBodyRecorded: false
    },
    projectionReadback: first.readback,
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
    throw new Error("plan_projection_cli_readback_not_ok");
  }
  await writeMetadataReadback(inputs.readbackPath, readback);
  return readback;
}

export function safeCliError(error) {
  if (error instanceof Error && /^[a-z0-9_:-]+$/i.test(error.message)) {
    return error.message;
  }
  return "plan_projection_cli_failed";
}

async function parseInputs(argv) {
  const args = parseArgumentMap(argv);
  const manifestPath = requireAbsolutePath(args.manifest, "manifest");
  const profileRoot = requireAbsolutePath(args["profile-root"], "profile_root");
  const readbackPath = requireAbsolutePath(args.readback, "readback");
  const ownerMarker = await parseOwnerMarker(args["owner-marker"]);
  return { manifestPath, profileRoot, readbackPath, ownerMarker };
}

function parseArgumentMap(argv) {
  if (argv.length === 0) {
    throw new Error("cli_required_argument_missing:manifest");
  }
  const allowed = new Set(["manifest", "profile-root", "owner-marker", "readback"]);
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    const value = argv[index + 1];
    if (!token?.startsWith("--")) {
      throw new Error("cli_argument_invalid");
    }
    const key = token.slice(2);
    if (!allowed.has(key) || !value || value.startsWith("--") || values[key] !== undefined) {
      throw new Error("cli_argument_invalid");
    }
    values[key] = value;
  }
  for (const required of allowed) {
    if (!values[required]) {
      throw new Error(`cli_required_argument_missing:${required}`);
    }
  }
  return values;
}

function requireAbsolutePath(value, name) {
  if (!value || !isAbsolute(value)) {
    throw new Error(`cli_${name}_path_must_be_absolute`);
  }
  return resolve(value);
}

async function parseOwnerMarker(value) {
  if (!value) {
    throw new Error("cli_required_argument_missing:owner-marker");
  }
  let parsed;
  try {
    parsed = value.trim().startsWith("{")
      ? JSON.parse(value)
      : JSON.parse(await readFile(requireAbsolutePath(value, "owner_marker"), "utf8"));
  } catch {
    throw new Error("cli_owner_marker_invalid");
  }
  const keys = ["profileId", "routeId", "runContext", "owner"];
  if (!parsed || typeof parsed !== "object" || keys.some((key) => typeof parsed[key] !== "string" || parsed[key].trim().length === 0)) {
    throw new Error("cli_owner_marker_invalid");
  }
  return Object.fromEntries(keys.map((key) => [key, parsed[key]]));
}

async function readManifest(manifestPath) {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    throw new Error("cli_manifest_invalid_json");
  }
}

function projectProfile(profileRoot, manifest) {
  const { repository, store } = openProfile(profileRoot);
  const readback = projectPlanManifest(store, manifest, projectionActor(manifest.projectionId));
  return { repository, store, readback };
}

function openProfile(profileRoot) {
  const databasePath = resolve(profileRoot, "db", databaseFileName);
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  repository.applyMigrations();
  repository.seedAiEmployees(createDefaultSeed().employees, "plan-projection-cli-seed-v1");
  const store = new AosStore(createDefaultSeed(), { persistence: repository });
  const persistedProjectIds = new Set((repository.hydrateCore().projects ?? []).map((project) => project.id));
  if (persistedProjectIds.size === 0) {
    for (const project of createDefaultSeed().projects) {
      store.upsertProject(project, projectionActor("project-registration"));
    }
  }
  return { repository, store };
}

function projectionActor(projectionId) {
  return {
    employeeId: "employee-ilya",
    role: "implementation",
    threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
    sessionId: `plan-projection-cli-${sha256(projectionId).slice(0, 12)}`
  };
}

function recordIdsPersisted(store, recordIds) {
  return Object.values(recordIds.initiatives).every((id) => store.listInitiatives().some((record) => record.id === id))
    && Object.values(recordIds.epics).every((id) => store.listEpics().some((record) => record.id === id))
    && Object.values(recordIds.stories).every((id) => store.listStories().some((record) => record.id === id));
}

function assertReadbackInsideProfile(readbackPath, profileRoot) {
  const profile = resolve(profileRoot);
  const output = resolve(readbackPath);
  if (relative(profile, output).startsWith("..") || relative(profile, output) === "") {
    throw new Error("cli_readback_must_be_inside_profile_root");
  }
}

async function writeMetadataReadback(path, readback) {
  await writeFile(path, `${JSON.stringify(readback, null, 2)}\n`, "utf8");
  const serialized = await readFile(path, "utf8");
  if (serialized.includes("/Users/") || serialized.includes("BEGIN PRIVATE")) {
    throw new Error("cli_readback_privacy_violation");
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
