#!/usr/bin/env node
// INIT-020 TCRN-CROSS-STORY-196 — production readiness gate.
//
// This is the one-command decision for the final handover: seven independent
// probes, one aggregate judgement, and one red-leg rehearsal for every probe.
// The gate is read-only. A weekly result may be annotated onto the governed
// work item by a separate, explicitly authorised ceremony; this file never
// writes a control tree or a work record as part of measuring it.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";

import { ChainClient } from "../../dist/packages/projection/src/index.js";
import { buildHelperRepinPlan } from "./helper-repin-plan.mjs";
import { localEngine, localWorkspaceFor } from "./local-engine-read.mjs";
import { PARTITION_ROSTER, PLATFORM_ROOT } from "./topology.mjs";
import { proveCloseout } from "./closeout-chain-proof.mjs";
import { verifyStopPactChannel } from "../../../TCRN-Workflow/tools/stop-pact/verify-channel.mjs";

const AOS_ROOT = resolve(PLATFORM_ROOT, "TCRN-AOS");
const LOCAL_ENGINE_ROOT = process.env.TCRN_AOS_ENGINE_ROOT
  ?? resolve(homedir(), ".tcrn-workflow", "tcrn-workflow");
const MCP_SERVER = resolve(LOCAL_ENGINE_ROOT, "scripts", "tcrn-workflow-mcp.mjs");
const CROSS_PARTITION = "cross-project";

export const PRODUCTION_PROBES = Object.freeze([
  "local-chain-integrity",
  "mcp-single-truth",
  "init-020-closeout",
  "stop-pact-channel",
  "helper-engine-pin",
  "knowledge-freshness",
  "fail-closed-write-refusal",
]);

const now = () => new Date().toISOString().replace(/\.\d+Z$/u, "Z");

function safeMessage(error) {
  return String(error?.message ?? error ?? "unknown error")
    .replaceAll(PLATFORM_ROOT, "<platform>")
    .replaceAll(AOS_ROOT, "<aos>")
    .replaceAll(LOCAL_ENGINE_ROOT, "<installed-engine>");
}

function probeFailure(id, reasonCode, error, details = {}) {
  return {
    id,
    ok: false,
    reasonCode,
    ...(error === undefined ? {} : { error: safeMessage(error) }),
    ...details,
  };
}

function headOf(body) {
  return {
    workspaceId: body?.workspaceId ?? null,
    version: Number.isSafeInteger(body?.version) ? body.version : null,
    headEventHash: typeof body?.headEventHash === "string" ? body.headEventHash : null,
  };
}

function sameHead(left, right) {
  return left.workspaceId !== null
    && left.workspaceId === right.workspaceId
    && left.version !== null
    && left.version === right.version
    && left.headEventHash !== null
    && left.headEventHash === right.headEventHash;
}

async function localChainIntegrityProbe() {
  const rows = await Promise.all(PARTITION_ROSTER.map(async (entry) => {
    const [status, validate] = await Promise.all([
      localEngine("status", entry.partitionId),
      localEngine("validate", entry.partitionId),
    ]);
    const statusHead = status.accepted ? headOf(status.json) : null;
    const validateHead = validate.accepted ? headOf(validate.json) : null;
    const identityOk = statusHead?.workspaceId === entry.workspaceId;
    const ok = status.accepted && validate.accepted
      && identityOk
      && statusHead !== null
      && validateHead !== null
      && sameHead(statusHead, validateHead);
    return {
      partition: entry.partitionId,
      ok,
      statusAccepted: status.accepted,
      validateAccepted: validate.accepted,
      statusReasonCode: status.json?.reasonCode ?? status.reasonCode ?? null,
      validateReasonCode: validate.json?.reasonCode ?? validate.reasonCode ?? null,
      identityOk,
      statusHead,
      validateHead,
    };
  }));
  return {
    id: "local-chain-integrity",
    ok: rows.every((row) => row.ok),
    reasonCode: rows.every((row) => row.ok)
      ? "LOCAL_STATUS_VALIDATE_VERIFIED"
      : "LOCAL_STATUS_VALIDATE_RED",
    partitions: rows,
  };
}

async function withMcp(callback) {
  const client = new ChainClient({ serverPath: MCP_SERVER, timeoutMs: 120_000 });
  try {
    return await callback(client);
  } finally {
    await client.stop();
  }
}

