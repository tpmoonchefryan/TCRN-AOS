import { randomBytes } from "node:crypto";

// Crockford base32, excluding I, L, O and U so a transcribed id cannot be misread.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

let lastTime = 0;
let lastRandom: number[] = [];

function encodeTime(time: number, length: number): string {
  let out = "";
  for (let i = length - 1; i >= 0; i -= 1) {
    const mod = time % 32;
    out = ALPHABET[mod] + out;
    time = (time - mod) / 32;
  }
  return out;
}

function randomChars(length: number): number[] {
  const bytes = randomBytes(length);
  const out: number[] = [];
  for (let i = 0; i < length; i += 1) out.push(bytes[i]! % 32);
  return out;
}

// Within the same millisecond the previous randomness is incremented rather than
// redrawn, so ids minted in a tight loop still sort in creation order. Without this two
// rows written in the same millisecond sort arbitrarily, and "oldest first" quietly
// stops meaning that.
function monotonicRandom(time: number): number[] {
  if (time === lastTime) {
    for (let i = lastRandom.length - 1; i >= 0; i -= 1) {
      if (lastRandom[i]! < 31) {
        lastRandom[i] = lastRandom[i]! + 1;
        return lastRandom.slice();
      }
      lastRandom[i] = 0;
    }
    return lastRandom.slice();
  }
  lastTime = time;
  lastRandom = randomChars(16);
  return lastRandom.slice();
}

/**
 * A sortable, opaque identifier: 48 bits of timestamp then 80 bits of randomness.
 *
 * Ids are opaque on purpose. Deriving one from the record's content — the shape this
 * rebuild replaces — means two records with identical fields collide and silently
 * overwrite each other, and the digest stops matching the record the moment anyone
 * edits it.
 */
export function ulid(now = Date.now()): string {
  return encodeTime(now, 10) + monotonicRandom(now).map((n) => ALPHABET[n]).join("");
}

export type IdPrefix =
  | "wi" | "pr" | "pi" | "se" | "tk" | "cm" | "rv" | "rel"
  | "lb" | "sp" | "pg" | "at" | "bd" | "bc" | "sv" | "gt"
  | "gd" | "dl" | "dp" | "dm" | "dc" | "nt";

/** Prefixed id. The prefix is for humans reading logs; nothing parses it back. */
export function newId(prefix: IdPrefix, now = Date.now()): string {
  return `${prefix}_${ulid(now)}`;
}

/**
 * Lexicographic rank between two neighbours, for board and page ordering.
 *
 * Ranking with integers means one drag renumbers a whole column; ranking with strings
 * means one drag writes one row.
 */
export function rankBetween(before: string | null, after: string | null): string {
  const lo = before ?? "";
  const hi = after ?? "";
  if (hi && lo >= hi) return lo + "m";

  let prefix = "";
  let i = 0;
  for (;;) {
    const a = lo.charCodeAt(i);
    const b = hi.charCodeAt(i);
    const aCode = Number.isNaN(a) ? 96 : a; // just below 'a'
    const bCode = Number.isNaN(b) ? 123 : b; // just above 'z'
    if (bCode - aCode > 1) {
      return prefix + String.fromCharCode(Math.floor((aCode + bCode) / 2));
    }
    prefix += Number.isNaN(a) ? "a" : lo[i]!;
    i += 1;
  }
}
