#!/usr/bin/env node
// Run the two destructive/in-cluster deployment proofs in their documented order.
// This entrypoint requires kubectl access to the deployed instance and is deliberately
// separate from `pnpm verify`: the persistence check deletes the Postgres pod.

import { spawnSync } from "node:child_process";

const checks = ["scripts/k8s-smoke.mjs", "scripts/k8s-persistence-check.mjs"];
for (const script of checks) {
  const result = spawnSync(process.execPath, [script], { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