async function mcpSingleTruthProbe() {
  return withMcp(async (client) => {
    const rows = await Promise.all(PARTITION_ROSTER.map(async (entry) => {
      try {
        const [cli, mcp] = await Promise.all([
          localEngine("status", entry.partitionId),
          client.callTool("tcrn_workflow_status", {
            workspace: localWorkspaceFor(entry.partitionId),
          }),
        ]);
        const cliHead = cli.accepted ? headOf(cli.json) : null;
        const mcpHead = headOf(mcp);
        const ok = cli.accepted && cliHead !== null && sameHead(cliHead, mcpHead);
        return {
          partition: entry.partitionId,
          ok,
          cliAccepted: cli.accepted,
          cliReasonCode: cli.json?.reasonCode ?? cli.reasonCode ?? null,
          cliHead,
          mcpHead,
        };
      } catch (error) {
        return {
          partition: entry.partitionId,
          ok: false,
          reasonCode: error?.reasonCode ?? "MCP_SINGLE_TRUTH_READ_REFUSED",
          error: safeMessage(error),
        };
      }
    }));
    const ok = rows.every((row) => row.ok);
    return {
      id: "mcp-single-truth",
      ok,
      reasonCode: ok ? "MCP_CLI_HEADS_MATCH" : "MCP_CLI_HEAD_MISMATCH",
      partitions: rows,
    };
  });
}

async function closeoutProbe() {
  const result = await proveCloseout();
  const head = result.authorityRead?.head ?? null;
  return {
    id: "init-020-closeout",
    ok: result.ok === true,
    reasonCode: result.reasonCode ?? (result.ok ? "CLOSEOUT_VERIFIED" : "CLOSEOUT_RED"),
    source: result.source ?? result.authorityRead?.source ?? null,
    itemCount: Number.isSafeInteger(result.itemCount)
      ? result.itemCount
      : Array.isArray(result.items) ? result.items.length : null,
    head: head === null ? null : headOf(head),
    problems: (result.problems ?? []).map((problem) => safeMessage(problem)),
  };
}

