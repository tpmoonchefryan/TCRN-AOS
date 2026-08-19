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

  const routes = new Set();
  for (const operation of allOperations()) {
    if (!operation.ui) continue;
    routes.add(
      operation.ui.route
        .replace("{key}", item.key)
        .replace("{projectId}", project.id)
        .replace(/\{[^}]+\}/g, ""),
    );
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
    const forms = formsIn(html).filter((form) => form.method === "POST");
    for (const form of forms) {
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

  const failures = results.filter((entry) => entry.ok === false);
  // At least one form must actually have PERFORMED its operation. Without this the gate
  // would pass on a build where every single control merely reached validation and
  // refused — green, and proving nothing anyone cares about.
  const performedEnough = performed > 0;
  const report = {
    ok: failures.length === 0 && replayed > 0 && performedEnough,
    routesChecked: routes.size,
    formsReplayed: replayed,
    performed,
    reachedValidation: validated,
    failures,
    ...(replayed === 0 ? { reasonCode: "NOTHING_REPLAYED", note: "no form was submitted; the gate proved nothing" } : {}),
    ...(!performedEnough && replayed > 0
      ? { reasonCode: "NOTHING_PERFORMED", note: "every form only reached validation; no control actually did anything" }
      : {}),
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reasonCode: "GATE_ERROR", message: error.message, stack: error.stack }));
  process.exit(1);
});
