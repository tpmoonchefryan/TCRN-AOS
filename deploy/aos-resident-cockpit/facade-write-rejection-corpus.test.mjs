// STORY-183 — red/green proof of the facade WRITE rejection corpus + the mutation
// witness. This file drives facade-write-rejection-corpus.mjs.
//
// GREEN LEG. Every corpus entry is POSTed to a real facade write service (file
// backend, scratch workspaces) and must produce its specific reason code — the
// INC-047/INC-069/INC-064 protection targets, each with a named refusal (or, for
// the pass entries, the positive guarantee the mutation must be able to break).
//
// RED LEG (the mutation witness). Every corpus entry carries the mutation that
// removes its rule. For each entry the witness builds a MIRROR of the module graph
// with that one mutation applied and re-runs the corpus item against it: the item
// must FLIP — the refusal is gone (turns PASS / a different reason code), or the
// positive guarantee breaks. A rule whose removal does not flip its corpus item has
// no witness, and that is the red this file exists to catch (判据两侧必须能够不同;
// INC-064 PASS-witness obligation, INC-069 两侧判决函数统一).
//
// NO NETWORK, NO VM, NO GOVERNED CONTAINER. Everything runs against the local
// engine CLI on scratch file-backed workspaces, exactly like
// facade-write-service.test.mjs. The only real read is the engine's own `commands`
// catalogue, taken live.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { startFacadeWriteService, writeWithheldGround } from "./facade-write-service.mjs";
import {
  assertPayload, planStep, resolveExpectations
} from "../aos-local-client/ceremony-plan.mjs";
import { LOCAL_ENGINE } from "../switch-rehearsal/rehearsal-lib.mjs";
import {
  REJECTION_CORPUS, materialiseMirror, makeScratchFixture, validPayload, liveCatalogueIndex, recordScope
} from "./facade-write-rejection-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUPPLY = { workspace: "/scratch/workspace", attestDir: "/scratch/attest", actor: "agent:fable" };

async function importUrl(file) {
  return import(pathToFileURL(file).href);
}

/** One facade write service, with every stated attest dir materialised first. */
async function startService({ workspaces, writeRoot }) {
  const attestDirs = {};
  for (const id of Object.keys(workspaces)) {
    const dir = join(workspaces[id], "..", `attest-${id}`);
    mkdirSync(dir, { recursive: true });
    attestDirs[id] = dir;
  }
  // INC-084: startup requires pgSchemas to cover every workspace. The test engine
  // runs file-backed (no TCRN_PG_CONNECTION, so the PG path is not taken).
  const pgSchemas = Object.fromEntries(Object.keys(workspaces).map((id) => [id, `chain_test_${id.toLowerCase()}`]));
  const service = await startFacadeWriteService({
    engineRoot: LOCAL_ENGINE,
    workspaces,
    attestDirs,
    pgSchemas,
    host: "127.0.0.1",
    port: 0,
    allowedHosts: ["127.0.0.1", "localhost"],
    catalogTtlMs: 5 * 60_000,
    writeRoot,
    actor: "agent:fable"
  });
  return service;
}

async function postCeremony(service, body) {
  const response = await fetch(`${service.url}/api/ceremony`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, json: await response.json() };
}

const mirrorCache = new Map();
async function mirroredPackage(mutations) {
  const key = JSON.stringify(mutations);
  let entry = mirrorCache.get(key);
  if (!entry) {
    entry = materialiseMirror(mutations);
    mirrorCache.set(key, entry);
  }
  return entry;
}

function fixtureFor(entry, p1, p2) {
  return entry.id === "REJ-041" ? p2 : p1;
}

function statusFor(entry) {
  return entry.expect === "pass" ? 200
    : entry.reasonCode === "MCP_PARTITION_UNKNOWN" ? 400 : 409;
}

// ── green leg ────────────────────────────────────────────────────────────────

