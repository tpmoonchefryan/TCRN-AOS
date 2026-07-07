import { startAosLocalServiceProof } from "../dist/apps/api/src/server.js";

const parsedPort = Number.parseInt(process.env.AOS_PORT ?? "4317", 10);
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 4317;
const service = await startAosLocalServiceProof(port);
let closing = false;

console.log(JSON.stringify({
  ok: true,
  service: "tcrn-aos-owner-trial",
  url: service.url,
  routes: {
    shell: `${service.url}/`,
    cockpit: `${service.url}/cockpit`,
    work: `${service.url}/work`,
    health: `${service.url}/health`,
    policy: `${service.url}/policy`,
    readback: `${service.url}/readback`
  },
  frontend: {
    codeDisposition: "first_shell_slice_available",
    routeDisposition: "static_shell_served",
    dummyCockpitOnly: true,
    finalCockpitAggregationAvailable: false,
    ownerReviewRequiredBeforeAcceptance: true
  },
  runtimeDataCommitted: false,
  externalQueue: "none",
  liveCodexDispatchAuthorized: false,
  serviceProofOnly: true
}, null, 2));

async function shutdown(signal) {
  if (closing) {
    return;
  }
  closing = true;
  const stopped = await service.close();
  console.log(JSON.stringify({
    ok: true,
    signal,
    stopped: stopped.stopped,
    runtimeReset: stopped.runtimeReset
  }, null, 2));
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

await new Promise(() => undefined);
