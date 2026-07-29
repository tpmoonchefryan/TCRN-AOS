/**
 * Paged read of a governed chain's complete event stream (STORY-114 unblock).
 *
 * Why this module exists. `EventMirrorStore.ingest` takes the WHOLE event list
 * and validates it whole, because hash linkage cannot be checked from the
 * middle of a chain. Until now the only surface that could hand over a whole
 * event list was `export`, and `export` refuses with INPUT_OVERSIZED once a
 * partition's canonical document passes the engine's one-MiB ceiling — which
 * the live AOS partition already has. So the mirror could be fed on scratch
 * chains and not on the chain the acceptance gate is actually about.
 *
 * The engine's `event-list` (v0.8.0) is the way through: it returns EventRecords
 * verbatim, a page at a time. What it does NOT do is hand over a whole-stream
 * guarantee — reassembling pages is the caller's job, and a caller that
 * reassembles them on trust has invented exactly the failure the paging verb was
 * built to avoid (INC-004/INC-005: a limit expressing itself as absence). So
 * every assembly here is CHECKED, against the chain's own status receipt:
 *
 *   1. count == the anchor's version/total (a short read is not the end of a chain);
 *   2. sequences are exactly 1..N, contiguous, no duplicates (a dropped or
 *      repeated page cannot hide inside a correct-looking total);
 *   3. the tail event's eventHash equals the anchor's headEventHash, compared at
 *      FULL 64-hex length (this platform has twice reported a difference that did
 *      not exist by comparing truncated digests);
 *   4. every page reports the same version AND headEventHash as the anchor —
 *      a chain that advanced mid-read yields pages from two different chains,
 *      and stitching those together would produce a plausible, wrong stream.
 *
 * Each failure has its own reason code. None of them degrade to a warning: a
 * paging assembly that cannot prove itself hands back nothing.
 *
 * The engine remains the only judge of hash linkage: this module checks that the
 * pages were assembled into the stream the chain says it has, and then
 * `validateEventChain` (inside `EventMirrorStore.ingest`) judges whether that
 * stream is a valid chain. Two different questions, neither reimplemented here.
 */

/** One `event-list` receipt, as the engine's paginate() shapes it. */
export interface EventPageReceipt {
  readonly reasonCode: string;
  readonly workspaceId: string;
  readonly version: number;
  readonly headEventHash: string;
  readonly kind: string;
  readonly total: number;
  readonly truncated: boolean;
  readonly records: readonly EventPageRecord[];
}

/** The verbatim EventRecord fields the mirror needs; payload stays opaque. */
export interface EventPageRecord {
  readonly schemaVersion: string;
  readonly id: string;
  readonly streamId: string;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly priorHash: string | null;
  readonly payload: unknown;
  readonly payloadHash: string;
  readonly eventHash: string;
}

/** The `status` receipt fields this module anchors against. */
export interface ChainAnchor {
  readonly workspaceId: string;
  readonly version: number;
  readonly headEventHash: string;
}

export class EventPagingError extends Error {
  constructor(message: string, readonly reasonCode: string, readonly detail?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = "EventPagingError";
  }
}

/** A page fetch. `limit`/`offset` are the engine's own flags, passed straight through. */
export type PageReader = (limit: number, offset: number) => Promise<EventPageReceipt>;

/** How the window moved, and why — recorded so "which window worked" is a fact, not a memory. */
export interface WindowStep {
  readonly limit: number;
  readonly offset: number;
  readonly outcome: "page" | "oversized";
  readonly records?: number;
  readonly reasonCode?: string;
}

export interface PagedReadProof {
  readonly anchor: ChainAnchor;
  readonly events: number;
  /** Every window actually attempted, in order — oversize refusals included. */
  readonly windowSteps: readonly WindowStep[];
  /** Windows that produced pages, smallest to largest. */
  readonly windowsUsed: readonly number[];
  readonly initialLimit: number;
  readonly finalLimit: number;
  readonly oversizedRefusals: number;
  readonly pages: number;
  /** The four assembly assertions, each recorded with the values it compared. */
  readonly assertions: readonly AssemblyAssertion[];
}

export interface AssemblyAssertion {
  readonly name: string;
  readonly ok: true;
  readonly detail: Readonly<Record<string, unknown>>;
}

