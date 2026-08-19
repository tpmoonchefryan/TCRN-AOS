/**
 * Text analysis for search.
 *
 * The measured problem: `to_tsvector('simple', '工单管理')` produces ONE lexeme for the
 * whole run, so searching 工单 — a two-character word, which is the dominant Chinese
 * word form — matches nothing. `pg_trgm` does not rescue it either: its GIN index cannot
 * accelerate a pattern shorter than three characters.
 *
 * So CJK runs are emitted as overlapping bigrams and Latin runs as ordinary lowercased
 * words, and the SAME function runs on the query side. Write-side and query-side drift
 * is impossible because there is only one emitter.
 *
 * The ceiling is real but the escape hatch is open: pgroonga, pg_bigm and zhparser are a
 * CREATE EXTENSION away in a custom image, and swapping the analyzer is a reindex rather
 * than a rewrite.
 */

// CJK ideographs, plus kana and Hangul, which have the same no-spaces property.
const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/;

export function isCjk(ch: string): boolean {
  return CJK.test(ch);
}

/**
 * Split text into tokens: bigrams for CJK runs, whole words for everything else.
 *
 * A single CJK character on its own (a one-character query, or a run of length one)
 * is emitted as itself so it is still findable.
 */
export function analyze(text: string): string[] {
  const tokens: string[] = [];
  let latin = "";
  let cjk = "";

  const flushLatin = (): void => {
    if (latin.length > 0) {
      tokens.push(latin.toLowerCase());
      latin = "";
    }
  };
  const flushCjk = (): void => {
    if (cjk.length === 0) return;
    if (cjk.length === 1) {
      tokens.push(cjk);
    } else {
      for (let i = 0; i < cjk.length - 1; i += 1) tokens.push(cjk.slice(i, i + 2));
    }
    cjk = "";
  };

  for (const ch of text) {
    if (CJK.test(ch)) {
      flushLatin();
      cjk += ch;
      continue;
    }
    if (/[\p{L}\p{N}_]/u.test(ch)) {
      flushCjk();
      latin += ch;
      continue;
    }
    flushLatin();
    flushCjk();
  }
  flushLatin();
  flushCjk();
  return tokens;
}

/** Postgres rejects a lexeme containing an unescaped quote or backslash. */
function quoteLexeme(token: string): string {
  return `'${token.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

/**
 * Build the tsvector literal for a document. Title tokens are weighted A, body B, so a
 * match in the title outranks a match buried in a long page.
 */
export function toVectorParts(title: string, body: string): { titleTokens: string; bodyTokens: string } {
  return { titleTokens: analyze(title).join(" "), bodyTokens: analyze(body).join(" ") };
}

/**
 * Build a tsquery string. Terms are ANDed: a two-term search means both, which is what
 * people expect from a search box and what keeps a broad query from returning the world.
 */
export function toQuery(input: string): string | null {
  const tokens = analyze(input);
  if (tokens.length === 0) return null;
  return tokens.map(quoteLexeme).join(" & ");
}

/**
 * Prefix-ish query for typeahead: the last token is treated as a prefix so results
 * appear while the word is still being typed.
 */
export function toPrefixQuery(input: string): string | null {
  const tokens = analyze(input);
  if (tokens.length === 0) return null;
  const parts = tokens.map((token, index) =>
    index === tokens.length - 1 ? `${quoteLexeme(token)}:*` : quoteLexeme(token),
  );
  return parts.join(" & ");
}
