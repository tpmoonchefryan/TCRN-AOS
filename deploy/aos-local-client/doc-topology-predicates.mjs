// TCRN-AOS-STORY-136 — the judgement: does a document's stated truth location match the
// machine's actual one?
//
// Pure. Inputs are (document texts, roster, observations); no disk, no network, no engine.
// That is what lets the same judgement run in `pnpm test` against literals and, in
// `doc-topology-proof.mjs`, against this platform's real files and a real engine probe.
// Neither run substitutes for the other: the test proves the judgement is right about
// data, the proof proves it is right about today.
//
// THREE TERMS, IN ORDER OF AUTHORITY. This matters, because a two-term check would be
// satisfiable by editing whichever of the two is easier to edit:
//
//   1. the DOCUMENT claims a home and an address (the thing that drifts);
//   2. the ROSTER declares the same (topology.mjs — one place, already consumed by the
//      ceremony and by local-purity);
//   3. the MEASUREMENT is the engine's own answer at an address (the authority).
//
// A document is wrong when it disagrees with the roster. The ROSTER is wrong when it
// disagrees with the measurement — and that finding is emitted too, so this gate cannot be
// satisfied by keeping a stale roster and stale docs mutually consistent.

const HOMES = Object.freeze(["local", "vm"]);

/**
 * The block markers live HERE, with the parser, and the registry imports them.
 *
 * They are a property of the claim FORMAT, not of the platform's topology, and a second
 * copy beside the roster would be one more pair of strings that has to agree — the class
 * of defect this whole file is about.
 */
export const CLAIM_BLOCK_BEGIN = "<!-- TOPOLOGY-CLAIMS:BEGIN -->";
export const CLAIM_BLOCK_END = "<!-- TOPOLOGY-CLAIMS:END -->";

const stripCell = (cell) => cell.trim().replace(/^`+|`+$/gu, "").trim();

/**
 * Claim rows out of one document's text.
 *
 * The block is a VISIBLE markdown table between two HTML-comment markers, and that is a
 * deliberate choice over an invisible metadata block: a machine-readable claim the reader
 * cannot see is a second copy of the fact, and this whole story exists because two copies
 * of a fact disagree eventually. The machine parses exactly the rows a human reads.
 *
 * Returns `{ present, malformed, claims, blocks }`. `malformed` is reported rather than
 * thrown so that one bad table in one document does not hide the verdict on the others.
 */
export function parseClaimBlocks(text, { path = "<memory>" } = {}) {
  const begin = CLAIM_BLOCK_BEGIN;
  const end = CLAIM_BLOCK_END;
  const claims = [];
  const malformed = [];
  const spans = [];

  let cursor = 0;
  for (;;) {
    const from = text.indexOf(begin, cursor);
    if (from < 0) break;
    const to = text.indexOf(end, from + begin.length);
    if (to < 0) {
      malformed.push({ path, why: "BEGIN marker with no matching END marker" });
      break;
    }
    const body = text.slice(from + begin.length, to);
    spans.push({ start: from, end: to + end.length });
    cursor = to + end.length;

    const rows = body.split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("|"))
      // A markdown table's separator row is structural, and so is its header. Both are
      // dropped by shape rather than by index, because a table that grows a caption line
      // would silently shift index-based skipping by one.
      .filter((line) => !/^\|[\s|:-]+\|$/u.test(line));

    let sawHeader = false;
    for (const line of rows) {
      const cells = line.replace(/^\|/u, "").replace(/\|$/u, "").split("|").map(stripCell);
      if (!sawHeader) { sawHeader = true; continue; }
      if (cells.length !== 4) {
        malformed.push({ path, why: `claim row has ${cells.length} cells, expected 4`, line });
        continue;
      }
      const [partitionId, home, address, recheckCommand] = cells;
      claims.push({ path, partitionId, home, address, recheckCommand });
    }
    if (!sawHeader) malformed.push({ path, why: "claim block contains no table" });
  }

  return { present: spans.length > 0, blocks: spans.length, spans, claims, malformed };
}

/** Every index at which `needle` occurs in `text`. */
function occurrences(text, needle) {
  const hits = [];
  let at = text.indexOf(needle);
  while (at >= 0) { hits.push(at); at = text.indexOf(needle, at + needle.length); }
  return hits;
}

/**
 * Concrete addresses appearing OUTSIDE every claim block in one document.
 *
 * `spans` are the byte ranges the claim blocks occupy, so containment is decided by
 * POSITION, not by whether the document happens to have a block somewhere. A document with
 * a correct block and a stale sentence three screens further down is the exact shape that
 * cost this platform twice, and it must red.
 */
export function findUncontainedMentions({ text, path, spans, literals }) {
  const inside = (index) => spans.some((span) => index >= span.start && index < span.end);
  const findings = [];
  for (const literal of literals) {
    for (const at of occurrences(text, literal)) {
      if (inside(at)) continue;
      const lineNumber = text.slice(0, at).split("\n").length;
      findings.push({ path, literal, line: lineNumber });
    }
  }
  return findings;
}

