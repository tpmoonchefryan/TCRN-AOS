import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import {
  aosCockpitUiReactRuntime,
  renderCockpitRuntimeDetailDrawer,
  renderCockpitRuntimeGateReadbackCards,
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
const route = "route_tcrn_aos_design_system_frontend_rebuild_59aq_gate_readback_cards_package_runtime_implementation";
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const runtimeSourcePath = "apps/web/src/cockpit-ui-react-runtime.ts";
const runtimeSource = readFileSync(join(repoRoot, runtimeSourcePath), "utf8");
const cockpitHtml = renderOperationsCockpitHtml();
const navRuntimeReadback = inspectPackageRuntimeNavItems(cockpitHtml);
const workIndexRuntimeReadback = inspectPackageRuntimeWorkIndexCluster(cockpitHtml);
const detailDrawerRuntimeReadback = inspectPackageRuntimeDetailDrawer(cockpitHtml);
const gateReadbackCardsRuntimeReadback = inspectPackageRuntimeGateReadbackCards(cockpitHtml);
const fullDocumentAccessibilityReadback = inspectFullDocumentAccessibility(cockpitHtml);
const visualStyleReadback = inspectAosRuntimeStyleContract(cockpitHtml);
const importReadback = inspectImports();
const dependencyReadback = inspectDependencies();
const storybookReferenceReadback = inspectStorybookReference();
const noOverclaimReadback = inspectNoOverclaim(cockpitHtml);
const sourceContentReadback = inspectSourceContentDigest();
const summaryPath = join(repoRoot, "evidence", "aos-design-system-package-runtime-proof.json");
const markdownPath = join(repoRoot, "evidence", "aos-design-system-package-runtime-proof.md");
const checkCurrentSource = process.argv.includes("--check-current-source");

const ok = aosDesignSystemConsumerBridge.uiReactPackage === "@tcrn/ui-react"
  && aosDesignSystemConsumerBridge.designSystemSourceHead === "b0c00828a813d3c62392eb6e53d7d6b85b6affeb"
  && aosCockpitUiReactRuntime.packageBackedReactRuntimeRendering === true
  && dependencyReadback.ok
  && importReadback.ok
  && navRuntimeReadback.ok
  && workIndexRuntimeReadback.ok
  && detailDrawerRuntimeReadback.ok
  && gateReadbackCardsRuntimeReadback.ok
  && fullDocumentAccessibilityReadback.ok
  && visualStyleReadback.ok
  && storybookReferenceReadback.ok
  && noOverclaimReadback.ok
  && sourceContentReadback.ok;

const summary = {
  ok,
  route,
  sourceHead,
  claimScope: {
    implementationKind: "operations_cockpit_gate_readback_cards_package_runtime_expansion",
    packageBackedReactRuntimeRendering: "operations_cockpit_navitem_work_index_selected_detail_drawer_and_gate_readback_cards",
    storybookVisualStyleParity: "navitem_disabled_reason_work_index_selected_detail_and_gate_readback_component_reference_only",
    broadUiReactRuntimeMigration: false,
    docsReadinessPackageRuntimeRendering: false,
    aosWidePackageRuntimeRendering: false,
    productAcceptanceReady: false,
    finalMvpAcceptanceReady: false,
    releasePublicationReady: false
  },
  sourceFreshnessReadback: sourceContentReadback,
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
  detailDrawerRuntimeReadback,
  gateReadbackCardsRuntimeReadback,
  fullDocumentAccessibilityReadback,
  visualStyleReadback,
  storybookReferenceReadback,
  noOverclaimReadback
};

if (checkCurrentSource) {
  const retained = JSON.parse(readFileSync(summaryPath, "utf8"));
  const retainedDigest = retained.sourceFreshnessReadback?.sourceContentDigest;
  const retainedStrategy = retained.sourceFreshnessReadback?.strategy;
  if (retainedDigest !== sourceContentReadback.sourceContentDigest || retainedStrategy !== sourceContentReadback.strategy) {
    console.error(JSON.stringify({
      ok: false,
      route,
      sourceHead,
      sourceContentDigest: sourceContentReadback.sourceContentDigest,
      retainedDigest,
      failure: "retained_source_content_digest_mismatch"
    }, null, 2));
    process.exit(1);
  }
} else {
  mkdirSync(dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(markdownPath, markdownReceipt(summary));
}
console.log(JSON.stringify({
  ok,
  route,
  sourceHead,
  sourceFreshnessStrategy: summary.sourceFreshnessReadback.strategy,
  sourceContentDigest: summary.sourceFreshnessReadback.sourceContentDigest,
  implementationKind: summary.claimScope.implementationKind,
  runtimeComponents: summary.navRuntimeReadback.packageRuntimeComponents,
  packageRuntimeNavItemCount: summary.navRuntimeReadback.packageRuntimeNavItemCount,
  packageRuntimeWorkIndexComponentCount: summary.workIndexRuntimeReadback.packageRuntimeComponents.length,
  packageRuntimeWorkRowCount: summary.workIndexRuntimeReadback.packageRuntimeWorkRowCount,
  packageRuntimeDetailDrawerComponentCount: summary.detailDrawerRuntimeReadback.packageRuntimeComponents.length,
  packageRuntimeDetailDrawerSelectedId: summary.detailDrawerRuntimeReadback.selectedDetailId,
  packageRuntimeGateReadbackCardComponentCount: summary.gateReadbackCardsRuntimeReadback.packageRuntimeComponents.length,
  packageRuntimeGateReadbackCardFailures: summary.gateReadbackCardsRuntimeReadback.failures.length,
  duplicateDomIdCount: summary.fullDocumentAccessibilityReadback.duplicateIds.length,
  ariaReferenceFailureCount: summary.fullDocumentAccessibilityReadback.ariaReferenceFailures.length,
  disabledDescriptionMismatchCount: summary.fullDocumentAccessibilityReadback.disabledControlDescriptionFailures.length,
  disabledNavItemFailureCount: summary.navRuntimeReadback.disabledNavItemFailures.length,
  workIndexFailureCount: summary.workIndexRuntimeReadback.failures.length,
  detailDrawerFailureCount: summary.detailDrawerRuntimeReadback.failures.length,
  visualStyleFailureCount: summary.visualStyleReadback.failures.length,
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
    "StateView",
    "DetailDrawer",
    "KeyValueList",
    "Surface",
    "Heading",
    "Text",
    "StatusBadge",
    "GateReadinessPanel",
    "ReadbackPanel"
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
    "function\\s+(NavItem|WorkIndex|TableShell|SearchInput|FilterBar|StateView|DetailDrawer|KeyValueList|Surface|Heading|Text|StatusBadge|GateReadinessPanel|ReadbackPanel)|const\\s+(NavItem|WorkIndex|TableShell|SearchInput|FilterBar|StateView|DetailDrawer|KeyValueList|Surface|Heading|Text|StatusBadge|GateReadinessPanel|ReadbackPanel)|export\\s+function\\s+(NavItem|WorkIndex|TableShell|SearchInput|FilterBar|StateView|DetailDrawer|KeyValueList|Surface|Heading|Text|StatusBadge|GateReadinessPanel|ReadbackPanel)",
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
    && /data-package-runtime-subcomponent="SearchInput\.control"/.test(clusterHtml)
    && !/data-package-runtime-component="Input"/.test(clusterHtml)
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
    searchInputControlDisposition: "internal_subcomponent_not_separate_package_runtime_scope",
    packageRuntimeFilterBarPresent: filterBarOk,
    packageRuntimeTableShellPresent: tableShellOk,
    packageRuntimeEmptyStatePresent: emptyStateOk,
    sampleRenderedHtmlSha256,
    failures
  };
}

function inspectPackageRuntimeDetailDrawer(html) {
  const detailHtml = extractDetailDrawerHtml(html);
  const failures = [];
  if (!detailHtml) {
    return {
      ok: false,
      present: false,
      surface: "operations-cockpit-detail-drawer",
      requiredComponents: [],
      packageRuntimeComponents: [],
      failures: ["detail_drawer_missing"]
    };
  }

  const asideMatch = detailHtml.match(/<aside\b([^>]*)>/);
  const asideAttributes = parseAttributes(asideMatch?.[1] ?? "");
  const packageRuntimeComponents = Array.from(new Set(
    Array.from(detailHtml.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredComponents = [
    "Button",
    "DetailDrawer",
    "Heading",
    "KeyValueList",
    "StatusBadge",
    "Surface",
    "Text"
  ];
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  if (missingComponents.length > 0) failures.push("detail_drawer_required_package_components_missing");
  if (asideAttributes["data-package-runtime-component"] !== "DetailDrawer") failures.push("detail_drawer_missing_runtime_marker");
  if (asideAttributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push("detail_drawer_missing_package_source");
  if (asideAttributes["data-package-runtime-surface"] !== "operations-cockpit-detail-drawer") failures.push("detail_drawer_missing_runtime_surface");
  if (!asideAttributes["data-service-detail-id"]?.trim()) failures.push("detail_drawer_missing_service_detail_id");
  if (asideAttributes["data-service-detail-type"] !== "story") failures.push("detail_drawer_unexpected_service_detail_type");
  if (asideAttributes["data-selected-story-id"] !== asideAttributes["data-service-detail-id"]) failures.push("detail_drawer_selected_story_mismatch");
  if (!/data-drawer-title/.test(detailHtml)) failures.push("detail_drawer_title_missing");
  if (!/data-detail-list/.test(detailHtml)) failures.push("detail_drawer_key_value_list_missing");
  if ((detailHtml.match(/<dt>/g) ?? []).length < 8 || (detailHtml.match(/<dd>/g) ?? []).length < 8) {
    failures.push("detail_drawer_key_value_rows_missing");
  }
  if (!/Selected Detail Readback/.test(detailHtml)) failures.push("detail_drawer_readback_surface_missing");
  if (!/Functional contract readback only; no visual, release, product, dependency-clean, or live-dispatch acceptance/.test(detailHtml)) {
    failures.push("detail_drawer_no_overclaim_copy_missing");
  }

  const disabledButtons = Array.from(detailHtml.matchAll(/<button\b(?=[^>]*data-package-runtime-component="Button")(?=[^>]*disabled)([^>]*)>([\s\S]*?)<\/button>/g))
    .map((match) => ({ attributes: match[1], body: match[2], parsed: parseAttributes(match[1]) }));
  if (disabledButtons.length < 2) failures.push("detail_drawer_disabled_actions_missing");
  for (const button of disabledButtons) {
    const buttonFailures = [];
    if (!button.parsed.title?.trim()) buttonFailures.push("disabled_button_missing_title");
    if (!button.parsed["data-disabled-reason"]?.trim()) buttonFailures.push("disabled_button_missing_data_disabled_reason");
    if (!button.parsed["aria-describedby"]?.trim()) buttonFailures.push("disabled_button_missing_aria_describedby");
    if (!/class="tcrn-sr-only"/.test(button.body)) buttonFailures.push("disabled_button_sr_only_reason_missing");
    if (buttonFailures.length > 0) {
      failures.push({ label: extractButtonLabel(button.body), failures: buttonFailures });
    }
  }

  const sampleRenderedHtmlSha256 = createHash("sha256").update(renderCockpitRuntimeDetailDrawer({
    blockedActionLabel: "No local readback blockers",
    closeLabel: "Close detail",
    detailRows: [
      { key: "selected", label: "Selected", value: "Story readback / sample_story" },
      { key: "evidence", label: "Evidence", value: "Metadata only" }
    ],
    noOverclaimSummary: "No product, final, release, live dispatch, or Owner Intent execution is claimed.",
    operatingLoopSummary: "Selected detail uses service-backed local readback only.",
    primaryActionDisabledReason: "Gate work order execution is held outside this UI slice",
    primaryActionLabel: "Gate work order held",
    secondaryActionDisabledReason: "Rework request execution requires a routed owner-trial action",
    secondaryActionLabel: "Rework request held",
    selectedId: "sample_story",
    selectedType: "story",
    selectedTypeLabel: "Story readback",
    statusLabel: "In progress",
    title: "Sample selected detail"
  })).digest("hex");

  return {
    ok: failures.length === 0,
    present: true,
    surface: "operations-cockpit-detail-drawer",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    selectedDetailId: asideAttributes["data-service-detail-id"] ?? "",
    selectedDetailType: asideAttributes["data-service-detail-type"] ?? "",
    selectedStoryId: asideAttributes["data-selected-story-id"] ?? "",
    keyValueRowCount: detailHtml.match(/<dt>/g)?.length ?? 0,
    disabledActionButtonCount: disabledButtons.length,
    sampleRenderedHtmlSha256,
    failures
  };
}

function inspectPackageRuntimeGateReadbackCards(html) {
  const gateHtml = extractRegionArticleHtml(html, "blocker-gate-card");
  const readbackHtml = extractRegionArticleHtml(html, "readback-posture-card");
  const failures = [];

  if (!gateHtml) failures.push("gate_work_order_card_missing");
  if (!readbackHtml) failures.push("readback_posture_card_missing");
  const combinedHtml = `${gateHtml}\n${readbackHtml}`;
  const packageRuntimeComponents = Array.from(new Set(
    Array.from(combinedHtml.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredComponents = [
    "Badge",
    "Button",
    "GateReadinessPanel",
    "Heading",
    "KeyValueList",
    "ReadbackPanel",
    "StateView",
    "StatusBadge",
    "Text"
  ];
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  if (missingComponents.length > 0) failures.push("gate_readback_required_package_components_missing");

  const gateAttributes = parseAttributes(gateHtml.match(/<article\b([^>]*)>/)?.[1] ?? "");
  const readbackAttributes = parseAttributes(readbackHtml.match(/<article\b([^>]*)>/)?.[1] ?? "");
  if (gateAttributes["data-package-runtime-component"] !== "GateReadinessPanel") failures.push("gate_card_missing_gate_readiness_panel_runtime_marker");
  if (readbackAttributes["data-package-runtime-component"] !== "ReadbackPanel") failures.push("readback_card_missing_readback_panel_runtime_marker");
  for (const [label, attributes] of [["gate", gateAttributes], ["readback", readbackAttributes]]) {
    if (attributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push(`${label}_card_missing_package_source`);
    if (attributes["data-package-runtime-surface"] !== "operations-cockpit-gate-readback-cards") failures.push(`${label}_card_missing_runtime_surface`);
  }

  if (!/Gate Work Order/.test(gateHtml)) failures.push("gate_card_title_missing");
  if (!/Readback Posture/.test(readbackHtml)) failures.push("readback_card_title_missing");
  if (!/class="count\b/.test(gateHtml)) failures.push("gate_card_count_badge_missing");
  if (!/class="gate-block\b/.test(gateHtml)) failures.push("gate_card_gate_block_missing");
  if (!/Gate request held/.test(gateHtml)) failures.push("gate_card_disabled_action_missing");
  if (!/Evidence detail held/.test(readbackHtml)) failures.push("readback_card_disabled_action_missing");
  if ((readbackHtml.match(/<dt>/g) ?? []).length !== 4) failures.push("readback_card_key_value_rows_missing");
  for (const expectedLabel of ["Runtime fixture", "Evidence", "Dependency", "Resource"]) {
    if (!readbackHtml.includes(`<dt>${expectedLabel}</dt>`)) {
      failures.push(`readback_card_${expectedLabel.toLowerCase().replace(/\s+/g, "_")}_row_missing`);
    }
  }

  const disabledButtons = Array.from(combinedHtml.matchAll(/<button\b(?=[^>]*data-package-runtime-component="Button")(?=[^>]*disabled)([^>]*)>([\s\S]*?)<\/button>/g))
    .map((match) => ({ attributes: match[1], body: match[2], parsed: parseAttributes(match[1]) }));
  if (disabledButtons.length !== 2) failures.push("gate_readback_disabled_button_count_mismatch");
  for (const button of disabledButtons) {
    const buttonFailures = [];
    if (!button.parsed.title?.trim()) buttonFailures.push("disabled_button_missing_title");
    if (!button.parsed["data-disabled-reason"]?.trim()) buttonFailures.push("disabled_button_missing_data_disabled_reason");
    if (!button.parsed["aria-describedby"]?.trim()) buttonFailures.push("disabled_button_missing_aria_describedby");
    if (!/class="tcrn-sr-only"/.test(button.body)) buttonFailures.push("disabled_button_sr_only_reason_missing");
    if (buttonFailures.length > 0) {
      failures.push({ label: extractButtonLabel(button.body), failures: buttonFailures });
    }
  }

  const sampleRenderedHtmlSha256 = createHash("sha256").update(renderCockpitRuntimeGateReadbackCards({
    gateWorkOrder: {
      count: 2,
      disabledReason: "Sample gate request disabled reason.",
      gateModeLabel: "Owner Intent separated",
      gateOwnerRole: "owner",
      gateStatusLabel: "Proof required",
      gateSummary: "Owner Intent gate: Proof required; Owner Intent separated.",
      gateTypeLabel: "Owner Intent gate"
    },
    readbackPosture: {
      dependencyLabel: "Review required",
      disabledReason: "Sample evidence detail disabled reason.",
      evidenceLabel: "Readback current",
      resourceLabel: "Review required",
      runtimeFixtureLabel: "Static fixture readback"
    }
  })).digest("hex");

  return {
    ok: failures.length === 0,
    present: Boolean(gateHtml && readbackHtml),
    surface: "operations-cockpit-gate-readback-cards",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    gateWorkOrderComponent: gateAttributes["data-package-runtime-component"] ?? "",
    readbackPostureComponent: readbackAttributes["data-package-runtime-component"] ?? "",
    disabledActionButtonCount: disabledButtons.length,
    readbackKeyValueRowCount: readbackHtml.match(/<dt>/g)?.length ?? 0,
    sampleRenderedHtmlSha256,
    failures
  };
}

function inspectFullDocumentAccessibility(html) {
  const idEntries = collectRealIdEntries(html);
  const idCounts = new Map();
  for (const entry of idEntries) {
    idCounts.set(entry.id, (idCounts.get(entry.id) ?? 0) + 1);
  }
  const duplicateIds = Array.from(idCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ id, count }))
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
  const idText = collectRealIdText(html);
  const ariaReferenceFailures = [];
  for (const reference of collectAriaReferences(html)) {
    for (const id of reference.ids) {
      const targetCount = idCounts.get(id) ?? 0;
      if (targetCount !== 1) {
        ariaReferenceFailures.push({
          tag: reference.tag,
          attribute: reference.attribute,
          id,
          targetCount
        });
      }
    }
  }
  const disabledControlDescriptionFailures = [];
  for (const control of collectDisabledControls(html)) {
    const expectedReason = control.parsed["data-disabled-reason"]?.trim() ?? "";
    const title = control.parsed.title?.trim() ?? "";
    const describedbyIds = splitIdRefs(control.parsed["aria-describedby"]);
    const targetCounts = describedbyIds.map((id) => ({ id, targetCount: idCounts.get(id) ?? 0 }));
    const resolvedText = describedbyIds
      .map((id) => idText.get(id) ?? "")
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const failures = [];
    if (!expectedReason) failures.push("disabled_control_missing_data_disabled_reason");
    if (!title) failures.push("disabled_control_missing_title_reason");
    if (describedbyIds.length === 0) failures.push("disabled_control_missing_aria_describedby");
    if (targetCounts.some(({ targetCount }) => targetCount !== 1)) failures.push("disabled_control_aria_target_count_not_one");
    if (!resolvedText) failures.push("disabled_control_description_unresolved");
    if (resolvedText && expectedReason && normalizeText(resolvedText) !== normalizeText(expectedReason)) {
      failures.push("disabled_control_description_mismatch");
    }
    if (failures.length > 0) {
      disabledControlDescriptionFailures.push({
        tag: control.tag,
        label: extractButtonLabel(control.body),
        dataDisabledReason: expectedReason,
        titleReason: title,
        ariaDescribedBy: describedbyIds,
        targetCounts,
        resolvedText,
        failures
      });
    }
  }
  return {
    ok: duplicateIds.length === 0
      && ariaReferenceFailures.length === 0
      && disabledControlDescriptionFailures.length === 0,
    idCount: idEntries.length,
    duplicateIds,
    ariaReferenceFailures,
    disabledControlDescriptionFailures,
    disabledControlsCount: collectDisabledControls(html).length,
    disabledControlsWithReasonCount: collectDisabledControls(html)
      .filter((control) => control.parsed["data-disabled-reason"]?.trim()).length
  };
}

function inspectAosRuntimeStyleContract(html) {
  const failures = [];
  const hasSrOnlyRule = /\.tcrn-sr-only\s*\{[^}]*position:\s*absolute;[^}]*width:\s*1px;[^}]*height:\s*1px;[^}]*overflow:\s*hidden;[^}]*white-space:\s*nowrap;[^}]*border:\s*0;/s.test(html);
  if (!hasSrOnlyRule) failures.push("aos_runtime_sr_only_rule_missing");
  const disabledButtonHasSrOnlyReason = /<button\b(?=[^>]*data-package-runtime-component="Button")(?=[^>]*disabled)([\s\S]*?)<span\b(?=[^>]*class="tcrn-sr-only")[^>]*>Column customization is not implemented in this owner-trial slice<\/span><\/button>/.test(html);
  if (!disabledButtonHasSrOnlyReason) failures.push("disabled_button_sr_only_reason_markup_missing");
  const mobileRulePresent = /@media \(max-width: 520px\)\s*\{[\s\S]*?\.work-table\.tcrn-table-shell\s*\{[^}]*min-width:\s*0;[^}]*overflow-x:\s*visible;[^}]*\}[\s\S]*?\.work-table \.tcrn-table-shell__head\s*\{[^}]*display:\s*none;[^}]*\}[\s\S]*?\.work-table \.tcrn-table-shell__row\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*min-width:\s*0;[^}]*\}[\s\S]*?\.work-table \.tcrn-table-shell__cell::before\s*\{[^}]*content:\s*attr\(data-label\);/s.test(html);
  if (!mobileRulePresent) failures.push("aos_runtime_mobile_table_shell_stacking_rule_missing");
  const tableDataLabelsPresent = (html.match(/class="tcrn-table-shell__cell"/g) ?? []).length >= 3
    && /data-label="Work item"/.test(html)
    && /data-label="State"/.test(html)
    && /data-label="Owner"/.test(html);
  if (!tableDataLabelsPresent) failures.push("work_index_mobile_data_labels_missing");
  return {
    ok: failures.length === 0,
    source: "AOS Operations Cockpit stylesheet consumes accepted Storybook sr-only and TableShell stacked-row selectors without Design System mutation",
    disabledButtonSrOnlyRulePresent: hasSrOnlyRule,
    disabledButtonSrOnlyReasonMarkupPresent: disabledButtonHasSrOnlyReason,
    mobileTableShellStackingRulePresent: mobileRulePresent,
    tableDataLabelsPresent,
    failures
  };
}