/** The reason code the engine raises when one page cannot fit the canonical ceiling. */
export const EVENT_PAGE_OVERSIZED = "CLI_EVENT_PAGE_OVERSIZED";

/**
 * Verify an assembled page sequence against the anchor. Pure — no I/O, no
 * engine — so the whole three-state logic is unit-testable on synthetic input.
 *
 * Returns the ordered events plus the assertions it made. Throws
 * `EventPagingError` with a named code on the first failure; it never returns a
 * partial or "probably fine" stream.
 */
export function assembleEventPages(pages: readonly EventPageReceipt[], anchor: ChainAnchor): {
  events: readonly EventPageRecord[];
  assertions: readonly AssemblyAssertion[];
} {
  if (pages.length === 0) {
    throw new EventPagingError(
      "no pages were read; an empty page set cannot be distinguished from an empty chain",
      "EVENT_PAGING_NO_PAGES"
    );
  }
  const assertions: AssemblyAssertion[] = [];

  // (4) first: every page must come from the same chain state as the anchor.
  // Checked before anything is stitched, because a stitched stream from two
  // chain states can still pass a count check and is the worst kind of wrong.
  const drifted = pages
    .map((page, index) => ({ index, version: page.version, headEventHash: page.headEventHash, workspaceId: page.workspaceId }))
    .filter((page) => page.version !== anchor.version
      || page.headEventHash !== anchor.headEventHash
      || page.workspaceId !== anchor.workspaceId);
  if (drifted.length > 0) {
    throw new EventPagingError(
      `${drifted.length} of ${pages.length} pages report a chain state different from the anchor — the chain moved mid-read`,
      "EVENT_PAGING_ANCHOR_MOVED",
      { anchor, drifted: drifted.slice(0, 5) }
    );
  }
  assertions.push({
    name: "every-page-matches-anchor",
    ok: true,
    detail: { pages: pages.length, version: anchor.version, headEventHash: anchor.headEventHash, workspaceId: anchor.workspaceId }
  });

  const events = pages.flatMap((page) => page.records);

  // (1) count. `version` and `total` are two independent statements of the same
  // number by the engine; both are compared, so a disagreement between them
  // surfaces here rather than being silently picked between.
  const total = pages[0]!.total;
  if (total !== anchor.version) {
    throw new EventPagingError(
      `event-list total ${total} disagrees with status version ${anchor.version}`,
      "EVENT_PAGING_TOTAL_DISAGREES_WITH_VERSION",
      { total, version: anchor.version }
    );
  }
  if (events.length !== anchor.version) {
    throw new EventPagingError(
      `assembled ${events.length} events but the chain is at version ${anchor.version} — pages are missing or duplicated`,
      "EVENT_PAGING_COUNT_MISMATCH",
      { assembled: events.length, version: anchor.version, total }
    );
  }
  assertions.push({
    name: "assembled-count-equals-chain-version",
    ok: true,
    detail: { assembled: events.length, version: anchor.version, total }
  });

  // (2) sequence contiguity. Position i must carry sequence i+1: that single
  // check catches a dropped page, a repeated page and a reordered page at once,
  // and does it without trusting the count that a swap would leave intact.
  for (const [index, event] of events.entries()) {
    if (event.sequence !== index + 1) {
      throw new EventPagingError(
        `sequence gap at position ${index + 1}: expected sequence ${index + 1}, read ${event.sequence}`,
        "EVENT_PAGING_SEQUENCE_GAP",
        { position: index + 1, expected: index + 1, received: event.sequence, eventId: event.id }
      );
    }
  }
  assertions.push({
    name: "sequences-contiguous-1-to-n",
    ok: true,
    detail: { first: events[0]?.sequence ?? null, last: events.at(-1)?.sequence ?? null, count: events.length }
  });

  // (3) head. Full 64-hex comparison, never a prefix.
  const tail = events.at(-1);
  if (!tail || tail.eventHash !== anchor.headEventHash) {
    throw new EventPagingError(
      `tail eventHash ${String(tail?.eventHash)} does not equal the chain head ${anchor.headEventHash}`,
      "EVENT_PAGING_HEAD_MISMATCH",
      { tailEventHash: tail?.eventHash ?? null, headEventHash: anchor.headEventHash }
    );
  }
  assertions.push({
    name: "tail-eventHash-equals-chain-head",
    ok: true,
    detail: {
      tailEventHash: tail.eventHash,
      headEventHash: anchor.headEventHash,
      comparedChars: anchor.headEventHash.length
    }
  });

  return { events, assertions };
}

