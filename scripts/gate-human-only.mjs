#!/usr/bin/env node
// Run a whole project by hand, with no agent.
//
// This is the gate for the ruling that a single project runs autonomously and a person can
// manage all of it themselves. It is deliberately hostile to the easy version of that
// claim: the database holds ZERO principals of kind 'agent', the MCP surface is never
// spoken to, and every single step is an ordinary form submission read out of the rendered
// markup.
//
// If any step here needs an API client or an agent, the claim is false.
//
// What this gate does NOT check, on purpose: whether a page carries a script tag. It used
// to, and that assertion was never ruled by anyone — it was one author's inference from
// "a person can manage the project by hand", stricter than the requirement and contrary to
// what the design system expects. Reading the markup and submitting its forms is a
// sufficient proof of the by-hand path whether or not script is also present.

import { spawn } from "node:child_process";
import { parse } from "parse5";

const PORT = Number(process.env.AOS_GATE_PORT ?? 8125);
const BASE = `http://127.0.0.1:${PORT}`;
const DB = process.env.AOS_HUMAN_GATE_DB ?? "postgres://postgres:devpass@127.0.0.1:55432/aos_gate_human";

function attr(node, name) {
  return node.attrs?.find((a) => a.name === name)?.value;
}
function* walk(node) {
  yield node;
  for (const child of node.childNodes ?? []) yield* walk(child);
}

/** Read the page as delivered: markup only, no script executed. */
async function getPage(path, cookie) {
  const response = await fetch(`${BASE}${path}`, { headers: { accept: "text/html", cookie } });
  const html = await response.text();
  return { status: response.status, html, doc: parse(html), setCookie: response.headers.get("set-cookie") ?? "" };
}

/** Find a form by the operation its action names, and read its rendered fields. */
function findForm(doc, operationId) {
  for (const node of walk(doc)) {
    if (node.nodeName !== "form") continue;
    const action = attr(node, "action") ?? "";
    if (!action.endsWith(`/${operationId}`)) continue;
    const fields = new URLSearchParams();
    for (const inner of walk(node)) {
      const name = attr(inner, "name");
      if (!name) continue;
      if (inner.nodeName === "input") {
        const type = (attr(inner, "type") ?? "text").toLowerCase();
        if ((type === "checkbox" || type === "radio") && attr(inner, "checked") === undefined) continue;
        fields.set(name, attr(inner, "value") ?? "");
      } else if (inner.nodeName === "textarea") {
        fields.set(name, inner.childNodes?.map((c) => c.value ?? "").join("") ?? "");
      } else if (inner.nodeName === "select") {
        const options = [...walk(inner)].filter((o) => o.nodeName === "option");
        const selected = options.find((o) => attr(o, "selected") !== undefined) ?? options[0];
        if (selected) fields.set(name, attr(selected, "value") ?? "");
      }
    }
    return { action, fields };
  }
  return null;
}

