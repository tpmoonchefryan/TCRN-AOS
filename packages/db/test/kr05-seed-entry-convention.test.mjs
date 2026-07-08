import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  createKr05FactCardConventionEntry,
  kr05FactCardConventionEntryId,
  kr05MaxPreEpicSeedEntries,
  kr05OwnerSeedEntryListDisposition,
  kr05SeedEntryBatchReadback,
  toKnowledgeRetrievalEntryInput
} from "../../../dist/packages/db/src/index.js";

const migrationsDir = fileURLToPath(new URL("../migrations/sqlite", import.meta.url));

test("KR-05 preserves none-initial seed boundary while storing only the fact-card convention entry", async () => {
  const root = await mkdtemp(join(tmpdir(), "tcrn-aos-kr05-test-"));
  try {
    const repository = new AosSqliteRepository({ databasePath: join(root, "kr05.sqlite"), migrationsDir });
    repository.applyMigrations();

    const convention = createKr05FactCardConventionEntry();
    const conventionReadback = kr05SeedEntryBatchReadback([convention], {
      ownerSeedEntryListDisposition: kr05OwnerSeedEntryListDisposition
    });
    assert.equal(conventionReadback.ok, true);
    assert.equal(conventionReadback.ownerSeedEntryListDisposition, "none_initial");
    assert.equal(conventionReadback.requestedCount, 1);
    assert.equal(conventionReadback.acceptedCount, 1);
    assert.equal(conventionReadback.conventionEntryCount, 1);
    assert.equal(conventionReadback.canonicalConventionEntryCount, 1);
    assert.equal(conventionReadback.canonicalSeedEntryCount, 0);
    assert.equal(conventionReadback.nonEnumeratedCanonicalSeedEntryAccepted, false);

    const storedConvention = repository.createKnowledgeRetrievalEntry(toKnowledgeRetrievalEntryInput(convention));
    assert.equal(storedConvention.id, kr05FactCardConventionEntryId);
    assert.equal(storedConvention.status, "canonical");
    const conventionSearch = repository.searchKnowledgeRetrievalEntries({
      query: "fact card convention",
      roleScope: "implementation",
      project: "TCRN-AOS"
    });
    assert.deepEqual(conventionSearch.map((entry) => entry.id), [kr05FactCardConventionEntryId]);

    const spoofedConvention = createKr05FactCardConventionEntry({
      id: "knowledge-kr05-spoofed-convention-canonical",
      title: "KR-05 spoofed convention canonical"
    });
    const spoofedConventionReadback = kr05SeedEntryBatchReadback([spoofedConvention]);
    assert.equal(spoofedConventionReadback.ok, true);
    assert.equal(spoofedConventionReadback.acceptedCount, 0);
    assert.equal(spoofedConventionReadback.canonicalConventionEntryCount, 0);
    assert.equal(spoofedConventionReadback.spoofedCanonicalConventionAccepted, false);
    assert.equal(spoofedConventionReadback.decisions[0]?.reason, "kr05_spoofed_canonical_convention_denied");

    const draftFixture = createKr05FactCardConventionEntry({
      id: "knowledge-kr05-draft-proof-fixture",
      title: "KR-05 draft proof fixture",
      status: "draft",
      seedKind: "convention_proof_fixture",
      summary: "Draft KR-05 proof fixture for readback only.",
      body: convention.body.replace("A fact card covers", "This draft proof fixture covers"),
      tags: ["kr05", "proof-fixture"]
    });
    const draftReadback = kr05SeedEntryBatchReadback([draftFixture]);
    assert.equal(draftReadback.ok, true);
    assert.equal(draftReadback.acceptedCount, 1);
    assert.equal(draftReadback.draftOrFixtureCount, 1);
    repository.createKnowledgeRetrievalEntry(toKnowledgeRetrievalEntryInput(draftFixture));
    assert.deepEqual(repository.searchKnowledgeRetrievalEntries({
      query: "draft proof fixture",
      roleScope: "implementation",
      project: "TCRN-AOS"
    }).map((entry) => entry.id), []);
    assert.deepEqual(repository.searchKnowledgeRetrievalEntries({
      query: "draft proof fixture",
      roleScope: "implementation",
      project: "TCRN-AOS",
      includeDraft: true
    }).map((entry) => entry.id), ["knowledge-kr05-draft-proof-fixture"]);

    const nonEnumeratedCanonical = createKr05FactCardConventionEntry({
      id: "knowledge-kr05-unlisted-canonical-seed",
      title: "KR-05 unlisted canonical seed",
      seedKind: "owner_enumerated_seed"
    });
    const nonEnumeratedReadback = kr05SeedEntryBatchReadback([nonEnumeratedCanonical]);
    assert.equal(nonEnumeratedReadback.ok, true);
    assert.equal(nonEnumeratedReadback.acceptedCount, 0);
    assert.equal(nonEnumeratedReadback.canonicalSeedEntryCount, 0);
    assert.equal(nonEnumeratedReadback.decisions[0]?.reason, "kr05_non_enumerated_canonical_seed_denied");

    const bulkMigration = createKr05FactCardConventionEntry({
      id: "knowledge-kr05-bulk-migration",
      title: "KR-05 bulk migration attempt",
      status: "draft",
      seedKind: "bulk_vault_migration"
    });
    const bulkReadback = kr05SeedEntryBatchReadback([bulkMigration]);
    assert.equal(bulkReadback.acceptedCount, 0);
    assert.equal(bulkReadback.bulkVaultMigrationAttempted, true);
    assert.equal(bulkReadback.decisions[0]?.reason, "kr05_bulk_vault_migration_forbidden");

    const missingSections = createKr05FactCardConventionEntry({
      id: "knowledge-kr05-missing-sections",
      title: "KR-05 missing sections",
      status: "draft",
      seedKind: "convention_proof_fixture",
      body: "This fixture intentionally omits the mandatory KR-05 fact-card headings."
    });
    const missingReadback = kr05SeedEntryBatchReadback([missingSections]);
    assert.equal(missingReadback.acceptedCount, 0);
    assert.equal(missingReadback.decisions[0]?.reason, "kr05_fact_card_required_sections_missing");
    assert.equal(missingReadback.decisions[0]?.missingRequiredSections.length, 4);

    const tooMany = Array.from({ length: kr05MaxPreEpicSeedEntries + 1 }, (_, index) => createKr05FactCardConventionEntry({
      id: `knowledge-kr05-overlimit-${index}`,
      title: `KR-05 overlimit ${index}`,
      status: "draft",
      seedKind: "convention_proof_fixture"
    }));
    const overLimitReadback = kr05SeedEntryBatchReadback(tooMany);
    assert.equal(overLimitReadback.acceptedCount, 0);
    assert.equal(overLimitReadback.overLimitAttemptRejected, true);
    assert.equal(overLimitReadback.decisions.every((decision) => decision.reason === "kr05_seed_entry_count_limit_exceeded"), true);

    repository.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
