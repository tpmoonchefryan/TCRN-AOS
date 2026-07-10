import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AosSqliteRepository, assertRouteOwnedSqliteRoot } from "../../../dist/packages/db/src/index.js";
import {
  AosStore,
  createDefaultSeed,
  digest,
  PLAN_PROJECTION_SCHEMA_VERSION,
  PlanProjectionValidationError,
  projectPlanManifest
} from "../../../dist/packages/domain/src/index.js";
import { McpGateway } from "../../../dist/packages/mcp-gateway/src/index.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const migrationsDir = fileURLToPath(new URL("../../db/migrations/sqlite", import.meta.url));
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "plan-projection-test"
};

test("plan projection registers Design System, persists hierarchy, reconciles, and remains gateway-readable", async () => {
  const root = await mkdtemp(join(tmpdir(), "tcrn-aos-plan-projection-"));
  await writeFile(join(root, ".tcrn-aos-phase1-root"), "route-owned-plan-projection\n", "utf8");
  try {
    assert.equal(assertRouteOwnedSqliteRoot(root, repoRoot).ok, true);
    const repository = new AosSqliteRepository({ databasePath: join(root, "projection.sqlite"), migrationsDir });
    repository.applyMigrations();
    repository.seedAiEmployees(createDefaultSeed().employees, "plan-projection-test");
    const store = new AosStore(createDefaultSeed(), { persistence: repository });
    for (const project of createDefaultSeed().projects) {
      store.upsertProject(project, actor);
    }
    const manifest = fixtureManifest();
    const first = projectPlanManifest(store, manifest, actor);
    assert.equal(first.ok, true);
    assert.equal(first.projectId, "TCRN-DESIGN-SYSTEM");
    assert.equal(first.counts.created, 6);
    assert.equal(first.counts.reconciled, 0);
    assert.equal(store.getProject("TCRN-DESIGN-SYSTEM")?.repoRegistryId, "TCRN-DESIGN-SYSTEM");
    assert.equal(store.getProject("TCRN-AOS")?.repoRegistryId, "TCRN-AOS");
    assert.equal(store.getProject("TCRN-TMS")?.repoRegistryId, "TCRN-TMS");
    const gateway = new McpGateway(store);
    const ticketList = gateway.handle({
      method: "aos.ticket.list",
      actor,
      params: { initiativeId: first.recordIds.initiatives["ds2-modernization"] }
    });
    assert.equal(ticketList.ok, true);
    assert.equal(ticketList.result.rows.length, 3);
    const story = store.listStories().find((item) => item.id === first.recordIds.stories["ds2-documentation"]);
    assert.equal(story?.projection?.externalKey, "ds2-documentation");
    assert.equal(story?.projection?.writeScopes[0], "TCRN-DESIGN-SYSTEM/packages/**");
    repository.close();

    const restartedRepository = new AosSqliteRepository({ databasePath: join(root, "projection.sqlite"), migrationsDir });
    restartedRepository.applyMigrations();
    const restartedStore = new AosStore(createDefaultSeed(), { persistence: restartedRepository });
    const second = projectPlanManifest(restartedStore, manifest, actor);
    assert.equal(second.counts.created, 0);
    assert.equal(second.counts.reconciled, 0);
    assert.equal(second.counts.reused, 6);
    assert.equal(restartedStore.listInitiatives().filter((item) => item.projection?.externalKey === "ds2-modernization").length, 1);
    assert.equal(restartedStore.listStories().filter((item) => item.projection?.externalKey.startsWith("ds2-")).length, 3);
    restartedRepository.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("plan projection fails closed on malformed hierarchy, duplicate keys, unknown project, and cross-project parents", () => {
  const store = new AosStore(createDefaultSeed());
  const cases = [
    ["duplicate", (manifest) => { manifest.epics[0].externalKey = manifest.initiatives[0].externalKey; }, "plan_projection_duplicate_external_key"],
    ["unknown-project", (manifest) => { manifest.project.id = "UNKNOWN-PROJECT"; manifest.initiatives.forEach((row) => { row.projectId = "UNKNOWN-PROJECT"; }); manifest.epics.forEach((row) => { row.projectId = "UNKNOWN-PROJECT"; }); manifest.stories.forEach((row) => { row.projectId = "UNKNOWN-PROJECT"; }); }, "plan_projection_unknown_project"],
    ["malformed-parent", (manifest) => { manifest.epics[0].initiativeKey = "missing-initiative"; }, "plan_projection_unknown_initiative_parent"],
    ["cross-project-parent", (manifest) => { manifest.stories[0].projectId = "TCRN-AOS"; }, "plan_projection_cross_project_parent"]
  ];
  for (const [, mutate, expected] of cases) {
    const manifest = fixtureManifest();
    mutate(manifest);
    assert.throws(
      () => projectPlanManifest(store, manifest, actor),
      (error) => error instanceof PlanProjectionValidationError && error.code.startsWith(expected)
    );
  }
});

function fixtureManifest() {
  const projectId = "TCRN-DESIGN-SYSTEM";
  const manifest = {
    schemaVersion: PLAN_PROJECTION_SCHEMA_VERSION,
    projectionId: "design-system-2-storybook-modernization",
    sourceDigest: digest({ source: "design-system-2-plan", revision: 1 }),
    project: {
      id: projectId,
      name: "TCRN Design System",
      registryStatus: "active",
      repoRegistryId: "TCRN-DESIGN-SYSTEM",
      repoPathReference: "../TCRN-Design-System",
      status: "in_progress",
      gateState: "pending_role"
    },
    initiatives: [
      base({
        externalKey: "ds2-modernization",
        projectId,
        title: "Design System 2 modernization",
        problem: "The Design System needs a trackable implementation plan projection.",
        expectedOutcome: "AOS exposes durable Initiative, Epic, and Story execution state."
      })
    ],
    epics: [
      base({
        externalKey: "ds2-foundation",
        projectId,
        initiativeKey: "ds2-modernization",
        title: "Foundation",
        goal: "Prepare the durable design-system foundation.",
        estimate: estimate(3)
      }),
      base({
        externalKey: "ds2-documentation-epic",
        projectId,
        initiativeKey: "ds2-modernization",
        title: "Documentation",
        goal: "Make the delivery evidence discoverable.",
        dependencies: ["ds2-foundation"],
        estimate: estimate(2)
      })
    ],
    stories: [
      base({
        externalKey: "ds2-foundation-tokens",
        projectId,
        epicKey: "ds2-foundation",
        title: "Verify token foundation",
        problem: "The token contract needs an explicit execution record.",
        user: "Design System maintainer",
        expectedBehavior: "The story is tracked with its gate and acceptance metadata.",
        estimate: estimate(2)
      }),
      base({
        externalKey: "ds2-storybook-proof",
        projectId,
        epicKey: "ds2-foundation",
        title: "Record Storybook proof",
        problem: "Storybook evidence needs a stable work item.",
        user: "Verification engineer",
        expectedBehavior: "The proof requirement is visible without raw plan content.",
        dependencies: ["ds2-foundation-tokens"],
        estimate: estimate(2)
      }),
      base({
        externalKey: "ds2-documentation",
        projectId,
        epicKey: "ds2-documentation-epic",
        title: "Publish documentation readback",
        problem: "Plan projection needs a discoverable story-level record.",
        user: "Workflow architect",
        expectedBehavior: "Current AOS ticket readback lists the projected story.",
        dependencies: ["ds2-storybook-proof"],
        estimate: estimate(1)
      })
    ]
  };
  return manifest;
}

function base(overrides) {
  return {
    externalKey: "missing-key",
    projectId: "missing-project",
    title: "Projected work item",
    status: "proposed",
    dependencies: [],
    owners: ["Minerva, Workflow Architect"],
    writeScopes: ["TCRN-DESIGN-SYSTEM/packages/**"],
    acceptanceCriteria: ["Record work state through AOS only."],
    gateRequirements: ["evidence_proof"],
    ...overrides
  };
}

function estimate(effortPoints) {
  return { effortPoints, complexity: "medium", risk: "L2", verificationCost: "medium", confidence: "medium" };
}