export interface ReadAllEventsOptions {
  readonly read: PageReader;
  readonly anchor: ChainAnchor;
  /** Opening window. The engine's own default is 64; larger is a wager on payload size. */
  readonly initialLimit?: number;
  /** Below this the loop stops halving and reports failure instead of looping to 1 forever. */
  readonly minLimit?: number;
  /** Guard against a reader that never advances; a runaway loop is not a read. */
  readonly maxPages?: number;
}

/**
 * Read the complete event stream, one page at a time, and prove the assembly.
 *
 * Oversize handling: the engine refuses a page that does not fit the canonical
 * ceiling with CLI_EVENT_PAGE_OVERSIZED and names the flag that fixes it. This
 * loop takes that at its word — it halves the window and retries the SAME
 * offset, and records every attempt. It does not skip the offset, does not
 * fall back to a partial stream, and does not swallow any other reason code:
 * anything that is not the oversize refusal propagates untouched, because a
 * read loop that treats every failure as "try smaller" turns a broken chain
 * into a slow one.
 */
export async function readAllEvents(options: ReadAllEventsOptions): Promise<{
  events: readonly EventPageRecord[];
  proof: PagedReadProof;
}> {
  const initialLimit = options.initialLimit ?? 64;
  const minLimit = options.minLimit ?? 1;
  const maxPages = options.maxPages ?? 100_000;
  if (!Number.isSafeInteger(initialLimit) || initialLimit < 1) {
    throw new EventPagingError("initialLimit must be a positive integer", "EVENT_PAGING_WINDOW_INVALID");
  }
  if (minLimit < 1 || minLimit > initialLimit) {
    throw new EventPagingError("minLimit must be between 1 and initialLimit", "EVENT_PAGING_WINDOW_INVALID");
  }

  const pages: EventPageReceipt[] = [];
  const windowSteps: WindowStep[] = [];
  const windowsUsed = new Set<number>();
  let limit = initialLimit;
  let offset = 0;
  let oversizedRefusals = 0;

  while (offset < options.anchor.version) {
    if (pages.length >= maxPages) {
      throw new EventPagingError(
        `page budget of ${maxPages} exhausted at offset ${offset}`,
        "EVENT_PAGING_BUDGET_EXHAUSTED",
        { offset, pages: pages.length }
      );
    }
    let page: EventPageReceipt;
    try {
      page = await options.read(limit, offset);
    } catch (error) {
      const reasonCode = (error as { reasonCode?: unknown })?.reasonCode;
      const oversized = reasonCode === EVENT_PAGE_OVERSIZED
        || String((error as { message?: unknown })?.message ?? "").includes(EVENT_PAGE_OVERSIZED);
      if (!oversized) throw error;
      oversizedRefusals += 1;
      windowSteps.push({ limit, offset, outcome: "oversized", reasonCode: EVENT_PAGE_OVERSIZED });
      const next = Math.floor(limit / 2);
      if (limit <= minLimit || next < minLimit) {
        throw new EventPagingError(
          `a single event at offset ${offset} does not fit one canonical page even at limit ${limit}`,
          "EVENT_PAGING_WINDOW_FLOOR_REACHED",
          { offset, limit, minLimit }
        );
      }
      limit = next;
      continue;
    }
    if (page.records.length === 0) {
      // A zero-record page short of the end is the "limit expressing itself as
      // absence" shape exactly; refusing beats looping forever or stopping early.
      throw new EventPagingError(
        `page at offset ${offset} returned no records while ${options.anchor.version - offset} events remain`,
        "EVENT_PAGING_EMPTY_PAGE",
        { offset, limit, remaining: options.anchor.version - offset }
      );
    }
    pages.push(page);
    windowSteps.push({ limit, offset, outcome: "page", records: page.records.length });
    windowsUsed.add(limit);
    offset += page.records.length;
  }

  const { events, assertions } = assembleEventPages(pages, options.anchor);
  return {
    events,
    proof: {
      anchor: options.anchor,
      events: events.length,
      windowSteps,
      windowsUsed: [...windowsUsed].sort((a, b) => a - b),
      initialLimit,
      finalLimit: limit,
      oversizedRefusals,
      pages: pages.length,
      assertions
    }
  };
}
