#!/usr/bin/env node
// Only the kernel may reach the store.
//
// This is the gate the other parity gates rest on. Authorization is checked in exactly
// one place — `dispatch` — and if a transport or a page could import the store directly
// it could read and write around that check, at which point proving the surfaces agree
// proves nothing about what they are allowed to do.

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Directories that may not import the store, and the reason each is on the list. */
const FORBIDDEN = [
  { dir: "apps/server", why: "the HTTP transport must go through dispatch, where authorization is checked" },
  { dir: "apps/web", why: "a rendered page must go through dispatch, or the UI could show what the API would refuse" },
  { dir: "packages/mcp", why: "the MCP surface must not be able to exceed what the same principal could do over HTTP" },
];

const STORE_IMPORT = /from\s+["'][^"']*packages\/store\/[^"']*["']|from\s+["']\.\.\/\.\.\/store\/[^"']*["']/;
const DIRECT_QUERY = /\.query\s*\(/;

// The exemptions are exactly the process entrypoints. A `main` has to create the pool and
// run migrations before any request exists, so it necessarily touches the store — but it
// serves no request, and everything that does goes through the kernel. The boundary is
// "is this a process entrypoint", not "did this happen to fail the check".
const EXEMPT = new Set(["apps/server/src/main.ts", "packages/mcp/src/stdio.ts"]);

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      yield* walk(full);
    } else if (/\.(ts|tsx|mjs)$/.test(entry.name)) {
      yield full;
    }
  }
}

const violations = [];
for (const { dir, why } of FORBIDDEN) {
  for await (const file of walk(join(repoRoot, dir))) {
    const rel = relative(repoRoot, file);
    if (EXEMPT.has(rel)) continue;
    const source = await readFile(file, "utf8");
    for (const [index, line] of source.split("\n").entries()) {
      if (STORE_IMPORT.test(line)) {
        violations.push({ file: rel, line: index + 1, statement: line.trim(), why });
      }
    }
  }
}

for (const dir of ["apps/web/src/pages", "apps/server/src/render.tsx"]) {
  const root = join(repoRoot, dir);
  const candidates = dir.endsWith(".tsx") ? [root] : [];
  if (candidates.length === 0) {
    for await (const file of walk(root)) candidates.push(file);
  }
  for (const file of candidates) {
    const rel = relative(repoRoot, file);
    const source = await readFile(file, "utf8");
    for (const [index, line] of source.split("\n").entries()) {
      if (DIRECT_QUERY.test(line)) {
        violations.push({
          file: rel,
          line: index + 1,
          statement: line.trim(),
          why: "rendered pages may only call dispatch; a direct query would bypass authorization",
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(
    JSON.stringify(
      { ok: false, reasonCode: "SIDE_DOOR_IMPORT", violations, exempt: [...EXEMPT] },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checkedDirectories: FORBIDDEN.map((entry) => entry.dir), exempt: [...EXEMPT] }));
