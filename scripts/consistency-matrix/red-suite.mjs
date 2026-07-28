#!/usr/bin/env node
// The red suite (EPIC-033 / STORY-116): one deliberate perturbation per
// matrix column, each with a PREDICTED reason code, each run on a disposable
// scratch chain, each recorded as {perturbation, expectedCode, actualCode}.
//
// Why this file exists at all: a predicate whose two sides cannot differ is
// not a gate, it is a painting of a gate. This platform has produced three
// always-green gates in a single day (same-inode operands, fixtures that
// could not fail, prose-pattern predicates), all caught only because someone
// forced the red. So every column's criterion is forced red here, on scratch
// copies, before its green on the real comparison is allowed to count.
// A predicted code that does not match the received code is a FINDING, never
// a rounding error.
//
// The perturbations:
//   C1   trailing space appended to a copied control-tree file  → SNAPSHOT_MISMATCH
//   C2   event segment re-serialized with indentation (same
//        semantics, different bytes)                            → WORKSPACE_EVENT_CORRUPT
//   C3a  payload tampered, hashes left alone                    → EVENT_CHAIN_CORRUPT
//   C3b  hash-self-consistent forged event appended and INGESTED
//        into the A mirror: C3 stays GREEN (keyless hashes cannot
//        see it) while the DRIVER's R3C4 mutual cell goes RED —
//        the pair proves the blind spot is real and that C4 is
//        its deliberate cover, not a redundant column
//   C1/C4 driver-cell adjudication: a prefix-short mirror plus a
//        sidecar set missing one file — R1C1 / R2C4 / R4C4 / R5C4
//        forced red BY THE DRIVER'S OWN CELLS, never by a digest
//        comparison reimplemented inside this suite
//   R5   actor stripped from a post-enable event, hashes
//        recomputed forward so the chain stays self-consistent  → WORKSPACE_ACTOR_REQUIRED
//        (proves the attestation criterion holds independently
//        of the hash criterion instead of riding on it)
//   R1   UPDATE / DELETE against the A-side mirror rows         → append-only triggers abort
//        (accidental writes only — see the DROP-then-rewrite case
//        for the trigger's honest limit and who covers it)
//   R1   triggers DROPped, a row rewritten                      → EVENT_MIRROR_TRIGGERS_MISSING
//        + the full matrix goes red on the rewritten bytes
//   NA   an extra table in the mirror db defeats the derived
//        container kind, R4C1's n/a loses its authority         → NA_OUT_OF_WHITELIST
//
// Perturbation targets are always engine-authored bytes on scratch chains
// built fresh per case; the live partitions are never read, let alone touched.

import { readFileSync, writeFileSync, readdirSync, cpSync, rmSync, statSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadJudges } from "./run-matrix.mjs";
import { buildScratchChain, destroyScratch } from "./scratch-chain.mjs";

function cliRaw(engineRoot, args) {
  // Unlike the driver's read-only wrapper this returns {code, parsed} because
  // the whole point here is commands that FAIL, with which reason code.
  try {
    const stdout = execFileSync(process.execPath,
      [join(engineRoot, "scripts/tcrn-workflow.mjs"), ...args],
      { cwd: engineRoot, maxBuffer: 16 * 1024 * 1024, encoding: "utf8" });
    return { exitCode: 0, body: JSON.parse(stdout) };
  } catch (error) {
    const text = String(error.stdout ?? "") + String(error.stderr ?? "");
    const match = text.match(/"reasonCode"\s*:\s*"([A-Z_]+)"/u);
    return { exitCode: error.status ?? 1, body: null, reasonCode: match?.[1] ?? null, raw: text.slice(0, 300) };
  }
}

function segmentPath(workspace) {
  const dir = join(workspace, ".tcrn-workflow/events");
  const name = readdirSync(dir).filter((entry) => entry.endsWith(".json")).sort()[0];
  return join(dir, name);
}

