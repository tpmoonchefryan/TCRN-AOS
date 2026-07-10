import { runPlanProjectionCli, safeCliError } from "./plan-project-cli-core.mjs";

try {
  const readback = await runPlanProjectionCli();
  console.log(JSON.stringify({
    ok: true,
    projectionId: readback.manifest.projectionId,
    counts: readback.projectionReadback.counts,
    restartPersistence: readback.restartPersistence.ok
  }));
} catch (error) {
  console.error(safeCliError(error));
  process.exitCode = 1;
}
