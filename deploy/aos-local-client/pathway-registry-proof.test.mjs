// SPDX-License-Identifier: Apache-2.0
// TCRN-CROSS-INIT-020 INC-076 — pathway registry red leg. The registry in
// topology.mjs declares every engine pathway; the proof scans deploy/ and reds on
// any engine-invoking file that is not registered. RED: register nothing and scan
// a file that invokes the engine but is not in the registry. GREEN: the committed
// registry covers every scanned file.

import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { judgePathwayRegistry } from "./pathway-registry-proof.mjs";

describe("engine pathway registry (INC-076)", () => {
  test("GREENS against the committed registry", async () => {
    const result = await judgePathwayRegistry();
    assert.equal(result.ok, true, JSON.stringify(result.problems ?? []).slice(0, 500));
    assert.equal(result.reasonCode, "PATHWAY_REGISTRY_VERIFIED");
  });

  test("REDS when an engine-invoking file is not registered", async () => {
    const root = mkdtempSync(join(tmpdir(), "pathway-reg-"));
    const rogue = join(root, "rogue-instrument.mjs");
    writeFileSync(
      rogue,
      `import { remoteEngine } from "./ceremony.mjs";\nexport const x = await remoteEngine(["status", "--workspace", "/tmp"]);\n`,
      "utf8",
    );
    const result = await judgePathwayRegistry({ extraScanFiles: [rogue] });
    assert.equal(result.ok, false);
    assert.equal(result.reasonCode, "PATHWAY_REGISTRY_UNREGISTERED");
    assert.ok(result.unregistered.some((path) => path.endsWith("rogue-instrument.mjs")));
  });
});
