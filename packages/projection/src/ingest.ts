import { ChainClient, ChainClientError } from "./chain-client.js";
import { WORK_KIND_TOKENS, digestOf, partitionTokenCandidates, resolveKeyTable } from "./external-keys.js";
import type {
  ChainConferenceStatus,
  ChainGateStatus,
  ChainOutcomeClass,
  ChainWorkKind,
  ChainWorkStatus,
  PartitionFreshness,
  PartitionProjection,
  ProjectedConference,
  ProjectedGate,
  ProjectedMinutes,
  ProjectedPosition,
  ProjectedWork
} from "./types.js";

/**
 * One governed partition the cockpit projects.
 *
 * `workspacePath` is the chain's own directory. It is passed to read tools and
 * never opened by this package: the engine reads its own bytes.
 */
export interface PartitionSource {
  partitionId: string;
  workspacePath: string;
}

/**
 * Reads whole partitions through the governed `export` tool.
 *
 * Why `export` rather than `work-list` plus `work-show` per record: the list and
 * show receipts carry neither `externalKey` nor the advisory extensions, and a
 * record id is a one-way digest of its key — so a cockpit built on those two
 * verbs could show a work tree but never name anything in it. `export` returns
 * work, gates, conferences, positions and minutes complete with keys and
 * extensions in a single call, which is also one round trip instead of N.
 */
export class ChainIngestor {
  constructor(private readonly client: ChainClient) {}

  /**
   * Read a partition's current version without pulling its contents.
   *
   * Freshness is decided by comparing this against what the store holds, never
   * by elapsed time: a chain idle for a day is not stale, and a projection one
   * version behind is stale however recently it ran.
   */
  async readVersion(source: PartitionSource): Promise<number> {
    const status = await this.client.callTool<{ version: number }>("tcrn_workflow_status", {
      workspace: source.workspacePath
    });
    return status.version;
  }

  /**
   * Pull a partition in full, at whatever version it is currently at.
   *
   * `export` is the only read tool that returns external keys and advisory
   * extensions, but it has no pagination and refuses any workspace whose
   * canonical form exceeds one MiB — which the two largest chains here already
   * do. So an oversized partition falls back to the paginated list plus
   * per-record show, with keys recovered by verified digest match.
   *
   * The fallback is a stopgap for a read-surface gap, not a preference: it costs
   * one call per record where export costs one per partition, and it can only
   * name records that follow the key convention.
   */
  async project(source: PartitionSource, verifiedAt: string): Promise<PartitionProjection> {
    let raw: ExportReceipt;
    try {
      raw = await this.client.callTool<ExportReceipt>("tcrn_workflow_export", {
        workspace: source.workspacePath
      });
    } catch (error) {
      if (error instanceof ChainClientError && error.reasonCode === "INPUT_OVERSIZED") {
        return this.projectPaginated(source, verifiedAt);
      }
      throw error;
    }
    const chainVersion = raw.version;
    const partitionId = source.partitionId;

    // Tombstoned records stay in the chain forever but are not current state, so
    // the projection drops them here rather than making every reader remember to.
    const live = <T extends { tombstone?: boolean }>(rows: readonly T[] | undefined): T[] =>
      (rows ?? []).filter((row) => row.tombstone !== true);

    const work: ProjectedWork[] = live(raw.work).map((row) => ({
      partitionId,
      id: row.id,
      externalKey: row.externalKey ?? null,
      kind: row.kind as ChainWorkKind,
      status: row.status as ChainWorkStatus,
      parentId: row.parentId ?? null,
      projectId: row.projectId,
      revision: row.revision,
      scope: advisoryString(row.extensions, "advisory:scope"),
      decidedBy: advisoryList(row.extensions, "advisory:decided-by"),
      sprintWorkId: advisorySprintWorkId(row.extensions),
      chainVersion
    }));

    const gates: ProjectedGate[] = live(raw.gates).map((row) => ({
      partitionId,
      id: row.id,
      externalKey: row.externalKey ?? null,
      title: row.title ?? null,
      status: row.status as ChainGateStatus,
      outcomeClass: row.outcomeClass as ChainOutcomeClass,
      workId: row.workId ?? row.linkedWorkId ?? null,
      chainVersion
    }));

    const conferences: ProjectedConference[] = live(raw.conferences).map((row) => ({
      partitionId,
      id: row.id,
      externalKey: row.externalKey ?? null,
      title: row.title ?? null,
      type: row.type ?? null,
      status: row.status as ChainConferenceStatus,
      workIds: row.linkedWorkIds ?? [],
      chainVersion
    }));

    // Positions carry no ordinal of their own; their order is the order the chain
    // recorded them, which the export preserves. Numbering them here keeps
    // fragment reassembly and round grouping deterministic downstream.
    const perConference = new Map<string, number>();
    const positions: ProjectedPosition[] = live(raw.conferencePositions).map((row) => {
      const ordinal = (perConference.get(row.conferenceId) ?? 0) + 1;
      perConference.set(row.conferenceId, ordinal);
      return {
        partitionId,
        id: row.id,
        externalKey: row.externalKey ?? null,
        conferenceId: row.conferenceId,
        actorId: row.actorId ?? null,
        body: row.position,
        ordinal,
        chainVersion
      };
    });

    const minutes: ProjectedMinutes[] = live(raw.conferenceMinutes).map((row) => ({
      partitionId,
      id: row.id,
      externalKey: row.externalKey ?? null,
      conferenceId: row.conferenceId,
      summary: row.summary ?? null,
      outcomeClass: row.outcomeClass as ChainOutcomeClass,
      decisions: row.decisions ?? [],
      unresolvedIssues: row.unresolvedIssues ?? [],
      chainVersion
    }));

    return { partitionId, chainVersion, verifiedAt, work, gates, conferences, positions, minutes };
  }

