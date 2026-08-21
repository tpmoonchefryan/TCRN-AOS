#!/usr/bin/env node
// Walk the real server-rendered routes and prove that Design System adoption is wired
// through the supplied sheet rather than through consumer CSS or leaked component props.

import { spawn } from "node:child_process";
import { parse } from "parse5";
import pg from "pg";
import { allOperations } from "../dist/packages/kernel/src/index.js";
import { tcrnCoreComponentCss } from "@tcrn/ui-react";

const PORT = Number(process.env.AOS_GATE_PORT ?? 8127);
const BASE = `http://127.0.0.1:${PORT}`;
const DB = process.env.AOS_DS_GATE_DB ?? "postgres://postgres:devpass@127.0.0.1:55432/aos_gate_ds";

function attr(node, name) {
  return node.attrs?.find((entry) => entry.name === name)?.value;
}

function* walk(node, ancestors = []) {
  yield { node, ancestors };
  for (const child of node.childNodes ?? []) yield* walk(child, [...ancestors, node]);
}

function textContent(node) {
  return (node.childNodes ?? []).map((child) => child.value ?? textContent(child)).join("");
}

function classTokens(node) {
  return (attr(node, "class") ?? "").split(/\s+/).filter(Boolean);
}

function scanHtml(html, route, css) {
  const doc = parse(html);
  const modifierClasses = new Set();
  const leakedProps = [];
  const pendingControls = [];
  const inlineStyles = [];
  for (const { node, ancestors } of walk(doc)) {
    for (const className of classTokens(node)) {
      if (/^tcrn-[a-z0-9-]+--[a-z0-9-]+$/i.test(className)) modifierClasses.add(className);
    }
    for (const name of ["tone", "variant", "selected", "interactive"]) {
      // React's native select serialization marks the chosen <option> with the
      // platform's own selected attribute. That is not a DS prop leak; DS Select
      // consumes its options and the browser needs the native state.
      if (name === "selected" && node.nodeName === "option") continue;
      if (attr(node, name) !== undefined) leakedProps.push({ route, name, value: attr(node, name) });
    }
    if (node.nodeName === "style") inlineStyles.push(textContent(node));
    if (node.nodeName === "button") {
      const insideForm = ancestors.some((ancestor) => ancestor.nodeName === "form");
      if (!insideForm && attr(node, "form") === undefined) {
        const shellControl = attr(node, "data-shell-control")
          ?? ancestors.map((ancestor) => attr(ancestor, "data-shell-control")).find(Boolean)
          ?? null;
        const nearestClass = [...classTokens(node), ...ancestors.flatMap(classTokens)].find((name) => name.startsWith("tcrn-")) ?? null;
        pendingControls.push({ route, shellControl, nearestClass, label: textContent(node).trim().slice(0, 120) });
      }
    }
  }
  const missingClasses = [...modifierClasses].filter((className) => {
    if (css.includes(`.${className}`)) return false;
    // DS intentionally has no neutral modifier rule: neutral is the component's base
    // appearance. A missing non-neutral modifier remains a hard failure.
    return !className.endsWith("--neutral") || !css.includes(`.${className.slice(0, -"--neutral".length)}`);
  });
  const inlineDsCss = inlineStyles.some((style) => style.includes(".tcrn-button") || style.includes(".tcrn-product-shell") || style.includes(".tcrn-card"));
  return { modifierClasses, missingClasses, leakedProps, pendingControls, inlineDsCss };
}

