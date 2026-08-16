# 代理原文 · aos-mcp-write 写面深审(general-purpose,只读)

收录:2026-08-06 · INIT-019 验收 · 评审范围 `git diff 24644aa..HEAD -- deploy/aos-mcp-write deploy/aos-local-client/ceremony.mjs deploy/aos-local-client/ceremony-plan.mjs` 及五文件全文。
原文除宿主路径打码(`<平台根>`/`~`)与 HTML 实体还原外未改动。对应拆单:INC-047(发现 1/2/3)、INC-051(其余)。

---

Review complete. Nothing in the repository was modified; all probes ran in the scratchpad.

## Findings

**1. P1 — `deploy/aos-mcp-write/server.mjs:231-235` — a ceremony that *throws* leaves no receipt at all**
`await this.#perform(...)` is not wrapped; the receipt is only written on the line after it returns. Every transport/precondition failure throws out of `runCeremony` rather than returning a receipt: `readChainHead` (ceremony.mjs:103), `readKnowledgeMarker` (ceremony.mjs:129 — now reachable from any knowledge step), `aosPartition`, `assertAttributedActor`.
Failure scenario: a 3-step batch where step 1 lands and the SSH connection drops before step 2's head read → tool answers `{"ok":false,"reasonCode":"MCP_INTERNAL_ERROR"}` with no `partition`, no `chainBefore/chainAfter`, no `receiptPath`; an orphan payload file is left in tracked `evidence/`; the caller cannot tell whether 0, 1, or 3 steps landed. This is the exact case the receipt exists for.
Verified: ran the real `CeremonyDispatcher` with a `perform` that throws `"the host engine refused to report status: 255"` → `payloads dir: [ '...json' ]`, `receipts dir: ABSENT`.

**2. P1 — `deploy/aos-mcp-write/server.test.mjs:102-181` — `dryRun` and `partition` pass-through are untestable (恒绿)**
`makeDispatcher`'s injected `perform` is `async () => ({...})` — it captures no arguments, and the test asserts `result.structuredContent.dryRun/partition`, which are echoed from the dispatcher's own local variables, not from what the ceremony received.
Verified by mutation: I copied `server.mjs` to the scratchpad with `this.#perform({ payloadPath, dryRun: false, partition: "TCRN-AOS" })` — i.e. a write face that performs a **real write when the caller asked for a dry run** and writes to the **AOS chain when the caller asked for TCRN-TMS** — and ran the unmodified test file against it: `pass 11, fail 0`. The two arguments that decide "does this mutate" and "which chain" have no falsifiable gate.

**3. P1 — `deploy/aos-mcp-write/knowledge-inject.test.mjs:10` + `package.json:11` — the test roster imports out of the repository**
The import is `"../../../tcrn-workflow/scripts/knowledge-inject.mjs"`, which resolves to `<平台根>/tcrn-workflow/scripts/knowledge-inject.mjs` — a *sibling repository*. Only the test file is tracked in TCRN-AOS (`git ls-files | grep knowledge-inject` → 1 hit, the test). Since `pnpm test` runs the whole roster in one `node --test` invocation, a standalone clone of `github.com/tpmoonchefryan/TCRN-AOS` cannot run the suite at all.
Verified: reproduced a lone clone in a temp dir (`deploy/aos-mcp-write/knowledge-inject.test.mjs` only) → `ERR_MODULE_NOT_FOUND ... /tcrn-workflow/scripts/knowledge-inject.mjs`. There is no `.github/` in this repo, so nothing catches it; `scripts/lib/verify-self-sufficiency.mjs` only judges `dist/` ordering, not out-of-repo imports.

**4. P2 — `deploy/aos-local-client/ceremony.mjs:342-343` — the auto-rebase error text is always the empty string**
`result.stderr?.trim() ?? result.stdout?.trim() ?? ""` is read off `remoteEngine`'s return value, which is `{accepted, exitCode, reasonCode, json, raw}` (ceremony.mjs:90-96) — it has neither `stderr` nor `stdout`. The engine's own message lives in `result.raw` / `result.json.error`.
Failure scenario: auto-rebase refused with non-JSON output → receipt records `reasonCode: "NON_JSON_OUTPUT"`, `error: ""`, and the diagnosis is gone. Latent today (no committed receipt shows a refused rebase). The copy-paste source is 20 lines up in the same file: `readKnowledgeMarker` legitimately reads `result.stderr` because `ssh()` *does* return it.