  /**
   * Project a partition only when the chain has moved past what is already held.
   *
   * The chain is append-only, so equal versions mean identical content and a
   * re-read would return the same bytes. Callers get the freshness verdict either
   * way, so a view can always say what it is showing and how current it is.
   */
  async projectIfMoved(
    source: PartitionSource,
    heldVersion: number | undefined,
    verifiedAt: string
  ): Promise<{ freshness: PartitionFreshness; projection?: PartitionProjection }> {
    const chainVersion = await this.readVersion(source);
    if (heldVersion !== undefined && heldVersion >= chainVersion) {
      return {
        freshness: {
          partitionId: source.partitionId,
          projectedVersion: heldVersion,
          chainVersion,
          verifiedAt,
          stale: false
        }
      };
    }
    const projection = await this.project(source, verifiedAt);
    return {
      freshness: {
        partitionId: source.partitionId,
        projectedVersion: projection.chainVersion,
        chainVersion: projection.chainVersion,
        // A chain that advanced between the status read and the export is not an
        // error — it is reported as behind rather than silently presented as current.
        stale: projection.chainVersion < chainVersion,
        verifiedAt
      },
      projection
    };
  }
  /**
   * Project a partition too large for `export`, one page at a time.
   *
   * Work records come from the paginated list; gates and conferences are then
   * recovered per work item, because `gate-list` and `conference-list-by-work`
   * are scoped to a work id rather than a workspace.
   *
   * Recovering them matters more than it costs. The cockpit's headline view is
   * the operator inbox, and an inbox that silently omits the busiest chain's
   * gates would report "nothing waiting" — a false all-clear is worse than a
   * slow refresh, so the extra calls are spent.
   */
  private async projectPaginated(
    source: PartitionSource,
    verifiedAt: string
  ): Promise<PartitionProjection> {
    const status = await this.client.callTool<{ version: number }>("tcrn_workflow_status", {
      workspace: source.workspacePath
    });
    const chainVersion = status.version;
    const partitionId = source.partitionId;

    const rows: ExportWorkRow[] = [];
    const pageSize = 200;
    for (let offset = 0; ; offset += pageSize) {
      const page = await this.client.callTool<{ records?: readonly ExportWorkRow[]; truncated?: boolean }>(
        "tcrn_workflow_work_list",
        { workspace: source.workspacePath, limit: pageSize, offset }
      );
      const records = page.records ?? [];
      rows.push(...records);
      if (records.length < pageSize) break;
    }

    // Keys are recovered by verified digest match. The derivation variant is
    // chosen by which one explains the most real ids, so no assumption is made
    // about which record happens to be first, and a changed derivation yields
    // unnamed records rather than wrong names.
    const keyTable = resolveKeyTable(
      "work",
      rows.map((row) => row.id),
      { partitionTokens: partitionTokenCandidates(partitionId), kindTokens: WORK_KIND_TOKENS }
    );

    const live = rows.filter((row) => row.tombstone !== true);
    const work: ProjectedWork[] = [];
    for (const row of live) {
      const shown = await this.client.callTool<{ advisory?: { scope?: unknown; decidedBy?: unknown; sprint?: unknown } }>(
        "tcrn_workflow_work_show",
        { workspace: source.workspacePath, id: row.id }
      );
      const advisory = shown.advisory ?? {};
      const sprint = advisory.sprint as { workId?: unknown } | undefined;
      work.push({
        partitionId,
        id: row.id,
        externalKey: keyTable.get(digestOf(row.id)) ?? null,
        kind: row.kind as ChainWorkKind,
        status: row.status as ChainWorkStatus,
        parentId: row.parentId ?? null,
        projectId: row.projectId,
        revision: row.revision,
        scope: typeof advisory.scope === "string" ? advisory.scope : null,
        decidedBy: Array.isArray(advisory.decidedBy)
          ? advisory.decidedBy.filter((entry): entry is string => typeof entry === "string")
          : [],
        sprintWorkId: typeof sprint?.workId === "string" ? sprint.workId : null,
        chainVersion
      });
    }

    // Gates and conferences hang off work items, so they are gathered per record.
    // Positions and minutes have no work-scoped read at all; a conference found
    // here is listed without its thread, and the reader is shown that rather
    // than an empty deliberation.
    const gates: ProjectedGate[] = [];
    const conferences: ProjectedConference[] = [];
    const seenConferences = new Set<string>();
    for (const item of work) {
      const gateRows = await this.client.callTool<readonly ExportGateRow[]>(
        "tcrn_workflow_gate_list", { workspace: source.workspacePath, "work-id": item.id });
      for (const row of gateRows ?? []) {
        if (row.tombstone === true) continue;
        gates.push({
          partitionId,
          id: row.id,
          externalKey: row.externalKey ?? null,
          title: row.title ?? null,
          status: row.status as ChainGateStatus,
          outcomeClass: row.outcomeClass as ChainOutcomeClass,
          workId: row.workId ?? item.id,
          chainVersion
        });
      }
      const conferenceRows = await this.client.callTool<readonly ExportConferenceRow[]>(
        "tcrn_workflow_conference_list_by_work", { workspace: source.workspacePath, "work-id": item.id });
      for (const row of conferenceRows ?? []) {
        if (row.tombstone === true || seenConferences.has(row.id)) continue;
        seenConferences.add(row.id);
        conferences.push({
          partitionId,
          id: row.id,
          externalKey: row.externalKey ?? null,
          title: row.title ?? null,
          type: row.type ?? null,
          status: row.status as ChainConferenceStatus,
          workIds: row.linkedWorkIds ?? [item.id],
          chainVersion
        });
      }
    }

    return {
      partitionId,
      chainVersion,
      verifiedAt,
      work,
      gates,
      conferences,
      positions: [],
      minutes: []
    };
  }
}