test("GREEN LEG: every corpus entry triggers its specific reason code on the real face", async () => {
  const p1 = makeScratchFixture();
  const p2 = makeScratchFixture();
  const writeRoot = mkdtempSync(join(tmpdir(), "facade-183-green-"));
  const service = await startService({
    workspaces: { P1: p1.workspace, P2: p2.workspace, BROKEN: join(p1.base, "does-not-exist") },
    writeRoot
  });
  try {
    for (const entry of REJECTION_CORPUS) {
      const fx = fixtureFor(entry, p1, p2);
      const body = entry.body(fx);
      // The service states P1/P2 (never "TCRN-AOS", the service default), so every
      // entry that targets a scratch chain must say so on the wire.
      if (body.partition === undefined) body.partition = entry.id === "REJ-041" ? "P2" : "P1";
      const { status, json } = await postCeremony(service, body);
      assert.equal(status, statusFor(entry), `${entry.id} expected HTTP ${statusFor(entry)}, got ${status}`);
      assert.equal(json.ok, entry.expect === "pass", `${entry.id} expected ok=${entry.expect === "pass"}`);
      assert.equal(json.reasonCode, entry.reasonCode,
        `${entry.id} (${entry.describe}) expected ${entry.reasonCode}, got ${json.reasonCode}`);

      if (entry.expect === "pass") {
        const receipt = json.receipt ?? json;
        if (entry.id === "REJ-003") {
          assert.ok(receipt.steps[0].autoSupplied.includes("at"),
            `${entry.id} the face must stamp the write with its own instant`);
          assert.ok(receipt.steps[0].argv.includes("--at"));
        }
        if (entry.id === "REJ-040") {
          assert.equal(receipt.chainAfter.version, receipt.chainBefore.version,
            `${entry.id} a dry run must not advance the chain`);
          assert.equal(receipt.steps[0].executed, false);
        }
        if (entry.id === "REJ-041") {
          assert.equal(receipt.partition, "P2");
          // The write must have landed on P2's OWN record, read from the engine directly
          // (the receipt's workspace path is host-scrubbed and two scratch workspaces
          // report the same workspaceId).
          assert.equal(await recordScope(p2.workspace, p2.workId), "STORY-183 reject face corpus",
            `${entry.id} the write must land on P2's chain, not a neighbour's`);
        }
      }
    }
  } finally {
    await service.close();
    rmSync(p1.base, { recursive: true, force: true });
    rmSync(p2.base, { recursive: true, force: true });
    rmSync(writeRoot, { recursive: true, force: true });
  }
});

// ── red leg: the mutation witness ────────────────────────────────────────────

test("RED LEG: removing any corpus rule flips its corpus item — every rule has a witness", async () => {
  const liveCatalogue = await liveCatalogueIndex();
  let flipped = 0;
  for (const entry of REJECTION_CORPUS) {
    const outcome = await witness(entry, { liveCatalogue });
    assert.equal(outcome.flipped, true,
      `${entry.id} (${entry.rule}): removing the rule must flip the corpus item — ` + outcome.detail);
    flipped += 1;
  }
  for (const entry of mirrorCache.values()) rmSync(entry.root, { recursive: true, force: true });
  mirrorCache.clear();
  assert.equal(flipped, REJECTION_CORPUS.length,
    `every corpus entry carries a witness; ${flipped}/${REJECTION_CORPUS.length}`);
});

/**
 * The mutation witness for one corpus entry: apply the entry's mutation to a
 * mirror of the module graph and re-run the corpus item against the mutated code.
 * Returns {flipped, detail} — flipped is the claim that the refusal is gone (the
 * rule was load-bearing) or that the positive guarantee broke.
 */
