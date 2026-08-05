// TCRN-AOS-STORY-136 — the judgement, against literals.
//
// This file may not read the platform's documents: a test that depended on files outside
// this repository would fail in a fresh clone for a reason unrelated to the code. So every
// input here is synthesised, and the real documents are judged by
// `doc-topology-proof.mjs`, which is in `pnpm verify`. Neither run stands in for the other.
//
// Every case is written so that the mutation which should make it fail is visible in the
// case itself — the roster and the claim are both literals and they differ by exactly one
// term. A case whose inputs cannot disagree is a case that cannot fail, and this platform
// has shipped three of those.

import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CLAIM_BLOCK_BEGIN, CLAIM_BLOCK_END, findUncontainedMentions, judgeDocTopology,
  judgeMeasurement, parseClaimBlocks, findSshDirectEngineCommands, sshCommandAllowlisted,
  SSH_ENGINE_PATTERN
} from "./doc-topology-predicates.mjs";
import { REPO_ROOT } from "./topology.mjs";

const AWAY_ADDRESS = "/srv/tcrn/governance/tcrn-workspace/TCRN-AOS/workspace";

const ROSTER = Object.freeze([
  { partitionId: "TCRN-AOS", externalKey: "TCRN-AOS-WORKSPACE", home: "vm",
    workspaceId: "workspace:aaa", liveAddress: AWAY_ADDRESS },
  { partitionId: "cross-project", externalKey: "TCRN-CROSS-WORKSPACE", home: "local",
    workspaceId: "workspace:bbb" }
]);

const LITERALS = Object.freeze([
  ".tcrn-workspace/TCRN-AOS/workspace",
  ".tcrn-workspace/cross-project/workspace",
  "/srv/tcrn/governance/tcrn-workspace",
  AWAY_ADDRESS
]);

const localAddressOf = (partitionId) => `.tcrn-workspace/${partitionId}/workspace`;

const claimRow = (partitionId, home, address, command = `run --workspace ${address}`) =>
  `| \`${partitionId}\` | \`${home}\` | \`${address}\` | \`${command}\` |`;

const block = (...rows) => [
  CLAIM_BLOCK_BEGIN,
  "",
  "| 分区 | home | 真值地址 | 复核命令 |",
  "| --- | --- | --- | --- |",
  ...rows,
  "",
  CLAIM_BLOCK_END
].join("\n");

const CORRECT_BLOCK = block(
  claimRow("TCRN-AOS", "vm", AWAY_ADDRESS),
  claimRow("cross-project", "local", ".tcrn-workspace/cross-project/workspace"));

const REGISTRY = Object.freeze([
  { path: "CLAUDE.md", mustCarryClaims: true,
    expectedPartitions: ["TCRN-AOS", "cross-project"] },
  { path: "AGENTS.md", mustCarryClaims: false }
]);

const OBSERVATIONS = Object.freeze({
  "TCRN-AOS": {
    partitionId: "TCRN-AOS", home: "vm", localAccepted: false,
    localReasonCode: "WORKSPACE_RELOCATION_VACATED", localWorkspaceId: "workspace:aaa",
    vmProbed: false
  },
  "cross-project": {
    partitionId: "cross-project", home: "local", localAccepted: true,
    localReasonCode: "WORKSPACE_COMMAND_COMPLETED", localWorkspaceId: "workspace:bbb",
    vmProbed: false
  }
});

const judge = (overrides = {}) => judgeDocTopology({
  documents: [
    { path: "CLAUDE.md", exists: true, text: `# entry\n\n${CORRECT_BLOCK}\n` },
    { path: "AGENTS.md", exists: true, text: "# pointer\n\nsee CLAUDE.md\n" }
  ],
  registry: REGISTRY,
  roster: ROSTER,
  literals: LITERALS,
  observations: OBSERVATIONS,
  localAddressOf,
  ...overrides
});

const codes = (verdict) => verdict.findingCodes;

test("the correct platform picture is green and says it was measured", () => {
  const verdict = judge();
  assert.equal(verdict.ok, true, JSON.stringify(verdict.findings));
  assert.equal(verdict.reasonCode, "DOC_TOPOLOGY_CLAIMS_MATCH_MEASUREMENT");
  assert.equal(verdict.measured, true);
  assert.equal(verdict.counts.claims, 2);
});

test("an unmeasured run is green under a DIFFERENT reason code", () => {
  // The two greens must not be the same word. A reader who sees one green cannot otherwise
  // tell whether a machine was consulted, and "we checked" would then be unfalsifiable.
  const verdict = judge({ observations: {} });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.measured, false);
  assert.equal(verdict.reasonCode, "DOC_TOPOLOGY_CLAIMS_MATCH_ROSTER");
});

