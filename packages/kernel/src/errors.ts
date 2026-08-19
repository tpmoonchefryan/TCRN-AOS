/**
 * Every refusal carries a stable machine-readable reason code.
 *
 * A flattened 500 tells a caller nothing about whether to retry, fix the request, or ask
 * someone for access. The codes here are part of the API contract: they appear in the
 * OpenAPI document and in MCP tool errors, and they do not change meaning between
 * releases.
 */
export type ReasonCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "stale_version"
  | "validation_failed"
  | "unsupported_filter"
  | "client_authority_denied"
  | "cursor_filter_mismatch"
  | "response_too_large"
  | "transition_not_permitted"
  | "gate_pending"
  | "immutable_record"
  | "duplicate_key"
  | "rate_limited"
  | "csrf_failed"
  | "payload_too_large"
  | "unsupported_media_type"
  | "internal_error";

const STATUS: Record<ReasonCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  stale_version: 409,
  validation_failed: 400,
  unsupported_filter: 400,
  client_authority_denied: 400,
  cursor_filter_mismatch: 400,
  response_too_large: 413,
  transition_not_permitted: 409,
  gate_pending: 409,
  immutable_record: 409,
  duplicate_key: 409,
  rate_limited: 429,
  csrf_failed: 403,
  payload_too_large: 413,
  unsupported_media_type: 415,
  internal_error: 500,
};

export class AosError extends Error {
  readonly reasonCode: ReasonCode;
  readonly status: number;
  readonly detail: Record<string, unknown>;

  constructor(reasonCode: ReasonCode, message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = "AosError";
    this.reasonCode = reasonCode;
    this.status = STATUS[reasonCode];
    this.detail = detail;
  }

  toPayload(): { ok: false; reasonCode: ReasonCode; message: string; detail: Record<string, unknown> } {
    return { ok: false, reasonCode: this.reasonCode, message: this.message, detail: this.detail };
  }
}

export function fail(
  reasonCode: ReasonCode,
  message: string,
  detail: Record<string, unknown> = {},
): never {
  throw new AosError(reasonCode, message, detail);
}

/**
 * Normalise anything thrown into a payload safe to send.
 *
 * An unexpected error's own message never crosses the boundary: it is the one string
 * most likely to carry a connection URL, a file path, or a fragment of somebody's data.
 */
export function normaliseError(error: unknown): {
  status: number;
  payload: { ok: false; reasonCode: ReasonCode; message: string; detail: Record<string, unknown> };
} {
  if (error instanceof AosError) {
    return { status: error.status, payload: error.toPayload() };
  }
  const pg = error as { code?: string; constraint?: string };
  if (pg?.code === "23505") {
    const conflict = new AosError("duplicate_key", "A record with that key already exists", {
      constraint: pg.constraint ?? null,
    });
    return { status: conflict.status, payload: conflict.toPayload() };
  }
  if (pg?.code === "23514" || pg?.code === "23503") {
    const invalid = new AosError("validation_failed", "The request violates a data constraint", {
      constraint: pg.constraint ?? null,
    });
    return { status: invalid.status, payload: invalid.toPayload() };
  }
  // The append-only triggers raise restrict_violation with an AOS_APPEND_ONLY prefix.
  if (pg?.code === "2F004" || /AOS_APPEND_ONLY/.test(String((error as Error)?.message ?? ""))) {
    const immutable = new AosError("immutable_record", "That record is immutable; write a superseding record instead");
    return { status: immutable.status, payload: immutable.toPayload() };
  }
  console.error(
    JSON.stringify({ level: "error", at: "unhandled", message: (error as Error)?.message ?? String(error) }),
  );
  const internal = new AosError("internal_error", "The request could not be completed");
  return { status: internal.status, payload: internal.toPayload() };
}
