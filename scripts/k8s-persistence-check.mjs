#!/usr/bin/env node
// Delete the database pod and prove the data comes back.
//
// This is deliberately NOT part of `pnpm verify`: it destroys a running pod, so it is a
// thing an operator runs on purpose, once, after a deployment.
//
// It checks the single highest-consequence property of this deployment. postgres:18-alpine
// keeps its data in /var/lib/postgresql/18/docker and declares the volume at
// /var/lib/postgresql; the path every pre-18 example uses, /var/lib/postgresql/data, does
// not exist in the image. Mount there and you get a deployment that starts, serves every
// request correctly, and silently loses the entire database on each restart — with no error
// in any log. Nothing short of restarting it on purpose finds that.

import { execFileSync } from "node:child_process";

const BASE = process.env.AOS_SMOKE_BASE ?? "http://localhost:8080";
const NAMESPACE = process.env.AOS_NAMESPACE ?? "aos";
const POD = process.env.AOS_PG_POD ?? "aos-postgres-0";
const HANDLE = process.env.AOS_SMOKE_USER ?? "ryan";
const PASSWORD = process.env.AOS_SMOKE_PASSWORD;

if (!PASSWORD) {
  console.error(JSON.stringify({ ok: false, reasonCode: "NO_PASSWORD", note: "set AOS_SMOKE_PASSWORD" }));
  process.exit(2);
}

async function signIn() {
  const response = await fetch(`${BASE}/api/v1/commands/auth.login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: HANDLE, password: PASSWORD }),
  });
  return response.json();
}

async function countWorkItems(session) {
  const response = await fetch(`${BASE}/api/v1/work-items`, {
    headers: { cookie: `aos_session=${session.sessionToken}` },
  });
  const body = await response.json();
  return body.total;
}

async function waitReady(seconds = 300) {
  for (let attempt = 0; attempt < seconds / 2; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/readyz`);
      if (response.ok) return true;
    } catch {
      // not yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}

const before = await countWorkItems(await signIn());
if (before === 0) {
  // A count of zero on both sides would "pass" while proving nothing at all.
  console.error(
    JSON.stringify({
      ok: false,
      reasonCode: "NOTHING_TO_LOSE",
      note: "there are no work items, so surviving a restart would prove nothing; create one first",
    }),
  );
  process.exit(1);
}

execFileSync("kubectl", ["-n", NAMESPACE, "delete", "pod", POD, "--wait=true"], { stdio: "inherit" });
const recovered = await waitReady();
const after = recovered ? await countWorkItems(await signIn()) : null;

const ok = recovered && after === before;
console.log(
  JSON.stringify(
    {
      ok,
      pod: POD,
      workItemsBefore: before,
      workItemsAfter: after,
      recoveredWithinTimeout: recovered,
      ...(ok
        ? {}
        : {
            reasonCode: after === 0 ? "DATA_LOST_ON_RESTART" : "DID_NOT_RECOVER",
            note:
              after === 0
                ? "the volume is not mounted where this image keeps its data; check the mountPath in deploy/k8s/base/postgres.yaml"
                : "the instance did not become ready again in time",
          }),
    },
    null,
    2,
  ),
);
process.exit(ok ? 0 : 1);
