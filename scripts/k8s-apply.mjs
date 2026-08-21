#!/usr/bin/env node
// Apply the supported single-node manifest. This is an operator action, never part of verify.

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
execFileSync("kubectl", ["apply", "-k", resolve(repoRoot, "deploy/k8s/overlays/single-node")], { stdio: "inherit" });