async function main() {
  const dbName = DB.split("/").pop();
  const admin = new pg.Client({ connectionString: DB.replace(/\/[^/]+$/, "/postgres") });
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
      AOS_BOOTSTRAP_ADMIN_USER: "dsgate",
      AOS_BOOTSTRAP_ADMIN_PASSWORD: "ds-gate-password-1234",
      AOS_LOG_LEVEL: "error",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stop = () => server.kill("SIGTERM");
  process.on("exit", stop);

  let ready = false;
  for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
    try {
      ready = (await fetch(`${BASE}/readyz`)).ok;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready) {
    stop();
    console.error(JSON.stringify({ ok: false, reasonCode: "SERVER_NOT_READY" }));
    process.exit(1);
  }

  const login = await fetch(`${BASE}/api/v1/commands/auth.login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: "dsgate", password: "ds-gate-password-1234" }),
  });
  const session = await login.json();
  const cookie = `aos_session=${session.sessionToken}`;
  const post = async (operationId, payload) => {
    const response = await fetch(`${BASE}/api/v1/commands/${operationId}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ ...payload, _csrf: session.csrfToken }),
    });
    return response.json();
  };

  const project = await post("project.create", { key: "DSGATE", name: "Design System gate" });
  const item = await post("work_item.create", { projectId: project.id, kind: "story", title: "DS adoption fixture", bodyMd: "真实路由夹具" });
  const space = await post("space.create", { key: "DSGSP", name: "Design System space", projectId: project.id });
  const page = await post("page.create", { spaceId: space.id, title: "Design System page", bodyMd: "页面夹具" });
  const comment = await post("comment.create", { subjectType: "work_item", subjectId: item.id, bodyMd: "评论夹具" });
  const governed = await post("project.create", { key: "DSGOV", name: "Design System governance", governanceEnabled: true });
  const deliberation = await post("deliberation.open", {
    projectId: governed.id,
    type: "architecture",
    title: "DS adoption deliberation",
    executionMode: "synthesis_only",
    desiredOutcome: "单线程夹具，验证治理路由可渲染。",
  });
  const gate = await post("gate.create", { projectId: governed.id, title: "DS gate", outcomeClass: "role_decision" });
  const second = await post("admin.create_account", { handle: "dsgatesecond", displayName: "DS gate second", kind: "human", password: "ds-second-password-1234" });

  const substitutions = {
    "{key}": item.key,
    "{projectId}": project.id,
    "{spaceId}": space.id,
    "{pageId}": page.id,
    "{commentId}": comment.id,
    "{subjectType}": "work_item",
    "{subjectId}": item.id,
    "{deliberationId}": deliberation.id,
    "{gateId}": gate.id,
    "{principalId}": second.principalId ?? second.id,
  };
  const routes = new Set();
  for (const operation of allOperations()) {
    if (!operation.ui) continue;
    const values = {
      ...substitutions,
      ...(operation.ui.route.includes("/governance/") ? { "{projectId}": governed.id } : {}),
    };
    let route = operation.ui.route;
    for (const [token, value] of Object.entries(values)) route = route.split(token).join(value ?? "");
    if (!route.includes("{")) routes.add(route);
  }

  const cssResponse = await fetch(`${BASE}/assets/tcrn.css`);
  const css = await cssResponse.text();
  const problems = [];
  const allModifiers = new Set();
  const allLeaks = [];
  const pendingControls = [];
  let inlineDsCss = false;
  for (const route of [...routes].sort()) {
    const response = await fetch(`${BASE}${route}`, { headers: { accept: "text/html", cookie } });
    const html = await response.text();
    if (!response.ok) {
      problems.push({ route, reasonCode: "ROUTE_NOT_RENDERED", status: response.status });
      continue;
    }
    if (route === "/") {
      const shellSignals = {
        productShell: html.includes("class=\"tcrn-product-shell"),
        registeredAosLogo: html.includes("data-registered-product-logo=\"@tcrn/ui-react/ProductLogo\""),
        brandMark: html.includes("src=\"/assets/tcrn-brand-mark.svg\""),
      };
      if (!shellSignals.productShell || !shellSignals.registeredAosLogo || !shellSignals.brandMark) {
        problems.push({ route, reasonCode: "PRODUCT_SHELL_BRAND_MISSING", shellSignals });
      }
    }
    const scan = scanHtml(html, route, css);
    for (const className of scan.modifierClasses) allModifiers.add(className);
    allLeaks.push(...scan.leakedProps);
    pendingControls.push(...scan.pendingControls);
    inlineDsCss ||= scan.inlineDsCss;
    if (scan.missingClasses.length > 0) problems.push({ route, reasonCode: "DS_CLASS_UNDEFINED", classes: scan.missingClasses });
  }
  if (allLeaks.length > 0) problems.push({ reasonCode: "DS_PROPS_LEAKED", attributes: allLeaks });
  if (inlineDsCss) problems.push({ reasonCode: "DS_CSS_INLINED" });
  if (!cssResponse.ok) problems.push({ reasonCode: "DS_CSS_UNAVAILABLE", status: cssResponse.status });

  stop();
  const pendingControlMap = new Map();
  for (const control of pendingControls) {
    const key = JSON.stringify([control.shellControl, control.nearestClass, control.label]);
    const existing = pendingControlMap.get(key) ?? { ...control, routes: [] };
    if (!existing.routes.includes(control.route)) existing.routes.push(control.route);
    pendingControlMap.set(key, existing);
  }
  const pendingControlManifest = [...pendingControlMap.values()].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
  const report = {
    ok: problems.length === 0,
    routesChecked: routes.size,
    cssStatus: cssResponse.status,
    modifierClasses: [...allModifiers].sort(),
    pendingControls: pendingControlManifest,
    problems,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reasonCode: "GATE_ERROR", message: error.message, stack: error.stack }));
  process.exit(1);
});
