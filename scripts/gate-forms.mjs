#!/usr/bin/env node
// Boot the real server, walk every declared UI route, and replay every form it renders.
//
// This is the gate with teeth. It does not look for a marker, a class name, or a command
// id in a bundle — the previous system had thirty-two placeholder routes that each
// answered 200 with byte-identical bodies and passed exactly that kind of check.
//
// Here: GET the route, parse the returned HTML, extract each <form>'s action and its
// named inputs with their rendered values, POST exactly those bytes back, and require the
// server to accept them. A control that cannot be submitted is not a control.

import { spawn } from "node:child_process";
import { parse } from "parse5";
import { allOperations } from "../dist/packages/kernel/src/index.js";

const PORT = Number(process.env.AOS_GATE_PORT ?? 8121);
const BASE = `http://127.0.0.1:${PORT}`;
const DB = process.env.AOS_DATABASE_URL ?? "postgres://postgres:devpass@127.0.0.1:55432/aos_gate_forms";

function attr(node, name) {
  return node.attrs?.find((a) => a.name === name)?.value;
}

function* walk(node) {
  yield node;
  for (const child of node.childNodes ?? []) yield* walk(child);
}

/** Extract every form exactly as the browser would see it. */
function formsIn(html) {
  const doc = parse(html);
  const forms = [];
  for (const node of walk(doc)) {
    if (node.nodeName !== "form") continue;
    const method = (attr(node, "method") ?? "GET").toUpperCase();
    const action = attr(node, "action") ?? "";
    const fields = [];
    for (const inner of walk(node)) {
      const name = attr(inner, "name");
      if (!name) continue;
      if (inner.nodeName === "input") {
        const type = (attr(inner, "type") ?? "text").toLowerCase();
        if (type === "checkbox" || type === "radio") {
          if (attr(inner, "checked") !== undefined) fields.push([name, attr(inner, "value") ?? "on"]);
          continue;
        }
        fields.push([name, attr(inner, "value") ?? ""]);
      } else if (inner.nodeName === "textarea") {
        const text = inner.childNodes?.map((c) => c.value ?? "").join("") ?? "";
        fields.push([name, text]);
      } else if (inner.nodeName === "select") {
        let chosen;
        const options = [...walk(inner)].filter((o) => o.nodeName === "option");
        for (const option of options) {
          if (attr(option, "selected") !== undefined) chosen = attr(option, "value");
        }
        if (chosen === undefined && options.length > 0) chosen = attr(options[0], "value");
        if (chosen !== undefined) fields.push([name, chosen]);
      }
    }
    forms.push({ method, action, fields });
  }
  return forms;
}

