import { createHash } from "node:crypto";
import { fail } from "./errors.js";

/**
 * Read-path conventions, ported from the previous system's readback facade.
 *
 * None of these is a framework default, and each exists because its absence produced a
 * real defect: a filter silently ignored, a caller asserting its own identity in a query
 * string, a page that was quietly wrong after the filter changed, a response truncated
 * without saying so.
 */

/**
 * A query string may never name who you are or what you may do.
 *
 * Checked case-INSENSITIVELY and BEFORE the allow-list, on purpose: an unknown key is a
 * typo and gets told so; an authority key is an attempt and gets told something else.
 */
const FORBIDDEN_AUTHORITY_KEYS = new Set([
  "actor", "employeeid", "principalid", "role", "roles", "isinstanceadmin",
  "threadid", "sessionid", "clientenv",
  "auth", "authorization", "bearer", "token", "cookie",
  "apikey", "api_key", "api-token", "api_token",
  "idempotencykey", "expectedversion",
]);

export function rejectForbiddenAuthorityKeys(keys: Iterable<string>): void {
  const forbidden = [...keys]
    .filter((key) => FORBIDDEN_AUTHORITY_KEYS.has(key.toLowerCase()) || key.toLowerCase().endsWith("_pat"))
    .sort((a, b) => a.localeCompare(b));
  if (forbidden.length > 0) {
    fail("client_authority_denied", "A request may not assert its own identity or permissions", {
      forbiddenKeys: forbidden,
    });
  }
}

/** Deny by default. An unknown filter is refused by name, never ignored. */
export function rejectUnsupportedQueryKeys(keys: Iterable<string>, allowed: ReadonlySet<string>): void {
  const unsupported = [...keys].filter((key) => !allowed.has(key)).sort((a, b) => a.localeCompare(b));
  if (unsupported.length > 0) {
    fail("unsupported_filter", "This endpoint does not support those filters", {
      unsupportedKeys: unsupported,
      supported: [...allowed].sort(),
    });
  }
}

/**
 * One value per key, and never an empty one.
 *
 * A repeated key is ambiguous and an empty value is almost always a UI bug that would
 * otherwise read as "no filter" and quietly return everything.
 */
export function singleQueryValue(values: string[] | undefined, key: string): string | undefined {
  if (values === undefined || values.length === 0) return undefined;
  if (values.length > 1 || values[0] === "") {
    fail("unsupported_filter", `The ${key} filter takes exactly one non-empty value`, {
      unsupportedKeys: [key],
    });
  }
  return values[0];
}

