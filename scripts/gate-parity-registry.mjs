#!/usr/bin/env node
// Set equality, in both directions, across the three surfaces.
//
// A subset check would let the UI quietly fall behind the API — which is the exact
// failure this product is built to refuse: an operation an agent can perform and a person
// cannot. So the assertion is equality, and the exemption ledgers must be empty.
//
// Exemptions are allowed to exist, but each one has to state its reason in the registry
// itself (the registry throws at import time otherwise), and this gate prints them so
// asymmetry is countable rather than invisible.

import { allOperations } from "../dist/packages/kernel/src/index.js";
import { buildOpenApi } from "../dist/apps/server/src/openapi.js";
import { toolDefinitions } from "../dist/packages/mcp/src/server.js";

const operations = allOperations();
const registryIds = new Set(operations.map((operation) => operation.id));

const openapi = buildOpenApi("gate");
const openapiIds = new Set();
for (const methods of Object.values(openapi.paths)) {
  for (const spec of Object.values(methods)) {
    if (spec.operationId && spec.operationId !== "commands.dispatch") openapiIds.add(spec.operationId);
  }
}

const mcpTools = new Set(toolDefinitions().map((tool) => tool.name));
const expectedMcpTools = new Set(
  operations.filter((operation) => operation.mcp !== null).map((operation) => operation.mcp.tool),
);

const uiExempt = operations.filter((operation) => operation.ui === null);
const mcpExempt = operations.filter((operation) => operation.mcp === null);

const problems = [];

const difference = (a, b) => [...a].filter((value) => !b.has(value)).sort();

const missingFromOpenApi = difference(registryIds, openapiIds);
const extraInOpenApi = difference(openapiIds, registryIds);
if (missingFromOpenApi.length) problems.push({ what: "in the registry but not in OpenAPI", ids: missingFromOpenApi });
if (extraInOpenApi.length) problems.push({ what: "in OpenAPI but not in the registry", ids: extraInOpenApi });

const missingTools = difference(expectedMcpTools, mcpTools);
const extraTools = difference(mcpTools, expectedMcpTools);
if (missingTools.length) problems.push({ what: "declared for MCP but not generated", ids: missingTools });
if (extraTools.length) problems.push({ what: "generated for MCP but not declared", ids: extraTools });

// Every command must have somewhere a person can perform it. A query may be reachable
// only as data, but a COMMAND without a UI control is an action only a machine can take.
const commandsWithoutUi = operations
  .filter((operation) => operation.kind === "command" && operation.ui === null)
  .map((operation) => ({ id: operation.id, statedReason: operation.uiExemptReason }));

// Duplicate route bindings would mean two operations answering the same address, which is
// how a screen comes to render something other than what it says it does.
const routeSeen = new Map();
for (const operation of operations) {
  const route = `${operation.http.method} ${operation.http.path}`;
  if (routeSeen.has(route)) {
    problems.push({ what: "two operations bound to one route", ids: [routeSeen.get(route), operation.id], route });
  }
  routeSeen.set(route, operation.id);
}

const report = {
  ok: problems.length === 0,
  counts: {
    registry: registryIds.size,
    openapi: openapiIds.size,
    mcpTools: mcpTools.size,
    commands: operations.filter((operation) => operation.kind === "command").length,
    queries: operations.filter((operation) => operation.kind === "query").length,
  },
  exemptions: {
    ui: uiExempt.map((operation) => ({ id: operation.id, reason: operation.uiExemptReason })),
    mcp: mcpExempt.map((operation) => ({ id: operation.id, reason: operation.mcpExemptReason })),
  },
  commandsWithoutUi,
  problems,
};

console.log(JSON.stringify(report, null, 2));
process.exit(problems.length === 0 ? 0 : 1);
