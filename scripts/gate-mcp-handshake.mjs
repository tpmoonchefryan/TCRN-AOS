#!/usr/bin/env node
// A real MCP client's first three messages must work.
//
// The system this replaces called itself MCP and was a newline-delimited JSON-RPC loop
// with no initialize, no tools/list and no tools/call — a real client failed at hello and
// nothing in the build noticed, because nothing in the build had ever spoken the protocol.
// So this gate speaks it: initialize, notifications/initialized, tools/list, tools/call.

import { spawn } from "node:child_process";

const PORT = Number(process.env.AOS_GATE_PORT ?? 8123);
const BASE = `http://127.0.0.1:${PORT}`;
const DB = process.env.AOS_MCP_GATE_DB ?? "postgres://postgres:devpass@127.0.0.1:55432/aos_gate_mcp";
const PROTOCOL = "2025-06-18";

async function rpc(token, body) {
  const response = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  // Streamable HTTP answers as server-sent events; the payload is the data: line.
  const line = text.split("\n").find((candidate) => candidate.startsWith("data: "));
  return { status: response.status, message: line ? JSON.parse(line.slice(6)) : null, raw: text };
}

async function main() {
  const dbName = DB.split("/").pop();
  const { Client } = await import("pg");
  const admin = new Client({ connectionString: DB.replace(/\/[^/]+$/, "/postgres") });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  const server = spawn(process.execPath, ["dist/apps/server/src/main.js"], {
    env: {
      ...process.env,
      AOS_BIND_HOST: "127.0.0.1",
      AOS_PORT: String(PORT),
      AOS_DATABASE_URL: DB,
      AOS_BOOTSTRAP_ADMIN_USER: "mcpgate",
      AOS_BOOTSTRAP_ADMIN_PASSWORD: "mcp-gate-password-1",
      AOS_LOG_LEVEL: "error",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stop = () => server.kill("SIGTERM");
  process.on("exit", stop);

  let ready = false;
  for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
    try {
      ready = (await fetch(`${BASE}/readyz`)).ok;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready) {
    console.error(JSON.stringify({ ok: false, reasonCode: "SERVER_NOT_READY" }));
    stop();
    process.exit(1);
  }

  const login = await (
    await fetch(`${BASE}/api/v1/commands/auth.login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: "mcpgate", password: "mcp-gate-password-1" }),
    })
  ).json();
  const cookie = `aos_session=${login.sessionToken}`;
  const pat = (
    await (
      await fetch(`${BASE}/api/v1/commands/auth.create_api_token`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ name: "mcp gate", _csrf: login.csrfToken }),
      })
    ).json()
  ).token;

  const checks = [];
  const record = (name, ok, detail) => checks.push({ name, ok, ...(ok ? {} : { detail }) });

  // 1. The endpoint must refuse an unauthenticated client. A transport that skips
  //    authentication is a way to hold more authority by choosing a different pipe.
  const anonymous = await rpc(null, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "gate", version: "1" } } });
  record("refuses an unauthenticated client", anonymous.status === 401, anonymous);

  // 2. initialize
  const initialize = await rpc(pat, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "gate", version: "1" } } });
  const initResult = initialize.message?.result;
  record("initialize answers with a protocol version", typeof initResult?.protocolVersion === "string", initialize);
  record("initialize declares the tools capability", initResult?.capabilities?.tools !== undefined, initResult);
  record("initialize names the server", typeof initResult?.serverInfo?.name === "string", initResult);

  // 3. tools/list
  const list = await rpc(pat, { jsonrpc: "2.0", id: 2, method: "tools/list" });
  const tools = list.message?.result?.tools ?? [];
  record("tools/list returns tools", tools.length > 0, list);
  record(
    "every tool carries a JSON Schema for its input",
    tools.every((tool) => tool.inputSchema && typeof tool.inputSchema === "object"),
    tools.find((tool) => !tool.inputSchema),
  );

  // 4. tools/call, and its result must be the real answer rather than an acknowledgement.
  const call = await rpc(pat, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "aos_whoami", arguments: {} } });
  let whoami = null;
  try {
    whoami = JSON.parse(call.message?.result?.content?.[0]?.text ?? "null");
  } catch {
    whoami = null;
  }
  record("tools/call returns the operation's own output", whoami?.handle === "mcpgate", call);

  // 5. A refusal must arrive as its stable reason code. An agent that cannot tell
  //    "not permitted" from "try again" will pick the wrong one.
  const refused = await rpc(pat, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "aos_work_item_get", arguments: { key: "NOPE-999" } } });
  const refusalText = refused.message?.result?.content?.[0]?.text ?? "";
  record("a refusal carries its reason code", refusalText.includes("not_found"), refused);

  // 6. An unknown tool is refused rather than ignored.
  const unknown = await rpc(pat, { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "aos_no_such_tool", arguments: {} } });
  record("an unknown tool is refused", (unknown.message?.result?.isError ?? false) === true, unknown);

  stop();

  const failures = checks.filter((check) => !check.ok);
  console.log(JSON.stringify({ ok: failures.length === 0, protocolVersion: PROTOCOL, toolCount: tools.length, checks }, null, 2));
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reasonCode: "GATE_ERROR", message: error.message }));
  process.exit(1);
});