function inspectSourceContentDigest() {
  const sourcePaths = [
    "apps/web/src/cockpit-ui-react-runtime.ts",
    "apps/web/src/cockpit-view.ts",
    "apps/web/src/design-system-bridge.ts",
    "apps/web/test/cockpit-view.test.mjs",
    "scripts/aos-design-system-package-runtime-proof.mjs",
    "scripts/aos-design-system-component-registry-proof.mjs",
    "scripts/aos-design-system-consumer-slice-1-proof.mjs",
    "scripts/aos-design-system-consumer-slice-2-proof.mjs",
    "scripts/slice-4b-style-proof.mjs"
  ];
  const digestInput = sourcePaths
    .map((sourcePath) => `${sourcePath}\0${readFileSync(join(repoRoot, sourcePath), "utf8")}`)
    .join("\0");
  return {
    ok: true,
    strategy: "source_content_digest_for_mutating_receipts",
    sourceHeadAtProofRun: sourceHead,
    exactFinalCommitHeadRequired: false,
    sourceContentDigest: createHash("sha256").update(digestInput).digest("hex"),
    sourcePaths
  };
}

function collectRealIdEntries(html) {
  return Array.from(html.matchAll(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g))
    .map((match) => {
      const parsed = parseAttributes(match[2] ?? "");
      return parsed.id ? { tag: match[1].toLowerCase(), id: parsed.id } : null;
    })
    .filter(Boolean);
}