/** Advisory extensions are `{ required, value }` envelopes keyed by name. */
type ExtensionMap = Record<string, { value?: unknown } | undefined> | undefined;

function advisoryString(extensions: ExtensionMap, key: string): string | null {
  const value = extensions?.[key]?.value;
  return typeof value === "string" ? value : null;
}

function advisoryList(extensions: ExtensionMap, key: string): readonly string[] {
  const value = extensions?.[key]?.value;
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function advisorySprintWorkId(extensions: ExtensionMap): string | null {
  const value = extensions?.["advisory:sprint"]?.value as { workId?: unknown } | undefined;
  return typeof value?.workId === "string" ? value.workId : null;
}

interface ExportReceipt {
  version: number;
  work?: readonly ExportWorkRow[];
  gates?: readonly ExportGateRow[];
  conferences?: readonly ExportConferenceRow[];
  conferencePositions?: readonly ExportPositionRow[];
  conferenceMinutes?: readonly ExportMinutesRow[];
}

interface ExportWorkRow {
  id: string;
  externalKey?: string;
  kind: string;
  status: string;
  parentId?: string | null;
  projectId: string;
  revision: number;
  extensions?: ExtensionMap;
  tombstone?: boolean;
}

interface ExportGateRow {
  id: string;
  externalKey?: string;
  title?: string;
  status: string;
  outcomeClass: string;
  workId?: string;
  linkedWorkId?: string;
  tombstone?: boolean;
}

interface ExportConferenceRow {
  id: string;
  externalKey?: string;
  title?: string;
  type?: string;
  status: string;
  linkedWorkIds?: readonly string[];
  tombstone?: boolean;
}

interface ExportPositionRow {
  id: string;
  externalKey?: string;
  conferenceId: string;
  actorId?: string;
  position: string;
  tombstone?: boolean;
}

interface ExportMinutesRow {
  id: string;
  externalKey?: string;
  conferenceId: string;
  summary?: string;
  outcomeClass: string;
  decisions?: readonly string[];
  unresolvedIssues?: readonly string[];
  tombstone?: boolean;
}
