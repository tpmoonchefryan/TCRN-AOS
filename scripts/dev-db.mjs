#!/usr/bin/env node
// Development Postgres, in Docker, on a fixed port.
//
// Tests that touch the database do not skip themselves when it is missing. A test that
// silently does not run is counted as passing by everyone reading the summary, which is
// the failure this project has already been bitten by; instead they fail and say to run
// `pnpm db:up`.

import { execFileSync } from "node:child_process";

const NAME = "aos-dev-pg";
const PORT = process.env.AOS_DEV_DB_PORT ?? "55432";
const IMAGE = "postgres:18-alpine";
const PASSWORD = "devpass";
const DATABASE = "aos";

export const DEV_DATABASE_URL = `postgres://postgres:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}`;

function docker(args, options = {}) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: options.quiet ? "pipe" : "inherit" });
}

function isRunning() {
  try {
    const out = execFileSync("docker", ["ps", "--filter", `name=^${NAME}$`, "--format", "{{.Names}}"], {
      encoding: "utf8",
    });
    return out.trim() === NAME;
  } catch {
    return false;
  }
}

function waitReady(seconds = 60) {
  for (let i = 0; i < seconds; i += 1) {
    try {
      execFileSync("docker", ["exec", NAME, "pg_isready", "-U", "postgres", "-d", DATABASE], {
        stdio: "pipe",
      });
      return true;
    } catch {
      execFileSync("sleep", ["1"]);
    }
  }
  return false;
}

const command = process.argv[2] ?? "up";

if (command === "up") {
  if (isRunning()) {
    console.log(JSON.stringify({ ok: true, state: "already-running", url: DEV_DATABASE_URL }));
    process.exit(0);
  }
  try {
    docker(["rm", "-f", NAME], { quiet: true });
  } catch {
    // Nothing to remove.
  }
  docker(
    [
      "run", "-d", "--name", NAME,
      "-e", `POSTGRES_PASSWORD=${PASSWORD}`,
      "-e", `POSTGRES_DB=${DATABASE}`,
      "-p", `${PORT}:5432`,
      IMAGE,
    ],
    { quiet: true },
  );
  if (!waitReady()) {
    console.error(JSON.stringify({ ok: false, reasonCode: "DEV_DB_NOT_READY" }));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, state: "started", url: DEV_DATABASE_URL }));
} else if (command === "down") {
  try {
    docker(["rm", "-f", NAME], { quiet: true });
  } catch {
    // Already gone.
  }
  console.log(JSON.stringify({ ok: true, state: "removed" }));
} else if (command === "url") {
  console.log(DEV_DATABASE_URL);
} else {
  console.error("usage: dev-db.mjs [up|down|url]");
  process.exit(2);
}
