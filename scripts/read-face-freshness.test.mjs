// The freshness window — STORY-137 (R1): default 9h, --max-age-hours override, red exit.
//
// Runs the gate as a subprocess against a local fixture (scripts/lib/freshness-fixture-server.mjs)
// that serves a generation stamp at a chosen age, so the red and green states are both
// real executions of the whole script — never a mocked judgment. Margins are wide
// (1h fresh vs 9h window; 20h stale vs 9h window) so a few seconds of clock drift
// between the fixture stamp and the subprocess run cannot flip a verdict.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startFreshnessFixture } from "./lib/freshness-fixture-server.mjs";

const FRESHNESS_SCRIPT = fileURLToPath(new URL("./read-face-freshness.mjs", import.meta.url));

function runFreshness({ url, extraArgs = [], extraEnv = {} }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [FRESHNESS_SCRIPT, ...extraArgs], {
      env: { ...process.env, AOS_READ_FACE_URL: url, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      let receipt = null;
      try { receipt = JSON.parse(stdout); } catch { receipt = null; }
      resolve({ code, stdout, stderr, receipt });
    });
  });
}

async function withFixture(run, { offsetHours }) {
  const fixture = await startFreshnessFixture({ offsetHours });
  try {
    await run(fixture);
  } finally {
    await fixture.close();
  }
}

test("green: a snapshot 1h old passes the default 9h window", async () => {
  await withFixture(async (fixture) => {
    const { code, receipt, stderr } = await runFreshness({ url: fixture.url });
    assert.equal(code, 0, `expected fresh exit 0, got ${code}; stderr: ${stderr}`);
    assert.equal(receipt?.verdict, "fresh");
    assert.equal(receipt?.maxAgeHours, 9, "the default window must be 9h");
    assert.equal(receipt?.maxAgeSource, "default");
    assert.deepEqual(receipt?.findings ?? [], []);
  }, { offsetHours: -1 });
});

test("red: a snapshot 20h old fails the default 9h window, exit non-zero", async () => {
  await withFixture(async (fixture) => {
    const { code, receipt, stderr } = await runFreshness({ url: fixture.url });
    assert.equal(code, 1, `expected red exit 1, got ${code}; stderr: ${stderr}`);
    assert.equal(receipt?.verdict, "not-fresh");
    const ids = (receipt?.findings ?? []).map((finding) => finding.id);
    assert.ok(ids.includes("served-snapshot-is-within-the-freshness-window"),
      `stale snapshot must red the freshness-window invariant; findings: ${ids.join(", ")}`);
  }, { offsetHours: -20 });
});

test("--max-age-hours widens the window, turning a red into a green", async () => {
  await withFixture(async (fixture) => {
    const { code, receipt } = await runFreshness({ url: fixture.url, extraArgs: ["--max-age-hours", "24"] });
    assert.equal(code, 0, "a 20h-old snapshot must be fresh under a 24h override");
    assert.equal(receipt?.verdict, "fresh");
    assert.equal(receipt?.maxAgeHours, 24);
    assert.equal(receipt?.maxAgeSource, "flag:--max-age-hours");
  }, { offsetHours: -20 });
});

test("the flag beats the environment override", async () => {
  await withFixture(async (fixture) => {
    // env says 24h, flag says 12h, snapshot is 20h old: the flag must win -> red.
    const { code, receipt } = await runFreshness({
      url: fixture.url,
      extraArgs: ["--max-age-hours", "12"],
      extraEnv: { AOS_READ_FACE_MAX_DATA_AGE_HOURS: "24" }
    });
    assert.equal(code, 1, "the --max-age-hours flag must take precedence over the environment");
    assert.equal(receipt?.maxAgeSource, "flag:--max-age-hours");
  }, { offsetHours: -20 });
});

test("the environment override still widens the window when no flag is given", async () => {
  await withFixture(async (fixture) => {
    const { code, receipt } = await runFreshness({
      url: fixture.url,
      extraEnv: { AOS_READ_FACE_MAX_DATA_AGE_HOURS: "24" }
    });
    assert.equal(code, 0);
    assert.equal(receipt?.verdict, "fresh");
    assert.equal(receipt?.maxAgeSource, "env:AOS_READ_FACE_MAX_DATA_AGE_HOURS");
  }, { offsetHours: -20 });
});

test("a malformed --max-age-hours is a could-not-judge, exit 2, never a pass", async () => {
  await withFixture(async (fixture) => {
    for (const bad of ["banana", "-3", "0"]) {
      const { code, receipt } = await runFreshness({ url: fixture.url, extraArgs: ["--max-age-hours", bad] });
      // Argument parsing throws before any probe, so no receipt is emitted and the
      // only report is the stderr message — the important part is the exit code:
      // class 2 (could not judge), never 0 or 1.
      assert.equal(code, 2, `--max-age-hours ${bad} must exit 2`);
      assert.equal(receipt, null, `--max-age-hours ${bad} must not emit a receipt`);
    }
  }, { offsetHours: -1 });
});