async function witness(entry, { liveCatalogue }) {
  const mutated = await mirroredPackage([entry.mutation]);

  switch (entry.witness) {
    case "plan-assert": {
      const plan = await importUrl(join(mutated.root, "deploy/aos-local-client/ceremony-plan.mjs"));
      const fx = makeScratchFixture();
      const payload = entry.body(fx).payload;
      const green = assertPayload(payload);
      assert.equal(green.ok, false, `${entry.id} green assertPayload must refuse`);
      assert.equal(green.reasonCode, entry.reasonCode);
      const result = plan.assertPayload(payload);
      rmSync(fx.base, { recursive: true, force: true });
      return { flipped: result.ok === true, detail: `mutated assertPayload → ${result.reasonCode}` };
    }
    case "plan-supply": {
      const plan = await importUrl(join(mutated.root, "deploy/aos-local-client/ceremony-plan.mjs"));
      const fx = makeScratchFixture();
      const args = {
        step: { verb: "work-annotate", flags: { id: fx.workId, scope: "x" } },
        catalogue: liveCatalogue, supply: SUPPLY, chainVersion: 1, at: "2026-08-06T00:00:00Z"
      };
      const real = planStep(args);
      assert.ok(real.autoSupplied.includes("at"), `${entry.id} green planStep must supply --at`);
      const result = plan.planStep(args);
      rmSync(fx.base, { recursive: true, force: true });
      // With the auto-supply gone, the mutated step either loses --at from its plan or
      // refuses for the now-missing required --at — either way the supply was load-bearing.
      const supplied = result.autoSupplied ?? [];
      return { flipped: !supplied.includes("at"), detail: `mutated autoSupplied=${supplied.join(",") ?? "<refused>"}` };
    }
    case "plan-step":
    case "both-sides": {
      const plan = await importUrl(join(mutated.root, "deploy/aos-local-client/ceremony-plan.mjs"));
      const fx = makeScratchFixture();
      const args = {
        step: entry.stepForWitness(fx),
        catalogue: liveCatalogue, supply: SUPPLY, chainVersion: 1, at: "2026-08-06T00:00:00Z"
      };
      const green = planStep(args);
      assert.equal(green.ok, false, `${entry.id} green planStep must refuse ${entry.reasonCode}`);
      assert.equal(green.reasonCode, entry.reasonCode, `${entry.id} green planStep reason code`);
      let result;
      let threw = null;
      try {
        result = plan.planStep(args);
      } catch (error) {
        threw = error;
      }
      rmSync(fx.base, { recursive: true, force: true });
      // The refusal is gone when the mutated step is planned (ok:true), OR when the
      // now-undefended guard throws on a shape it used to refuse cleanly — both mean
      // the corpus item no longer produces its reason code. The decisive check is
      // that the reason code differs from green.
      return {
        flipped: threw !== null || result.reasonCode !== entry.reasonCode,
        detail: threw ? `mutated planStep threw: ${threw.message}` : `mutated planStep → ${result.reasonCode}`
      };
    }
    case "plan-readback": {
      const plan = await importUrl(join(mutated.root, "deploy/aos-local-client/ceremony-plan.mjs"));
      const fx = makeScratchFixture();
      const payload = entry.body(fx).payload;
      const green = resolveExpectations({ step: entry.readbackForWitness, steps: payload.steps });
      assert.ok(green.problems.length > 0, `${entry.id} green resolveExpectations must report a problem`);
      const result = plan.resolveExpectations({ step: entry.readbackForWitness, steps: payload.steps });
      rmSync(fx.base, { recursive: true, force: true });
      return { flipped: result.problems.length === 0, detail: `mutated problems=${result.problems.length}` };
    }
    case "write-withheld": {
      const facade = await importUrl(join(mutated.root, "deploy/aos-resident-cockpit/facade-write-service.mjs"));
      const green = writeWithheldGround(entry.verbEntryForWitness);
      assert.equal(green.reasonCode, entry.reasonCode, `${entry.id} green writeWithheldGround reason code`);
      const result = facade.writeWithheldGround(entry.verbEntryForWitness);
      // The rule is gone when the verb is either no longer withheld (null) or withheld
      // for a DIFFERENT reason — the reason code this corpus item guards has vanished.
      const flipped = result === null || result.reasonCode !== entry.reasonCode;
      return { flipped, detail: result === null ? "writeWithheldGround no longer withholds" : `→ ${result.reasonCode}` };
    }
    case "http": {
      // A genuinely behavioral rule: run the corpus item against a mutated HTTP service
      // on its own fresh workspaces (P1 is the mis-route target, P2 the intended chain).
      const fxP1 = makeScratchFixture();
      const fxP2 = makeScratchFixture();
      const root = mkdtempSync(join(tmpdir(), "facade-183-witness-"));
      const facadeModule = await importUrl(join(mutated.root, "deploy/aos-resident-cockpit/facade-write-service.mjs"));
      const witnessService = await facadeModule.startFacadeWriteService({
        engineRoot: LOCAL_ENGINE,
        workspaces: { P1: fxP1.workspace, P2: fxP2.workspace, BROKEN: join(fxP1.base, "missing") },
        attestDirs: {
          P1: join(fxP1.base, "attest-P1"),
          P2: join(fxP2.base, "attest-P2"),
          BROKEN: join(fxP1.base, "attest-B")
        },
        // INC-084: startup requires pgSchemas coverage.
        pgSchemas: { P1: "chain_p1", P2: "chain_p2", BROKEN: "chain_b" },
        host: "127.0.0.1",
        port: 0,
        allowedHosts: ["127.0.0.1", "localhost"],
        catalogTtlMs: 5 * 60_000,
        writeRoot: root,
        actor: "agent:fable"
      });
      try {
        mkdirSync(join(fxP1.base, "attest-P1"), { recursive: true });
        mkdirSync(join(fxP2.base, "attest-P2"), { recursive: true });
        const fx = entry.id === "REJ-041" ? fxP2 : fxP1;
        const { json } = await postCeremony(witnessService, entry.body(fx));
        let flipped;
        if (entry.id === "REJ-041") {
          // The pass guarantee is routing: the write must land on P2's OWN record. The
          // mutation routes everything to Object.values(workspaces)[0] (P1), so the
          // annotate lands on P1's chain and P2's record never carries the scope.
          flipped = (await recordScope(fxP2.workspace, fxP2.workId)) !== "STORY-183 reject face corpus";
        } else {
          flipped = json.reasonCode !== entry.reasonCode || (entry.expect === "pass" && json.ok !== true);
        }
        return { flipped, detail: `mutated HTTP → ${json.reasonCode} ok=${json.ok}` };
      } finally {
        await witnessService.close();
        rmSync(fxP1.base, { recursive: true, force: true });
        rmSync(fxP2.base, { recursive: true, force: true });
        rmSync(root, { recursive: true, force: true });
      }
    }
    default:
      throw new Error(`no witness for ${entry.id} (witness=${entry.witness})`);
  }
}

