// Project a partition whose chain is on another host.
//
// TCRN-AOS-STORY-131 moved the AOS truth root to the VM. The projection pipeline
// reads a chain by spawning the governed engine's MCP facade against a local
// path, and there is no version of that which reaches across a network — the
// engine reads its own bytes, on its own machine, by design. So a partition that
// now lives elsewhere is projected WHERE IT LIVES, by that host's own engine and
// that host's own copy of this same projection code, and only the finished
// projection travels.
//
// Two consequences worth stating plainly:
//   - what crosses the connection is a projection, not authority. Nothing here
//     can write, and the remote side is handed no pins;
//   - the far side answers for its own bytes. The head hash and version in the
//     returned projection are what that engine reported, on that host.

import { spawn } from "node:child_process";

/**
 * Run a node program on the far host, program text over stdin (S118 precedent).
 *
 * No `-n` here, and that is the opposite of the rule everywhere else in this
 * codebase: `ssh -n` points the remote stdin at /dev/null, which is what stops a
 * backgrounded remote command from holding the session open — and is also what
 * makes a program delivered OVER stdin never arrive. The first run of this
 * function carried `-n`, the remote `node -` read an immediately-closed stdin,
 * executed nothing, exited 0, and the caller reported
 * "Unexpected end of JSON input" from a completely empty stdout.
 */
function sshNode(host, script) {
  return new Promise((done, fail) => {
    const child = spawn("ssh", [host, "node", "-"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", fail);
    child.on("close", (code) => code === 0
      ? done(stdout)
      : fail(new Error(`remote projection exited ${String(code)}: ${stderr.slice(0, 2000)}`)));
    child.stdin.end(script);
  });
}

/**
 * The projection of one partition, produced on the host that holds it.
 *
 * `runtimeRoot` is a deployed tree carrying this repository's compiled
 * `dist/packages/projection` — the same code this process runs, so the two sides
 * cannot disagree about what a projection is.
 */
export async function projectPartitionOnHost({
  host, runtimeRoot, engineMcp, partitionId, workspacePath, verifiedAt
}) {
  const raw = await sshNode(host, `
    const path = require("path");
    const { pathToFileURL } = require("url");
    (async () => {
      const { ChainClient, ChainIngestor } = await import(
        pathToFileURL(path.join(${JSON.stringify(runtimeRoot)}, "dist/packages/projection/src/index.js")).href);
      const client = new ChainClient({ serverPath: ${JSON.stringify(engineMcp)} });
      await client.start();
      try {
        const ingestor = new ChainIngestor(client);
        const result = await ingestor.projectIfMoved(
          { partitionId: ${JSON.stringify(partitionId)}, workspacePath: ${JSON.stringify(workspacePath)} },
          undefined,
          ${JSON.stringify(verifiedAt)});
        process.stdout.write(JSON.stringify(result));
      } finally {
        await client.stop();
      }
    })().catch((error) => {
      process.stderr.write(String((error && error.stack) || error));
      process.exit(1);
    });
  `);
  const result = JSON.parse(raw);
  if (!result.projection) {
    throw new Error(`remote host produced no projection for ${partitionId}`);
  }
  return result;
}
