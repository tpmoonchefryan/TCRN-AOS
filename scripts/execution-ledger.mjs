import { runExecutionLedgerCli, safeExecutionLedgerCliError } from "./execution-ledger-cli-core.mjs";

try {
  const readback = await runExecutionLedgerCli();
  console.log(JSON.stringify({
    ok: true,
    targetId: readback.executionReadback.targetId,
    status: readback.executionReadback.status.after,
    replayed: readback.executionReadback.status.replayed
  }));
} catch (error) {
  console.error(safeExecutionLedgerCliError(error));
  process.exitCode = 1;
}