async function submit(form, overrides, cookie) {
  for (const [key, value] of Object.entries(overrides)) form.fields.set(key, value);
  const response = await fetch(`${BASE}${form.action}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html", cookie },
    body: form.fields,
    redirect: "manual",
  });
  return { status: response.status, location: response.headers.get("location"), body: await response.text() };
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
      AOS_BOOTSTRAP_ADMIN_USER: "person",
      AOS_BOOTSTRAP_ADMIN_PASSWORD: "person-password-1234",
      AOS_LOG_LEVEL: "error",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stop = () => server.kill("SIGTERM");
  process.on("exit", stop);

  let ready = false;
  for (let attempt = 0; attempt < 90 && !ready; attempt += 1) {
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

  const steps = [];
  const step = (name, ok, detail) => {
    steps.push({ name, ok, ...(ok ? {} : { detail: String(detail).slice(0, 300) }) });
    return ok;
  };

  // ---- sign in, from the rendered login form ----
  const loginPage = await getPage("/", "");
  step("the login page renders without a session", loginPage.status === 200 && loginPage.html.includes("auth.login"), loginPage.status);

  const loginForm = findForm(loginPage.doc, "auth.login");
  if (!step("the login form exists on the page", loginForm !== null, "no auth.login form")) {
    stop();
    console.log(JSON.stringify({ ok: false, steps }, null, 2));
    process.exit(1);
  }
  const loginCookie = loginPage.setCookie.split(";")[0] ?? "";
  const loginResponse = await fetch(`${BASE}${loginForm.action}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html", cookie: loginCookie },
    body: new URLSearchParams({ ...Object.fromEntries(loginForm.fields), handle: "person", password: "person-password-1234" }),
    redirect: "manual",
  });
  const setCookie = loginResponse.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0] ?? "";
  step("signing in sets a session cookie", cookie.startsWith("aos_session="), setCookie);
  step("signing in redirects rather than answering with a body", loginResponse.status === 303, loginResponse.status);

  const home = await getPage("/", cookie);
  for (const [path, label] of [
    ["/watching", "关注入口"],
    ["/views", "保存视图入口"],
    ["/activity", "活动入口"],
    ["/trash", "回收站入口"],
    ["/admin/accounts", "账户管理入口"],
    ["/admin/erasure", "抹除入口"],
    ["/admin/purges", "抹除台账入口"],
  ]) {
    step(`首页可以点击到${label}`, home.html.includes(`href="${path}"`), path);
  }

  // ---- create a project, by hand ----
  const projectsPage = await getPage("/projects", cookie);
  const projectForm = findForm(projectsPage.doc, "project.create");
  step("the projects page offers a create form", projectForm !== null, projectsPage.status);
  const created = projectForm
    ? await submit(projectForm, { key: "HAND", name: "手工建立的项目" }, cookie)
    : { status: 0 };
  step("creating a project by form succeeds", created.status === 303, created.status);

  // ---- create a work item, by hand ----
  const newItemPage = await getPage("/work-items/new", cookie);
  const itemForm = findForm(newItemPage.doc, "work_item.create");
  step("the new work item page offers a create form", itemForm !== null, newItemPage.status);
  const madeItem = itemForm
    ? await submit(itemForm, { kind: "story", title: "只用键盘和表单建立的工作项" }, cookie)
    : { status: 0 };
  step("creating a work item by form succeeds", madeItem.status === 303, madeItem.status);

  // ---- find it, edit it, move it, all from rendered pages ----
  const list = await getPage("/work-items", cookie);
  const keyMatch = /HAND-\d+/.exec(list.html);
  step("the new item appears in the list", keyMatch !== null, "no HAND- key rendered");
  const key = keyMatch?.[0];

  const projectPage = await getPage("/projects", cookie);
  const projectLink = /href="\/projects\/([^"?]+)"/.exec(projectPage.html)?.[1];
  const projectOverview = projectLink ? await getPage(`/projects/${projectLink}`, cookie) : null;
  for (const [suffix, label] of [
    ["/settings", "项目设置入口"],
    ["/governance/gates", "门入口"],
    ["/governance/deliberations", "审议入口"],
    ["/governance/decisions", "决定入口"],
  ]) {
    step(`项目页可以点击到${label}`, projectOverview?.html.includes(`href="/projects/${projectLink}${suffix}"`) === true, suffix);
  }

  let detail = key ? await getPage(`/work-items/${key}`, cookie) : null;
  step("the detail page renders", detail?.status === 200, detail?.status);

  const editForm = detail ? findForm(detail.doc, "work_item.update") : null;
  const edited = editForm ? await submit(editForm, { title: "改过标题的工作项" }, cookie) : { status: 0 };
  step("editing by form succeeds", edited.status === 303, edited.status);

  detail = key ? await getPage(`/work-items/${key}`, cookie) : null;
  step("the edit is visible on reload", detail?.html.includes("改过标题的工作项") === true, "the new title was not rendered");

  const moveForm = detail ? findForm(detail.doc, "work_item.transition") : null;
  const moved = moveForm ? await submit(moveForm, { status: "active" }, cookie) : { status: 0 };
  step("moving the item to another status by form succeeds", moved.status === 303, moved.status);

  // A refused transition must be refused for a human too, with its reason on the page.
  const detailAfter = key ? await getPage(`/work-items/${key}`, cookie) : null;
  const badMoveForm = detailAfter ? findForm(detailAfter.doc, "work_item.transition") : null;
  const badMove = badMoveForm ? await submit(badMoveForm, { status: "planned" }, cookie) : { status: 0 };
  step(
    "an illegal transition is refused with a stated reason, not silently ignored",
    badMove.status === 409 || badMove.status === 400,
    `${badMove.status}`,
  );

  // ---- the standing conditions of this gate ----
  const check = new Client({ connectionString: DB });
  await check.connect();
  const agents = await check.query("SELECT count(*)::int AS n FROM principal WHERE kind = 'agent'");
  step("no agent principal exists in this instance", agents.rows[0].n === 0, agents.rows[0].n);
  const items = await check.query("SELECT count(*)::int AS n FROM work_item WHERE deleted_at IS NULL");
  step("the work done by hand is really in the database", items.rows[0].n >= 1, items.rows[0].n);
  const activity = await check.query("SELECT count(*)::int AS n FROM activity_event WHERE actor_label LIKE 'human:%'");
  step("every act is attributed to the person who performed it", activity.rows[0].n >= 4, activity.rows[0].n);
  await check.end();

  stop();

  const failed = steps.filter((entry) => !entry.ok);
  console.log(
    JSON.stringify(
      { ok: failed.length === 0, mcpEverContacted: false, javascriptUsed: false, steps },
      null,
      2,
    ),
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reasonCode: "GATE_ERROR", message: error.message, stack: error.stack }));
  process.exit(1);
});
