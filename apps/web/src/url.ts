/**
 * The single place a URL with a query string is constructed.
 *
 * The previous implementation APPENDED the shell's state to the caller's query string,
 * producing a second `?`. Browsers and URLSearchParams both read that as part of the
 * preceding value, so `/work-items?project=TCRN-TMS` became a filter for a project
 * literally named `TCRN-TMS?locale=en`. Every filter link on the page returned zero rows
 * while the page itself rendered perfectly — which is why it survived review.
 *
 * So: MERGE, never append. One URLSearchParams, one `?`, each key written once.
 */

export type QueryValue = string | number | boolean | null | undefined;

export function buildHref(
  pathname: string,
  current: URLSearchParams | Record<string, QueryValue>,
  changes: Record<string, QueryValue> = {},
): string {
  const params = new URLSearchParams();

  const seed = current instanceof URLSearchParams ? [...current.entries()] : Object.entries(current);
  for (const [key, value] of seed) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
      continue;
    }
    params.set(key, String(value));
  }

  // Stable order, so two links to the same view are the same string and a cache or a
  // test can compare them.
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const query = sorted.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
  return query.length > 0 ? `${pathname}?${query}` : pathname;
}

/** The href that removes exactly one applied condition, leaving everything else alone. */
export function hrefWithout(pathname: string, current: URLSearchParams, key: string): string {
  return buildHref(pathname, current, { [key]: null });
}

/**
 * Reset the conditions but keep the scope.
 *
 * The project is not a filter on this page; it is which workspace you are looking at.
 * Clearing it as if it were a condition throws the reader out of the place they were in.
 */
export function hrefResetConditions(pathname: string, current: URLSearchParams): string {
  const kept: Record<string, QueryValue> = {};
  const project = current.get("project");
  if (project) kept.project = project;
  return buildHref(pathname, kept);
}
