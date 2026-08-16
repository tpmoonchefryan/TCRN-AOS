#!/usr/bin/env node
// S200 local read face. All five governed chains are local after the final
// handover; this module keeps read-only proofs on the installed local engine and
// makes a retired VM facade an explicit, impossible-to-ignore distinction.

import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { PARTITION_ROSTER, PLATFORM_ROOT } from "./topology.mjs";

const runFile = promisify(execFile);
const LOCAL_ENGINE_ROOT = process.env.TCRN_AOS_ENGINE_ROOT
  ?? resolve(homedir(), ".tcrn-workflow", "tcrn-workflow");
const LOCAL_ENGINE_CLI = resolve(LOCAL_ENGINE_ROOT, "scripts", "tcrn-workflow.mjs");
const MAX_BUFFER = 64 * 1024 * 1024;

export function localWorkspaceFor(partition) {
  const entry = PARTITION_ROSTER.find((candidate) => candidate.partitionId === partition);
  if (!entry) {
    const error = new Error(`partition ${partition} is absent from the local topology roster`);
    error.reasonCode = "LOCAL_ENGINE_PARTITION_NOT_ROSTERED";
    throw error;
  }
  if (entry.home !== "local") {
    const error = new Error(`partition ${partition} is not local after S200`);
    error.reasonCode = "LOCAL_ENGINE_REQUIRED_FOR_LOCAL_HOME";
    throw error;
  }
  return resolve(PLATFORM_ROOT, entry.liveAddress);
}

function jsonFromOutput(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Run one read-only local engine command; refusal is returned as data. */
export async function localEngine(verb, partition, flags = {}) {
  const workspace = localWorkspaceFor(partition);
  const arguments_ = [LOCAL_ENGINE_CLI, verb, "--workspace", workspace];
  for (const [name, value] of Object.entries(flags)) {
    if (value === undefined || value === null) continue;
    arguments_.push(`--${name}`, String(value));
  }
  try {
    const { stdout } = await runFile(process.execPath, arguments_, {
      cwd: PLATFORM_ROOT,
      maxBuffer: MAX_BUFFER,
    });
    const json = jsonFromOutput(stdout);
    if (json === null) {
      return {
        accepted: false,
        json: null,
        reasonCode: "LOCAL_ENGINE_NON_JSON_OUTPUT",
      };
    }
    return { accepted: true, json };
  } catch (error) {
    const json = jsonFromOutput(error?.stdout) ?? jsonFromOutput(error?.stderr);
    return {
      accepted: false,
      json,
      reasonCode: json?.reasonCode ?? "LOCAL_ENGINE_READ_REFUSED",
      exitCode: error?.code ?? error?.status ?? null,
    };
  }
}

export async function localChainHead(partition) {
  const result = await localEngine("status", partition);
  if (!result.accepted) {
    const error = new Error(`status refused for ${partition}: ${result.reasonCode ?? result.exitCode}`);
    error.reasonCode = result.reasonCode ?? "LOCAL_ENGINE_STATUS_REFUSED";
    throw error;
  }
  const body = result.json ?? {};
  return {
    workspaceId: body.workspaceId,
    version: body.version,
    headEventHash: body.headEventHash,
  };
}
