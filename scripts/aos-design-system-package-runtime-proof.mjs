import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import {
  aosCockpitUiReactRuntime,
  renderCockpitRuntimeNavItems,
  renderCockpitRuntimeWorkIndexCluster
} from "../dist/apps/web/src/cockpit-ui-react-runtime.js";
import {
  aosDesignSystemConsumerBridge
} from "../dist/apps/web/src/design-system-bridge.js";
import {
  renderOperationsCockpitHtml
} from "../dist/apps/web/src/cockpit-view.js";

const repoRoot = process.cwd();
const route = "route_tcrn_aos_design_system_frontend_rebuild_59ao_operations_cockpit_work_index_package_runtime_implementation";
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const runtimeSourcePath = "apps/web/src/cockpit-ui-react-runtime.ts";
const runtimeSource = readFileSync(join(repoRoot, runtimeSourcePath), "utf8");
const cockpitHtml = renderOperationsCockpitHtml();
const navRuntimeReadback = inspectPackageRuntimeNavItems(cockpitHtml);
const workIndexRuntimeReadback = inspectPackageRuntimeWorkIndexCluster(cockpitHtml);
const importReadback = inspectImports();
const dependencyReadback = inspectDependencies();
const storybookReferenceReadback = inspectStorybookReference();
const noOverclaimReadback = inspectNoOverclaim(cockpitHtml);
const summaryPath = join(repoRoot, "evidence", "aos-design-system-package-runtime-proof.json");
const markdownPath = join(repoRoot, "evidence", "aos-design-system-package-runtime-proof.md");

const ok = aosDesignSystemConsumerBridge.uiReactPackage === "@tcrn/ui-react"
  && aosDesignSystemConsumerBridge.designSystemSourceHead === "b0c00828a813d3c62392eb6e53d7d6b85b6affeb"
  && aosCockpitUiReactRuntime.packageBackedReactRuntimeRendering === true
  && dependencyReadback.ok
  && importReadback.ok
  && navRuntimeReadback.ok
  && workIndexRuntimeReadback.ok
  && storybookReferenceReadback.ok
  && noOverclaimReadback.ok;

const summary = {
  ok,
  route,
  sourceHead,
  claimScope: {
    implementationKind: "operations_cockpit_work_index_package_runtime_expansion",
    packageBackedReactRuntimeRendering: "operations_cockpit_navitem_and_work_index_cluster",
    storybookVisualStyleParity: "navitem_disabled_reason_and_work_index_component_reference_only",
    broadUiReactRuntimeMigration: false,
    docsReadinessPackageRuntimeRendering: false,
    aosWidePackageRuntimeRendering: false,
    productAcceptanceReady: false,
    finalMvpAcceptanceReady: false,
    releasePublicationReady: false
  },
  designSystemReadback: {
    sourceHead: aosDesignSystemConsumerBridge.designSystemSourceHead,
    uiReactPackage: aosDesignSystemConsumerBridge.uiReactPackage,
    uiReactPackageSpecifier: aosDesignSystemConsumerBridge.uiReactPackageSpecifier,
    runtimeSurface: aosDesignSystemConsumerBridge.uiReactRuntimeSurface,
    runtimeComponentScope: aosDesignSystemConsumerBridge.uiReactRuntimeComponentScope
  },
  dependencyReadback,
  importReadback,
  navRuntimeReadback,
  workIndexRuntimeReadback,
  storybookReferenceReadback,
  noOverclaimReadback
};

mkdirSync(dirname(summaryPath), { recursive: true });
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(markdownPath, markdownReceipt(summary));
console.log(JSON.stringify({
  ok,
  route,
  sourceHead,
  implementationKind: summary.claimScope.implementationKind,
  runtimeComponents: summary.navRuntimeReadback.packageRuntimeComponents,
  packageRuntimeNavItemCount: summary.navRuntimeReadback.packageRuntimeNavItemCount,
  packageRuntimeWorkIndexComponentCount: summary.workIndexRuntimeReadback.packageRuntimeComponents.length,
  packageRuntimeWorkRowCount: summary.workIndexRuntimeReadback.packageRuntimeWorkRowCount,
  disabledNavItemFailureCount: summary.navRuntimeReadback.disabledNavItemFailures.length,
  workIndexFailureCount: summary.workIndexRuntimeReadback.failures.length,
  markerOnlyNavItemCount: summary.navRuntimeReadback.markerOnlyNavItemCount,
  deepImportHits: summary.importReadback.deepImportHits,
  storybookReferenceOk: summary.storybookReferenceReadback.ok,
  receipt: relative(repoRoot, summaryPath)
}, null, 2));

