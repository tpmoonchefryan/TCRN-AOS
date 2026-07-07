import test from "node:test";
import assert from "node:assert/strict";
import {
  candidateInput,
  docsReadinessInput,
  docsSearchScenario,
  githubInput,
  prciInput,
  searchInput
} from "../../domain/test/slice9-fixture.mjs";
import { McpGateway } from "../../../dist/packages/mcp-gateway/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice9-gateway-test"
};

test("Slice 9 gateway records docs search and release-candidate linkage metadata", () => {
  const scenario = docsSearchScenario();
  const gateway = new McpGateway(scenario.store);
  const readiness = gateway.handle({
    method: "aos.docs.readiness.record",
    actor,
    params: docsReadinessInput(scenario),
    idempotencyKey: "slice9-readiness"
  });
  const readinessDuplicate = gateway.handle({
    method: "aos.docs.readiness.record",
    actor,
    params: docsReadinessInput(scenario),
    idempotencyKey: "slice9-readiness"
  });
  const search = gateway.handle({
    method: "aos.docs.search.index",
    actor,
    params: searchInput(scenario)
  });
  const github = gateway.handle({
    method: "aos.github.metadata.record",
    actor,
    params: githubInput()
  });
  const prci = gateway.handle({
    method: "aos.pr_ci.story_readiness.record",
    actor,
    params: prciInput(scenario, github.result.id)
  });
  const candidate = gateway.handle({
    method: "aos.release_candidate.linkage.record",
    actor,
    params: candidateInput(scenario, readiness.result.id, github.result.id, prci.result.id)
  });
  const index = gateway.handle({
    method: "aos.release_candidate.linkage.read",
    actor,
    params: { projectId: "TCRN-AOS" }
  });

  assert.equal(readiness.ok, true);
  assert.equal(readinessDuplicate.status, "deduped");
  assert.equal(search.result.visibility, "metadata_only");
  assert.equal(github.result.githubWriteExecuted, false);
  assert.equal(prci.result.releaseReadyClaimed, false);
  assert.equal(candidate.result.finalMvpAccepted, false);
  assert.equal(index.status, "read");
  assert.deepEqual(index.result.releaseCandidateIds, [candidate.result.id]);
  assert.ok(index.result.blockedReleaseCandidateIds.includes(candidate.result.id));
});

test("Slice 9 gateway blocks restricted payloads and release claims", () => {
  const scenario = docsSearchScenario();
  const gateway = new McpGateway(scenario.store);
  const claimed = gateway.handle({
    method: "aos.github.metadata.record",
    actor,
    params: {
      ...githubInput(),
      releaseCreated: true
    }
  });
  const syntheticPath = "/" + "Users/example/search-index.md";
  const restricted = gateway.handle({
    method: "aos.docs.search.index",
    actor,
    params: {
      ...searchInput(scenario),
      summary: syntheticPath
    }
  });

  assert.equal(claimed.ok, false);
  assert.match(claimed.error, /releaseCreated/);
  assert.equal(restricted.ok, false);
  assert.match(restricted.error, /restricted machine_local_absolute_path/);
});
