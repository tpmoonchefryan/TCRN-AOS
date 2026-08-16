import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  PRODUCTION_PROBES,
  judgeProductionReadiness,
  rehearseRedLegs,
} from "./production-readiness-proof.mjs";
import { buildHelperRepinPlan } from "./helper-repin-plan.mjs";

const green = () => PRODUCTION_PROBES.map((id) => ({ id, ok: true }));

const OWNER_MARKERS = [
  "## 裁定三 · helper 重钉（INC-113）",
  "Owner：「**批准，tag 铸成即执行（推荐）**」。",
  "v0.11.8 annotated tag 铸成后立即重钉",
  "`HELPER_REPIN_OWNER_APPROVAL_REQUIRED` 必停点就此清偿，无需再问。",
];

function helperFixture(authorization) {
  const root = mkdtempSync(join(tmpdir(), "tcrn-aos-helper-plan-"));
  const candidate = join(root, "candidate");
  mkdirSync(candidate);
  // The plan derives its expected version from the DEPLOYED engine, so a fixture that
  // pins everything to 0.11.8 while leaving that root real is judged against whatever
  // this machine happens to run — the test went red on an engine upgrade it does not
  // describe. `deployedEngineRoot` was injectable all along; the fixture now supplies it
  // and the case is hermetic again (TCRN-CROSS-INC-213).
  const deployedEngine = join(root, "deployed-engine");
  mkdirSync(deployedEngine);
  writeFileSync(join(deployedEngine, "package.json"), JSON.stringify({ version: "0.11.8" }));
  writeFileSync(join(root, "complete-skill-archive.provenance.json"), JSON.stringify({
    predicate: { buildDefinition: { externalParameters: { version: "0.11.8", tag: "v0.11.8" } } },
  }));
  writeFileSync(join(root, "installed-copy-claude.json"), JSON.stringify({ version: "v0.11.8" }));
  writeFileSync(join(root, "installed-copy-codex.json"), JSON.stringify({ version: "v0.11.8" }));
  writeFileSync(join(root, "state.json"), JSON.stringify({ verifiedArchiveSha256: "a".repeat(64) }));
  writeFileSync(join(candidate, "package.json"), JSON.stringify({ version: "0.11.8" }));
  const authorizationPath = join(root, "authorization.md");
  writeFileSync(authorizationPath, authorization);
  return { root, candidate, authorizationPath, deployedEngine };
}

test("all seven healthy probes produce PRODUCTION_READY", () => {
  assert.deepEqual(judgeProductionReadiness(green()), {
    ok: true,
    decision: "PRODUCTION_READY",
    failedProbes: [],
  });
});

test("a missing probe is fail-closed and names the missing probe", () => {
  const observations = green().filter((probe) => probe.id !== "mcp-single-truth");
  const result = judgeProductionReadiness(observations);
  assert.equal(result.ok, false);
  assert.equal(result.decision, "NOT_READY");
  assert.deepEqual(result.failedProbes, ["mcp-single-truth"]);
});

test("each of the seven red-leg rehearsals forces the aggregate door red", () => {
  const legs = rehearseRedLegs(green());
  assert.equal(legs.length, 7);
  assert.ok(legs.every((leg) => leg.ok));
  assert.deepEqual(legs.map((leg) => leg.target), [...PRODUCTION_PROBES]);
});

test("an unexpected probe identity cannot silently satisfy the gate", () => {
  const observations = [
    ...green().filter((probe) => probe.id !== "knowledge-freshness"),
    { id: "not-knowledge", ok: true },
  ];
  const result = judgeProductionReadiness(observations);
  assert.equal(result.ok, false);
  assert.deepEqual(result.failedProbes, ["knowledge-freshness"]);
});

test("helper repin remains fail-closed without the recorded Owner ruling", () => {
  const fixture = helperFixture(OWNER_MARKERS.slice(0, 3).join("\n"));
  try {
    const result = buildHelperRepinPlan({
      helperRoot: fixture.root,
      candidateRoot: fixture.candidate,
      deployedEngineRoot: fixture.deployedEngine,
      ownerAuthorizationPath: fixture.authorizationPath,
    });
    assert.equal(result.ready, false);
    assert.equal(result.reasonCode, "HELPER_REPIN_OWNER_APPROVAL_REQUIRED");
    assert.equal(result.repinVerified, true);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("helper repin verifies only with matching live pins and the recorded Owner ruling", () => {
  const fixture = helperFixture(OWNER_MARKERS.join("\n"));
  try {
    const result = buildHelperRepinPlan({
      helperRoot: fixture.root,
      candidateRoot: fixture.candidate,
      deployedEngineRoot: fixture.deployedEngine,
      ownerAuthorizationPath: fixture.authorizationPath,
    });
    assert.equal(result.ready, true);
    assert.equal(result.reasonCode, "HELPER_REPIN_VERIFIED");
    assert.equal(result.ownerApproval.granted, true);
    assert.equal(result.repinVerified, true);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
