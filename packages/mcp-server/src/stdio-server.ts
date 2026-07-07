import { createRuntimeTransport, runJsonLineStdioServer, type AosMcpRuntimeConfig } from "./transport.js";

const config = loadConfig();
const runtime = createRuntimeTransport(config);

try {
  await runJsonLineStdioServer(runtime.transport);
} finally {
  runtime.close();
}

function loadConfig(): AosMcpRuntimeConfig {
  const encoded = process.env.AOS_MCP_TRANSPORT_CONFIG_B64;
  if (!encoded) {
    throw new Error("AOS_MCP_TRANSPORT_CONFIG_B64 is required for stdio transport startup");
  }
  const decoded = Buffer.from(encoded, "base64url").toString("utf8");
  return JSON.parse(decoded) as AosMcpRuntimeConfig;
}