export async function runRedSuite(scratchRoot) {
  const judges = await loadJudges();
  const cases = [];
  const record = (entry) => {
    cases.push({ ...entry, matched: entry.expectedCode === entry.actualCode });
  };

  // ---- C1: byte equality --------------------------------------------------
  {
    const chain = buildScratchChain(scratchRoot, { label: "red-c1" });
    try {
      const manifestPath = join(chain.root, "manifest.json");
      writeFileSync(manifestPath, execFileSync(process.execPath,
        [join(chain.engineRoot, "scripts/tcrn-workflow.mjs"), "snapshot-manifest",
          "--workspace", chain.workspace, "--at", "2026-07-28T00:10:00Z"],
        { cwd: chain.engineRoot, encoding: "utf8" }));
      const copyRoot = join(chain.root, "copy");
      cpSync(join(chain.workspace, ".tcrn-workflow"), join(copyRoot, ".tcrn-workflow"), { recursive: true });
      // Prove the perturbation target is NOT the original (the same-inode trap):
      const original = statSync(segmentPath(chain.workspace));
      const copied = statSync(segmentPath(copyRoot));
      const distinct = !(original.dev === copied.dev && original.ino === copied.ino);
      appendFileSync(segmentPath(copyRoot), " ");
      const verify = cliRaw(chain.engineRoot, ["snapshot-verify", "--root", copyRoot, "--manifest", manifestPath]);
      record({
        column: "C1",
        perturbation: "对快照副本的事件段文件尾部追加一个空格(副本与原件经 stat 证非同 inode)",
        expectedCode: "SNAPSHOT_MISMATCH",
        actualCode: verify.reasonCode ?? verify.body?.reasonCode ?? null,
        copyDistinctInode: distinct
      });
    } finally { destroyScratch(chain.root); }
  }

  // ---- C2: canonical-form equality ---------------------------------------
  {
    const chain = buildScratchChain(scratchRoot, { label: "red-c2" });
    try {
      const path = segmentPath(chain.workspace);
      const events = JSON.parse(readFileSync(path, "utf8"));
      // Same semantics, different bytes: indentation only.
      writeFileSync(path, `${JSON.stringify(events, null, 2)}\n`);
      const validate = cliRaw(chain.engineRoot, ["validate", "--workspace", chain.workspace]);
      record({
        column: "C2",
        perturbation: "事件段 JSON 重排版(加缩进,语义不变、字节非规范形)后原位写回",
        expectedCode: "WORKSPACE_EVENT_CORRUPT",
        actualCode: validate.reasonCode ?? validate.body?.reasonCode ?? null
      });
    } finally { destroyScratch(chain.root); }
  }

  // ---- C3(a): payload tampered, hashes untouched --------------------------
  {
    const chain = buildScratchChain(scratchRoot, { label: "red-c3a" });
    try {
      const path = segmentPath(chain.workspace);
      const events = JSON.parse(readFileSync(path, "utf8"));
      events[0].payload.record.name = "Tampered probe name";
      // Written back CANONICALLY so C2 cannot be the thing that fires; the
      // only lie left is the payload-vs-payloadHash one.
      writeFileSync(path, judges.canonicalJson(events));
      const validate = cliRaw(chain.engineRoot, ["validate", "--workspace", chain.workspace]);
      // The matrix's C3 judge is the engine's pure validateEventChain (the
      // driver calls it directly), so that is the code under prediction; the
      // CLI's wrapping of the same failure is recorded alongside.
      let pureCode = null;
      try { judges.validateEventChain(events); } catch (error) { pureCode = error?.reasonCode ?? null; }
      record({
        column: "C3(a)",
        perturbation: "篡改首事件 payload 一处字符,哈希字段原样保留,段文件按规范形写回",
        expectedCode: "EVENT_CHAIN_CORRUPT",
        actualCode: pureCode,
        cliValidateCode: validate.reasonCode ?? validate.body?.reasonCode ?? null
      });
    } finally { destroyScratch(chain.root); }
  }

  // ---- C3(b) + C4: the paired proof of the keyless-hash blind spot --------
  // The C4 verdict here comes from the DRIVER's own cell adjudication, not
  // from a digest comparison reimplemented inside this suite: a red gate that
  // lives only in the test proves nothing about the gate that ships.
  {
    const chain = buildScratchChain(scratchRoot, { label: "red-c3b" });
    try {
      const { runMatrix } = await import("./run-matrix.mjs");
      const { EventMirrorStore } = await import(pathToFileURL(
        resolve(process.cwd(), "dist/packages/projection/src/index.js")).href);
      const last = chain.events.at(-1);
      const forged = judges.createEvent({
        id: `event:${"f".repeat(24)}`,
        streamId: last.streamId,
        sequence: last.sequence + 1,
        occurredAt: "2026-07-28T00:59:00Z",
        priorHash: last.eventHash,
        payload: JSON.parse(JSON.stringify(chain.events.at(-1).payload))
      });
      const forgedChain = [...chain.events, forged];
      let c3Code = null;
      let c3Green = false;
      try { judges.validateEventChain(forgedChain); c3Green = true; } catch (error) { c3Code = error?.reasonCode ?? null; }
      // The A container ingests the forged-but-self-consistent chain (the
      // engine validator passes it — that IS the blind spot), then the driver
      // adjudicates its cells against the unforged F workspace.
      const mirrorPath = join(chain.root, "mirror.db");
      const store = new EventMirrorStore(mirrorPath);
      store.ingest("SCRATCH", chain.version, forgedChain, judges);
      store.close();
      const migratedAttest = join(chain.root, "attest-migrated");
      cpSync(chain.attestDir, migratedAttest, { recursive: true });
      const run = await runMatrix({
        fWorkspace: chain.workspace, aDatabasePath: mirrorPath, partitionId: "SCRATCH",
        fAttestDir: chain.attestDir, aAttestDir: migratedAttest
      });
      const byCell = Object.fromEntries((run.cells ?? []).map((entry) => [entry.cell, entry]));
      record({
        column: "C3(b)",
        perturbation: "用引擎 createEvent 正规重算,尾部追加一条哈希自洽的伪造事件并灌入 A 镜像",
        expectedCode: null,
        actualCode: c3Code,
        expectation: "C3 判据(validateEventChain)预期仍绿——无密钥哈希的已知盲区",
        c3StillGreen: c3Green,
        aSideVerifyStillGreen: run.sides?.a?.verifyOk === true
      });
      record({
        column: "C4(paired-with-C3b, driver格判)",
        perturbation: "同一伪造下由驱动器裁 R3C4(chainHeadEventHash 互指格)",
        expectedCode: "CHAIN_HEAD_MUTUAL_REFERENCE_DIVERGENT",
        actualCode: byCell.R3C4?.reasonCodeOnRed ?? byCell.R3C4?.verdict ?? null,
        driverOverall: run.ok === true ? "MATRIX_STILL_GREEN" : (run.reasonCode ?? null),
        pairProves: "C3 的盲区真实存在(逐侧 validateEventChain 均绿),且 C4 不是冗余列而是其补位——红码取自驱动器自己的格,非套内重实现"
      });
    } finally { destroyScratch(chain.root); }
  }

  // ---- C1 + C4 by the driver's own cells ----------------------------------
  // A prefix-ingested mirror (one event short) plus a migrated sidecar set
  // missing one file: the driver's C1 stream cell, both C4 mutual cells, and
  // the sidecar C4 cell must all go red BY THE DRIVER'S ADJUDICATION. The
  // engine-level C1 case above (snapshot-verify) stays as the engine's own
  // byte gate; this one forces the driver's.
  {
    const chain = buildScratchChain(scratchRoot, { label: "red-cells" });
    try {
      const { runMatrix } = await import("./run-matrix.mjs");
      const { EventMirrorStore } = await import(pathToFileURL(
        resolve(process.cwd(), "dist/packages/projection/src/index.js")).href);
      const mirrorPath = join(chain.root, "mirror.db");
      const store = new EventMirrorStore(mirrorPath);
      store.ingest("SCRATCH", chain.version, chain.events.slice(0, -1), judges);
      store.close();
      const migratedAttest = join(chain.root, "attest-migrated");
      cpSync(chain.attestDir, migratedAttest, { recursive: true });
      const migratedNames = readdirSync(migratedAttest).filter((name) => name.endsWith(".json")).sort();
      rmSync(join(migratedAttest, migratedNames[0]));
      const run = await runMatrix({
        fWorkspace: chain.workspace, aDatabasePath: mirrorPath, partitionId: "SCRATCH",
        fAttestDir: chain.attestDir, aAttestDir: migratedAttest
      });
      const byCell = Object.fromEntries((run.cells ?? []).map((entry) => [entry.cell, entry]));
      const cellCode = (id) => byCell[id]?.reasonCodeOnRed ?? byCell[id]?.verdict ?? null;
      record({
        column: "C1(driver格判)",
        perturbation: "A 镜像少灌最后一事件,驱动器裁 R1C1(逐事件规范字节流格)",
        expectedCode: "EVENT_STREAM_BYTES_DIVERGENT",
        actualCode: cellCode("R1C1")
      });
      record({
        column: "C4(driver格判·契约互指)",
        perturbation: "同一短缺镜像,驱动器裁 R2C4(export 文档派生事件流 vs A 侧规范事件流)",
        expectedCode: "MUTUAL_REFERENCE_DIGEST_DIVERGENT",
        actualCode: cellCode("R2C4")
      });
      record({
        column: "C4(driver格判·回放互指)",
        perturbation: "同一短缺镜像,驱动器裁 R4C4",
        expectedCode: "MUTUAL_REFERENCE_DIGEST_DIVERGENT",
        actualCode: cellCode("R4C4")
      });
      record({
        column: "C4(driver格判·sidecar)",
        perturbation: `迁移副本删去一个 sidecar 文件(${migratedNames.length}→${migratedNames.length - 1}),驱动器裁 R5C4`,
        expectedCode: "ATTESTATION_SET_DIGEST_DIVERGENT",
        actualCode: cellCode("R5C4"),
        driverOverall: run.ok === true ? "MATRIX_STILL_GREEN" : (run.reasonCode ?? null)
      });
    } finally { destroyScratch(chain.root); }
  }

  // ---- R5: actor stripped, hashes recomputed forward ----------------------
  {
    const chain = buildScratchChain(scratchRoot, { label: "red-r5" });
    try {
      const path = segmentPath(chain.workspace);
      const events = JSON.parse(readFileSync(path, "utf8"));
      // Find a post-enable event bearing an actor, strip it, then re-chain
      // every later event with the engine's own createEvent so every hash is
      // self-consistent again. If the actor criterion were riding on the hash
      // criterion, this chain would pass; the expectation is that it fails on
      // the actor rule ALONE.
      const target = events.findIndex((event) => event.payload?.operation !== "attestation.actor.enabled"
        && typeof event.payload?.actor === "string");
      if (target < 0) throw new Error("scratch chain has no post-enable actor-bearing event");
      let prior = target === 0 ? null : events[target - 1].eventHash;
      for (let index = target; index < events.length; index += 1) {
        const source = events[index];
        const payload = { ...source.payload };
        if (index === target) delete payload.actor;
        const rebuilt = judges.createEvent({
          id: source.id, streamId: source.streamId, sequence: source.sequence,
          occurredAt: source.occurredAt, priorHash: prior, payload
        });
        events[index] = rebuilt;
        prior = rebuilt.eventHash;
      }
      let hashStillValid = false;
      try { judges.validateEventChain(events); hashStillValid = true; } catch { hashStillValid = false; }
      writeFileSync(path, judges.canonicalJson(events));
      const validate = cliRaw(chain.engineRoot, ["validate", "--workspace", chain.workspace]);
      record({
        column: "R5",
        perturbation: "剥掉 enable 起点后一事件的 actor 字段,用引擎 createEvent 向后重算全部哈希使链自洽",
        expectedCode: "WORKSPACE_ACTOR_REQUIRED",
        actualCode: validate.reasonCode ?? validate.body?.reasonCode ?? null,
        hashChainStillSelfConsistent: hashStillValid,
        proves: "attestation 判据独立于哈希判据成立,而非搭其便车"
      });
    } finally { destroyScratch(chain.root); }
  }

  // ---- R1 (A side): UPDATE / DELETE against mirror rows -------------------
  {
    const chain = buildScratchChain(scratchRoot, { label: "red-r1" });
    try {
      const { EventMirrorStore } = await import(pathToFileURL(
        resolve(process.cwd(), "dist/packages/projection/src/index.js")).href);
      const dbPath = join(chain.root, "mirror.db");
      const store = new EventMirrorStore(dbPath);
      store.ingest("SCRATCH", chain.version, chain.events, judges);
      store.close();
      const { DatabaseSync } = await import("node:sqlite");
      const db = new DatabaseSync(dbPath);
      let updateCode = null, deleteCode = null;
      try {
        db.prepare("UPDATE aos_event_mirror SET stream_id = 'tampered' WHERE sequence = 1").run();
        updateCode = "UPDATE_SUCCEEDED";
      } catch (error) {
        updateCode = /aos_event_mirror_append_only_update_denied/u.test(String(error.message))
          ? "aos_event_mirror_append_only_update_denied" : String(error.message).slice(0, 80);
      }
      try {
        db.prepare("DELETE FROM aos_event_mirror WHERE sequence = 1").run();
        deleteCode = "DELETE_SUCCEEDED";
      } catch (error) {
        deleteCode = /aos_event_mirror_append_only_delete_denied/u.test(String(error.message))
          ? "aos_event_mirror_append_only_delete_denied" : String(error.message).slice(0, 80);
      }
      db.close();
      const triggerLimits = "如实限界:触发器挡意外写,不挡持句柄先 DROP TRIGGER 再改写的蓄意者;防篡改由 verify 的触发器存在性自检与跨容器矩阵比对承担(DROP 后改写的红证见下一例)";
      record({
        column: "R1(A侧)",
        perturbation: "对 A 容器 scratch 库的已有事件行执行 UPDATE",
        expectedCode: "aos_event_mirror_append_only_update_denied",
        actualCode: updateCode,
        min003: "此格即 MIN-003 所指「单表触发器是否挡住意外 UPDATE/DELETE」的试金石(非防篡改全称命题)",
        limits: triggerLimits
      });
      record({
        column: "R1(A侧)",
        perturbation: "对 A 容器 scratch 库的已有事件行执行 DELETE",
        expectedCode: "aos_event_mirror_append_only_delete_denied",
        actualCode: deleteCode,
        limits: triggerLimits
      });
    } finally { destroyScratch(chain.root); }
  }

  // ---- R1 (A side): the trigger's honest limit — DROP, then rewrite -------
  // A handle-holder can DROP the triggers and rewrite rows; the trigger alone
  // never claimed to stop that. This case proves who DOES catch it: the
  // store's verify (trigger-presence self-check → EVENT_MIRROR_TRIGGERS_MISSING)
  // and the cross-container matrix (the rewritten row diverges cell by cell).
  {
    const chain = buildScratchChain(scratchRoot, { label: "red-r1-drop" });
    try {
      const { runMatrix } = await import("./run-matrix.mjs");
      const { EventMirrorStore } = await import(pathToFileURL(
        resolve(process.cwd(), "dist/packages/projection/src/index.js")).href);
      const mirrorPath = join(chain.root, "mirror.db");
      const store = new EventMirrorStore(mirrorPath);
      store.ingest("SCRATCH", chain.version, chain.events, judges);
      store.close();
      const { DatabaseSync } = await import("node:sqlite");
      const raw = new DatabaseSync(mirrorPath);
      raw.exec("DROP TRIGGER aos_event_mirror_no_update; DROP TRIGGER aos_event_mirror_no_delete;");
      const row = raw.prepare(
        "SELECT canonical_json FROM aos_event_mirror WHERE sequence = 1").get();
      const tampered = String(row.canonical_json)
        .replace("Consistency matrix scratch", "Rewritten after trigger DROP");
      if (tampered === String(row.canonical_json)) throw new Error("tamper target substring not found");
      raw.prepare("UPDATE aos_event_mirror SET canonical_json = ? WHERE sequence = 1").run(tampered);
      raw.close();
      // The FIRST reopen after the tamper is the one that can still see the
      // dropped triggers (the store's own DDL restores them going forward);
      // its verify must go red on the trigger self-check.
      let verifyCode = null;
      const reopened = new EventMirrorStore(mirrorPath);
      try { reopened.verify("SCRATCH", judges); verifyCode = "VERIFY_STILL_GREEN"; }
      catch (error) { verifyCode = error?.reasonCode ?? String(error.message).slice(0, 80); }
      finally { reopened.close(); }
      record({
        column: "R1(A侧·DROP后改写)",
        perturbation: "持句柄 DROP 两触发器后 UPDATE 改写一行 canonical_json,再经 EventMirrorStore.verify 自检(改写后首次重开)",
        expectedCode: "EVENT_MIRROR_TRIGGERS_MISSING",
        actualCode: verifyCode,
        limits: "触发器挡意外写、不挡持句柄的蓄意 DROP;防篡改由 verify 自检与跨容器矩阵比对承担——本例即其红证"
      });
      const migratedAttest = join(chain.root, "attest-migrated");
      cpSync(chain.attestDir, migratedAttest, { recursive: true });
      const run = await runMatrix({
        fWorkspace: chain.workspace, aDatabasePath: mirrorPath, partitionId: "SCRATCH",
        fAttestDir: chain.attestDir, aAttestDir: migratedAttest
      });
      record({
        column: "R1(A侧·DROP后改写→矩阵)",
        perturbation: "同一 DROP 后改写库跑完整矩阵:跨容器比对必须抓到改写",
        expectedCode: "MATRIX_HAS_RED_OR_UNSTABLE_CELLS",
        actualCode: run.ok === true ? "MATRIX_STILL_GREEN" : (run.reasonCode ?? null),
        redCells: (run.cells ?? []).filter((entry) => entry.verdict === "mismatch").map((entry) => entry.cell),
        proves: "矩阵能抓 DROP 后改写——触发器限界的补位是实证而非声称"
      });
    } finally { destroyScratch(chain.root); }
  }

  // ---- driver-level red: an unauthorized n/a must land NA_OUT_OF_WHITELIST -
  // The R4C1 views-absence exemption binds to the DERIVED A container kind.
  // Give the mirror database an extra table and the derivation stops saying
  // event-row-mirror, the whitelist entry stops firing, and the driver must
  // classify the runtime n/a claim as a mismatch — the reachable red that the
  // literal-constant context used to make impossible.
  {
    const chain = buildScratchChain(scratchRoot, { label: "red-na" });
    try {
      const { runMatrix } = await import("./run-matrix.mjs");
      const { EventMirrorStore } = await import(pathToFileURL(
        resolve(process.cwd(), "dist/packages/projection/src/index.js")).href);
      const mirrorPath = join(chain.root, "mirror.db");
      const store = new EventMirrorStore(mirrorPath);
      store.ingest("SCRATCH", chain.version, chain.events, judges);
      store.close();
      const { DatabaseSync } = await import("node:sqlite");
      const raw = new DatabaseSync(mirrorPath);
      raw.exec("CREATE TABLE aos_views_snapshot (id INTEGER PRIMARY KEY, body TEXT)");
      raw.close();
      const migratedAttest = join(chain.root, "attest-migrated");
      cpSync(chain.attestDir, migratedAttest, { recursive: true });
      const run = await runMatrix({
        fWorkspace: chain.workspace, aDatabasePath: mirrorPath, partitionId: "SCRATCH",
        fAttestDir: chain.attestDir, aAttestDir: migratedAttest
      });
      const r4c1 = (run.cells ?? []).find((entry) => entry.cell === "R4C1");
      record({
        column: "driver(NA 出白名单)",
        perturbation: "镜像库添加 aos_views_snapshot 表,使派生的 aContainer 不再是 event-row-mirror,R4C1 的 n/a 失去白名单授权",
        expectedCode: "NA_OUT_OF_WHITELIST",
        actualCode: r4c1?.reasonCodeOnRed ?? r4c1?.verdict ?? null,
        derivedAContainer: run.aContainer?.kind ?? null,
        driverOverall: run.ok === true ? "MATRIX_STILL_GREEN" : (run.reasonCode ?? null)
      });
    } finally { destroyScratch(chain.root); }
  }

  // ---- driver-level red: a stale A side must fail loudly, twice -----------
  // First at the lockstep gate BEFORE any anchor is taken (the chain moved
  // after knowledge-init, so the high-water mark trails the head), then —
  // once lockstep is restored by a governed rebase on this scratch chain —
  // as honest cell mismatches. This forces the DRIVER red, not merely its
  // criterion functions: a driver that cannot go red is the same painting.
  {
    const chain = buildScratchChain(scratchRoot, { label: "red-driver" });
    try {
      const { runMatrix } = await import("./run-matrix.mjs");
      const { EventMirrorStore } = await import(pathToFileURL(
        resolve(process.cwd(), "dist/packages/projection/src/index.js")).href);
      const mirrorPath = join(chain.root, "mirror.db");
      const store = new EventMirrorStore(mirrorPath);
      store.ingest("SCRATCH", chain.version, chain.events, judges);
      store.close();
      const migratedAttest = join(chain.root, "attest-migrated");
      cpSync(chain.attestDir, migratedAttest, { recursive: true });
      // The chain moves on; the mirror does not.
      cliRaw(chain.engineRoot, ["work-transition", "--workspace", chain.workspace,
        "--expected-version", String(chain.version), "--at", "2026-07-28T00:30:00Z",
        "--id", chain.workId, "--status", "active", "--actor", chain.actor, "--attest-dir", chain.attestDir]);
      const matrixOptions = {
        fWorkspace: chain.workspace, aDatabasePath: mirrorPath, partitionId: "SCRATCH",
        fAttestDir: chain.attestDir, aAttestDir: migratedAttest
      };
      const lockstepRun = await runMatrix(matrixOptions);
      record({
        column: "driver(lockstep 先于取锚)",
        perturbation: "链在 knowledge-init 后前进一事件,镜像未跟进,直接跑驱动器",
        expectedCode: "KNOWLEDGE_HIGH_WATER_MISMATCH",
        actualCode: lockstepRun.reasonCode ?? null,
        stage: lockstepRun.stage ?? null,
        anchorNeverTaken: lockstepRun.anchor === undefined
      });
      // Restore lockstep by the governed remedy (a write on this scratch
      // chain only), leaving the mirror stale: now the cells must go red.
      const marker = JSON.parse(readFileSync(
        join(chain.workspace, ".tcrn-workflow/knowledge/store.json"), "utf8"));
      cliRaw(chain.engineRoot, ["knowledge-rebase", "--workspace", chain.workspace,
        "--expected-version", String(marker.version), "--at", "2026-07-28T00:31:00Z"]);
      const staleRun = await runMatrix(matrixOptions);
      const redCells = (staleRun.cells ?? []).filter((entry) => entry.verdict === "mismatch").map((entry) => entry.cell);
      record({
        column: "driver(整体红)",
        perturbation: "同一滞后镜像,lockstep 经受治 knowledge-rebase 修复后复跑驱动器",
        expectedCode: "MATRIX_HAS_RED_OR_UNSTABLE_CELLS",
        actualCode: staleRun.ok === true ? "MATRIX_STILL_GREEN" : (staleRun.reasonCode ?? null),
        redCells,
        proves: "滞后的 A 侧在驱动器里是逐格 mismatch,不是静默通过"
      });
    } finally { destroyScratch(chain.root); }
  }

  const findings = cases.filter((entry) => !entry.matched);
  return {
    schemaVersion: "aos.consistency-matrix-red-suite.v1",
    principle: "判据两侧必须能够不同:每列在一次性 scratch 副本上故意扰动并预言红码;预期≠实收即为发现",
    hygiene: [
      "全程不触活链:扰动对象只有本套件自建的 scratch 链与其副本",
      "红证与绿跑同一份判据代码、同一受治引擎副本,防「测试专用判据」分叉",
      "scratch 用后即弃并验证删净"
    ],
    cases,
    findings,
    ok: findings.length === 0
  };
}

// ---- CLI ------------------------------------------------------------------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const scratchRoot = process.argv[2] ?? process.env.TCRN_AOS_MATRIX_SCRATCH;
  if (!scratchRoot) {
    console.error(JSON.stringify({ ok: false, error: "usage: red-suite.mjs <scratch-root> (session scratchpad or /srv/tcrn/scratch-*)" }));
    process.exit(1);
  }
  const result = await runRedSuite(resolve(scratchRoot));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