function stopPactProbe() {
  const result = verifyStopPactChannel({ projectDirs: [PLATFORM_ROOT, AOS_ROOT] });
  const roots = (result.roots ?? []).map((root) => ({
    project: root.projectDir === PLATFORM_ROOT ? "platform-root"
      : root.projectDir === AOS_ROOT ? "TCRN-AOS" : "other",
    ok: root.ok === true,
    reason: root.reason ?? null,
    detail: root.detail ?? null,
  }));
  return {
    id: "stop-pact-channel",
    ok: result.ok === true,
    reasonCode: result.status ?? result.reason ?? "STOP_PACT_CHANNEL_UNPROVEN",
    roots,
    detail: result.detail ?? null,
  };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function version(value) {
  return typeof value === "string" ? value.replace(/^v/u, "") : null;
}

function helperEnginePinProbe() {
  const plan = buildHelperRepinPlan();
  const enginePackage = readJson(join(LOCAL_ENGINE_ROOT, "package.json"));
  const engineVersion = version(enginePackage?.version);
  const observed = {
    provenance: version(plan.current?.provenanceVersion),
    claudeInstalled: version(plan.current?.claudeInstalledVersion),
    codexInstalled: version(plan.current?.codexInstalledVersion),
  };
  const versionsMatch = engineVersion !== null
    && Object.values(observed).every((value) => value === engineVersion);
  const ok = plan.ready === true && versionsMatch;
  return {
    id: "helper-engine-pin",
    ok,
    reasonCode: ok ? "HELPER_ENGINE_PIN_VERIFIED" : plan.reasonCode,
    engineVersion,
    observed,
    versionsMatch,
    ownerApprovalRequired: plan.ready !== true,
  };
}

async function knowledgeFreshnessProbe() {
  const at = now();
  const rows = await Promise.all(PARTITION_ROSTER.map(async (entry) => {
    const result = await localEngine("knowledge-freshness", entry.partitionId, { at });
    const records = Array.isArray(result.json?.records) ? result.json.records : [];
    const stale = records.filter((record) => record?.state === "stale");
    const unknown = records.filter((record) => record?.state !== "fresh");
    const ok = result.accepted
      && result.json?.reasonCode === "KNOWLEDGE_FRESHNESS_EVALUATED"
      && stale.length === 0
      && unknown.length === 0;
    return {
      partition: entry.partitionId,
      ok,
      accepted: result.accepted,
      reasonCode: result.json?.reasonCode ?? result.reasonCode ?? null,
      recordCount: records.length,
      staleCount: stale.length,
      unknownCount: unknown.length,
    };
  }));
  const ok = rows.every((row) => row.ok);
  return {
    id: "knowledge-freshness",
    ok,
    reasonCode: ok ? "KNOWLEDGE_FRESHNESS_ALL_FRESH" : "KNOWLEDGE_FRESHNESS_RED",
    at,
    partitions: rows,
  };
}

async function failClosedWriteRefusalProbe() {
  try {
    const status = await localEngine("status", CROSS_PARTITION);
    const expectedVersion = status.accepted && Number.isSafeInteger(status.json?.version)
      ? status.json.version
      : "head";
    const refusal = await withMcp((client) => client.callTool("tcrn_workflow_work_transition", {
      workspace: localWorkspaceFor(CROSS_PARTITION),
      expectedVersion,
      at: now(),
      id: "work:ecfba950a6fa5233d4b1f414",
      status: "active",
      actor: "person:foreign-untrusted-write-probe",
    }));
    return probeFailure(
      "fail-closed-write-refusal",
      "UNEXPECTED_WRITE_ACCEPTED",
      undefined,
      { acceptedResponse: refusal },
    );
  } catch (error) {
    const ok = error?.reasonCode === "OPERATOR_AUTHORITY_REQUIRED";
    return {
      id: "fail-closed-write-refusal",
      ok,
      reasonCode: ok ? "MCP_EXTERNAL_WRITE_REFUSED" : (error?.reasonCode ?? "MCP_WRITE_REFUSAL_UNPROVEN"),
      attemptedTool: "tcrn_workflow_work_transition",
      refusalReasonCode: error?.reasonCode ?? null,
      refusal: safeMessage(error),
    };
  }
}

export function judgeProductionReadiness(observations) {
  const byId = new Map((Array.isArray(observations) ? observations : []).map((probe) => [probe?.id, probe]));
  const failedProbes = PRODUCTION_PROBES.filter((id) => byId.get(id)?.ok !== true);
  return {
    ok: failedProbes.length === 0,
    decision: failedProbes.length === 0 ? "PRODUCTION_READY" : "NOT_READY",
    failedProbes,
  };
}

export function rehearseRedLegs(observations) {
  return PRODUCTION_PROBES.map((target) => {
    const simulated = PRODUCTION_PROBES.map((id) => {
      const original = (observations ?? []).find((probe) => probe?.id === id);
      return id === target
        ? { ...(original ?? { id }), id, ok: false, reasonCode: "RED_LEG_INJECTED" }
        : (original ?? { id, ok: false, reasonCode: "PROBE_MISSING" });
    });
    const judgement = judgeProductionReadiness(simulated);
    const ok = judgement.decision === "NOT_READY" && judgement.failedProbes.includes(target);
    return {
      target,
      ok,
      observedDecision: judgement.decision,
      failedProbes: judgement.failedProbes,
    };
  });
}

async function runProbe(id, callback) {
  try {
    return await callback();
  } catch (error) {
    return probeFailure(id, "PROBE_THROWN", error);
  }
}

export async function runProductionReadiness() {
  const observations = [
    await runProbe("local-chain-integrity", localChainIntegrityProbe),
    await runProbe("mcp-single-truth", mcpSingleTruthProbe),
    await runProbe("init-020-closeout", closeoutProbe),
    await runProbe("stop-pact-channel", async () => stopPactProbe()),
    await runProbe("helper-engine-pin", async () => helperEnginePinProbe()),
    await runProbe("knowledge-freshness", knowledgeFreshnessProbe),
    await runProbe("fail-closed-write-refusal", failClosedWriteRefusalProbe),
  ];
  const judgement = judgeProductionReadiness(observations);
  const redLegs = rehearseRedLegs(observations);
  const redLegsOk = redLegs.every((leg) => leg.ok);
  return {
    schemaVersion: "tcrn.production-readiness.v1",
    observedAt: now(),
    ...judgement,
    redLegs,
    redLegsOk,
    probes: observations,
  };
}

if (process.argv[1]?.endsWith("production-readiness-proof.mjs")) {
  const result = await runProductionReadiness();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  for (const probe of result.probes) {
    process.stderr.write(`${probe.id}: ${probe.ok ? "green" : "red"}${probe.reasonCode ? ` — ${probe.reasonCode}` : ""}\n`);
  }
  for (const leg of result.redLegs) {
    process.stderr.write(`red-leg ${leg.target}: ${leg.ok ? "verified" : "FAILED"}\n`);
  }
  if (!result.ok || !result.redLegsOk) process.exitCode = 1;
}