/**
 * The access-form guard (TCRN-CROSS-INIT-019 STORY-157.3, D1/D9).
 *
 * A registered document may not teach SSH-direct-engine CLI invocation unless that exact
 * command is allowlisted. Reads go through the MCP read face, writes through the ceremony;
 * SSH direct is break-glass only, and the two residual classes live in
 * `deploy/aos-local-client/ssh-breakglass-allowlist.json`. The allowlist is passed in as
 * data so this judge stays pure; an entry matches when its `pattern` (a regex string)
 * matches the command text.
 */
export const SSH_ENGINE_PATTERN = /ssh\s+[A-Za-z0-9._-]+\s+['"]node\s+\S*tcrn-workflow\.mjs/gu;

export function findSshDirectEngineCommands({ text, path }) {
  const findings = [];
  for (const match of text.matchAll(SSH_ENGINE_PATTERN)) {
    const lineNumber = text.slice(0, match.index).split("\n").length;
    findings.push({ path, line: lineNumber, command: match[0].slice(0, 160) });
  }
  return findings;
}

export function sshCommandAllowlisted(command, allowlist) {
  return (allowlist ?? []).some((entry) => {
    if (typeof entry?.pattern !== "string") return false;
    let re;
    try { re = new RegExp(entry.pattern, "u"); } catch { return false; }
    return re.test(command);
  });
}

/**
 * The measurement, turned into a verdict about one partition's home.
 *
 * `observation` is what `observeDocTopology` produced for this partition:
 *   localAddress, localAccepted, localReasonCode, localWorkspaceId,
 *   vmProbed, vmAccepted, vmReasonCode, vmWorkspaceId
 *
 * The two directions are NOT symmetric and are deliberately written out rather than
 * folded into one comparison:
 *   home=local — the engine must ANSWER at the local address and the chain there must be
 *                the one the roster names. Silence is not evidence of anything.
 *   home=vm    — the engine must REFUSE at the local address. A live tree here for a
 *                partition whose truth moved away is the defect STORY-133 exists to catch,
 *                and this gate re-asserts it from the documentation side.
 */
export function judgeMeasurement({ entry, observation }) {
  const findings = [];
  if (entry.home === "local") {
    if (observation.localAccepted !== true) {
      findings.push({
        code: "ROSTER_SAYS_LOCAL_BUT_ENGINE_DOES_NOT_ANSWER_HERE",
        partitionId: entry.partitionId,
        expected: "WORKSPACE_COMMAND_COMPLETED",
        observed: observation.localReasonCode ?? "NO_ANSWER"
      });
    } else if (observation.localWorkspaceId !== entry.workspaceId) {
      findings.push({
        code: "LOCAL_ADDRESS_HOLDS_A_DIFFERENT_CHAIN",
        partitionId: entry.partitionId,
        expected: entry.workspaceId,
        observed: observation.localWorkspaceId ?? null
      });
    }
    return findings;
  }

  if (observation.localAccepted === true) {
    findings.push({
      code: "ROSTER_SAYS_AWAY_BUT_A_LIVE_TREE_ANSWERS_LOCALLY",
      partitionId: entry.partitionId,
      expected: "a refusal at the local address",
      observed: observation.localReasonCode ?? "ACCEPTED"
    });
  }
  if (observation.vmProbed === true) {
    if (observation.vmAccepted !== true) {
      findings.push({
        code: "AWAY_HOST_DID_NOT_ANSWER",
        partitionId: entry.partitionId,
        expected: "WORKSPACE_COMMAND_COMPLETED at the declared away address",
        observed: observation.vmReasonCode ?? "NO_ANSWER"
      });
    } else if (observation.vmWorkspaceId !== entry.workspaceId) {
      findings.push({
        code: "AWAY_HOST_HOLDS_A_DIFFERENT_CHAIN",
        partitionId: entry.partitionId,
        expected: entry.workspaceId,
        observed: observation.vmWorkspaceId ?? null
      });
    }
  }
  return findings;
}

/**
 * The whole judgement.
 *
 * @param documents  [{ path, text, exists }]  — registry order, texts as read
 * @param registry   the DOC_REGISTRY rows
 * @param roster     PARTITION_ROSTER
 * @param literals   forbiddenOutsideClaimBlocks(roster)
 * @param observations { [partitionId]: observation }  — may be {} for a pure-data run,
 *                     in which case measurement findings are skipped and `measured` is
 *                     false. It is recorded, never implied: an unmeasured green must not
 *                     read like a measured one.
 * @param localAddressOf (partitionId) => the local siting address, as written in claims
 */
export function judgeDocTopology({
  documents, registry, roster, literals, observations = {}, localAddressOf, sshAllowlist = []
}) {
  const findings = [];
  const perDocument = [];

  const rosterOf = (partitionId) => roster.find((entry) => entry.partitionId === partitionId) ?? null;

  for (const rule of registry) {
    const document = documents.find((candidate) => candidate.path === rule.path) ?? null;
    if (document === null || document.exists !== true) {
      findings.push({ code: "REGISTERED_DOCUMENT_MISSING", path: rule.path });
      perDocument.push({ path: rule.path, exists: false, claims: 0 });
      continue;
    }

    const parsed = parseClaimBlocks(document.text, { path: rule.path });
    for (const bad of parsed.malformed) {
      findings.push({ code: "CLAIM_BLOCK_MALFORMED", path: rule.path, why: bad.why, line: bad.line });
    }

    if (rule.mustCarryClaims === true && parsed.present !== true) {
      findings.push({
        code: "REQUIRED_CLAIM_BLOCK_ABSENT",
        path: rule.path,
        expected: [...rule.expectedPartitions]
      });
    }

    if (rule.mustCarryClaims === true && parsed.present === true) {
      const declared = [...new Set(parsed.claims.map((claim) => claim.partitionId))].sort();
      const expected = [...rule.expectedPartitions].sort();
      if (declared.join("/") !== expected.join("/")) {
        findings.push({
          code: "CLAIMED_PARTITION_SET_MISMATCH",
          path: rule.path, expected, observed: declared
        });
      }
    }

    // A document not required to carry claims is still not allowed to carry WRONG ones.
    // Otherwise "not required" would read as "not checked", and the cheapest way to keep
    // this gate quiet would be to demote a document in the registry.
    for (const claim of parsed.claims) {
      const entry = rosterOf(claim.partitionId);
      if (entry === null) {
        findings.push({
          code: "CLAIM_NAMES_AN_UNKNOWN_PARTITION",
          path: rule.path, partitionId: claim.partitionId,
          expected: roster.map((row) => row.partitionId)
        });
        continue;
      }
      if (!HOMES.includes(claim.home)) {
        findings.push({
          code: "CLAIM_HOME_NOT_A_LEGAL_VALUE",
          path: rule.path, partitionId: claim.partitionId,
          expected: HOMES, observed: claim.home
        });
      } else if (claim.home !== entry.home) {
        findings.push({
          code: "CLAIMED_HOME_CONTRADICTS_ROSTER",
          path: rule.path, partitionId: claim.partitionId,
          expected: entry.home, observed: claim.home
        });
      }

      const expectedAddress = entry.home === "vm" ? entry.liveAddress : localAddressOf(entry.partitionId);
      if (claim.address !== expectedAddress) {
        findings.push({
          code: "CLAIMED_ADDRESS_CONTRADICTS_ROSTER",
          path: rule.path, partitionId: claim.partitionId,
          expected: expectedAddress, observed: claim.address
        });
      }
      if (!claim.recheckCommand.includes(claim.address)) {
        findings.push({
          code: "RECHECK_COMMAND_DOES_NOT_NAME_THE_CLAIMED_ADDRESS",
          path: rule.path, partitionId: claim.partitionId,
          expected: `a command containing ${claim.address}`,
          observed: claim.recheckCommand.slice(0, 120)
        });
      }
    }

    for (const mention of findUncontainedMentions({
      text: document.text, path: rule.path, spans: parsed.spans, literals
    })) {
      findings.push({ code: "ADDRESS_STATED_OUTSIDE_A_CLAIM_BLOCK", ...mention });
    }

    for (const hit of findSshDirectEngineCommands({ text: document.text, path: rule.path })) {
      if (!sshCommandAllowlisted(hit.command, sshAllowlist)) {
        findings.push({ code: "SSH_DIRECT_ENGINE_COMMAND_NOT_ALLOWLISTED", ...hit });
      }
    }

    perDocument.push({
      path: rule.path,
      exists: true,
      mustCarryClaims: rule.mustCarryClaims === true,
      blocks: parsed.blocks,
      claims: parsed.claims.length,
      partitions: [...new Set(parsed.claims.map((claim) => claim.partitionId))].sort()
    });
  }

  const measured = Object.keys(observations).length > 0;
  if (measured) {
    for (const entry of roster) {
      const observation = observations[entry.partitionId];
      if (observation === undefined) {
        findings.push({ code: "ROSTERED_PARTITION_NOT_OBSERVED", partitionId: entry.partitionId });
        continue;
      }
      findings.push(...judgeMeasurement({ entry, observation }));
    }
  }

  return {
    ok: findings.length === 0,
    reasonCode: findings.length === 0
      ? (measured ? "DOC_TOPOLOGY_CLAIMS_MATCH_MEASUREMENT" : "DOC_TOPOLOGY_CLAIMS_MATCH_ROSTER")
      : "DOC_TOPOLOGY_CLAIM_DRIFTED",
    measured,
    findings,
    findingCodes: [...new Set(findings.map((finding) => finding.code))].sort(),
    perDocument,
    counts: {
      documents: perDocument.length,
      documentsCarryingClaims: perDocument.filter((row) => (row.claims ?? 0) > 0).length,
      claims: perDocument.reduce((total, row) => total + (row.claims ?? 0), 0)
    }
  };
}