test("a claimed home that contradicts the roster is red and names the partition", () => {
  const verdict = judge({
    documents: [
      { path: "CLAUDE.md", exists: true, text: block(
        claimRow("TCRN-AOS", "vm", AWAY_ADDRESS),
        claimRow("cross-project", "vm", ".tcrn-workspace/cross-project/workspace")) },
      { path: "AGENTS.md", exists: true, text: "pointer" }
    ]
  });
  assert.equal(verdict.ok, false);
  assert.ok(codes(verdict).includes("CLAIMED_HOME_CONTRADICTS_ROSTER"));
  const finding = verdict.findings.find((row) => row.code === "CLAIMED_HOME_CONTRADICTS_ROSTER");
  assert.equal(finding.partitionId, "cross-project");
  assert.equal(finding.expected, "local");
  assert.equal(finding.observed, "vm");
});

test("a claimed address off by one path segment is red", () => {
  const verdict = judge({
    documents: [
      { path: "CLAUDE.md", exists: true, text: block(
        claimRow("TCRN-AOS", "vm", AWAY_ADDRESS.replace("/governance/", "/gov/")),
        claimRow("cross-project", "local", ".tcrn-workspace/cross-project/workspace")) },
      { path: "AGENTS.md", exists: true, text: "pointer" }
    ]
  });
  assert.equal(verdict.ok, false);
  assert.ok(codes(verdict).includes("CLAIMED_ADDRESS_CONTRADICTS_ROSTER"));
});

test("deleting a required block is red — deletion must not be the way out", () => {
  const verdict = judge({
    documents: [
      { path: "CLAUDE.md", exists: true, text: "# entry with no claims\n" },
      { path: "AGENTS.md", exists: true, text: "pointer" }
    ]
  });
  assert.equal(verdict.ok, false);
  assert.ok(codes(verdict).includes("REQUIRED_CLAIM_BLOCK_ABSENT"));
});

test("dropping one row from a required block is red", () => {
  const verdict = judge({
    documents: [
      { path: "CLAUDE.md", exists: true, text: block(claimRow("TCRN-AOS", "vm", AWAY_ADDRESS)) },
      { path: "AGENTS.md", exists: true, text: "pointer" }
    ]
  });
  assert.equal(verdict.ok, false);
  assert.ok(codes(verdict).includes("CLAIMED_PARTITION_SET_MISMATCH"));
});

test("a correct block plus a stale sentence in the same document is red", () => {
  // The shape that cost this platform twice: one place updated, another not, both in one file.
  const verdict = judge({
    documents: [
      { path: "CLAUDE.md", exists: true,
        text: `${CORRECT_BLOCK}\n\nThe chain lives under ${AWAY_ADDRESS} on this laptop.\n` },
      { path: "AGENTS.md", exists: true, text: "pointer" }
    ]
  });
  assert.equal(verdict.ok, false);
  assert.ok(codes(verdict).includes("ADDRESS_STATED_OUTSIDE_A_CLAIM_BLOCK"));
  const finding = verdict.findings.find(
    (row) => row.code === "ADDRESS_STATED_OUTSIDE_A_CLAIM_BLOCK" && row.literal === AWAY_ADDRESS);
  assert.equal(finding.path, "CLAUDE.md");
  assert.ok(finding.line > 1);
});

test("a document not required to carry claims may still not carry a WRONG one", () => {
  // Otherwise `mustCarryClaims: false` would read as "unchecked", and demoting a document
  // in the registry would be the cheapest way to silence this gate.
  const verdict = judge({
    documents: [
      { path: "CLAUDE.md", exists: true, text: CORRECT_BLOCK },
      { path: "AGENTS.md", exists: true,
        text: block(claimRow("cross-project", "vm", ".tcrn-workspace/cross-project/workspace")) }
    ]
  });
  assert.equal(verdict.ok, false);
  const finding = verdict.findings.find((row) => row.code === "CLAIMED_HOME_CONTRADICTS_ROSTER");
  assert.equal(finding.path, "AGENTS.md");
});

test("a recheck command that does not name the claimed address is red", () => {
  const verdict = judge({
    documents: [
      { path: "CLAUDE.md", exists: true, text: block(
        claimRow("TCRN-AOS", "vm", AWAY_ADDRESS, "status --workspace /somewhere/else"),
        claimRow("cross-project", "local", ".tcrn-workspace/cross-project/workspace")) },
      { path: "AGENTS.md", exists: true, text: "pointer" }
    ]
  });
  assert.equal(verdict.ok, false);
  assert.ok(codes(verdict).includes("RECHECK_COMMAND_DOES_NOT_NAME_THE_CLAIMED_ADDRESS"));
});

