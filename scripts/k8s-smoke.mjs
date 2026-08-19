#!/usr/bin/env node
// Prove the deployed instance actually works, from outside the cluster.
//
// Not "the pod is Running" — a pod is Running while its database is unreachable and every
// request 500s. This signs in over the ingress, creates a record, reads it back, and finds
// it by a two-character Chinese search.

const BASE = process.env.AOS_SMOKE_BASE ?? "http://localhost:8080";
const HANDLE = process.env.AOS_SMOKE_USER ?? "ryan";
const PASSWORD = process.env.AOS_SMOKE_PASSWORD;

if (!PASSWORD) {
  console.error(JSON.stringify({ ok: false, reasonCode: "NO_PASSWORD", note: "set AOS_SMOKE_PASSWORD" }));
  process.exit(2);
}

const checks = [];
const check = (name, ok, detail) => {
  checks.push({ name, ok, ...(ok ? {} : { detail: String(detail).slice(0, 200) }) });
  return ok;
};

// Wait for the instance to answer before judging it. A single-replica Recreate rollout
// has a window where the old pod is gone and the new one is not yet in the service's
// endpoints; a smoke test that reports red during that window is a gate that cries wolf.
let reachable = false;
for (let attempt = 0; attempt < 60 && !reachable; attempt += 1) {
  try {
    reachable = (await fetch(`${BASE}/readyz`)).ok;
  } catch {
    // not listening yet
  }
  if (!reachable) await new Promise((resolve) => setTimeout(resolve, 2000));
}
check("the instance becomes reachable within two minutes", reachable, "still 503 or refusing connections");

const health = await fetch(`${BASE}/healthz`);
check("the instance answers a health probe", health.ok, health.status);

const ready = await fetch(`${BASE}/readyz`);
const readyBody = await ready.json().catch(() => null);
check("the instance reports ready with a schema version", ready.ok && Boolean(readyBody?.schemaVersion), readyBody);

const login = await fetch(`${BASE}/api/v1/commands/auth.login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ handle: HANDLE, password: PASSWORD }),
});
const session = await login.json().catch(() => null);
if (!check("signing in works over the ingress", login.ok && Boolean(session?.sessionToken), login.status)) {
  console.log(JSON.stringify({ ok: false, checks }, null, 2));
  process.exit(1);
}
const cookie = `aos_session=${session.sessionToken}`;
const post = async (op, payload) => {
  const response = await fetch(`${BASE}/api/v1/commands/${op}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ ...payload, _csrf: session.csrfToken }),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
};

const stamp = Date.now().toString(36);
const project = await post("project.create", { key: `SMK${stamp.slice(-3).toUpperCase()}`, name: "冒烟测试项目" });
check("a project can be created", project.status === 200, project.body);

const item = await post("work_item.create", {
  projectId: project.body?.id,
  kind: "story",
  title: `部署冒烟 ${stamp} 中文检索`,
  bodyMd: "这条记录由 k8s 冒烟测试创建。",
});
check("a work item can be created", item.status === 200 && Boolean(item.body?.key), item.body);

const found = await fetch(`${BASE}/api/v1/work-items?q=${encodeURIComponent("检索")}`, { headers: { cookie } });
const foundBody = await found.json().catch(() => null);
check(
  "a two-character Chinese query finds it",
  (foundBody?.items ?? []).some((row) => row.key === item.body?.key),
  foundBody?.total,
);

const page = await fetch(`${BASE}/work-items`, { headers: { accept: "text/html", cookie } });
const html = await page.text();
check("the work items page renders", page.ok && html.includes("<title>"), page.status);
check("no page carries a script tag", !html.includes("<script"), "a <script> was served");

const failed = checks.filter((entry) => !entry.ok);
console.log(JSON.stringify({ ok: failed.length === 0, base: BASE, checks }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