// ── both sides judge with the SAME code (INC-069 两侧判决函数统一) ──────────────

test("INC-069: the facade write face and the local ceremony judge the SAME family with the SAME reason code", async () => {
  const liveCatalogue = await liveCatalogueIndex();
  const p1 = makeScratchFixture();
  const writeRoot = mkdtempSync(join(tmpdir(), "facade-183-bothsides-"));
  const service = await startService({ workspaces: { P1: p1.workspace }, writeRoot });
  try {
    for (const [id, step, expected] of [
      ["REJ-030", { verb: "relocation-vacate", flags: {} }, "VERB_REQUIRES_OUT_OF_BAND_AUTHORITY"],
      ["REJ-031", { verb: "work-annotate", flags: { id: p1.workId, scope: "x", "expected-version": 42 } }, "RESERVED_FLAG_IN_PAYLOAD"]
    ]) {
      const planned = planStep({ step, catalogue: liveCatalogue, supply: SUPPLY, chainVersion: 1, at: "2026-08-06T00:00:00Z" });
      assert.equal(planned.reasonCode, expected, `${id} ceremony-plan side`);
      const { json } = await postCeremony(service, {
        partition: "P1",
        payload: { ...validPayload(p1), steps: [step] }
      });
      assert.equal(json.reasonCode, expected, `${id} facade side agrees`);
    }
  } finally {
    await service.close();
    rmSync(p1.base, { recursive: true, force: true });
    rmSync(writeRoot, { recursive: true, force: true });
  }
});