if (!ok) {
  process.exit(1);
}

function inspectDependencies() {
  const expectedRuntime = {
    "@tcrn/ui-copy-state": "file:../TCRN-Design-System/packages/ui-copy-state",
    "@tcrn/ui-react": "file:../TCRN-Design-System/packages/ui-react",
    "@tcrn/ui-tokens": "file:../TCRN-Design-System/packages/ui-tokens",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  };
  const dependencies = packageJson.dependencies ?? {};
  const mismatches = Object.entries(expectedRuntime)
    .filter(([name, specifier]) => dependencies[name] !== specifier)
    .map(([name, specifier]) => ({ name, expected: specifier, actual: dependencies[name] ?? "missing" }));
  return {
    ok: mismatches.length === 0,
    expectedRuntime,
    runtimeDependencies: Object.fromEntries(Object.keys(expectedRuntime).map((name) => [name, dependencies[name] ?? "missing"])),
    mismatches
  };
}

function inspectImports() {
  const packageImportPresent = /from\s+["']@tcrn\/ui-react["']/.test(runtimeSource);
  const reactServerRenderingPresent = /from\s+["']react-dom\/server["']/.test(runtimeSource);
  const requiredPublicComponentImports = [
    "NavItem",
    "WorkIndex",
    "SearchInput",
    "Field",
    "FilterBar",
    "Button",
    "Badge",
    "StateView"
  ];
  const publicComponentImportPresence = Object.fromEntries(
    requiredPublicComponentImports.map((name) => [name, new RegExp(`\\b${name}\\b`).test(runtimeSource)])
  );
  const deepImportHits = runRg([
    "-n",
    "from\\s+[\"']@tcrn/ui-react/|TCRN-Design-System/packages/ui-react/src|TCRN-Design-System/packages/ui-react/dist",
    "--glob",
    "!scripts/aos-design-system-package-runtime-proof.mjs",
    "apps/web/src",
    "apps/web/test",
    "scripts"
  ]);
  const copiedSourceHits = runRg([
    "-n",
    "function\\s+(NavItem|WorkIndex|TableShell|SearchInput|FilterBar|StateView)|const\\s+(NavItem|WorkIndex|TableShell|SearchInput|FilterBar|StateView)|export\\s+function\\s+(NavItem|WorkIndex|TableShell|SearchInput|FilterBar|StateView)",
    "apps/web/src",
    "apps/web/test",
    "scripts"
  ]).filter((line) => !line.includes(runtimeSourcePath));
  return {
    ok: packageImportPresent
      && reactServerRenderingPresent
      && Object.values(publicComponentImportPresence).every(Boolean)
      && deepImportHits.length === 0
      && copiedSourceHits.length === 0,
    runtimeSourcePath,
    packageImportPresent,
    reactServerRenderingPresent,
    publicComponentImportPresence,
    deepImportHits,
    copiedSourceHits
  };
}

function inspectPackageRuntimeNavItems(html) {
  const navItems = Array.from(html.matchAll(/<a\b(?=[^>]*data-tcrn-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g))
    .map((match) => ({ attributes: match[1], body: match[2], parsed: parseAttributes(match[1]) }));
  const packageRuntimeItems = navItems.filter((item) => item.parsed["data-package-runtime-component"] === "NavItem");
  const markerOnlyItems = navItems.filter((item) => item.parsed["data-package-runtime-component"] !== "NavItem");
  const disabledItems = packageRuntimeItems.filter((item) => item.parsed["aria-disabled"] === "true");
  const activeItems = packageRuntimeItems.filter((item) => item.parsed["aria-current"] === "page");
  const disabledFailures = [];

  for (const item of disabledItems) {
    const label = extractVisibleText(item.body, "tcrn-nav-item__label");
    const visibleReason = findVisibleDisabledReason(item.body, item.parsed["aria-describedby"]);
    const failures = [];
    if (item.parsed.href) failures.push("disabled_navitem_has_href");
    if (item.parsed.tabindex !== "-1") failures.push("disabled_navitem_missing_tabindex_minus_1");
    if (!item.parsed.title?.trim()) failures.push("disabled_navitem_missing_title");
    if (!item.parsed["data-disabled-reason"]?.trim()) failures.push("disabled_navitem_missing_data_disabled_reason");
    if (!item.parsed["aria-describedby"]?.trim()) failures.push("disabled_navitem_missing_aria_describedby");
    if (!visibleReason.resolved) failures.push("disabled_navitem_aria_describedby_unresolved");
    if (visibleReason.resolved && !visibleReason.text.trim()) failures.push("disabled_navitem_visible_reason_empty");
    if (visibleReason.text && visibleReason.text !== item.parsed["data-disabled-reason"]) failures.push("disabled_navitem_visible_reason_mismatch");
    if (failures.length > 0) {
      disabledFailures.push({ label, failures });
    }
  }

  const ok = navItems.length === 10
    && packageRuntimeItems.length === 10
    && markerOnlyItems.length === 0
    && disabledItems.length === 9
    && activeItems.length === 1
    && activeItems[0]?.parsed.href === "#cockpit"
    && disabledFailures.length === 0
    && html.includes('data-package-backed-react-runtime-rendering="true"')
    && html.includes('data-package-runtime-scope="operations-cockpit-navitem"');

  return {
    ok,
    packageRuntimeComponents: aosCockpitUiReactRuntime.componentScope,
    navItemCount: navItems.length,
    packageRuntimeNavItemCount: packageRuntimeItems.length,
    markerOnlyNavItemCount: markerOnlyItems.length,
    disabledNavItemCount: disabledItems.length,
    activeNavItemCount: activeItems.length,
    disabledNavItemFailures: disabledFailures,
    packageRuntimeShellMarkerPresent: html.includes('data-package-backed-react-runtime-rendering="true"'),
    packageRuntimeScopeMarkerPresent: html.includes('data-package-runtime-scope="operations-cockpit-navitem"'),
    sampleRenderedHtmlSha256: createHash("sha256").update(renderCockpitRuntimeNavItems([
      {
        active: false,
        disabledReason: "Sample disabled reason for package runtime proof.",
        href: "#cockpit",
        label: "Sample"
      }
    ])).digest("hex")
  };
}

function inspectPackageRuntimeWorkIndexCluster(html) {
  const clusterHtml = extractWorkIndexClusterHtml(html);
  const failures = [];
  if (!clusterHtml) {
    return {
      ok: false,
      present: false,
      packageRuntimeComponents: [],
      packageRuntimeWorkRowCount: 0,
      failures: ["work_index_cluster_missing"]
    };
  }

  const packageRuntimeComponents = Array.from(new Set(
    Array.from(clusterHtml.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredComponents = [
    "Badge",
    "Button",
    "Field",
    "FilterBar",
    "Input",
    "SearchInput",
    "StateView",
    "TableShell",
    "WorkIndex"
  ];
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  if (missingComponents.length > 0) failures.push("work_index_required_package_components_missing");

  const workRows = Array.from(clusterHtml.matchAll(/<button\b(?=[^>]*data-work-row)([^>]*)>([\s\S]*?)<\/button>/g))
    .map((match) => ({ attributes: match[1], body: match[2], parsed: parseAttributes(match[1]) }));
  if (workRows.length === 0) failures.push("package_runtime_work_rows_missing");
  for (const row of workRows) {
    const rowFailures = [];
    if (row.parsed["data-package-runtime-component"] !== "TableShell") rowFailures.push("work_row_missing_table_shell_runtime_marker");
    if (row.parsed["data-package-runtime-source"] !== "@tcrn/ui-react") rowFailures.push("work_row_missing_package_source");
    if (row.parsed["data-package-runtime-surface"] !== "operations-cockpit-work-index") rowFailures.push("work_row_missing_runtime_surface");
    if (!row.parsed["data-row-id"]?.trim()) rowFailures.push("work_row_missing_row_id");
    if (!row.parsed["data-title"]?.trim()) rowFailures.push("work_row_missing_title");
    if ((row.body.match(/role="cell"/g) ?? []).length !== 3) rowFailures.push("work_row_unexpected_cell_count");
    if (rowFailures.length > 0) {
      failures.push({ id: row.parsed["data-row-id"] ?? "unknown", failures: rowFailures });
    }
  }

  const searchInputOk = /data-package-runtime-component="SearchInput"/.test(clusterHtml)
    && /data-package-runtime-component="Input"/.test(clusterHtml)
    && /data-work-search="true"/.test(clusterHtml);
  if (!searchInputOk) failures.push("package_runtime_search_input_missing");
  const filterBarOk = /data-package-runtime-component="FilterBar"/.test(clusterHtml)
    && (clusterHtml.match(/data-package-runtime-component="Button"/g) ?? []).length >= 4
    && (clusterHtml.match(/data-package-runtime-component="Badge"/g) ?? []).length >= 3;
  if (!filterBarOk) failures.push("package_runtime_filter_bar_missing");
  const tableShellOk = /data-package-runtime-component="TableShell"/.test(clusterHtml)
    && /data-work-table/.test(clusterHtml)
    && /aria-label="Service-backed Work Index"/.test(clusterHtml);
  if (!tableShellOk) failures.push("package_runtime_table_shell_missing");
  const emptyStateOk = /data-empty-state="true"/.test(clusterHtml)
    && /data-package-runtime-component="StateView"/.test(clusterHtml)
    && /hidden/.test(clusterHtml);
  if (!emptyStateOk) failures.push("package_runtime_empty_state_missing");

  const sampleRenderedHtmlSha256 = createHash("sha256").update(renderCockpitRuntimeWorkIndexCluster({
    columnsDisabledReason: "Sample disabled reason for package runtime proof.",
    filters: [{ label: "Project: TCRN-AOS" }, { label: "Freshness: Readback current" }],
    rows: [
      {
        active: true,
        evidenceLabel: "1 conference link",
        gateLabel: "3 local actions",
        owner: "implementation",
        searchText: "sample work index row",
        stateLabel: "In progress",
        storyId: "sample_story",
        title: "Sample work index row"
      }
    ]
  })).digest("hex");

  return {
    ok: failures.length === 0,
    present: true,
    surface: "operations-cockpit-work-index",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    packageRuntimeWorkRowCount: workRows.length,
    packageRuntimeSearchInputPresent: searchInputOk,
    packageRuntimeFilterBarPresent: filterBarOk,
    packageRuntimeTableShellPresent: tableShellOk,
    packageRuntimeEmptyStatePresent: emptyStateOk,
    sampleRenderedHtmlSha256,
    failures
  };
}

function extractWorkIndexClusterHtml(html) {
  const marker = 'data-region="work-index"';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return "";
  const start = html.lastIndexOf("<section", markerIndex);
  const end = html.indexOf('<aside class="detail-drawer', markerIndex);
  if (start === -1 || end === -1) return "";
  return html.slice(start, end);
}

function inspectStorybookReference() {
  const summaryPath = join(repoRoot, "..", "TCRN-Design-System", "docs", "verification", "internal-alpha", "browser-proof-summary.json");
  if (!existsSync(summaryPath)) {
    return {
      ok: false,
      path: "../TCRN-Design-System/docs/verification/internal-alpha/browser-proof-summary.json",
      missing: true
    };
  }
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const readback = summary.componentStorybookParityReadback?.packageBackedDisabledNavItemReasonReadback;
  return {
    ok: summary.ok === true && readback?.ok === true && (readback?.disabledNavItemCount ?? 0) > 0,
    path: "../TCRN-Design-System/docs/verification/internal-alpha/browser-proof-summary.json",
    storybookOk: summary.ok === true,
    packageBackedDisabledNavItemReasonReadback: readback ?? null
  };
}

function inspectNoOverclaim(html) {
  const lower = html.toLowerCase();
  const forbiddenClaims = [
    "product accepted",
    "final mvp accepted",
    "release ready",
    "deployment ready",
    "public ready",
    "live dispatch enabled",
    "broad ui react migration"
  ];
  const hits = forbiddenClaims.filter((claim) => lower.includes(claim));
  return {
    ok: hits.length === 0,
    forbiddenClaimHits: hits
  };
}

function runRg(args) {
  try {
    const output = execFileSync("rg", args, { cwd: repoRoot, encoding: "utf8" }).trim();
    return output ? output.split("\n") : [];
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
}

function parseAttributes(raw) {
  const attributes = {};
  for (const match of raw.matchAll(/\s([a-zA-Z0-9:-]+)(?:="([^"]*)")?/g)) {
    attributes[match[1].toLowerCase()] = match[2] ?? "true";
  }
  return attributes;
}

function findVisibleDisabledReason(body, describedby) {
  if (!describedby) return { resolved: false, text: "" };
  const id = escapeRegExp(describedby);
  const match = body.match(new RegExp(`<span\\b(?=[^>]*id="${id}")(?=[^>]*class="[^"]*tcrn-nav-item__disabled-reason[^"]*")[^>]*>([\\s\\S]*?)<\\/span>`));
  if (!match) return { resolved: false, text: "" };
  return { resolved: true, text: decodeHtml(stripTags(match[1]).trim()) };
}

function extractVisibleText(body, className) {
  const match = body.match(new RegExp(`<span\\b(?=[^>]*class="[^"]*${escapeRegExp(className)}[^"]*")[^>]*>([\\s\\S]*?)<\\/span>`));
  return match ? decodeHtml(stripTags(match[1]).trim()) : "";
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "");
}

function decodeHtml(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markdownReceipt(summary) {
  const rows = summary.navRuntimeReadback.disabledNavItemFailures.length === 0
    ? "- Disabled package-runtime NavItem semantic failures: 0"
    : summary.navRuntimeReadback.disabledNavItemFailures.map((failure) => `- ${failure.label}: ${failure.failures.join(", ")}`).join("\n");
  const workIndexRows = summary.workIndexRuntimeReadback.failures.length === 0
    ? "- Work Index package-runtime failures: 0"
    : summary.workIndexRuntimeReadback.failures.map((failure) => typeof failure === "string" ? `- ${failure}` : `- ${failure.id}: ${failure.failures.join(", ")}`).join("\n");
  return `# AOS Design System Package Runtime Proof\n\n`
    + `- Route: ${summary.route}\n`
    + `- Source head: ${summary.sourceHead}\n`
    + `- Scope: ${summary.claimScope.implementationKind}\n`
    + `- Runtime rendering claim: ${summary.claimScope.packageBackedReactRuntimeRendering}\n`
    + `- Design System source head: ${summary.designSystemReadback.sourceHead}\n`
    + `- UI React package: ${summary.designSystemReadback.uiReactPackage} (${summary.designSystemReadback.uiReactPackageSpecifier})\n`
    + `- Package runtime NavItems: ${summary.navRuntimeReadback.packageRuntimeNavItemCount}\n`
    + `- Package runtime Work Index rows: ${summary.workIndexRuntimeReadback.packageRuntimeWorkRowCount}\n`
    + `- Package runtime Work Index components: ${summary.workIndexRuntimeReadback.packageRuntimeComponents.join(", ")}\n`
    + `- Marker-only NavItems in cockpit nav: ${summary.navRuntimeReadback.markerOnlyNavItemCount}\n`
    + `- Deep import hits: ${summary.importReadback.deepImportHits.length}\n`
    + `- Storybook NavItem disabled reason reference ok: ${summary.storybookReferenceReadback.ok}\n\n`
    + `${rows}\n`
    + `${workIndexRows}\n\n`
    + `## Boundaries\n\n`
    + `This is an Operations Cockpit NavItem plus Work Index package-runtime expansion only. Docs Readiness and AOS-wide Product Design remain marker/static-renderer surfaces. It is not AOS-wide @tcrn/ui-react migration, product UI acceptance, product acceptance, final MVP acceptance, publication, release, VM freshness, or Owner Intent execution.\n`;
}