test("a missing registered document is red, not skipped", () => {
  const verdict = judge({
    documents: [
      { path: "CLAUDE.md", exists: true, text: CORRECT_BLOCK },
      { path: "AGENTS.md", exists: false, text: "" }
    ]
  });
  assert.equal(verdict.ok, false);
  assert.ok(codes(verdict).includes("REGISTERED_DOCUMENT_MISSING"));
});

test("an unknown partition in a claim is red", () => {
  const verdict = judge({
    documents: [
      { path: "CLAUDE.md", exists: true, text: block(
        claimRow("TCRN-AOS", "vm", AWAY_ADDRESS),
        claimRow("cross-project", "local", ".tcrn-workspace/cross-project/workspace"),
        claimRow("TCRN-GHOST", "local", ".tcrn-workspace/TCRN-GHOST/workspace")) },
      { path: "AGENTS.md", exists: true, text: "pointer" }
    ]
  });
  assert.equal(verdict.ok, false);
  assert.ok(codes(verdict).includes("CLAIM_NAMES_AN_UNKNOWN_PARTITION"));
  assert.ok(codes(verdict).includes("CLAIMED_PARTITION_SET_MISMATCH"));
});

test("an illegal home value is red on its own terms, not silently non-matching", () => {
  const verdict = judge({
    documents: [
      { path: "CLAUDE.md", exists: true, text: block(
        claimRow("TCRN-AOS", "cloud", AWAY_ADDRESS),
        claimRow("cross-project", "local", ".tcrn-workspace/cross-project/workspace")) },
      { path: "AGENTS.md", exists: true, text: "pointer" }
    ]
  });
  assert.equal(verdict.ok, false);
  assert.ok(codes(verdict).includes("CLAIM_HOME_NOT_A_LEGAL_VALUE"));
});

test("documents and roster agreeing does NOT excuse a contradicting measurement", () => {
  // The term no document edit can reach. Without it, this whole gate could be satisfied by
  // keeping a stale roster and stale documents mutually consistent.
  const verdict = judge({
    observations: {
      ...OBSERVATIONS,
      "cross-project": {
        ...OBSERVATIONS["cross-project"],
        localAccepted: false, localReasonCode: "WORKSPACE_RELOCATION_VACATED"
      }
    }
  });
  assert.equal(verdict.ok, false);
  assert.ok(codes(verdict).includes("ROSTER_SAYS_LOCAL_BUT_ENGINE_DOES_NOT_ANSWER_HERE"));
});

test("a resurrected live tree for an away partition is red", () => {
  const verdict = judge({
    observations: {
      ...OBSERVATIONS,
      "TCRN-AOS": {
        ...OBSERVATIONS["TCRN-AOS"],
        localAccepted: true, localReasonCode: "WORKSPACE_COMMAND_COMPLETED"
      }
    }
  });
  assert.equal(verdict.ok, false);
  assert.ok(codes(verdict).includes("ROSTER_SAYS_AWAY_BUT_A_LIVE_TREE_ANSWERS_LOCALLY"));
});

test("a local address holding a different chain is red even though it answers", () => {
  const verdict = judge({
    observations: {
      ...OBSERVATIONS,
      "cross-project": { ...OBSERVATIONS["cross-project"], localWorkspaceId: "workspace:zzz" }
    }
  });
  assert.equal(verdict.ok, false);
  assert.ok(codes(verdict).includes("LOCAL_ADDRESS_HOLDS_A_DIFFERENT_CHAIN"));
});

test("a rostered partition with no observation is red, not assumed fine", () => {
  const verdict = judge({ observations: { "cross-project": OBSERVATIONS["cross-project"] } });
  assert.equal(verdict.ok, false);
  assert.ok(codes(verdict).includes("ROSTERED_PARTITION_NOT_OBSERVED"));
});

test("probing the away host and getting a different chain is red", () => {
  const findings = judgeMeasurement({
    entry: ROSTER[0],
    observation: {
      ...OBSERVATIONS["TCRN-AOS"],
      vmProbed: true, vmAccepted: true, vmWorkspaceId: "workspace:other"
    }
  });
  assert.deepEqual(findings.map((row) => row.code), ["AWAY_HOST_HOLDS_A_DIFFERENT_CHAIN"]);
});