**5. P2 — `ceremony.mjs:286-291` — the new non-record readback branch reopens the "the read succeeded" tautology**
For verbs with no `record`/`advisory` (knowledge-list, knowledge-freshness) the observed value is now the whole engine envelope, status field included. `judgeReadback` (ceremony-plan.mjs:240-255) exists specifically to refuse "I read my own success out of a 200" (its comment cites STORY-132 paying for it).
Verified: `judgeReadback({expected:{reasonCode:"KNOWLEDGE_LIST_READY"}, observed:{reasonCode:"KNOWLEDGE_LIST_READY",total:0,...}})` → `{"ok":true,"reasonCode":"READBACK_MATCHES_FULL_VALUE"}`. Pre-diff this was unreachable (`{...undefined, ...undefined}` = `{}` → `READBACK_DIVERGENT`), so the diff introduced it. Suggested fix: drop envelope keys (`reasonCode`, `schemaVersion`) from the observed view.

**6. P2 — `ceremony-plan.mjs:171-172` — a payload may name `actor` and `at`, contradicting the file's own header**
`if (command.flags.has("actor") && !Object.hasOwn(given, "actor"))` — payload wins. `assertAttributedActor` (ceremony.mjs:59-69) only validates `payload.actor ?? ACTOR`, never a step-level one. `ceremony-plan.mjs:20-25` states "a payload may NOT override the first three" (workspace, attest-dir, **actor**); AOS `CLAUDE.md` says the ceremony supplies `--actor`/`--at` "from one place".
Verified with the real `planStep`: `flags:{actor:"owner:someone-else"}` → planned with `--actor owner:someone-else`; `flags:{at:"1999-01-01T00:00:00Z"}` → planned with that instant. The engine validates actor *format* only (`assertActorId`, prefixes owner|profile|agent) and never checks timestamp monotonicity (`appendEvent` → `assertStrictInstant`, workspace.ts:2617), so both land on the chain verbatim.

**7. P2 — `ceremony.mjs:321-357` — the auto-rebase is an unrequested mutating write with no read-back**
Every successful non-dry-run ceremony now drives `knowledge-rebase` against the target chain, whatever the payload asked for. It is outside `payload.steps`, no readback covers it, it cannot fail the ceremony (`receipt.ok` stays true, `reasonCode` stays `CEREMONY_COMPLETED_AND_READ_BACK`), and `SPEC.md` — which the server calls "THE CONTRACT" (server.mjs:34) — does not mention it. The single invariant this face exists to enforce is "a write nobody read back is not proven"; this write is exempt from it by construction.

