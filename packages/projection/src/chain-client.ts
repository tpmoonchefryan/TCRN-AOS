import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

/**
 * A read-only client for the governed Workflow MCP facade.
 *
 * Everything the cockpit knows about the chains arrives through this class, and
 * it can only read. That is a deliberate boundary, not an oversight: the chain
 * is the truth and the cockpit is a derivative, so a projection pipeline that
 * could write would be able to alter the thing it claims to mirror.
 *
 * Why MCP rather than parsing `.tcrn-workflow/` directly: replay semantics —
 * canonical bytes, hash linkage, tombstones, advisory extension merging — live
 * in the engine. A second reader would be a second implementation of those
 * semantics, and it would drift. Measured cost of going through the facade on
 * the largest live chain is ~130ms per call against ~190ms for a cold CLI spawn,
 * far below any interactive threshold, so there is nothing to buy by drifting.
 */
export interface ChainClientOptions {
  /** Path to the governed copy's `tcrn-workflow-mcp.mjs`. */
  serverPath: string;
  /** Operator authority pins, supplied together or not at all. */
  authorityPins?: string;
  authorityPinsDigest?: string;
  /** Per-call ceiling; a hung facade must not hang the cockpit. */
  timeoutMs?: number;
}

export class ChainClientError extends Error {
  constructor(message: string, readonly reasonCode: string) {
    super(message);
    this.name = "ChainClientError";
  }
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class ChainClient {
  private child: ChildProcessWithoutNullStreams | undefined;
  private buffer = "";
  private nextId = 1;
  private readonly pending = new Map<number, PendingCall>();
  private readonly timeoutMs: number;

  constructor(private readonly options: ChainClientOptions) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
    if ((options.authorityPins === undefined) !== (options.authorityPinsDigest === undefined)) {
      throw new ChainClientError(
        "authorityPins and authorityPinsDigest must be supplied together",
        "CHAIN_CLIENT_AUTHORITY_INCOMPLETE"
      );
    }
  }

  /**
   * Start the facade and complete the MCP handshake.
   *
   * The server is spawned `detached` so teardown can reclaim the whole process
   * group. Killing only the direct child leaves the real binary reparented to
   * init — a leak this platform has caught three separate times, so the spawn
   * and its reclaim are written together here rather than left to callers.
   */
  async start(): Promise<void> {
    if (this.child) return;
    const args = [this.options.serverPath];
    if (this.options.authorityPins && this.options.authorityPinsDigest) {
      args.push(
        "--authority-pins", this.options.authorityPins,
        "--authority-pins-digest", this.options.authorityPinsDigest
      );
    }
    const child = spawn(process.execPath, args, { stdio: ["pipe", "pipe", "pipe"], detached: true });
    this.child = child;
    child.stdout.on("data", (chunk: Buffer) => this.consume(chunk));
    child.on("exit", (code, signal) => {
      const error = new ChainClientError(
        `workflow MCP facade exited (code=${String(code)} signal=${String(signal)})`,
        "CHAIN_CLIENT_SERVER_EXITED"
      );
      for (const call of this.pending.values()) {
        clearTimeout(call.timer);
        call.reject(error);
      }
      this.pending.clear();
      this.child = undefined;
    });

    await this.rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "tcrn-aos-projection", version: "1" }
    });
    this.write({ jsonrpc: "2.0", method: "notifications/initialized" });
  }

  /** Reclaim the whole process group; safe to call more than once. */
  async stop(): Promise<void> {
    const child = this.child;
    if (!child?.pid) return;
    this.child = undefined;
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* group already gone */ }
    try { child.kill("SIGKILL"); } catch { /* already gone */ }
  }

  /**
   * Call a read-only Workflow tool.
   *
   * Refusals are surfaced with the engine's own reason code rather than
   * translated: a caller that sees `WORKSPACE_VIEW_STALE` or
   * `OPERATOR_AUTHORITY_COMMAND_NOT_GRANTED` should read the engine's word for
   * what happened, not this client's paraphrase of it.
   */
  async callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    if (!this.child) await this.start();
    const result = await this.rpc("tools/call", { name, arguments: args }) as {
      isError?: boolean;
      content?: Array<{ text?: string }>;
    };
    const text = (result.content ?? []).map((part) => part.text ?? "").join("");
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ChainClientError(
        `tool ${name} returned a non-JSON body`,
        "CHAIN_CLIENT_RESPONSE_MALFORMED"
      );
    }
    const envelope = payload as { ok?: boolean; reasonCode?: string; error?: string };
    if (result.isError || envelope?.ok === false) {
      throw new ChainClientError(
        `${name}: ${envelope?.reasonCode ?? "unknown"} ${envelope?.error ?? ""}`.trim(),
        envelope?.reasonCode ?? "CHAIN_CLIENT_TOOL_REFUSED"
      );
    }
    return payload as T;
  }

  private write(message: unknown): void {
    this.child?.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private rpc(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new ChainClientError(`${method} timed out`, "CHAIN_CLIENT_TIMEOUT"));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }

  private consume(chunk: Buffer): void {
    this.buffer += chunk.toString("utf8");
    let newline = this.buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      newline = this.buffer.indexOf("\n");
      if (!line) continue;
      let message: { id?: number; result?: unknown; error?: { message?: string } };
      try {
        message = JSON.parse(line);
      } catch {
        continue; // the facade may emit non-JSON diagnostics; they are not replies
      }
      if (typeof message.id !== "number") continue;
      const call = this.pending.get(message.id);
      if (!call) continue;
      this.pending.delete(message.id);
      clearTimeout(call.timer);
      if (message.error) {
        call.reject(new ChainClientError(message.error.message ?? "rpc error", "CHAIN_CLIENT_RPC_ERROR"));
      } else {
        call.resolve(message.result);
      }
    }
  }
}