test("probing the away host and getting no answer is red, never a silent pass", () => {
  const findings = judgeMeasurement({
    entry: ROSTER[0],
    observation: {
      ...OBSERVATIONS["TCRN-AOS"],
      vmProbed: true, vmAccepted: false, vmReasonCode: "AWAY_HOST_UNREACHABLE_OR_NON_JSON"
    }
  });
  assert.deepEqual(findings.map((row) => row.code), ["AWAY_HOST_DID_NOT_ANSWER"]);
});

test("a green away verdict without a probe is honest but weaker — no vm finding either way", () => {
  // Documented ceiling, asserted so it cannot silently become a stronger claim: with
  // vmProbed false, refusal at the local address is the whole of the evidence.
  const findings = judgeMeasurement({ entry: ROSTER[0], observation: OBSERVATIONS["TCRN-AOS"] });
  assert.deepEqual(findings, []);
});

test("the parser reads a table a human reads, and reports a malformed one", () => {
  const parsed = parseClaimBlocks(CORRECT_BLOCK);
  assert.equal(parsed.present, true);
  assert.equal(parsed.blocks, 1);
  assert.deepEqual(parsed.claims.map((claim) => claim.partitionId), ["TCRN-AOS", "cross-project"]);
  assert.deepEqual(parsed.malformed, []);

  const short = parseClaimBlocks([
    CLAIM_BLOCK_BEGIN, "| 分区 | home |", "| --- | --- |", "| `x` | `local` |", CLAIM_BLOCK_END
  ].join("\n"));
  assert.equal(short.claims.length, 0);
  assert.equal(short.malformed.length, 1);

  const unterminated = parseClaimBlocks(`${CLAIM_BLOCK_BEGIN}\n| a | b | c | d |\n`);
  assert.equal(unterminated.malformed.length, 1);
  assert.match(unterminated.malformed[0].why, /no matching END/u);
});

test("containment is decided by position, not by whether a block exists somewhere", () => {
  const text = `intro ${AWAY_ADDRESS}\n${CORRECT_BLOCK}\ntail ${AWAY_ADDRESS}\n`;
  const parsed = parseClaimBlocks(text);
  const found = findUncontainedMentions({
    text, path: "d.md", spans: parsed.spans, literals: [AWAY_ADDRESS]
  });
  assert.equal(found.length, 2, "both the sentence before and the one after must be caught");
  assert.deepEqual(found.map((row) => row.literal), [AWAY_ADDRESS, AWAY_ADDRESS]);
});

test("the generic placeholder form is NOT a location claim", () => {
  // `.tcrn-workspace/<分区>/` is prose about the siting convention; matching it would make
  // the containment rule unusable and it would then be turned off.
  const text = "chains are sited under `.tcrn-workspace/<分区>/` on whichever host owns them";
  const found = findUncontainedMentions({ text, path: "d.md", spans: [], literals: LITERALS });
  assert.deepEqual(found, []);
});

// ── STORY-157.3 access-form guard ───────────────────────────────────────────

const SSH_DIRECT = `ssh tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs status --workspace ${AWAY_ADDRESS}"`;

test("findSshDirectEngineCommands spots an ssh-direct-engine command and names its line", () => {
  const text = `header\n\n${SSH_DIRECT}\n`;
  const found = findSshDirectEngineCommands({ text, path: "d.md" });
  assert.equal(found.length, 1);
  assert.equal(found[0].path, "d.md");
  assert.equal(found[0].line, 3);
});

test("ssh for something other than the engine is not an ssh-direct-engine command", () => {
  const text = `ssh tcrn-platform-dev "ls -ld /srv/tcrn/aos-cockpit"`;
  assert.equal(findSshDirectEngineCommands({ text, path: "d.md" }).length, 0);
  assert.equal(SSH_ENGINE_PATTERN.test(text), false);
});

test("a document teaching an unallowlisted ssh-direct command is red and names file + line", () => {
  const verdict = judge({
    documents: [
      { path: "CLAUDE.md", exists: true, text: `# entry\n\n${CORRECT_BLOCK}\n\n复核走 ${SSH_DIRECT}\n` },
      { path: "AGENTS.md", exists: true, text: "# pointer\n" }
    ]
  });
  assert.equal(verdict.ok, false);
  assert.ok(codes(verdict).includes("SSH_DIRECT_ENGINE_COMMAND_NOT_ALLOWLISTED"));
  const finding = verdict.findings.find((row) => row.code === "SSH_DIRECT_ENGINE_COMMAND_NOT_ALLOWLISTED");
  assert.equal(finding.path, "CLAUDE.md");
  assert.ok(typeof finding.line === "number");
});