**8. P2 — `server.mjs:229` vs `server.mjs:235` — the payload is materialised unscrubbed, the receipt is scrubbed, and both are committed**
`writeFileSync(payloadPath, JSON.stringify(payload,null,2))` has no `scrubHostPaths`; the receipt on the next line does. All 45 payloads are tracked (`git ls-files evidence/mcp-ceremony-write`). `evidence-hygiene.mjs:11-15` states the doctrine — emitters scrub so evidence is "born clean", the scanner is the backstop. Here only the backstop exists, and its effect is a hard red in `pnpm test` after the file is already written. A caller-supplied `intent`/`body` quoting a local path (INC-037's exact shape) reaches disk unredacted.

**9. P2 — `ceremony-plan.mjs:34` — `RESERVED_FLAGS` is the hardcoded list the same file argues against**
Lines 59-73 derive the one-shot authority family from catalogue *shape* precisely because "a list of command names goes stale in the PERMISSIVE direction". `RESERVED_FLAGS` is three literal strings, while engine 0.10.2 has a fourth caller-chosen CAS sentinel: `--expected-revision` (required on knowledge-promote/retire/reverify, cli/index.ts:746-749). It ships payload-supplied today — receipt `2026-08-05T14-39-56-375Z-f6ba53-TCRN-AOS.json:56-57` shows `fromPayload: ["expected-revision", ...]`. Not exploitable (the engine's CAS still refuses a wrong revision), but the SPEC's promise "sentinel comes from a live read" is true only of `expected-version`, and a future `expected-*` flag is admitted silently.

**10. P3 — `server.mjs:345` — the `catalog` argument is dead**
`runRemoteReadMcpStdio(..., { tools: [ceremonyToolDescriptor()] }, new CeremonyDispatcher())`: the third parameter is only used to build the *default* dispatcher (`remote-read-mcp.mjs:886-887`), which is never constructed here. It reads as if it configures the exposed tool set; editing it would change nothing.

**11. P3 — inherited transport semantics, unchanged for a write face** — `MAX_IN_FLIGHT = 8` (`remote-read-mcp.mjs:878`) means up to 8 ceremonies interleave in one server process; two batches against one chain will trade CAS mismatches mid-batch, and the loser's receipt reads like a payload defect rather than a concurrency event. Separately, an oversized line (`MAX_LINE_BYTES` 1 MiB, e.g. a large knowledge `body`) throws out of the read loop and **kills the server process** instead of refusing one request.

**12. P3 — `server.mjs:244-245` — `relative(REPO_ROOT, …)` without the guard its sibling documents**
`ceremony.mjs:78-81` deliberately reports `<outside-repository>` instead of a `../../..` walk, "because the relative form would leak the same host structure the absolute form does, one segment at a time". The server's two `relative()` calls have no such guard and are not scrubbed on the success path. Only reachable with a non-default `writeRoot` — which is exactly what the tests use.

**13. P3 — SPEC.md drift** — (a) `payload` is documented and schema-declared as `object`, but a JSON *string* is also accepted and parsed (server.mjs:211-218); (b) the refusal table has no row for `MCP_INTERNAL_ERROR`, `MCP_ARGUMENT_UNKNOWN` or `MCP_TOOL_UNKNOWN` — and per finding 1, `MCP_INTERNAL_ERROR` is the code a caller actually sees when the host drops; (c) row 9 says host-unreachable ⇒ `HOST_CATALOGUE_UNAVAILABLE`, true only for the first call of a run; (d) `knowledgeRebase` is absent entirely.

**14. P3 — `ceremony.mjs:59-69` — the local actor gate accepts a shape the engine rejects**
`assertAttributedActor` allows `person:<id>` and its error text recommends `person:owner:governance`. The engine's `ACTOR_PREFIXES` is `{owner, profile, agent}` and `assertProtocolId` (`protocol/src/index.ts:322`) forbids a second colon, so that value fails twice at the host. Pre-existing, but it is the message an operator is told to follow.

**15. P3 — `knowledge-inject.test.mjs:42-46`** — a test named "never grows the output past the budget" asserts `<= 500 + 3`. Real worst case for `Buffer.subarray().toString("utf8")` is +2 (one U+FFFD replacing a 1-byte remnant of a 3-byte char), so the predicate can never fail for the overflow it is named after.

**16. P3 — `ceremony.mjs:207-211` — `readHeadFirst:false` is a payload-controlled sentinel knob** absent from SPEC.md: it downgrades "read immediately before this step" to "read at ceremony start". Fail-closed (the engine CAS refuses a stale value), but for a knowledge verb it silently supplies the **chain** version where the marker is required.

## 亮点

1. **The reserved-flag rejection face is genuinely closed against key-shaped smuggling.** I probed nine constructive variants against the real `planStep`: attached form as a key (`"expected-version=1"`), case variants (`"Expected-Version"`), JSON-parsed `__proto__`, an array in place of `flags`, nested objects — every one refused with a named code (`FLAG_NOT_DEFINED_BY_VERB` / `RESERVED_FLAG_IN_PAYLOAD`), and no prototype pollution (`({}).polluted === undefined`). The allowlist-by-catalogue design is what makes this hold, not the reserved list.
2. **No string concatenation reaches a shell, and I checked the far end too.** Locally it is `execFile("ssh", ["-n", host, ...])`; remotely every token goes through `shellQuote`. Cross-reading the engine's own parser (`packages/cli/src/index.ts:256-292`) confirms the two-token form rejects any value beginning with `--`, so a flag value cannot become a flag — the injection surface is closed on both sides, not just quoted on one.
3. **The committed evidence is clean.** 45 receipts + 45 payloads scanned for `<local-home> the account name, dash-encoded home paths, private keys, IPs, `.lan` names, tokens/secrets — zero hits, and zero `<local-*>` placeholders (nothing needed redacting in the first place). I read five receipts end to end, including a genuine `READBACK_DIVERGENT` red.
4. **`KNOWLEDGE_STORE_CAS_VERBS` is exactly right, not approximately right.** The five declared verbs are precisely the knowledge verbs that declare `--expected-version` in engine 0.10.2's catalogue (`cli/index.ts:741-749`); `knowledge-checkpoint` and `knowledge-init` correctly do not appear because they take no sentinel.

## 总体判词

The *decision* half of this write face is the strong half: refusals are derived from the host catalogue rather than remembered, the smuggling surface I could construct is closed on both the wrapper and the engine side, and the shipped evidence is clean enough to publish. The weaknesses are all on the other three halves — **what happens when it breaks** (a dropped SSH connection produces no receipt at all, which is the one moment a receipt is worth having), **what proves it works** (the two arguments that decide "does this mutate" and "which chain" survive a mutation test untouched, and the new non-record readback branch lets `reasonCode` stand in for evidence), and **what it does that nobody asked for** (an auto-rebase write outside the payload contract, exempt from the read-back invariant and absent from a SPEC the server itself calls the contract). None of these endanger chain integrity — the engine's CAS and lease are doing the real enforcing — but three of them (1, 2, 8) are about the proof artifacts of this repository, and I would close those before this branch is pushed.