function collectRealIdText(html) {
  const textById = new Map();
  for (const { id } of collectRealIdEntries(html)) {
    const escapedId = escapeRegExp(id);
    const match = html.match(new RegExp(`<([a-zA-Z][\\w:-]*)\\b(?=[^>]*\\sid="${escapedId}")[^>]*>([\\s\\S]*?)<\\/\\1>`));
    if (match) {
      textById.set(id, decodeHtml(stripTags(match[2]).trim()));
    } else {
      textById.set(id, "");
    }
  }
  return textById;
}

function collectAriaReferences(html) {
  const references = [];
  for (const match of html.matchAll(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g)) {
    const parsed = parseAttributes(match[2] ?? "");
    for (const attribute of ["aria-describedby", "aria-labelledby"]) {
      const ids = splitIdRefs(parsed[attribute]);
      if (ids.length > 0) {
        references.push({
          tag: match[1].toLowerCase(),
          attribute,
          ids
        });
      }
    }
  }
  return references;
}

function collectDisabledControls(html) {
  return Array.from(html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g))
    .map((match) => ({
      tag: match[1].toLowerCase(),
      attributes: match[2],
      body: match[3],
      parsed: parseAttributes(match[2] ?? "")
    }))
    .filter((control) => control.parsed.disabled === "true" || control.parsed["aria-disabled"] === "true");
}