export function parseQuery(search: URLSearchParams, allowed: ReadonlySet<string>): Map<string, string> {
  const keys = [...new Set(search.keys())];
  rejectForbiddenAuthorityKeys(keys);
  rejectUnsupportedQueryKeys(keys, allowed);
  const out = new Map<string, string>();
  for (const key of keys) {
    const value = singleQueryValue(search.getAll(key), key);
    if (value !== undefined) out.set(key, value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Keyset cursors
// ---------------------------------------------------------------------------

export interface CursorPayload {
  readonly schemaVersion: string;
  readonly sortVersion: string;
  readonly filterDigest: string;
  readonly limit: number;
  readonly last: { readonly sortKey: string; readonly id: string };
}

/**
 * The digest is taken over the COMPACTED filter object, so an absent filter and a filter
 * explicitly set to undefined produce the same digest and do not invalidate each other's
 * cursors.
 */
export function filterDigest(filters: Record<string, unknown>): string {
  const compact: Record<string, unknown> = {};
  for (const key of Object.keys(filters).sort()) {
    const value = filters[key];
    if (value === undefined || value === null || value === "") continue;
    compact[key] = value;
  }
  return createHash("sha256").update(JSON.stringify(compact)).digest("hex").slice(0, 32);
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Decode in three stages, and refuse on any disagreement.
 *
 * A cursor carries the sort and schema versions it was minted under, so a deploy that
 * changes either invalidates outstanding cursors instead of silently paging through a
 * different ordering. A filter or limit change between pages is a hard refusal rather
 * than a page that is quietly wrong.
 */
export function decodeCursor(
  raw: string,
  expected: { schemaVersion: string; sortVersion: string; filterDigest: string; limit: number },
): CursorPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    fail("validation_failed", "That cursor is not readable", { cursor: "malformed" });
  }
  const cursor = parsed as Partial<CursorPayload>;
  const shapeOk =
    typeof cursor?.schemaVersion === "string" &&
    typeof cursor?.sortVersion === "string" &&
    typeof cursor?.filterDigest === "string" &&
    typeof cursor?.limit === "number" &&
    typeof cursor?.last?.sortKey === "string" &&
    typeof cursor?.last?.id === "string";
  if (!shapeOk) {
    fail("validation_failed", "That cursor is not readable", { cursor: "malformed" });
  }
  if (cursor.schemaVersion !== expected.schemaVersion || cursor.sortVersion !== expected.sortVersion) {
    fail("cursor_filter_mismatch", "That cursor was issued for a different list shape; start again", {
      cursorSchema: cursor.schemaVersion,
      expectedSchema: expected.schemaVersion,
    });
  }
  if (cursor.filterDigest !== expected.filterDigest || cursor.limit !== expected.limit) {
    fail("cursor_filter_mismatch", "The filters changed since that cursor was issued; start again", {});
  }
  return cursor as CursorPayload;
}

// ---------------------------------------------------------------------------
// Response budget
// ---------------------------------------------------------------------------

export const DEFAULT_RESPONSE_BUDGET_BYTES = 512 * 1024;

/**
 * Fail closed.
 *
 * Not one byte of an oversized payload reaches the caller: the refusal names the budget
 * and the count that would have been returned, and the caller lowers its own limit. A
 * truncated array that looks complete is the failure this prevents.
 */
export function enforceResponseBudget<T>(
  body: T,
  budget: number = DEFAULT_RESPONSE_BUDGET_BYTES,
  counted?: number,
): T {
  const bytes = Buffer.byteLength(JSON.stringify(body ?? null), "utf8");
  if (bytes <= budget) return body;
  fail("response_too_large", "The response exceeds this endpoint's byte budget; request fewer rows", {
    responseBudgetBytes: budget,
    measuredBytes: bytes,
    wouldHaveReturned: counted ?? null,
  });
}

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

/**
 * Set on EVERY response, including JSON errors.
 *
 * The previous tree had two read faces that disagreed: one set these, the other set none
 * at all. One process, one header set, no route that can be reached without them.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
};

/**
 * Anti-DNS-rebinding, checked before routing.
 *
 * The port is stripped because an allow-list names a host, and the port a request happens
 * to carry is not part of identity. An empty list disables the check, and that is a
 * deployment's choice to make rather than a default this code makes for it.
 */
export function hostAllowed(hostHeader: string | undefined, allowedHosts: readonly string[]): boolean {
  if (allowedHosts.length === 0) return true;
  const host = typeof hostHeader === "string" ? (hostHeader.split(":")[0] ?? "") : "";
  return allowedHosts.includes(host);
}

/**
 * The deployment must state the interface to bind.
 *
 * The previous face additionally refused `0.0.0.0`, which is correct for a process on a
 * laptop and wrong for a pod — inside Kubernetes the kubelet's probes and the Service
 * both arrive on the pod IP, so refusing the wildcard refuses the platform. The boundary
 * there is the Service, the NetworkPolicy and the Ingress, not the listen address. What
 * survives is the half that still holds: refusing to start without being told.
 */
export function assertStatedBindHost(host: string | undefined): string {
  if (!host || host.trim() === "") {
    throw new Error(
      "AOS refused to start: no bind host stated. Set AOS_BIND_HOST explicitly (0.0.0.0 in a container, 127.0.0.1 for a local run).",
    );
  }
  return host.trim();
}
