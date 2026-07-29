#!/usr/bin/env node
// Feed an EventMirrorStore from a LIVE governed chain, through the governed
// read surface, a page at a time (STORY-114).
//
// Why this exists at all. `EventMirrorStore.ingest` wants the whole event list,
// and until v0.8.0 the only surface that produced one was `export` — which
// refuses with INPUT_OVERSIZED once a partition's canonical document passes the
// engine's one-MiB ceiling. The live AOS partition passed it long ago, so the
// A side of the consistency matrix could be built on scratch chains and not on
// the chain the MIN-008 acceptance gate is actually about. `event-list`
// (v0.8.0, INC-027) is the way through, and this is the wiring.
//
// WHICH SURFACE, AND WHY THE MCP FACADE RATHER THAN THE CLI.
//
// Both carry `event-list`. The facade was chosen for three reasons, in order of
// weight:
//
//  1. It is this repository's OWN existing governed read path. `ChainClient`
//     already carries the handshake, the per-call timeout, the verbatim
//     reason-code surfacing and — the part that has bitten this platform three
//     times — a `detached` spawn with a process-GROUP reclaim. Reaching for the
//     CLI here would mean a second reader for the same question, which is how
//     two readers drift.
//  2. Read-only is enforced by the ENGINE, not by a list maintained here. The
//     facade refuses every `mutates` or `authorityBearing` tool with
//     OPERATOR_AUTHORITY_REQUIRED whenever authority pins are absent, and this
//     client is constructed with no pins at all. A local allowlist (the matrix
//     driver's own READ_ONLY_VERBS) is only as good as the person editing it;
//     an engine-side refusal survives an editing mistake here.
//     (Read from the engine's `WorkflowMcpDispatcher.#callTool` at v0.8.0 —
//     stated as source-read, not as something this script test-fires: firing a
//     mutating verb to watch it be refused is not something to do against a
//     live chain.)
//  3. One long-lived facade process amortises the spawn across every page —
//     the measured ~130ms per facade call against ~190ms per cold CLI spawn.
//     On a 711-event chain at a 64-event window that is twelve spawns saved;
//     the reason it matters is not the seconds but that a per-page spawn makes
//     the read look like twelve unrelated reads of a chain that can move.
//
// What this script will not do: write anything to the chain, hold a lease, or
// touch `.tcrn-workspace/` in any way other than reading through the facade.
// The mirror database it writes lives wherever the caller says, and the caller
// is expected to keep it out of the workspace and off the backup surface (the
// O3 ruling's "明确不备").

import { mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_ENGINE_ROOT = process.env.TCRN_AOS_ENGINE_ROOT
  ?? resolve(homedir(), ".tcrn-workflow/tcrn-workflow");

/**
 * Read a whole live partition through the facade and ingest it into a mirror.
 *
 * Returns the ingest receipt plus the paging proof. Nothing is "assumed
 * complete": the paging proof carries the four assembly assertions and the
 * exact windows used, and `ingest` re-judges the assembled stream with the
 * engine's own `validateEventChain` before a row is written.
 */
export async function liveMirrorIngest({
  workspace,
  partitionId,
  mirrorPath,
  engineRoot = DEFAULT_ENGINE_ROOT,
  projectionDist = resolve(process.cwd(), "dist/packages/projection/src/index.js"),
  initialLimit = 64,
  minLimit = 1,
  freshMirror = false
}) {
  const projection = await import(pathToFileURL(projectionDist).href);
  const { ChainClient, EventMirrorStore, loadEngineProtocol, readAllEvents } = projection;

  const protocol = await loadEngineProtocol(engineRoot);
  const client = new ChainClient({
    serverPath: resolve(engineRoot, "scripts/tcrn-workflow-mcp.mjs"),
    // No authority pins, deliberately: with none supplied the engine refuses
    // every mutating and authority-bearing tool by itself. This is the whole
    // read-only argument, and it is one line.
    timeoutMs: 120_000
  });

  const started = Date.now();
  let store;
  try {
    await client.start();

    // The anchor. Taken FIRST and compared against every page: a chain that
    // moves mid-read yields pages from two chain states, and a stream stitched
    // from two states is plausible and wrong.
    const status = await client.callTool("tcrn_workflow_status", { workspace });
    const anchor = {
      workspaceId: status.workspaceId,
      version: status.version,
      headEventHash: status.headEventHash
    };

    const pageCalls = [];
    const { events, proof } = await readAllEvents({
      anchor,
      initialLimit,
      minLimit,
      read: async (limit, offset) => {
        const at = Date.now();
        const page = await client.callTool("tcrn_workflow_event_list", { workspace, limit, offset });
        pageCalls.push({ limit, offset, records: page.records?.length ?? 0, ms: Date.now() - at });
        return page;
      }
    });

    // A second status read AFTER the last page. The per-page anchor comparison
    // already refuses a page from a moved chain; this closes the remaining
    // window where the chain moves after the final page is served, which no
    // page could report.
    const statusAfter = await client.callTool("tcrn_workflow_status", { workspace });
    const chainStill = statusAfter.headEventHash === anchor.headEventHash
      && statusAfter.version === anchor.version;
    if (!chainStill) {
      throw Object.assign(
        new Error(`chain advanced during the read: ${anchor.headEventHash} -> ${statusAfter.headEventHash}`),
        { reasonCode: "EVENT_PAGING_CHAIN_ADVANCED_DURING_READ" }
      );
    }

    if (freshMirror) {
      rmSync(mirrorPath, { force: true });
      for (const suffix of ["-wal", "-shm"]) rmSync(`${mirrorPath}${suffix}`, { force: true });
    }
    mkdirSync(dirname(resolve(mirrorPath)), { recursive: true });
    store = new EventMirrorStore(mirrorPath);
    const appended = store.ingest(partitionId, anchor.version, events, protocol);
    const verified = store.verify(partitionId, protocol);
    const rows = store.listRows(partitionId);

    return {
      ok: appended === anchor.version && verified.ok === true && rows.length === anchor.version,
      surface: "governed-workflow-mcp-facade (tcrn_workflow_status + tcrn_workflow_event_list, no authority pins)",
      engineVersion: protocol.engineVersion,
      anchor,
      anchorAfterRead: {
        version: statusAfter.version,
        headEventHash: statusAfter.headEventHash,
        unchanged: chainStill
      },
      paging: {
        ...proof,
        pageCalls,
        elapsedMs: Date.now() - started
      },
      mirror: {
        partitionId,
        appended,
        rows: rows.length,
        verifyOk: verified.ok,
        verifiedEvents: verified.events,
        headRow: {
          sequence: rows.at(-1)?.sequence ?? null,
          eventHash: rows.at(-1)?.eventHash ?? null
        },
        headMatchesChain: rows.at(-1)?.eventHash === anchor.headEventHash
      }
    };
  } finally {
    store?.close();
    // Reclaim written in the same breath as the spawn: ChainClient.stop kills
    // the whole process group, not just the direct child.
    await client.stop();
  }
}

// ---- CLI ------------------------------------------------------------------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : fallback;
  };
  const workspace = flag("workspace");
  const mirrorPath = flag("mirror");
  const partitionId = flag("partition-id");
  if (!workspace || !mirrorPath || !partitionId) {
    console.error(JSON.stringify({
      ok: false,
      error: "--workspace <root> --mirror <dbPath> --partition-id <id> are required"
    }));
    process.exit(1);
  }
  const result = await liveMirrorIngest({
    workspace: resolve(workspace),
    mirrorPath: resolve(mirrorPath),
    partitionId,
    initialLimit: Number(flag("limit", "64")),
    minLimit: Number(flag("min-limit", "1")),
    freshMirror: args.includes("--fresh")
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