test("an ssh-direct command matching the break-glass allowlist is not red", () => {
  // The command sits INSIDE the claim block so the containment rule (tested elsewhere)
  // does not fire; this isolates the access-form guard, which is what the allowlist gates.
  const insideBlock = [
    CLAIM_BLOCK_BEGIN, "",
    "| 分区 | home | 真值地址 | 复核命令 |",
    "| --- | --- | --- | --- |",
    claimRow("TCRN-AOS", "vm", AWAY_ADDRESS),
    claimRow("cross-project", "local", ".tcrn-workspace/cross-project/workspace"),
    "",
    `fallback: ${SSH_DIRECT}`,
    "",
    CLAIM_BLOCK_END
  ].join("\n");
  const allowlist = [
    { pattern: `ssh\\s+\\S+\\s+["']node\\s+/srv/tcrn/engine/.*`, reason: "host MCP face unreachable fallback", since: "2026-08-05" }
  ];
  const verdict = judge({
    sshAllowlist: allowlist,
    documents: [
      { path: "CLAUDE.md", exists: true, text: `# entry\n\n${insideBlock}\n` },
      { path: "AGENTS.md", exists: true, text: "# pointer\n" }
    ]
  });
  assert.equal(verdict.ok, true, JSON.stringify(verdict.findings));
});

test("sshCommandAllowlisted matches by regex pattern and ignores a malformed one", () => {
  assert.equal(sshCommandAllowlisted(SSH_DIRECT, [{ pattern: "tcrn-workflow\\.mjs", reason: "x", since: "2026-08-05" }]), true);
  assert.equal(sshCommandAllowlisted(SSH_DIRECT, [{ pattern: "(unclosed", reason: "x", since: "2026-08-05" }]), false);
  assert.equal(sshCommandAllowlisted(SSH_DIRECT, [{ reason: "no pattern" }]), false);
});

// ── INC-051: break-glass allowlist schema + two-consumer agreement ───────────

test("every break-glass allowlist entry carries class, pattern, reason and since, and the pattern compiles (INC-051)", () => {
  const allowlist = JSON.parse(readFileSync(resolve(REPO_ROOT, "deploy/aos-local-client/ssh-breakglass-allowlist.json"), "utf8"));
  assert.ok(Array.isArray(allowlist.entries) && allowlist.entries.length >= 2, "the two decided classes must have real entries (enforce precondition)");
  for (const entry of allowlist.entries) {
    assert.ok(typeof entry.class === "string" && entry.class.length > 0, "entry needs a class");
    assert.ok(typeof entry.pattern === "string" && entry.pattern.length > 0, "entry needs a pattern");
    assert.match(entry.since, /^\d{4}-\d{2}-\d{2}$/u, "entry needs a since date");
    assert.ok(typeof entry.reason === "string" && entry.reason.length > 0, "entry needs a reason");
    assert.doesNotThrow(() => new RegExp(entry.pattern, "u"), `pattern must compile: ${entry.pattern}`);
  }
});

test("a documented break-glass command matching an entry is allowlisted (both consumers agree on the full line)", () => {
  const allowlist = JSON.parse(readFileSync(resolve(REPO_ROOT, "deploy/aos-local-client/ssh-breakglass-allowlist.json"), "utf8")).entries;
  const statusCmd = `ssh tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs status --workspace /srv/tcrn/governance/x"`;
  const proseCmd = `break-glass: ${statusCmd}`;
  const evilCmd = `ssh tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs work-transition --id work:x --status done"`;
  assert.equal(sshCommandAllowlisted(statusCmd, allowlist), true, "the bare break-glass command must be allowed");
  assert.equal(sshCommandAllowlisted(proseCmd, allowlist), true, "the same command inside prose must be allowed too (doc-topology matches the full line)");
  assert.equal(sshCommandAllowlisted(evilCmd, allowlist), false, "a write via ssh must NOT be allowlisted");
});

test("findSshDirectEngineCommands reports the FULL command line, not a truncated fragment (INC-051)", () => {
  const text = `line before\nbreak-glass: ssh tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs status --workspace /srv/tcrn/governance/x"\nafter`;
  const found = findSshDirectEngineCommands({ text, path: "d.md" });
  assert.equal(found.length, 1);
  assert.ok(found[0].command.includes("--workspace"), "the full command (with verb flags) must be what the allowlist matches");
  assert.equal(found[0].line, 2);
});