function splitIdRefs(value) {
  return (value ?? "").split(/\s+/).map((id) => id.trim()).filter(Boolean);
}

function normalizeText(value) {
  return decodeHtml(stripTags(value)).replace(/\s+/g, " ").trim();
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

function extractDetailDrawerHtml(html) {
  const marker = 'data-region="detail-drawer"';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return "";
  const start = html.lastIndexOf("<aside", markerIndex);
  const end = html.indexOf("</aside>", markerIndex);
  if (start === -1 || end === -1) return "";
  return html.slice(start, end + "</aside>".length);
}

function extractRegionArticleHtml(html, region) {
  const marker = `data-region="${region}"`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return "";
  const start = html.lastIndexOf("<article", markerIndex);
  const end = html.indexOf("</article>", markerIndex);
  if (start === -1 || end === -1) return "";
  return html.slice(start, end + "</article>".length);
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

function extractButtonLabel(body) {
  return decodeHtml(stripTags(body).trim()) || "unknown";
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
  const detailDrawerRows = summary.detailDrawerRuntimeReadback.failures.length === 0
    ? "- Selected detail drawer package-runtime failures: 0"
    : summary.detailDrawerRuntimeReadback.failures.map((failure) => typeof failure === "string" ? `- ${failure}` : `- ${failure.label}: ${failure.failures.join(", ")}`).join("\n");
  const gateReadbackRows = summary.gateReadbackCardsRuntimeReadback.failures.length === 0
    ? "- Gate Work Order / Readback Posture package-runtime failures: 0"
    : summary.gateReadbackCardsRuntimeReadback.failures.map((failure) => typeof failure === "string" ? `- ${failure}` : `- ${failure.label}: ${failure.failures.join(", ")}`).join("\n");
  const accessibilityRows = [
    `- Full-document duplicate real DOM ids: ${summary.fullDocumentAccessibilityReadback.duplicateIds.length}`,
    `- Full-document aria reference failures: ${summary.fullDocumentAccessibilityReadback.ariaReferenceFailures.length}`,
    `- Full-document disabled-description mismatches: ${summary.fullDocumentAccessibilityReadback.disabledControlDescriptionFailures.length}`
  ].join("\n");
  return `# AOS Design System Package Runtime Proof\n\n`
    + `- Route: ${summary.route}\n`
    + `- Source head at proof run: ${summary.sourceHead}\n`
    + `- Source freshness strategy: ${summary.sourceFreshnessReadback.strategy}\n`
    + `- Source content digest: ${summary.sourceFreshnessReadback.sourceContentDigest}\n`
    + `- Scope: ${summary.claimScope.implementationKind}\n`
    + `- Runtime rendering claim: ${summary.claimScope.packageBackedReactRuntimeRendering}\n`
    + `- Design System source head: ${summary.designSystemReadback.sourceHead}\n`
    + `- UI React package: ${summary.designSystemReadback.uiReactPackage} (${summary.designSystemReadback.uiReactPackageSpecifier})\n`
    + `- Package runtime NavItems: ${summary.navRuntimeReadback.packageRuntimeNavItemCount}\n`
    + `- Package runtime Work Index rows: ${summary.workIndexRuntimeReadback.packageRuntimeWorkRowCount}\n`
    + `- Package runtime Work Index components: ${summary.workIndexRuntimeReadback.packageRuntimeComponents.join(", ")}\n`
    + `- Package runtime selected detail id/type: ${summary.detailDrawerRuntimeReadback.selectedDetailId} / ${summary.detailDrawerRuntimeReadback.selectedDetailType}\n`
    + `- Package runtime selected detail components: ${summary.detailDrawerRuntimeReadback.packageRuntimeComponents.join(", ")}\n`
    + `- Package runtime Gate/Readback card components: ${summary.gateReadbackCardsRuntimeReadback.packageRuntimeComponents.join(", ")}\n`
    + `- Marker-only NavItems in cockpit nav: ${summary.navRuntimeReadback.markerOnlyNavItemCount}\n`
    + `- Deep import hits: ${summary.importReadback.deepImportHits.length}\n`
    + `- Storybook NavItem disabled reason reference ok: ${summary.storybookReferenceReadback.ok}\n\n`
    + `- AOS runtime sr-only / mobile TableShell style proof ok: ${summary.visualStyleReadback.ok}\n`
    + `${rows}\n`
    + `${workIndexRows}\n`
    + `${detailDrawerRows}\n`
    + `${gateReadbackRows}\n`
    + `${accessibilityRows}\n\n`
    + `## Boundaries\n\n`
    + `This is an Operations Cockpit NavItem, Work Index, selected detail drawer, Gate Work Order card, and Readback Posture card package-runtime expansion only. Docs Readiness and AOS-wide Product Design remain marker/static-renderer surfaces. It is not AOS-wide @tcrn/ui-react migration, product UI acceptance, product acceptance, final MVP acceptance, publication, release, VM freshness, or Owner Intent execution.\n`;
}