async function main() {
  // A database of its own, so replaying real writes cannot disturb anything else.
  const dbName = DB.split("/").pop();
  const adminUrl = DB.replace(/\/[^/]+$/, "/postgres");
  const { Client } = await import("pg");
  const admin = new Client({ connectionString: adminUrl });
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
      AOS_BOOTSTRAP_ADMIN_USER: "gate",
      AOS_BOOTSTRAP_ADMIN_PASSWORD: "gate-password-1234",
      AOS_LOG_LEVEL: "error",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs = [];
  server.stdout.on("data", (chunk) => logs.push(String(chunk)));
  server.stderr.on("data", (chunk) => logs.push(String(chunk)));

  const stop = () => server.kill("SIGTERM");
  process.on("exit", stop);

  // Wait for readiness rather than sleeping a guessed interval.
  let ready = false;
  for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/readyz`);
      ready = response.ok;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready) {
    console.error(JSON.stringify({ ok: false, reasonCode: "SERVER_NOT_READY", logs: logs.join("") }));
    stop();
    process.exit(1);
  }

  const login = await fetch(`${BASE}/api/v1/commands/auth.login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: "gate", password: "gate-password-1234" }),
  });
  const session = await login.json();
  const cookie = `aos_session=${session.sessionToken}`;

  // Seed enough that the routes have something real to render. A page with no records
  // renders no forms, and a gate that passes because there was nothing to check is the
  // failure mode this whole exercise exists to refuse.
  const post = async (op, payload) => {
    const response = await fetch(`${BASE}/api/v1/commands/${op}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ ...payload, _csrf: session.csrfToken }),
    });
    return response.json();
  };
  const project = await post("project.create", { key: "GATE", name: "Gate fixture" });
  const item = await post("work_item.create", {
    projectId: project.id,
    kind: "story",
    title: "表单回放夹具",
    bodyMd: "这条记录存在，是为了让每一屏都有东西可渲染。",
  });

  // Seed the rest of the fixtures. A route whose id placeholder has no real value gets
  // an empty segment and 404s, and the gate would then be reporting its own missing
  // fixture as a product defect.
  const space = await post("space.create", { key: "GATESP", name: "Gate space", projectId: project.id });
  const page = await post("page.create", {
    spaceId: space.id,
    title: "表单回放用的页面",
    bodyMd: "这一页存在，是为了让页面相关的路由有东西可渲染。",
  });
  const comment = await post("comment.create", {
    subjectType: "work_item",
    subjectId: item.id,
    bodyMd: "回放夹具评论。",
  });

  const governed = await post("project.create", { key: "GOV", name: "Gate governance", governanceEnabled: true });
  const deliberation = await post("deliberation.open", {
    projectId: governed.id,
    type: "architecture",
    title: "回放用的审议",
    executionMode: "synthesis_only",
    desiredOutcome: "夹具：由主线程综合执笔，因此声明 synthesis_only。",
  });
  const gate = await post("gate.create", {
    projectId: governed.id,
    title: "回放用的门",
    outcomeClass: "role_decision",
  });
  const second = await post("admin.create_account", {
    handle: "gatesecond",
    displayName: "Gate second",
    kind: "human",
    password: "gate-second-password-1",
  });

  const substitutions = {
    "{key}": item.key,
    "{projectId}": project.id,
    "{spaceId}": space.id ?? "",
    "{pageId}": page.id ?? "",
    "{commentId}": comment.id ?? "",
    "{subjectType}": "work_item",
    "{subjectId}": item.id,
    "{deliberationId}": deliberation.id ?? "",
    "{gateId}": gate.id ?? "",
    "{principalId}": second.principalId ?? second.id ?? "",
  };

  const routes = new Set();
  const unsubstituted = [];
  for (const operation of allOperations()) {
    if (!operation.ui) continue;
    const routeSubstitutions = {
      ...substitutions,
      // Governance screens must be rendered from a project with governance enabled. Using
      // the plain fixture here made every governance form become a "governance disabled"
      // notice, so the gate replayed zero of the controls it claimed to cover.
      ...(operation.ui.route.includes("/governance/") ? { "{projectId}": governed.id } : {}),
    };
    let route = operation.ui.route;
    for (const [token, value] of Object.entries(routeSubstitutions)) {
      if (route.includes(token) && value === "") {
        // No fixture for this id. Reported rather than blanked, so a route the gate cannot
        // reach is visible instead of silently passing as an empty path.
        unsubstituted.push({ operation: operation.id, route: operation.ui.route, missing: token });
      }
      route = route.split(token).join(value);
    }
    if (route.includes("{")) continue;
    if (route.includes("//")) continue;
    routes.add(route);
  }

  // Values for the blank inputs a page renders for a human to fill in.
  const PLACEHOLDER = {
    name: "gate token",
    title: "回放建立的工作项",
    key: item.key,
    otherKey: item.key,
    currentPassword: "gate-password-1234",
    newPassword: "gate-password-5678",
    handle: "gate",
    bodyMd: "回放正文",
    descriptionMd: "回放说明",
    parentId: "",
    labels: "",
  };

  const results = [];
  const renderedControls = new Set();
  let replayed = 0;
  let performed = 0;
  let validated = 0;
  for (const route of [...routes].sort()) {
    const page = await fetch(`${BASE}${route}`, { headers: { accept: "text/html", cookie } });
    const html = await page.text();
    if (!page.ok) {
      results.push({ route, ok: false, status: page.status, action: "(GET)", reason: `the route a control declares does not render: GET returned ${page.status}` });
      continue;
    }
    const initialForms = formsIn(html).filter((form) => form.method === "POST");
    for (const form of initialForms) {
      const renderedOperation = form.action.split("/").at(-1);
      if (renderedOperation) renderedControls.add(renderedOperation);
    }
    const formCount = initialForms.length;
    for (let formIndex = 0; formIndex < formCount; formIndex += 1) {
      // Re-read the page for every submission. Replaying several forms from one snapshot
      // makes the second one carry a version the first already superseded, and the 409 that
      // follows is the concurrency check working rather than a broken control.
      const fresh = await fetch(`${BASE}${route}`, { headers: { accept: "text/html", cookie } });
      if (!fresh.ok) break;
      const freshForms = formsIn(await fresh.text()).filter((entry) => entry.method === "POST");
      const form = freshForms[formIndex];
      if (!form) break;
      const renderedOperation = form.action.split("/").at(-1);
      if (renderedOperation) renderedControls.add(renderedOperation);
      // Skip the destructive ones: this gate proves controls submit, and proving delete
      // works by deleting the fixture would break every later route in the same run.
      // Also skipped: change_password, which by design revokes every session — including
      // the one this gate is using. Its control is proven by parity:human-only instead.
      if (/\.(delete|logout|purge|restore|change_password)$/.test(form.action)) continue;
      const body = new URLSearchParams();
      for (const [name, value] of form.fields) {
        // A blank required input is what the page renders for a human to fill. Submitting
        // it empty proves only that validation works; filling it plausibly proves the
        // control actually performs its operation.
        body.append(name, value === "" && !name.startsWith("_") ? PLACEHOLDER[name] ?? "" : value);
      }
      const response = await fetch(`${BASE}${form.action}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html", cookie },
        body,
        redirect: "manual",
      });
      replayed += 1;
      // Three outcomes, and only one of them is a failure:
      //   303/200  the control performed its operation
      //   400      the server dispatched to the real operation and its own schema refused
      //            the values — the control works, the input was not good enough
      //   anything else means the control cannot work at all: no such operation (404),
      //   wrong method (405), the form's own CSRF token rejected (403), or a crash (500)
      if (response.status === 303 || response.status === 200) {
        performed += 1;
      } else if (response.status === 400) {
        validated += 1;
        let why = "";
        try {
          const text = await response.text();
          const match = /"reasonCode":"([^"]+)"/.exec(text);
          const detail = /"message":"([^"]{0,120})/.exec(text);
          why = `${match?.[1] ?? "?"}: ${detail?.[1] ?? ""}`;
        } catch { why = "unreadable"; }
        results.push({ route, action: form.action, ok: true, outcome: "reached-validation", why });
      } else {
        results.push({
          route,
          action: form.action,
          ok: false,
          status: response.status,
          detail: (await response.text()).slice(0, 240),
          fields: form.fields.map(([name]) => name),
        });
      }
    }
  }

  stop();

  // Governance is the route family most likely to disappear behind a "disabled" fixture.
  // Require its representative controls to be present in rendered HTML, not merely that
  // some unrelated form elsewhere performed an operation.
  const requiredControls = [
    "gate.create",
    "gate.decide",
    "deliberation.open",
    "deliberation.add_position",
    "deliberation.close",
  ];
  for (const operationId of requiredControls) {
    if (!renderedControls.has(operationId)) {
      results.push({ operationId, ok: false, detail: "the rendered governance fixture exposed no form for this control" });
    }
  }
  const failures = results.filter((entry) => entry.ok === false);
  // The bar used to be one working form anywhere in the product, which is barely a bar at
  // all: rename a single input on the project form and creation becomes impossible for
  // every human, while the gate still records "reached validation" and stays green off the
  // strength of some other screen. So: a MAJORITY of replayed forms must actually perform
  // their operation, and every control that only ever reaches validation is named in the
  // report so a growing pile of them cannot hide.
  const performedEnough = replayed > 0 && performed * 2 > replayed;
  const report = {
    ok: failures.length === 0 && replayed > 0 && performedEnough,
    routesChecked: routes.size,
    routesWithoutAFixture: unsubstituted,
    formsReplayed: replayed,
    performed,
    reachedValidation: validated,
    requiredControls,
    missingRequiredControls: requiredControls.filter((operationId) => !renderedControls.has(operationId)),
    failures,
    ...(replayed === 0 ? { reasonCode: "NOTHING_REPLAYED", note: "no form was submitted; the gate proved nothing" } : {}),
    ...(!performedEnough && replayed > 0
      ? {
          reasonCode: "TOO_FEW_PERFORMED",
          note: `only ${performed} of ${replayed} replayed forms actually performed their operation; a majority must`,
        }
      : {}),
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reasonCode: "GATE_ERROR", message: error.message, stack: error.stack }));
  process.exit(1);
});
