import type { ChainClient } from "./chain-client.js";

/**
 * The safe write surface: the mutations the cockpit performs on a person's
 * behalf, with the ceremony supplied rather than demanded.
 *
 * Every governed mutation needs three things a person should never have to type:
 * the version it expects to be writing against, the instant it occurred, and the
 * actor performing it. Requiring those in a UI would make routine work feel like
 * filling in a form; omitting them is not an option, because they are what makes
 * the record replayable and attributable. So they are supplied here, once.
 *
 * What is deliberately NOT here: opening a deliberation, recording a position,
 * closing minutes, satisfying a gate, and departing a release train. Those carry
 * governance weight that a click should not, and they keep their explicit
 * ceremony — the cockpit routes to guidance rather than performing them.
 */
export interface WriteContext {
  /** Chain the mutation targets. */
  workspacePath: string;
  /**
   * Who is performing this. An attribution claim the engine records, not proof
   * of identity — the cockpit passes through what it was told and never invents
   * an actor to make a write succeed.
   */
  actor: string;
  /** Where time-attestation receipts land, outside the workspace root. */
  attestDir?: string;
}

export class WriteRefused extends Error {
  constructor(message: string, readonly reasonCode: string) {
    super(message);
    this.name = "WriteRefused";
  }
}

/**
 * Instant in the engine's strict format.
 *
 * Second precision with no fractional part, because the engine's canonical form
 * accepts exactly that; a millisecond timestamp is refused, and refusing at the
 * boundary here is clearer than discovering it in a reason code.
 */
function instant(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

export class SafeWriteSurface {
  constructor(private readonly client: ChainClient, private readonly context: WriteContext) {}

  private base(): Record<string, unknown> {
    return {
      workspace: this.context.workspacePath,
      // `head` rather than a number the cockpit read earlier: between render and
      // click the chain may have moved, and a stale expected-version would refuse
      // a write that is perfectly valid. The engine still serialises writes, so
      // this yields to concurrency rather than defeating it.
      "expected-version": "head",
      at: instant(),
      actor: this.context.actor,
      ...(this.context.attestDir ? { "attest-dir": this.context.attestDir } : {})
    };
  }

  /**
   * Create a work item.
   *
   * The title is written into the scope annotation rather than kept beside the
   * chain, because the chain has no title field and a work item's intent belongs
   * on the record rather than only in the cockpit's own store. Creation and
   * annotation are two events; the item exists after the first even if the
   * second fails, which is the honest decomposition of "create with a title".
   */
  async createWork(input: {
    projectId: string;
    externalKey: string;
    kind: string;
    parentId: string | null;
    title: string;
  }): Promise<{ id: string }> {
    const created = await this.call<{ record?: { id?: string } }>("tcrn_workflow_work_create", {
      ...this.base(),
      "project-id": input.projectId,
      "external-key": input.externalKey,
      kind: input.kind,
      // The engine takes a sentinel for "no parent" rather than an omitted flag.
      "parent-id": input.parentId ?? "-"
    });
    const id = created.record?.id;
    if (!id) throw new WriteRefused("work-create returned no record id", "WRITE_SURFACE_NO_RECORD");
    if (input.title.trim()) {
      await this.annotate({ id, scope: input.title });
    }
    return { id };
  }

  /** Move a work item, letting the engine's state machine judge the move. */
  async transition(input: { id: string; status: string }): Promise<void> {
    await this.call("tcrn_workflow_work_transition", {
      ...this.base(),
      id: input.id,
      status: input.status
    });
  }

  /**
   * Annotate a work item's scope, and optionally what decided it.
   *
   * Annotation is additive by design: a later annotation supersedes an earlier
   * one on the record while the earlier event stays in the chain, so editing a
   * title never erases what the title used to say.
   */
  async annotate(input: { id: string; scope?: string; decidedBy?: readonly string[] }): Promise<void> {
    const args: Record<string, unknown> = { ...this.base(), id: input.id };
    if (input.scope !== undefined) args.scope = input.scope;
    if (input.decidedBy !== undefined) {
      // The MCP facade's `list` value kind takes a real array — it refuses a
      // pre-joined comma string or a "-" sentinel with MCP_ARGUMENT_INVALID, and
      // performs the CLI wire conversion (including [] -> "-") itself. This
      // surface once sent the CLI wire format here and every decided-by write
      // was refused; the array passes through untouched so the engine, not this
      // layer, judges the value (an empty list draws the engine's own
      // "non-empty list of minutes ids" refusal).
      args["decided-by"] = [...input.decidedBy];
    }
    await this.call("tcrn_workflow_work_annotate", args);
  }

  /** Enrol a work item in a release train. */
  async enrolInTrain(input: { id: string; workspaceId: string; trainWorkId: string }): Promise<void> {
    await this.call("tcrn_workflow_work_annotate", {
      ...this.base(),
      id: input.id,
      // The engine's wire format for the sprint advisory. A comma stood here
      // until the first engine-proven call refused it (TCRN-AOS-STORY-111).
      sprint: `${input.workspaceId}#${input.trainWorkId}`
    });
  }

  private async call<T>(tool: string, args: Record<string, unknown>): Promise<T> {
    try {
      return await this.client.callTool<T>(tool, args);
    } catch (error) {
      const reasonCode = (error as { reasonCode?: string }).reasonCode ?? "WRITE_SURFACE_REFUSED";
      // Refusals pass through with the engine's own reason code. A cockpit that
      // rephrased INVALID_TRANSITION as "could not save" would hide the one piece
      // of information that tells a person what to do next.
      throw new WriteRefused((error as Error).message, reasonCode);
    }
  }
}

/**
 * Mutations that keep their explicit ceremony, with why.
 *
 * The cockpit shows these as guidance rather than buttons. Each is a governance
 * act whose weight a single click would understate.
 */
export const CEREMONIAL_WRITES: ReadonlyArray<{ verb: string; reason: string }> = [
  { verb: "conference-open", reason: "opens a deliberation that will bind a decision" },
  { verb: "conference-append-position", reason: "records an argument verbatim and permanently" },
  { verb: "conference-close", reason: "produces minutes that later work cites as its ruling" },
  { verb: "gate-transition", reason: "satisfying a gate needs evidence and a permitted identity" },
  { verb: "attestation-enable", reason: "a one-way door that cannot be closed again" },
  { verb: "work-delete", reason: "removal is terminal; correction is an appended record" }
];
