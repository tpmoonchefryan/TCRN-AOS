// SPDX-License-Identifier: Apache-2.0
// TCRN-CROSS-INIT-020 INC-075 — single-truth tip gate red leg. The gate is a live
// probe (facade-read PG head vs ceremony file-track head); its fixture mode is
// hermetic so the red side is constructible without the VM. This test pins the
// judgement's two sides:
//   RED — the current cross fork signature (PG 2133/4cc9… vs file 2122/ad2a7c9b)
//         is injected and must diverge;
//   GREEN — a fixture where every pathway agrees must pass.

import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { judgeTip } from "./tip-gate.mjs";

const H64 = (c) => c.repeat(64);
const ALL = ["TCRN-AOS", "cross-project", "TCRN-Design-System", "TCRN-TMS", "Joi-Button"];

async function judgeTipFixture(fixture) {
  const path = join(tmpdir(), `tip-fixture-${randomBytes(6).toString("hex")}.json`);
  writeFileSync(path, JSON.stringify(fixture), "utf8");
  try {
    return await judgeTip({ fixturePath: path });
  } finally {
    // judgeTip forces live=false in fixture mode; nothing to reclaim.
    void path;
  }
}

describe("single-truth tip gate (INC-075)", () => {
  test("REDS when an unsealed file track diverges from the authority (the cross fork signature)", async () => {
    const fixture = {};
    for (const partition of ALL) {
      fixture[partition] = {
        version: 2107, headEventHash: H64("f"), ceremonyVersion: 2107, ceremonyHeadEventHash: H64("f"),
        fileVersion: 2107, fileHeadEventHash: H64("f"), fileSealed: false,
      };
    }
    fixture["cross-project"] = {
      version: 2133, headEventHash: H64("a"), ceremonyVersion: 2133, ceremonyHeadEventHash: H64("a"),
      fileVersion: 2122, fileHeadEventHash: H64("b"), fileSealed: false,
    };
    const result = await judgeTipFixture(fixture);
    assert.equal(result.ok, false);
    assert.equal(result.reasonCode, "TIP_TRUTH_DIVERGED");
    const fork = result.divergent.find((e) => e.partition === "cross-project");
    assert.ok(fork, "cross-project must diverge");
    assert.equal(fork.readingA.version, 2133);
    assert.equal(fork.readingC.version, 2122);
  });

  test("GREENS when every pathway agrees on every partition", async () => {
    const fixture = {};
    for (const partition of ALL) {
      fixture[partition] = {
        version: 100, headEventHash: H64("c"), ceremonyVersion: 100, ceremonyHeadEventHash: H64("c"),
        fileVersion: 100, fileHeadEventHash: H64("c"), fileSealed: false,
      };
    }
    const result = await judgeTipFixture(fixture);
    assert.equal(result.ok, true);
    assert.equal(result.reasonCode, "TIP_SINGLE_TRUTH_VERIFIED");
    assert.deepEqual(result.divergent, []);
  });

  test("GREENS when the file track is sealed: its stale head is expected, not a divergence", async () => {
    const fixture = {};
    for (const partition of ALL) {
      fixture[partition] = {
        version: 100, headEventHash: H64("d"), ceremonyVersion: 100, ceremonyHeadEventHash: H64("d"),
        fileVersion: 90, fileHeadEventHash: H64("e"), fileSealed: true,
      };
    }
    const result = await judgeTipFixture(fixture);
    assert.equal(result.ok, true, JSON.stringify(result.divergent));
  });

  test("REDS when the ceremony pathway disagrees with the authority", async () => {
    const fixture = {};
    for (const partition of ALL) {
      fixture[partition] = {
        version: 50, headEventHash: H64("g"), ceremonyVersion: 50, ceremonyHeadEventHash: H64("g"),
        fileVersion: 50, fileHeadEventHash: H64("g"), fileSealed: false,
      };
    }
    fixture["TCRN-TMS"] = {
      version: 50, headEventHash: H64("g"), ceremonyVersion: 51, ceremonyHeadEventHash: H64("h"),
      fileVersion: 50, fileHeadEventHash: H64("g"), fileSealed: false,
    };
    const result = await judgeTipFixture(fixture);
    assert.equal(result.ok, false);
    assert.ok(result.divergent.some((e) => e.partition === "TCRN-TMS"));
  });
});
