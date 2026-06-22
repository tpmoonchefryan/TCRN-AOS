import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import {
  aosCockpitUiReactRuntime,
  renderCockpitRuntimeClaimRiskStrips,
  renderCockpitRuntimeDetailDrawer,
  renderCockpitRuntimeGateReadbackCards,
  renderCockpitRuntimeHeroTitle,
  renderCockpitRuntimeNavItems,
  renderCockpitRuntimeShellSidebar,
  renderCockpitRuntimeStagePhaseCards,
  renderCockpitRuntimeTopbarCheckpoint,
  renderCockpitRuntimeWorkIndexCluster
} from "../dist/apps/web/src/cockpit-ui-react-runtime.js";
import {
  aosDesignSystemConsumerBridge
} from "../dist/apps/web/src/design-system-bridge.js";
import {
  aosDocsReadinessUiReactRuntime,
  renderDocsReadinessRuntimeSurface
} from "../dist/apps/web/src/docs-readiness-ui-react-runtime.js";
import {
  aosWideProductDesignUiReactRuntime,
  renderAOSWideProductDesignRuntimeSurface
} from "../dist/apps/web/src/aos-wide-product-design-ui-react-runtime.js";
import {
  createAOSWideProductDesignModel,
  renderAOSWideProductDesignHtml
} from "../dist/apps/web/src/aos-wide-product-design-view.js";
import {
  createSlice9bDocsSearchReleaseReadModel,
  renderDocsSearchReleaseReadinessHtml
} from "../dist/apps/web/src/docs-readiness-view.js";
import {
  renderOperationsCockpitHtml
} from "../dist/apps/web/src/cockpit-view.js";

const repoRoot = process.cwd();
const route = "route_tcrn_aos_design_system_frontend_full_rebuild_planning_and_implementation_packet";
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const runtimeSourcePath = "apps/web/src/cockpit-ui-react-runtime.ts";
const docsRuntimeSourcePath = "apps/web/src/docs-readiness-ui-react-runtime.ts";
const aosWideRuntimeSourcePath = "apps/web/src/aos-wide-product-design-ui-react-runtime.ts";
const runtimeSource = readFileSync(join(repoRoot, runtimeSourcePath), "utf8");
const docsRuntimeSource = readFileSync(join(repoRoot, docsRuntimeSourcePath), "utf8");
const aosWideRuntimeSource = readFileSync(join(repoRoot, aosWideRuntimeSourcePath), "utf8");
const cockpitHtml = renderOperationsCockpitHtml();
const docsReadinessHtml = renderDocsSearchReleaseReadinessHtml();
const aosWideHtml = renderAOSWideProductDesignHtml();
const shellSidebarRuntimeReadback = inspectPackageRuntimeShellSidebar(cockpitHtml);
const claimRiskEvidenceStripRuntimeReadback = inspectPackageRuntimeClaimRiskStrips(cockpitHtml);
const topbarCheckpointRuntimeReadback = inspectPackageRuntimeTopbarCheckpoint(cockpitHtml);
const navRuntimeReadback = inspectPackageRuntimeNavItems(cockpitHtml);
const workIndexRuntimeReadback = inspectPackageRuntimeWorkIndexCluster(cockpitHtml);
const detailDrawerRuntimeReadback = inspectPackageRuntimeDetailDrawer(cockpitHtml);
const gateReadbackCardsRuntimeReadback = inspectPackageRuntimeGateReadbackCards(cockpitHtml);
const stagePhaseRuntimeReadback = inspectPackageRuntimeStagePhaseCards(cockpitHtml);
const operationsCockpitCompletionRuntimeReadback = inspectOperationsCockpitCompletionRuntime(cockpitHtml);
const docsReadinessRuntimeReadback = inspectDocsReadinessRuntime(docsReadinessHtml);
const aosWideTargetSetRuntimeReadback = inspectAosWideTargetSetRuntime(aosWideHtml);
const fullDocumentAccessibilityReadback = inspectFullDocumentAccessibility(cockpitHtml);
const docsReadinessFullDocumentAccessibilityReadback = inspectFullDocumentAccessibility(docsReadinessHtml);
const aosWideFullDocumentAccessibilityReadback = inspectFullDocumentAccessibility(aosWideHtml);
const visualStyleReadback = inspectAosRuntimeStyleContract(cockpitHtml);
const importReadback = inspectImports();
const dependencyReadback = inspectDependencies();
const storybookReferenceReadback = inspectStorybookReference();
const noOverclaimReadback = inspectNoOverclaim(`${cockpitHtml}\n${docsReadinessHtml}\n${aosWideHtml}`);
const productVisibleCopyReadback = inspectProductVisibleCopy({
  operationsCockpit: cockpitHtml,
  docsReadiness: docsReadinessHtml,
  aosWideProductDesign: aosWideHtml
});
const sourceContentReadback = inspectSourceContentDigest();
const summaryPath = join(repoRoot, "evidence", "aos-design-system-package-runtime-proof.json");
const markdownPath = join(repoRoot, "evidence", "aos-design-system-package-runtime-proof.md");
const checkCurrentSource = process.argv.includes("--check-current-source");

const ok = aosDesignSystemConsumerBridge.uiReactPackage === "@tcrn/ui-react"
  && aosDesignSystemConsumerBridge.designSystemSourceHead === "b0c00828a813d3c62392eb6e53d7d6b85b6affeb"
  && aosCockpitUiReactRuntime.packageBackedReactRuntimeRendering === true
  && dependencyReadback.ok
  && importReadback.ok
  && shellSidebarRuntimeReadback.ok
  && claimRiskEvidenceStripRuntimeReadback.ok
  && topbarCheckpointRuntimeReadback.ok
  && navRuntimeReadback.ok
  && workIndexRuntimeReadback.ok
  && detailDrawerRuntimeReadback.ok
  && gateReadbackCardsRuntimeReadback.ok
  && stagePhaseRuntimeReadback.ok
  && operationsCockpitCompletionRuntimeReadback.ok
  && docsReadinessRuntimeReadback.ok
  && aosWideTargetSetRuntimeReadback.ok
  && fullDocumentAccessibilityReadback.ok
  && docsReadinessFullDocumentAccessibilityReadback.ok
  && aosWideFullDocumentAccessibilityReadback.ok
  && visualStyleReadback.ok
  && storybookReferenceReadback.ok
  && noOverclaimReadback.ok
  && productVisibleCopyReadback.ok
  && sourceContentReadback.ok;

const summary = {
  ok,
  route,
  sourceHead,
  claimScope: {
    implementationKind: "aos_product_frontend_rebuilt_registered_design_system_runtime",
    packageBackedReactRuntimeRendering: "operations_cockpit_docs_readiness_and_aos_wide_product_design_runtime_rebuild",
    storybookVisualStyleParity: "navitem_disabled_reason_work_index_selected_detail_gate_readback_stage_phase_topbar_checkpoint_claim_risk_shell_sidebar_typography_docs_readiness_and_aos_wide_component_reference_only",
    broadUiReactRuntimeMigration: false,
    docsReadinessPackageRuntimeRendering: true,
    aosWidePackageRuntimeRendering: true,
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
  shellSidebarRuntimeReadback,
  claimRiskEvidenceStripRuntimeReadback,
  topbarCheckpointRuntimeReadback,
  navRuntimeReadback,
  workIndexRuntimeReadback,
  detailDrawerRuntimeReadback,
  gateReadbackCardsRuntimeReadback,
  stagePhaseRuntimeReadback,
  operationsCockpitCompletionRuntimeReadback,
  docsReadinessRuntimeReadback,
  aosWideTargetSetRuntimeReadback,
  fullDocumentAccessibilityReadback,
  docsReadinessFullDocumentAccessibilityReadback,
  aosWideFullDocumentAccessibilityReadback,
  visualStyleReadback,
  storybookReferenceReadback,
  noOverclaimReadback,
  productVisibleCopyReadback
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
  packageRuntimeShellSidebarComponentCount: summary.shellSidebarRuntimeReadback.packageRuntimeComponents.length,
  packageRuntimeShellSidebarFailures: summary.shellSidebarRuntimeReadback.failures.length,
  packageRuntimeClaimRiskEvidenceStripComponentCount: summary.claimRiskEvidenceStripRuntimeReadback.packageRuntimeComponents.length,
  packageRuntimeClaimRiskEvidenceStripFailures: summary.claimRiskEvidenceStripRuntimeReadback.failures.length,
  packageRuntimeClaimCount: summary.claimRiskEvidenceStripRuntimeReadback.claimCount,
  packageRuntimeRiskWarningCount: summary.claimRiskEvidenceStripRuntimeReadback.riskWarningCount,
  packageRuntimeTopbarCheckpointComponentCount: summary.topbarCheckpointRuntimeReadback.packageRuntimeComponents.length,
  packageRuntimeTopbarCheckpointFailures: summary.topbarCheckpointRuntimeReadback.failures.length,
  runtimeComponents: summary.navRuntimeReadback.packageRuntimeComponents,
  packageRuntimeNavItemCount: summary.navRuntimeReadback.packageRuntimeNavItemCount,
  packageRuntimeWorkIndexComponentCount: summary.workIndexRuntimeReadback.packageRuntimeComponents.length,
  packageRuntimeWorkRowCount: summary.workIndexRuntimeReadback.packageRuntimeWorkRowCount,
  packageRuntimeDetailDrawerComponentCount: summary.detailDrawerRuntimeReadback.packageRuntimeComponents.length,
  packageRuntimeDetailDrawerSelectedId: summary.detailDrawerRuntimeReadback.selectedDetailId,
  packageRuntimeGateReadbackCardComponentCount: summary.gateReadbackCardsRuntimeReadback.packageRuntimeComponents.length,
  packageRuntimeGateReadbackCardFailures: summary.gateReadbackCardsRuntimeReadback.failures.length,
  packageRuntimeStagePhaseComponentCount: summary.stagePhaseRuntimeReadback.packageRuntimeComponents.length,
  packageRuntimeStagePhaseStageCount: summary.stagePhaseRuntimeReadback.stageCount,
  packageRuntimeStagePhaseRowCount: summary.stagePhaseRuntimeReadback.phaseRowCount,
  packageRuntimeStagePhaseFailures: summary.stagePhaseRuntimeReadback.failures.length,
  operationsCockpitCompletionMarkerOnlyCount: summary.operationsCockpitCompletionRuntimeReadback.markerOnlyComponents.length,
  operationsCockpitCompletionFailures: summary.operationsCockpitCompletionRuntimeReadback.failures.length,
  docsReadinessRuntimeComponentCount: summary.docsReadinessRuntimeReadback.packageRuntimeComponents.length,
  docsReadinessMarkerOnlyCount: summary.docsReadinessRuntimeReadback.markerOnlyComponents.length,
  docsReadinessRuntimeFailures: summary.docsReadinessRuntimeReadback.failures.length,
  aosWideTargetSetRuntimeComponentCount: summary.aosWideTargetSetRuntimeReadback.packageRuntimeComponents.length,
  aosWideTargetSetMarkerOnlyCount: summary.aosWideTargetSetRuntimeReadback.markerOnlyComponents.length,
  aosWideTargetSetRuntimeFailures: summary.aosWideTargetSetRuntimeReadback.failures.length,
  docsReadinessDuplicateDomIdCount: summary.docsReadinessFullDocumentAccessibilityReadback.duplicateIds.length,
  docsReadinessAriaReferenceFailureCount: summary.docsReadinessFullDocumentAccessibilityReadback.ariaReferenceFailures.length,
  docsReadinessDisabledDescriptionMismatchCount: summary.docsReadinessFullDocumentAccessibilityReadback.disabledControlDescriptionFailures.length,
  aosWideDuplicateDomIdCount: summary.aosWideFullDocumentAccessibilityReadback.duplicateIds.length,
  aosWideAriaReferenceFailureCount: summary.aosWideFullDocumentAccessibilityReadback.ariaReferenceFailures.length,
  aosWideDisabledDescriptionMismatchCount: summary.aosWideFullDocumentAccessibilityReadback.disabledControlDescriptionFailures.length,
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
  const combinedRuntimeSource = `${runtimeSource}\n${docsRuntimeSource}\n${aosWideRuntimeSource}`;
  const packageImportPresent = /from\s+["']@tcrn\/ui-react["']/.test(runtimeSource);
  const docsPackageImportPresent = /from\s+["']@tcrn\/ui-react["']/.test(docsRuntimeSource);
  const aosWidePackageImportPresent = /from\s+["']@tcrn\/ui-react["']/.test(aosWideRuntimeSource);
  const reactServerRenderingPresent = /from\s+["']react-dom\/server["']/.test(runtimeSource);
  const docsReactServerRenderingPresent = /from\s+["']react-dom\/server["']/.test(docsRuntimeSource);
  const aosWideReactServerRenderingPresent = /from\s+["']react-dom\/server["']/.test(aosWideRuntimeSource);
  const requiredPublicComponentImports = [
    "NavItem",
    "SideNav",
    "NavGroup",
    "LinkButton",
    "TopBar",
    "WorkIndex",
    "SearchInput",
    "Field",
    "Select",
    "FilterBar",
    "Button",
    "IconButton",
    "Badge",
    "StateView",
    "DetailDrawer",
    "KeyValueList",
    "Surface",
    "Heading",
    "Text",
    "StatusBadge",
    "GateReadinessPanel",
    "ReadbackPanel",
    "EvidenceStrip",
    "SideNav",
    "NavGroup",
    "LinkButton"
  ];
  const publicComponentImportPresence = Object.fromEntries(
    Array.from(new Set(requiredPublicComponentImports)).map((name) => [name, new RegExp(`\\b${name}\\b`).test(combinedRuntimeSource)])
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
    "function\\s+(NavItem|SideNav|NavGroup|LinkButton|TopBar|WorkIndex|TableShell|SearchInput|Field|Select|FilterBar|Button|IconButton|Badge|StateView|DetailDrawer|KeyValueList|Surface|Heading|Text|StatusBadge|GateReadinessPanel|ReadbackPanel|EvidenceStrip)|const\\s+(NavItem|SideNav|NavGroup|LinkButton|TopBar|WorkIndex|TableShell|SearchInput|Field|Select|FilterBar|Button|IconButton|Badge|StateView|DetailDrawer|KeyValueList|Surface|Heading|Text|StatusBadge|GateReadinessPanel|ReadbackPanel|EvidenceStrip)|export\\s+function\\s+(NavItem|SideNav|NavGroup|LinkButton|TopBar|WorkIndex|TableShell|SearchInput|Field|Select|FilterBar|Button|IconButton|Badge|StateView|DetailDrawer|KeyValueList|Surface|Heading|Text|StatusBadge|GateReadinessPanel|ReadbackPanel|EvidenceStrip)",
    "apps/web/src",
    "apps/web/test",
    "scripts"
  ]).filter((line) => !line.includes(runtimeSourcePath) && !line.includes(docsRuntimeSourcePath) && !line.includes(aosWideRuntimeSourcePath));
  return {
    ok: packageImportPresent
      && docsPackageImportPresent
      && aosWidePackageImportPresent
      && reactServerRenderingPresent
      && docsReactServerRenderingPresent
      && aosWideReactServerRenderingPresent
      && Object.values(publicComponentImportPresence).every(Boolean)
      && deepImportHits.length === 0
      && copiedSourceHits.length === 0,
    runtimeSourcePath,
    docsRuntimeSourcePath,
    aosWideRuntimeSourcePath,
    packageImportPresent,
    docsPackageImportPresent,
    aosWidePackageImportPresent,
    reactServerRenderingPresent,
    docsReactServerRenderingPresent,
    aosWideReactServerRenderingPresent,
    publicComponentImportPresence,
    deepImportHits,
    copiedSourceHits
  };
}

function inspectPackageRuntimeShellSidebar(html) {
  const mainHtml = extractMainShellHtml(html);
  const sidebarHtml = extractSidebarHtml(html);
  const brandHtml = extractRegionElementHtml(html, "brand-lockup", "a");
  const failures = [];

  if (!mainHtml) failures.push("shell_surface_missing");
  if (!sidebarHtml) failures.push("sidebar_nav_missing");
  if (!brandHtml) failures.push("brand_lockup_missing");

  const mainTagHtml = mainHtml.match(/<main\b[^>]*>/)?.[0] ?? "";
  const packageRuntimeComponents = Array.from(new Set(
    Array.from(`${mainTagHtml}\n${sidebarHtml}`.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredComponents = [
    "LinkButton",
    "NavGroup",
    "NavItem",
    "SideNav",
    "Surface",
    "Text"
  ];
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  if (missingComponents.length > 0) failures.push("shell_sidebar_required_package_components_missing");

  const mainAttributes = parseAttributes(mainHtml.match(/<main\b([^>]*)>/)?.[1] ?? "");
  const sidebarAttributes = parseAttributes(sidebarHtml.match(/<nav\b([^>]*)>/)?.[1] ?? "");
  const brandAttributes = parseAttributes(brandHtml.match(/<a\b([^>]*)>/)?.[1] ?? "");
  const navGroupAttributes = parseAttributes(sidebarHtml.match(/<div\b(?=[^>]*data-package-runtime-component="NavGroup")([^>]*)>/)?.[1] ?? "");

  if (mainAttributes["data-package-runtime-component"] !== "Surface") failures.push("shell_surface_missing_runtime_marker");
  if (mainAttributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push("shell_surface_missing_package_source");
  if (mainAttributes["data-package-runtime-surface"] !== aosCockpitUiReactRuntime.implementationKind) failures.push("shell_surface_implementation_scope_mismatch");
  if (mainAttributes["data-surface"] !== "operations-cockpit") failures.push("shell_surface_aos_metadata_missing");
  if (sidebarAttributes["data-package-runtime-component"] !== "SideNav") failures.push("sidebar_missing_sidenav_runtime_marker");
  if (sidebarAttributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push("sidebar_missing_package_source");
  if (sidebarAttributes["data-package-runtime-surface"] !== "operations-cockpit-shell-sidebar") failures.push("sidebar_missing_runtime_surface");
  if (sidebarAttributes["data-region"] !== "sidebar-nav") failures.push("sidebar_region_missing");
  if (sidebarAttributes["aria-label"] !== "AOS navigation") failures.push("sidebar_label_mismatch");
  if (sidebarAttributes["data-navigation-primitive"] !== "side-nav") failures.push("sidebar_navigation_primitive_missing");
  if (brandAttributes["data-package-runtime-component"] !== "LinkButton") failures.push("brand_lockup_missing_linkbutton_runtime_marker");
  if (brandAttributes["data-region"] !== "brand-lockup") failures.push("brand_lockup_region_missing");
  if (brandAttributes.href !== "#cockpit") failures.push("brand_lockup_href_mismatch");
  if (!/class="brand-tcrn">TCRN<\/span>/.test(brandHtml) || !/class="brand-aos">AOS<\/span>/.test(brandHtml)) {
    failures.push("brand_lockup_copy_missing");
  }
  if (navGroupAttributes["data-package-runtime-component"] !== "NavGroup") failures.push("nav_group_missing_runtime_marker");
  if (navGroupAttributes["data-package-runtime-scope"] !== "operations-cockpit-navitem") failures.push("nav_group_scope_missing");
  if (navGroupAttributes["data-navigation-primitive"] !== "nav-group") failures.push("nav_group_primitive_missing");
  if (!/Primary cockpit views/.test(sidebarHtml)) failures.push("nav_group_label_missing");
  if (!/Local operations posture recorded/.test(sidebarHtml)) failures.push("sidebar_footer_copy_missing");
  if (!/data-package-runtime-component="Text"/.test(sidebarHtml)) failures.push("sidebar_footer_text_runtime_missing");

  const navItems = Array.from(sidebarHtml.matchAll(/<a\b(?=[^>]*data-tcrn-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g));
  if (navItems.length !== 10) failures.push("sidebar_navitem_count_mismatch");
  const markerOnlyComponents = Array.from(sidebarHtml.matchAll(/<([a-zA-Z][\w:-]*)\b(?=[^>]*data-tcrn-component="([^"]+)")(?![^>]*data-package-runtime-component=)([^>]*)>/g))
    .map((match) => ({ tag: match[1], component: match[2] }));
  if (markerOnlyComponents.length > 0) failures.push("shell_sidebar_marker_only_runtime_claim_present");

  const sampleRenderedHtmlSha256 = createHash("sha256").update(renderCockpitRuntimeShellSidebar({
    brandAriaLabel: "TCRN AOS",
    brandHref: "#cockpit",
    brandPrimaryLabel: "TCRN",
    brandSecondaryLabel: "AOS",
    footerLabel: "Local operations posture recorded",
    navItems: [
      {
        active: false,
        disabledReason: "Sample disabled reason for shell sidebar proof.",
        href: "#cockpit",
        label: "Sample"
      }
    ],
    navLabel: "Primary cockpit views",
    shellAttributesHtml: 'data-surface="operations-cockpit" data-service-backed="false" data-cockpit-api="/api/cockpit" data-package-backed-react-runtime-rendering="true" data-package-runtime-surface="sample" data-package-runtime-component-scope="NavItem,SideNav,NavGroup,LinkButton,Surface,Text"'
  })).digest("hex");

  return {
    ok: failures.length === 0,
    present: Boolean(mainHtml && sidebarHtml && brandHtml),
    surface: "operations-cockpit-shell-sidebar",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    navItemCount: navItems.length,
    markerOnlyComponents,
    brandLockupRegionPresent: Boolean(brandAttributes["data-region"]),
    sidebarRegionPresent: Boolean(sidebarAttributes["data-region"]),
    footerReadback: /Local operations posture recorded/.test(sidebarHtml),
    sampleRenderedHtmlSha256,
    failures
  };
}

function inspectPackageRuntimeClaimRiskStrips(html) {
  const claimHtml = extractRegionHtml(html, "claim-strip");
  const riskHtml = extractRegionHtml(html, "risk-lane");
  const failures = [];

  if (!claimHtml) failures.push("claim_strip_missing");
  if (!riskHtml) failures.push("risk_lane_missing");
  const combinedHtml = `${claimHtml}\n${riskHtml}`;
  const packageRuntimeComponents = Array.from(new Set(
    Array.from(combinedHtml.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredComponents = [
    "Badge",
    "EvidenceStrip",
    "StatusBadge"
  ];
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  if (missingComponents.length > 0) failures.push("claim_risk_required_package_components_missing");

  const claimAttributes = parseAttributes(claimHtml.match(/<section\b([^>]*)>/)?.[1] ?? "");
  const riskAttributes = parseAttributes(riskHtml.match(/<section\b([^>]*)>/)?.[1] ?? "");
  for (const [label, attributes] of [["claim_strip", claimAttributes], ["risk_lane", riskAttributes]]) {
    if (attributes["data-package-runtime-component"] !== "EvidenceStrip") failures.push(`${label}_missing_evidence_strip_runtime_marker`);
    if (attributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push(`${label}_missing_package_source`);
    if (attributes["data-package-runtime-surface"] !== "operations-cockpit-claim-risk-strips") failures.push(`${label}_missing_runtime_surface`);
  }

  const claimCount = Number(claimAttributes["data-package-runtime-item-count"] ?? 0);
  const riskWarningCount = Number(riskAttributes["data-package-runtime-item-count"] ?? 0);
  if (claimCount !== 3) failures.push("claim_strip_item_count_mismatch");
  if (riskWarningCount !== 4) failures.push("risk_lane_item_count_mismatch");
  if ((claimHtml.match(/data-claim-key=/g) ?? []).length !== 3) failures.push("claim_strip_claim_keys_missing");
  if ((riskHtml.match(/data-risk-id=/g) ?? []).length !== 4) failures.push("risk_lane_risk_ids_missing");
  if ((riskHtml.match(/data-risk-owner-role=/g) ?? []).length !== 4) failures.push("risk_lane_owner_roles_missing");
  if ((riskHtml.match(/data-risk-summary=/g) ?? []).length !== 4) failures.push("risk_lane_summaries_missing");
  if (!/Evidence review pending/.test(claimHtml)) failures.push("claim_strip_release_boundary_missing");
  if (!/Not enabled/.test(claimHtml)) failures.push("claim_strip_product_design_boundary_missing");
  if (!/Live operations disabled/.test(claimHtml)) failures.push("claim_strip_live_dispatch_boundary_missing");
  if (!/Review required|Blocked|Not applicable|Accepted with residual risk/.test(riskHtml)) failures.push("risk_lane_warning_state_missing");

  const markerOnlyComponents = Array.from(combinedHtml.matchAll(/<([a-zA-Z][\w:-]*)\b(?=[^>]*data-tcrn-component="([^"]+)")(?![^>]*data-package-runtime-component=)([^>]*)>/g))
    .map((match) => ({ tag: match[1], component: match[2] }));
  if (markerOnlyComponents.length > 0) failures.push("claim_risk_marker_only_runtime_claim_present");

  const forbiddenClaimHits = [
    "risk accepted",
    "dependency clean",
    "legal completion",
    "release ready",
    "product accepted",
    "final mvp accepted"
  ].filter((phrase) => combinedHtml.toLowerCase().includes(phrase));
  if (forbiddenClaimHits.length > 0) failures.push("claim_risk_forbidden_overclaim_copy_present");

  const sampleRenderedHtmlSha256 = createHash("sha256").update(renderCockpitRuntimeClaimRiskStrips({
    claims: [
      { key: "release-readiness", label: "Evidence review pending", state: "external_proof_needed", variant: "status" },
      { key: "product-design-visual", label: "Not enabled", state: "not_claimed", variant: "status" },
      { key: "live-dispatch", label: "Live operations disabled", state: "unavailable", variant: "badge" }
    ],
    riskWarnings: [
      {
        id: "sample-risk",
        ownerRole: "security",
        state: "proof_required",
        stateLabel: "Review required",
        summary: "Sample risk warning remains a readback only.",
        typeLabel: "Dependency proof"
      }
    ]
  })).digest("hex");

  return {
    ok: failures.length === 0,
    present: Boolean(claimHtml && riskHtml),
    surface: "operations-cockpit-claim-risk-strips",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    claimCount,
    riskWarningCount,
    claimItems: Array.from(claimHtml.matchAll(/data-claim-key="([^"]+)"/g)).map((match) => match[1]),
    riskItems: Array.from(riskHtml.matchAll(/data-risk-id="([^"]+)"/g)).map((match) => match[1]),
    markerOnlyComponents,
    forbiddenClaimHits,
    sampleRenderedHtmlSha256,
    failures
  };
}

function inspectPackageRuntimeTopbarCheckpoint(html) {
  const topbarHtml = extractHeaderHtml(html, "topbar-checkpoint");
  const failures = [];
  if (!topbarHtml) {
    return {
      ok: false,
      present: false,
      surface: "operations-cockpit-topbar-checkpoint",
      requiredComponents: [],
      packageRuntimeComponents: [],
      failures: ["topbar_checkpoint_missing"]
    };
  }

  const packageRuntimeComponents = Array.from(new Set(
    Array.from(topbarHtml.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredComponents = [
    "Badge",
    "Button",
    "Field",
    "Heading",
    "IconButton",
    "ReadbackPanel",
    "Select",
    "StatusBadge",
    "TopBar"
  ];
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  if (missingComponents.length > 0) failures.push("topbar_checkpoint_required_package_components_missing");

  const topbarAttributes = parseAttributes(topbarHtml.match(/<header\b([^>]*)>/)?.[1] ?? "");
  if (topbarAttributes["data-package-runtime-component"] !== "TopBar") failures.push("topbar_missing_topbar_runtime_marker");
  if (topbarAttributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push("topbar_missing_package_source");
  if (topbarAttributes["data-package-runtime-surface"] !== "operations-cockpit-topbar-checkpoint") failures.push("topbar_missing_runtime_surface");

  const projectSelectorHtml = extractLabelHtml(topbarHtml, "project-selector");
  if (!projectSelectorHtml) failures.push("project_selector_missing");
  if (projectSelectorHtml && !/data-package-runtime-component="Field"/.test(projectSelectorHtml)) failures.push("project_selector_missing_field_runtime_marker");
  if (projectSelectorHtml && !/data-package-runtime-component="Select"/.test(projectSelectorHtml)) failures.push("project_selector_missing_select_runtime_marker");
  if (projectSelectorHtml && !/id="project-select"/.test(projectSelectorHtml)) failures.push("project_selector_missing_project_select_id");
  if (projectSelectorHtml && !/Project/.test(projectSelectorHtml)) failures.push("project_selector_label_missing");

  const checkpointHtml = extractSectionHtml(topbarHtml, "checkpoint-strip");
  if (!checkpointHtml) failures.push("checkpoint_strip_missing");
  if (checkpointHtml && !/data-package-runtime-component="ReadbackPanel"/.test(checkpointHtml)) failures.push("checkpoint_missing_readback_panel_runtime_marker");
  if (checkpointHtml && !/Workspace status/.test(checkpointHtml)) failures.push("checkpoint_label_missing");
  if (checkpointHtml && !/data-local-checkpoint/.test(checkpointHtml)) failures.push("checkpoint_value_missing");
  if (checkpointHtml && !/data-package-runtime-component="StatusBadge"/.test(checkpointHtml)) failures.push("checkpoint_freshness_status_badge_missing");
  if (checkpointHtml && !/data-readback-freshness/.test(checkpointHtml)) failures.push("checkpoint_freshness_readback_missing");
  if (checkpointHtml && !/data-service-status/.test(checkpointHtml)) failures.push("checkpoint_service_status_missing");
  if (checkpointHtml && !/data-service-model-readback/.test(checkpointHtml)) failures.push("checkpoint_service_model_readback_missing");

  const refreshButton = topbarHtml.match(/<button\b(?=[^>]*data-refresh-readback)([^>]*)>([\s\S]*?)<\/button>/);
  if (!refreshButton) failures.push("refresh_readback_button_missing");
  const refreshAttrs = parseAttributes(refreshButton?.[1] ?? "");
  if (refreshButton && refreshAttrs["data-package-runtime-component"] !== "Button") failures.push("refresh_readback_button_missing_runtime_marker");
  if (refreshButton && !/Refresh status/.test(refreshButton[2])) failures.push("refresh_readback_button_label_missing");

  const profileButton = topbarHtml.match(/<button\b(?=[^>]*aria-label="Current operator")([^>]*)>([\s\S]*?)<\/button>/);
  if (!profileButton) failures.push("profile_icon_button_missing");
  const profileAttrs = parseAttributes(profileButton?.[1] ?? "");
  if (profileButton && profileAttrs["data-package-runtime-component"] !== "IconButton") failures.push("profile_icon_button_missing_runtime_marker");
  if (profileButton && !/RL/.test(profileButton[2])) failures.push("profile_operator_label_missing");

  const markerOnlyComponents = Array.from(topbarHtml.matchAll(/<([a-zA-Z][\w:-]*)\b(?=[^>]*data-tcrn-component="([^"]+)")(?![^>]*data-package-runtime-component=)([^>]*)>/g))
    .map((match) => ({ tag: match[1], component: match[2] }));
  if (markerOnlyComponents.length > 0) failures.push("topbar_checkpoint_marker_only_runtime_claim_present");

  const sampleRenderedHtmlSha256 = createHash("sha256").update(renderCockpitRuntimeTopbarCheckpoint({
    checkpointLabel: "Workspace status",
    checkpointValue: "Operations cockpit ready",
    freshnessLabel: "Readback current",
    operatorLabel: "RL",
    projectId: "TCRN-AOS",
    projectOptions: ["TCRN-AOS", "TCRN-TMS"],
    refreshLabel: "Refresh status",
    serviceReadbackLabel: "1 work / 2 gates / detail story",
    serviceStatusLabel: "static fixture"
  })).digest("hex");

  return {
    ok: failures.length === 0,
    present: true,
    surface: "operations-cockpit-topbar-checkpoint",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    projectSelectorPresent: Boolean(projectSelectorHtml),
    checkpointStripPresent: Boolean(checkpointHtml),
    refreshButtonPresent: Boolean(refreshButton),
    profileIconButtonPresent: Boolean(profileButton),
    markerOnlyComponents,
    sampleRenderedHtmlSha256,
    failures
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
  if (!/Selected Work Summary/.test(detailHtml)) failures.push("detail_drawer_summary_surface_missing");
  if (!/Release and live operations remain disabled in this workspace/.test(detailHtml)) {
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
    blockedActionLabel: "No local blockers",
    closeLabel: "Close detail",
    detailRows: [
      { key: "selected", label: "Selected", value: "Selected work / sample_story" },
      { key: "evidence", label: "Evidence", value: "Metadata only" }
    ],
    noOverclaimSummary: "Release and live operations remain disabled in this workspace.",
    operatingLoopSummary: "Selected detail uses the service-backed work model.",
    primaryActionDisabledReason: "Gate work order execution requires approved action authority.",
    primaryActionLabel: "Gate work order",
    secondaryActionDisabledReason: "Rework requests require approved action authority.",
    secondaryActionLabel: "Request rework",
    selectedId: "sample_story",
    selectedType: "story",
    selectedTypeLabel: "Selected work",
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
  if (!/Workspace Posture/.test(readbackHtml)) failures.push("readback_card_title_missing");
  if (!/class="count\b/.test(gateHtml)) failures.push("gate_card_count_badge_missing");
  if (!/class="gate-block\b/.test(gateHtml)) failures.push("gate_card_gate_block_missing");
  if (!/Gate request held/.test(gateHtml)) failures.push("gate_card_disabled_action_missing");
  if (!/Evidence detail held/.test(readbackHtml)) failures.push("readback_card_disabled_action_missing");
  if ((readbackHtml.match(/<dt>/g) ?? []).length !== 4) failures.push("readback_card_key_value_rows_missing");
  for (const expectedLabel of ["Local data mode", "Evidence", "Dependency", "Resource"]) {
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
      gateStatusLabel: "Owner Intent required",
      gateSummary: "Owner Intent gate: Owner Intent required; Owner Intent separated.",
      gateTypeLabel: "Owner Intent gate"
    },
    readbackPosture: {
      dependencyLabel: "Review required",
      disabledReason: "Sample evidence detail disabled reason.",
      evidenceLabel: "Readback current",
      resourceLabel: "Review required",
      runtimeFixtureLabel: "Local service snapshot"
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

function inspectPackageRuntimeStagePhaseCards(html) {
  const stageHtml = extractRegionHtml(html, "stage-map");
  const phaseHtml = extractRegionHtml(html, "ai-employee-phase");
  const failures = [];

  if (!stageHtml) failures.push("stage_map_card_missing");
  if (!phaseHtml) failures.push("ai_employee_phase_card_missing");
  const combinedHtml = `${stageHtml}\n${phaseHtml}`;
  const packageRuntimeComponents = Array.from(new Set(
    Array.from(combinedHtml.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredComponents = [
    "Badge",
    "Button",
    "Heading",
    "StatusBadge",
    "Surface",
    "Text"
  ];
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  if (missingComponents.length > 0) failures.push("stage_phase_required_package_components_missing");

  const stageAttributes = parseAttributes(stageHtml.match(/<(?:section|article)\b([^>]*)>/)?.[1] ?? "");
  const phaseAttributes = parseAttributes(phaseHtml.match(/<(?:section|article)\b([^>]*)>/)?.[1] ?? "");
  if (stageAttributes["data-package-runtime-component"] !== "Surface") failures.push("stage_map_missing_surface_runtime_marker");
  if (phaseAttributes["data-package-runtime-component"] !== "Surface") failures.push("ai_employee_phase_missing_surface_runtime_marker");
  for (const [label, attributes] of [["stage_map", stageAttributes], ["ai_employee_phase", phaseAttributes]]) {
    if (attributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push(`${label}_missing_package_source`);
    if (attributes["data-package-runtime-surface"] !== "operations-cockpit-stage-phase") failures.push(`${label}_missing_runtime_surface`);
  }

  const stageItems = Array.from(stageHtml.matchAll(/<li\b(?=[^>]*data-stage-id)([^>]*)>([\s\S]*?)<\/li>/g))
    .map((match) => ({ attributes: match[1], body: match[2], parsed: parseAttributes(match[1]) }));
  const phaseRows = Array.from(phaseHtml.matchAll(/<div\b(?=[^>]*class="[^"]*\bphase-row\b)(?=[^>]*data-phase-stage-id)([^>]*)>([\s\S]*?)<\/div>/g))
    .map((match) => ({ attributes: match[1], body: match[2], parsed: parseAttributes(match[1]) }));
  if (stageItems.length !== 4) failures.push("stage_map_stage_count_mismatch");
  if (phaseRows.length !== 4) failures.push("ai_employee_phase_row_count_mismatch");
  for (const item of stageItems) {
    const itemFailures = [];
    if (item.parsed["data-package-runtime-surface"] !== "operations-cockpit-stage-phase") itemFailures.push("stage_item_missing_runtime_surface");
    if (!item.parsed["data-stage-state"]?.trim()) itemFailures.push("stage_item_missing_state");
    if (!item.parsed["data-stage-owner-count"]?.trim()) itemFailures.push("stage_item_missing_owner_count");
    if (!item.parsed["data-stage-gate-count"]?.trim()) itemFailures.push("stage_item_missing_gate_count");
    if (!item.parsed["data-stage-evidence-count"]?.trim()) itemFailures.push("stage_item_missing_evidence_count");
    if (!/data-package-runtime-component="Text"/.test(item.body)) itemFailures.push("stage_item_missing_text_runtime_marker");
    if (!/class="[^"]*\bstage-number\b[^"]*"/.test(item.body)) itemFailures.push("stage_item_missing_number_badge");
    if (!/data-package-runtime-component="StatusBadge"/.test(item.body)) itemFailures.push("stage_item_missing_status_badge_runtime_marker");
    if (itemFailures.length > 0) {
      failures.push({ stageId: item.parsed["data-stage-id"] ?? "unknown", failures: itemFailures });
    }
  }
  for (const row of phaseRows) {
    const rowFailures = [];
    if (row.parsed["data-package-runtime-surface"] !== "operations-cockpit-stage-phase") rowFailures.push("phase_row_missing_runtime_surface");
    if (!row.parsed["data-phase-state"]?.trim()) rowFailures.push("phase_row_missing_state");
    if (!/data-package-runtime-component="Text"/.test(row.body)) rowFailures.push("phase_row_missing_text_runtime_marker");
    if (!/data-package-runtime-component="Badge"/.test(row.body)) rowFailures.push("phase_row_missing_owner_badge_runtime_marker");
    if (!/data-package-runtime-component="StatusBadge"/.test(row.body)) rowFailures.push("phase_row_missing_status_badge_runtime_marker");
    if (rowFailures.length > 0) {
      failures.push({ stageId: row.parsed["data-phase-stage-id"] ?? "unknown", failures: rowFailures });
    }
  }

  const disabledButtons = Array.from(combinedHtml.matchAll(/<button\b(?=[^>]*data-package-runtime-component="Button")(?=[^>]*disabled)([^>]*)>([\s\S]*?)<\/button>/g))
    .map((match) => ({ attributes: match[1], body: match[2], parsed: parseAttributes(match[1]) }));
  if (disabledButtons.length !== 2) failures.push("stage_phase_disabled_button_count_mismatch");
  for (const button of disabledButtons) {
    const buttonFailures = [];
    if (button.parsed["data-package-runtime-surface"] !== "operations-cockpit-stage-phase") buttonFailures.push("disabled_button_missing_stage_phase_surface");
    if (!button.parsed.title?.trim()) buttonFailures.push("disabled_button_missing_title");
    if (!button.parsed["data-disabled-reason"]?.trim()) buttonFailures.push("disabled_button_missing_data_disabled_reason");
    if (!button.parsed["aria-describedby"]?.trim()) buttonFailures.push("disabled_button_missing_aria_describedby");
    if (!/class="tcrn-sr-only"/.test(button.body)) buttonFailures.push("disabled_button_sr_only_reason_missing");
    if (buttonFailures.length > 0) {
      failures.push({ label: extractButtonLabel(button.body), failures: buttonFailures });
    }
  }

  const markerOnlyComponents = Array.from(combinedHtml.matchAll(/<([a-zA-Z][\w:-]*)\b(?=[^>]*data-tcrn-component="([^"]+)")(?![^>]*data-package-runtime-component=)([^>]*)>/g))
    .map((match) => ({ tag: match[1], component: match[2] }));
  if (markerOnlyComponents.length > 0) failures.push("stage_phase_marker_only_runtime_claim_present");

  const mobileReadability = {
    stageLabelRulePresent: /\.stage-line \.stage-label\s*\{[^}]*white-space:\s*nowrap;/s.test(html),
    stageNumberScopedRulePresent: /\.stage-line \.stage-number\s*\{[^}]*width:\s*30px;[^}]*height:\s*30px;/s.test(html),
    phaseLabelRulePresent: /\.phase-label\s*\{[^}]*min-width:\s*0;[^}]*white-space:\s*nowrap;/s.test(html),
    mobileStageWrapRulePresent: /@media \(max-width: (?:460|520)px\)\s*\{[\s\S]*?\.stage-line\s*\{[^}]*grid-template-columns:\s*1fr;/s.test(html)
  };
  if (!Object.values(mobileReadability).every(Boolean)) failures.push("stage_phase_mobile_readability_rule_missing");

  const sampleRenderedHtmlSha256 = createHash("sha256").update(renderCockpitRuntimeStagePhaseCards({
    roleDetailDisabledReason: "Sample role detail disabled reason.",
    stageDetailDisabledReason: "Sample stage detail disabled reason.",
    stages: [
      {
        evidenceCount: 2,
        freshnessLabel: "Readback current",
        index: 0,
        label: "Sample stage",
        ownerRoles: ["implementation", "review"],
        releaseReadinessLabel: "Not claimed",
        sourceGateCount: 1,
        stageId: "sample-stage",
        state: "active",
        stateLabel: "Active locally"
      }
    ]
  })).digest("hex");

  return {
    ok: failures.length === 0,
    present: Boolean(stageHtml && phaseHtml),
    surface: "operations-cockpit-stage-phase",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    stageCount: stageItems.length,
    phaseRowCount: phaseRows.length,
    disabledActionButtonCount: disabledButtons.length,
    markerOnlyComponents,
    mobileReadability,
    sampleRenderedHtmlSha256,
    failures
  };
}

function inspectOperationsCockpitCompletionRuntime(html) {
  const mainHtml = extractMainShellHtml(html);
  const failures = [];
  if (!mainHtml) {
    return {
      ok: false,
      present: false,
      surface: "operations-cockpit-package-runtime-completion",
      requiredComponents: [],
      packageRuntimeComponents: [],
      markerOnlyComponents: [],
      missingComponents: [],
      failures: ["operations_cockpit_main_missing"]
    };
  }

  const packageRuntimeComponents = Array.from(new Set(
    Array.from(mainHtml.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredComponents = Array.from(aosCockpitUiReactRuntime.componentScope);
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  if (missingComponents.length > 0) failures.push("operations_cockpit_required_package_components_missing");

  const markerOnlyComponents = Array.from(mainHtml.matchAll(/<([a-zA-Z][\w:-]*)\b(?=[^>]*data-tcrn-component="([^"]+)")(?![^>]*data-package-runtime-component=)([^>]*)>/g))
    .map((match) => ({
      tag: match[1],
      component: match[2],
      snippet: redactAttributeSnippet(match[0])
    }));
  if (markerOnlyComponents.length > 0) failures.push("operations_cockpit_marker_only_component_claim_present");

  const mainAttributes = parseAttributes(mainHtml.match(/<main\b([^>]*)>/)?.[1] ?? "");
  if (mainAttributes["data-package-runtime-surface"] !== aosCockpitUiReactRuntime.implementationKind) {
    failures.push("operations_cockpit_runtime_surface_mismatch");
  }
  if (mainAttributes["data-package-runtime-component-scope"] !== aosCockpitUiReactRuntime.componentScope.join(",")) {
    failures.push("operations_cockpit_component_scope_mismatch");
  }

  const heroTitleHtml = extractRegionElementHtml(mainHtml, "hero-title", "div");
  const heroAttributes = parseAttributes(heroTitleHtml.match(/<div\b([^>]*)>/)?.[1] ?? "");
  const heroTextRuntimePresent = /<p\b(?=[^>]*data-tcrn-component="Text")(?=[^>]*data-package-runtime-component="Text")(?=[^>]*data-package-runtime-surface="operations-cockpit-hero-title")[^>]*>Operations Cockpit<\/p>/.test(heroTitleHtml);
  const heroHeadingRuntimePresent = /<h1\b(?=[^>]*data-tcrn-component="Heading")(?=[^>]*data-package-runtime-component="Heading")(?=[^>]*data-package-runtime-surface="operations-cockpit-hero-title")[^>]*>TCRN-AOS<\/h1>/.test(heroTitleHtml);
  if (heroAttributes["data-region"] !== "hero-title") failures.push("hero_title_region_missing");
  if (heroAttributes["data-package-runtime-surface"] !== "operations-cockpit-hero-title") failures.push("hero_title_surface_missing");
  if (!heroTextRuntimePresent) failures.push("hero_title_text_runtime_missing");
  if (!heroHeadingRuntimePresent) failures.push("hero_title_heading_runtime_missing");

  const workIndexHeadingRuntimePresent = /<h2\b(?=[^>]*data-tcrn-component="Heading")(?=[^>]*data-package-runtime-component="Heading")(?=[^>]*data-package-runtime-surface="operations-cockpit-work-index")[^>]*>Work Index<\/h2>/.test(mainHtml);
  if (!workIndexHeadingRuntimePresent) failures.push("work_index_heading_runtime_missing");

  const sampleRenderedHtmlSha256 = createHash("sha256").update(renderCockpitRuntimeHeroTitle({
    eyebrow: "Operations Cockpit",
    title: "TCRN-AOS"
  })).digest("hex");

  return {
    ok: failures.length === 0,
    present: true,
    surface: "operations-cockpit-package-runtime-completion",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    markerOnlyComponents,
    runtimeSurface: mainAttributes["data-package-runtime-surface"] ?? "",
    componentScope: mainAttributes["data-package-runtime-component-scope"] ?? "",
    heroTitleReadback: {
      present: Boolean(heroTitleHtml),
      region: heroAttributes["data-region"] ?? "",
      surface: heroAttributes["data-package-runtime-surface"] ?? "",
      textRuntimePresent: heroTextRuntimePresent,
      headingRuntimePresent: heroHeadingRuntimePresent
    },
    workIndexHeadingRuntimePresent,
    sampleRenderedHtmlSha256,
    failures
  };
}

function inspectDocsReadinessRuntime(html) {
  const mainHtml = extractDocsReadinessMainHtml(html);
  const failures = [];
  if (!mainHtml) {
    return {
      ok: false,
      present: false,
      surface: "docs-readiness-package-runtime-adoption",
      requiredComponents: [],
      packageRuntimeComponents: [],
      markerOnlyComponents: [],
      missingComponents: [],
      failures: ["docs_readiness_main_missing"]
    };
  }

  const packageRuntimeComponents = Array.from(new Set(
    Array.from(mainHtml.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredComponents = Array.from(aosDocsReadinessUiReactRuntime.componentScope);
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  if (missingComponents.length > 0) failures.push("docs_readiness_required_package_components_missing");

  const markerOnlyComponents = Array.from(mainHtml.matchAll(/<([a-zA-Z][\w:-]*)\b(?=[^>]*data-tcrn-component="([^"]+)")(?![^>]*data-package-runtime-component=)(?![^>]*data-package-runtime-subcomponent=)([^>]*)>/g))
    .map((match) => ({
      tag: match[1],
      component: match[2],
      snippet: redactAttributeSnippet(match[0])
    }));
  if (markerOnlyComponents.length > 0) failures.push("docs_readiness_marker_only_component_claim_present");

  const mainAttributes = parseAttributes(mainHtml.match(/<main\b([^>]*)>/)?.[1] ?? "");
  if (mainAttributes["data-package-runtime-surface"] !== aosDocsReadinessUiReactRuntime.implementationKind) {
    failures.push("docs_readiness_runtime_surface_mismatch");
  }
  if (mainAttributes["data-package-runtime-component-scope"] !== aosDocsReadinessUiReactRuntime.componentScope.join(",")) {
    failures.push("docs_readiness_component_scope_mismatch");
  }
  if (mainAttributes["data-surface"] !== "docs-search-release-readiness") failures.push("docs_readiness_surface_marker_missing");
  if (mainAttributes["data-package-backed-react-runtime-rendering"] !== "true") failures.push("docs_readiness_runtime_flag_missing");
  if (mainAttributes["data-product-design-acceptance"] !== "not_claimed") failures.push("docs_readiness_product_design_boundary_missing");

  const requiredRegions = [
    "docs-surface-shell",
    "brand-lockup",
    "header-claim-strip",
    "docs-readiness-board",
    "search-inspection",
    "github-prci-linkage",
    "release-candidate-linkage",
    "evidence-readback-panel",
    "detail-panel"
  ];
  const missingRegions = requiredRegions.filter((region) => !mainHtml.includes(`data-region="${region}"`));
  if (missingRegions.length > 0) failures.push("docs_readiness_required_regions_missing");

  const navItems = Array.from(mainHtml.matchAll(/<a\b(?=[^>]*data-tcrn-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g))
    .map((match) => ({ attributes: match[1], body: match[2], parsed: parseAttributes(match[1]) }));
  const packageRuntimeNavItems = navItems.filter((item) => item.parsed["data-package-runtime-component"] === "NavItem");
  const disabledNavItems = packageRuntimeNavItems.filter((item) => item.parsed["aria-disabled"] === "true");
  const activeNavItems = packageRuntimeNavItems.filter((item) => item.parsed["aria-current"] === "page");
  if (navItems.length !== 5) failures.push("docs_readiness_navitem_count_mismatch");
  if (packageRuntimeNavItems.length !== 5) failures.push("docs_readiness_navitem_runtime_count_mismatch");
  if (disabledNavItems.length !== 4) failures.push("docs_readiness_disabled_navitem_count_mismatch");
  if (activeNavItems.length !== 1) failures.push("docs_readiness_active_navitem_count_mismatch");
  for (const item of disabledNavItems) {
    const label = extractVisibleText(item.body, "tcrn-nav-item__label");
    const visibleReason = findVisibleDisabledReason(item.body, item.parsed["aria-describedby"]);
    const itemFailures = [];
    if (item.parsed.href) itemFailures.push("disabled_navitem_has_href");
    if (item.parsed.tabindex !== "-1") itemFailures.push("disabled_navitem_missing_tabindex_minus_1");
    if (!item.parsed.title?.trim()) itemFailures.push("disabled_navitem_missing_title");
    if (!item.parsed["data-disabled-reason"]?.trim()) itemFailures.push("disabled_navitem_missing_data_disabled_reason");
    if (!item.parsed["aria-describedby"]?.trim()) itemFailures.push("disabled_navitem_missing_aria_describedby");
    if (!visibleReason.resolved) itemFailures.push("disabled_navitem_aria_describedby_unresolved");
    if (visibleReason.resolved && !visibleReason.text.trim()) itemFailures.push("disabled_navitem_visible_reason_empty");
    if (visibleReason.text && item.parsed["data-disabled-reason"] && normalizeText(visibleReason.text) !== normalizeText(item.parsed["data-disabled-reason"])) {
      itemFailures.push("disabled_navitem_visible_reason_mismatch");
    }
    if (itemFailures.length > 0) failures.push({ label, failures: itemFailures });
  }

  if (!mainHtml.includes('data-package-runtime-subcomponent="SearchInput.control"')) failures.push("docs_readiness_search_input_control_missing");
  if (mainHtml.includes('data-package-runtime-component="Input"')) failures.push("docs_readiness_input_scope_overclaim_present");
  if (!mainHtml.includes("data-detail-title")) failures.push("docs_readiness_detail_title_hook_missing");
  if (!mainHtml.includes("Drafts stay local")) failures.push("docs_readiness_local_draft_copy_missing");
  if (!mainHtml.includes("Release actions disabled")) failures.push("docs_readiness_release_action_copy_missing");
  if (!mainHtml.includes("GitHub / PR CI")) failures.push("docs_readiness_github_panel_missing");
  if (!mainHtml.includes("release review pending") || !mainHtml.includes("review needed")) failures.push("docs_readiness_release_review_copy_missing");

  const forbiddenClaimHits = [
    "docs published",
    "github write enabled",
    "ci mutation complete",
    "canonical promotion complete",
    "release ready",
    "release created",
    "product accepted",
    "final mvp accepted"
  ].filter((phrase) => mainHtml.toLowerCase().includes(phrase));
  if (forbiddenClaimHits.length > 0) failures.push("docs_readiness_forbidden_overclaim_copy_present");

  const sampleRenderedHtmlSha256 = createHash("sha256").update(renderDocsReadinessRuntimeSurface(createSlice9bDocsSearchReleaseReadModel())).digest("hex");

  return {
    ok: failures.length === 0,
    present: true,
    surface: "docs-readiness-package-runtime-adoption",
    implementationKind: mainAttributes["data-package-runtime-surface"] ?? "",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    markerOnlyComponents,
    missingRegions,
    packageRuntimeNavItemCount: packageRuntimeNavItems.length,
    disabledNavItemCount: disabledNavItems.length,
    activeNavItemCount: activeNavItems.length,
    searchInputControlDisposition: "internal_subcomponent_not_separate_package_runtime_scope",
    forbiddenClaimHits,
    sampleRenderedHtmlSha256,
    failures
  };
}

function inspectAosWideTargetSetRuntime(html) {
  const mainHtml = html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? "";
  const failures = [];
  if (!mainHtml) {
    return {
      ok: false,
      present: false,
      surface: "aos-wide-target-set-package-runtime-adoption",
      requiredComponents: [],
      packageRuntimeComponents: [],
      markerOnlyComponents: [],
      missingComponents: [],
      failures: ["aos_wide_main_missing"]
    };
  }

  const packageRuntimeComponents = Array.from(new Set(
    Array.from(mainHtml.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredComponents = Array.from(aosWideProductDesignUiReactRuntime.componentScope);
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  if (missingComponents.length > 0) failures.push("aos_wide_required_package_components_missing");

  const markerOnlyComponents = Array.from(mainHtml.matchAll(/<([a-zA-Z][\w:-]*)\b(?=[^>]*data-tcrn-component="([^"]+)")(?![^>]*data-package-runtime-component=)(?![^>]*data-package-runtime-subcomponent=)([^>]*)>/g))
    .map((match) => ({
      tag: match[1],
      component: match[2],
      snippet: redactAttributeSnippet(match[0])
    }));
  if (markerOnlyComponents.length > 0) failures.push("aos_wide_marker_only_component_claim_present");

  const mainAttributes = parseAttributes(mainHtml.match(/<main\b([^>]*)>/)?.[1] ?? "");
  if (mainAttributes["data-package-runtime-surface"] !== aosWideProductDesignUiReactRuntime.implementationKind) {
    failures.push("aos_wide_runtime_surface_mismatch");
  }
  if (mainAttributes["data-package-runtime-component-scope"] !== aosWideProductDesignUiReactRuntime.componentScope.join(",")) {
    failures.push("aos_wide_component_scope_mismatch");
  }
  if (mainAttributes["data-surface"] !== "aos-wide-product-design") failures.push("aos_wide_surface_marker_missing");
  if (mainAttributes["data-package-backed-react-runtime-rendering"] !== "true") failures.push("aos_wide_runtime_flag_missing");
  if (mainAttributes["data-aos-wide-product-design-accepted"] !== "false") failures.push("aos_wide_acceptance_boundary_missing");

  const requiredRegions = [
    "aos-wide-shell",
    "brand-lockup",
    "target-path-readback",
    "project-dashboard-hierarchy",
    "initiative-ticket-drillthrough",
    "ai-employee-profile",
    "gate-owner-intent",
    "conference-minutes",
    "gateway-adapter-health",
    "knowledge-release-modules",
    "dependency-governance-console",
    "resource-library-traceability",
    "admin-access-audit-shell",
    "surface-index",
    "detail-panel",
    "evidence-readiness-panel"
  ];
  const missingRegions = requiredRegions.filter((region) => !mainHtml.includes(`data-region="${region}"`));
  if (missingRegions.length > 0) failures.push("aos_wide_required_regions_missing");

  const navItems = Array.from(mainHtml.matchAll(/<a\b(?=[^>]*data-tcrn-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g))
    .map((match) => ({ attributes: match[1], body: match[2], parsed: parseAttributes(match[1]) }));
  const packageRuntimeNavItems = navItems.filter((item) => item.parsed["data-package-runtime-component"] === "NavItem");
  const disabledNavItems = packageRuntimeNavItems.filter((item) => item.parsed["aria-disabled"] === "true");
  const activeNavItems = packageRuntimeNavItems.filter((item) => item.parsed["aria-current"] === "page");
  if (navItems.length !== 10) failures.push("aos_wide_navitem_count_mismatch");
  if (packageRuntimeNavItems.length !== 10) failures.push("aos_wide_navitem_runtime_count_mismatch");
  if (disabledNavItems.length !== 9) failures.push("aos_wide_disabled_navitem_count_mismatch");
  if (activeNavItems.length !== 1) failures.push("aos_wide_active_navitem_count_mismatch");
  for (const item of disabledNavItems) {
    const label = extractVisibleText(item.body, "tcrn-nav-item__label");
    const visibleReason = findVisibleDisabledReason(item.body, item.parsed["aria-describedby"]);
    const itemFailures = [];
    if (item.parsed.href) itemFailures.push("disabled_navitem_has_href");
    if (item.parsed.tabindex !== "-1") itemFailures.push("disabled_navitem_missing_tabindex_minus_1");
    if (!item.parsed.title?.trim()) itemFailures.push("disabled_navitem_missing_title");
    if (!item.parsed["data-disabled-reason"]?.trim()) itemFailures.push("disabled_navitem_missing_data_disabled_reason");
    if (!item.parsed["aria-describedby"]?.trim()) itemFailures.push("disabled_navitem_missing_aria_describedby");
    if (!visibleReason.resolved) itemFailures.push("disabled_navitem_aria_describedby_unresolved");
    if (visibleReason.resolved && !visibleReason.text.trim()) itemFailures.push("disabled_navitem_visible_reason_empty");
    if (visibleReason.text && item.parsed["data-disabled-reason"] && normalizeText(visibleReason.text) !== normalizeText(item.parsed["data-disabled-reason"])) {
      itemFailures.push("disabled_navitem_visible_reason_mismatch");
    }
    if (itemFailures.length > 0) failures.push({ label, failures: itemFailures });
  }

  const surfaceRows = Array.from(mainHtml.matchAll(/<button\b(?=[^>]*data-surface-row)([^>]*)>/g))
    .map((match) => ({ parsed: parseAttributes(match[1]) }));
  if (surfaceRows.length !== 10) failures.push("aos_wide_surface_row_count_mismatch");
  if (surfaceRows.some((row) => !row.parsed["data-row-id"]?.trim())) failures.push("aos_wide_surface_rows_missing_row_ids");

  const disabledButtons = Array.from(mainHtml.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g))
    .map((match) => ({ attributes: match[1], body: match[2], parsed: parseAttributes(match[1]) }))
    .filter((button) => Object.hasOwn(button.parsed, "disabled"));
  const disabledButtonFailures = disabledButtons
    .filter((button) => !button.parsed["data-disabled-reason"]?.trim()
      || !button.parsed.title?.trim()
      || !button.parsed["aria-describedby"]?.trim())
    .map((button) => ({ label: extractButtonLabel(button.body), attributes: redactAttributeSnippet(button.attributes) }));
  if (disabledButtonFailures.length > 0) failures.push("aos_wide_disabled_button_reason_wiring_missing");

  if (!mainHtml.includes('data-package-runtime-subcomponent="SearchInput.control"')) failures.push("aos_wide_search_input_control_missing");
  if (mainHtml.includes('data-package-runtime-component="Input"')) failures.push("aos_wide_input_scope_overclaim_present");
  if (!mainHtml.includes("data-detail-title")) failures.push("aos_wide_detail_title_hook_missing");
  if (!mainHtml.includes("Review posture")) failures.push("aos_wide_evidence_readback_missing");
  if (!mainHtml.includes("Registered Design System UI")) failures.push("aos_wide_claim_strip_runtime_copy_missing");

  const forbiddenClaimHits = [
    "aos-wide product design accepted",
    "product accepted",
    "final mvp accepted",
    "release ready",
    "deployment ready",
    "public ready",
    "legal complete",
    "dependency clean",
    "docs published",
    "docs exported",
    "canonical knowledge promoted",
    "github release created",
    "live dispatch enabled",
    "resource materialized",
    "product repo written",
    "codex security scan completed"
  ].filter((phrase) => mainHtml.toLowerCase().includes(phrase));
  if (forbiddenClaimHits.length > 0) failures.push("aos_wide_forbidden_overclaim_copy_present");

  const sampleRenderedHtmlSha256 = createHash("sha256").update(
    renderAOSWideProductDesignRuntimeSurface(createAOSWideProductDesignModel())
  ).digest("hex");

  return {
    ok: failures.length === 0,
    present: true,
    surface: "aos-wide-target-set-package-runtime-adoption",
    implementationKind: mainAttributes["data-package-runtime-surface"] ?? "",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    markerOnlyComponents,
    missingRegions,
    packageRuntimeNavItemCount: packageRuntimeNavItems.length,
    disabledNavItemCount: disabledNavItems.length,
    activeNavItemCount: activeNavItems.length,
    surfaceRowCount: surfaceRows.length,
    disabledButtonFailures,
    searchInputControlDisposition: "internal_subcomponent_not_separate_package_runtime_scope",
    forbiddenClaimHits,
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
  const disabledButtonHasSrOnlyReason = /<button\b(?=[^>]*data-package-runtime-component="Button")(?=[^>]*disabled)([\s\S]*?)<span\b(?=[^>]*class="tcrn-sr-only")[^>]*>Column settings are not available in this workspace\.<\/span><\/button>/.test(html);
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
    "apps/web/src/cockpit.ts",
    "apps/api/src/server.ts",
    "apps/web/src/docs-readiness-ui-react-runtime.ts",
    "apps/web/src/docs-readiness-view.ts",
    "apps/web/src/aos-wide-product-design-data.ts",
    "apps/web/src/aos-wide-product-design-ui-react-runtime.ts",
    "apps/web/src/aos-wide-product-design-view.ts",
    "apps/web/src/design-system-bridge.ts",
    "apps/web/test/cockpit-view.test.mjs",
    "apps/api/test/service-smoke.test.mjs",
    "packages/db/src/runtime-fixture.ts",
    "packages/db/test/runtime-fixture.test.mjs",
    "apps/web/test/docs-readiness-view.test.mjs",
    "apps/web/test/aos-wide-product-design-view.test.mjs",
    "scripts/aos-design-system-package-runtime-proof.mjs",
    "scripts/aos-design-system-component-registry-proof.mjs",
    "scripts/aos-design-system-consumer-slice-1-proof.mjs",
    "scripts/aos-design-system-consumer-slice-2-proof.mjs",
    "scripts/aos-owner-trial-service-backed-frontend-proof.mjs",
    "scripts/service-smoke.mjs",
    "scripts/slice-9b-visible-readiness-proof.mjs",
    "scripts/slice-10-aos-wide-product-design-proof.mjs",
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
  const controls = [];
  const disabledNativeControls = new Set(["button", "input", "select", "textarea"]);

  for (const match of html.matchAll(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g)) {
    const tag = match[1].toLowerCase();
    const attributes = match[2] ?? "";
    const parsed = parseAttributes(attributes);
    const isNativeDisabled = disabledNativeControls.has(tag)
      && Object.prototype.hasOwnProperty.call(parsed, "disabled");
    const isAriaDisabled = parsed["aria-disabled"] === "true";
    if (!isNativeDisabled && !isAriaDisabled) continue;
    if (tag === "a" && !isAriaDisabled) continue;

    const closingMatch = html
      .slice(match.index + match[0].length)
      .match(new RegExp(`([\\s\\S]*?)<\\/${escapeRegExp(tag)}>`, "i"));
    controls.push({
      tag,
      attributes,
      body: closingMatch ? closingMatch[1] : "",
      parsed
    });
  }

  return controls;
}

function splitIdRefs(value) {
  return (value ?? "").split(/\s+/).map((id) => id.trim()).filter(Boolean);
}

function normalizeText(value) {
  return decodeHtml(stripTags(value)).replace(/\s+/g, " ").trim();
}

function extractMainShellHtml(html) {
  const marker = 'data-surface="operations-cockpit"';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return "";
  const start = html.lastIndexOf("<main", markerIndex);
  const end = html.indexOf("</main>", markerIndex);
  if (start === -1 || end === -1) return "";
  return html.slice(start, end + "</main>".length);
}

function extractDocsReadinessMainHtml(html) {
  const marker = 'data-surface="docs-search-release-readiness"';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return "";
  const start = html.lastIndexOf("<main", markerIndex);
  const end = html.indexOf("</main>", markerIndex);
  if (start === -1 || end === -1) return "";
  return html.slice(start, end + "</main>".length);
}

function extractSidebarHtml(html) {
  const marker = 'data-region="sidebar-nav"';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return "";
  const start = html.lastIndexOf("<nav", markerIndex);
  const end = html.indexOf("</nav>", markerIndex);
  if (start === -1 || end === -1) return "";
  return html.slice(start, end + "</nav>".length);
}

function extractRegionElementHtml(html, region, tag) {
  const marker = `data-region="${region}"`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return "";
  const start = html.lastIndexOf(`<${tag}`, markerIndex);
  const end = html.indexOf(`</${tag}>`, markerIndex);
  if (start === -1 || end === -1) return "";
  return html.slice(start, end + `</${tag}>`.length);
}

function extractHeaderHtml(html, region) {
  const marker = `data-region="${region}"`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return "";
  const start = html.lastIndexOf("<header", markerIndex);
  const end = html.indexOf("</header>", markerIndex);
  if (start === -1 || end === -1) return "";
  return html.slice(start, end + "</header>".length);
}

function extractLabelHtml(html, region) {
  const marker = `data-region="${region}"`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return "";
  const start = html.lastIndexOf("<label", markerIndex);
  const end = html.indexOf("</label>", markerIndex);
  if (start === -1 || end === -1) return "";
  return html.slice(start, end + "</label>".length);
}

function extractSectionHtml(html, region) {
  const marker = `data-region="${region}"`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return "";
  const start = html.lastIndexOf("<section", markerIndex);
  const end = html.indexOf("</section>", markerIndex);
  if (start === -1 || end === -1) return "";
  return html.slice(start, end + "</section>".length);
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

function extractRegionHtml(html, region) {
  const marker = `data-region="${region}"`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return "";
  const articleStart = html.lastIndexOf("<article", markerIndex);
  const sectionStart = html.lastIndexOf("<section", markerIndex);
  const start = Math.max(articleStart, sectionStart);
  if (start === -1) return "";
  const tag = start === articleStart ? "article" : "section";
  const end = html.indexOf(`</${tag}>`, markerIndex);
  if (end === -1) return "";
  return html.slice(start, end + `</${tag}>`.length);
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

function inspectProductVisibleCopy(surfaces) {
  const bannedTerms = [
    { id: "readback", pattern: /\breadback\b/i },
    { id: "checkpoint", pattern: /\bcheckpoint\b/i },
    { id: "route", pattern: /\broute\b/i },
    { id: "fixture", pattern: /\bfixture\b/i },
    { id: "proof_required", pattern: /proof required/i },
    { id: "external_proof_required", pattern: /external proof required/i },
    { id: "package_runtime_pilot", pattern: /package-runtime pilot/i },
    { id: "functional_contract_readback_only", pattern: /functional contract readback only/i },
    { id: "held_for_later", pattern: /held for later/i },
    { id: "unavailable_in_this_route", pattern: /unavailable in this route/i },
    { id: "not_claimed", pattern: /not claimed|not_claimed/i }
  ];
  const surfaceReadbacks = Object.entries(surfaces).map(([surface, html]) => {
    const text = productVisibleAndA11yText(html);
    const hits = bannedTerms
      .filter((term) => term.pattern.test(text))
      .map((term) => term.id);
    return {
      surface,
      ok: hits.length === 0,
      hits,
      scannedTextLength: text.length
    };
  });
  return {
    ok: surfaceReadbacks.every((readback) => readback.ok),
    bannedTerms: bannedTerms.map((term) => term.id),
    surfaceReadbacks
  };
}

function productVisibleAndA11yText(html) {
  const attributeText = Array.from(html.matchAll(/\s(?:aria-label|title|data-disabled-reason|placeholder|alt)="([^"]*)"/g))
    .map((match) => match[1])
    .join(" ");
  return `${visibleText(html)} ${attributeText}`
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function redactAttributeSnippet(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
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
  const shellSidebarRows = summary.shellSidebarRuntimeReadback.failures.length === 0
    ? "- Shell / Sidebar package-runtime failures: 0"
    : summary.shellSidebarRuntimeReadback.failures.map((failure) => typeof failure === "string" ? `- ${failure}` : `- ${failure.label}: ${failure.failures.join(", ")}`).join("\n");
  const claimRiskRows = summary.claimRiskEvidenceStripRuntimeReadback.failures.length === 0
    ? "- Claim Strip / Risk Lane package-runtime failures: 0"
    : summary.claimRiskEvidenceStripRuntimeReadback.failures.map((failure) => typeof failure === "string" ? `- ${failure}` : `- ${failure.label}: ${failure.failures.join(", ")}`).join("\n");
  const topbarRows = summary.topbarCheckpointRuntimeReadback.failures.length === 0
    ? "- Topbar / Checkpoint package-runtime failures: 0"
    : summary.topbarCheckpointRuntimeReadback.failures.map((failure) => typeof failure === "string" ? `- ${failure}` : `- ${failure.label}: ${failure.failures.join(", ")}`).join("\n");
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
  const stagePhaseRows = summary.stagePhaseRuntimeReadback.failures.length === 0
    ? "- Stage Map / AI Employee Phase package-runtime failures: 0"
    : summary.stagePhaseRuntimeReadback.failures.map((failure) => typeof failure === "string" ? `- ${failure}` : `- ${failure.stageId ?? failure.label}: ${failure.failures.join(", ")}`).join("\n");
  const completionRows = summary.operationsCockpitCompletionRuntimeReadback.failures.length === 0
    ? "- Operations Cockpit completion marker-only failures: 0"
    : summary.operationsCockpitCompletionRuntimeReadback.failures.map((failure) => typeof failure === "string" ? `- ${failure}` : `- ${failure.label}: ${failure.failures.join(", ")}`).join("\n");
  const docsReadinessRows = summary.docsReadinessRuntimeReadback.failures.length === 0
    ? "- Docs Readiness package-runtime failures: 0"
    : summary.docsReadinessRuntimeReadback.failures.map((failure) => typeof failure === "string" ? `- ${failure}` : `- ${failure.label}: ${failure.failures.join(", ")}`).join("\n");
  const aosWideRows = summary.aosWideTargetSetRuntimeReadback.failures.length === 0
    ? "- AOS-wide product design package-runtime failures: 0"
    : summary.aosWideTargetSetRuntimeReadback.failures.map((failure) => typeof failure === "string" ? `- ${failure}` : `- ${failure.label}: ${failure.failures.join(", ")}`).join("\n");
  const accessibilityRows = [
    `- Full-document duplicate real DOM ids: ${summary.fullDocumentAccessibilityReadback.duplicateIds.length}`,
    `- Full-document aria reference failures: ${summary.fullDocumentAccessibilityReadback.ariaReferenceFailures.length}`,
    `- Full-document disabled-description mismatches: ${summary.fullDocumentAccessibilityReadback.disabledControlDescriptionFailures.length}`
  ].join("\n");
  const docsAccessibilityRows = [
    `- Docs Readiness duplicate real DOM ids: ${summary.docsReadinessFullDocumentAccessibilityReadback.duplicateIds.length}`,
    `- Docs Readiness aria reference failures: ${summary.docsReadinessFullDocumentAccessibilityReadback.ariaReferenceFailures.length}`,
    `- Docs Readiness disabled-description mismatches: ${summary.docsReadinessFullDocumentAccessibilityReadback.disabledControlDescriptionFailures.length}`
  ].join("\n");
  const aosWideAccessibilityRows = [
    `- AOS-wide product design duplicate real DOM ids: ${summary.aosWideFullDocumentAccessibilityReadback.duplicateIds.length}`,
    `- AOS-wide product design aria reference failures: ${summary.aosWideFullDocumentAccessibilityReadback.ariaReferenceFailures.length}`,
    `- AOS-wide product design disabled-description mismatches: ${summary.aosWideFullDocumentAccessibilityReadback.disabledControlDescriptionFailures.length}`
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
    + `- Package runtime Shell/Sidebar components: ${summary.shellSidebarRuntimeReadback.packageRuntimeComponents.join(", ")}\n`
    + `- Package runtime Claim/Risk components: ${summary.claimRiskEvidenceStripRuntimeReadback.packageRuntimeComponents.join(", ")}\n`
    + `- Package runtime Claim/Risk counts: ${summary.claimRiskEvidenceStripRuntimeReadback.claimCount} claims / ${summary.claimRiskEvidenceStripRuntimeReadback.riskWarningCount} risk warnings\n`
    + `- Package runtime Topbar/Checkpoint components: ${summary.topbarCheckpointRuntimeReadback.packageRuntimeComponents.join(", ")}\n`
    + `- Package runtime NavItems: ${summary.navRuntimeReadback.packageRuntimeNavItemCount}\n`
    + `- Package runtime Work Index rows: ${summary.workIndexRuntimeReadback.packageRuntimeWorkRowCount}\n`
    + `- Package runtime Work Index components: ${summary.workIndexRuntimeReadback.packageRuntimeComponents.join(", ")}\n`
    + `- Package runtime selected detail id/type: ${summary.detailDrawerRuntimeReadback.selectedDetailId} / ${summary.detailDrawerRuntimeReadback.selectedDetailType}\n`
    + `- Package runtime selected detail components: ${summary.detailDrawerRuntimeReadback.packageRuntimeComponents.join(", ")}\n`
    + `- Package runtime Gate/Readback card components: ${summary.gateReadbackCardsRuntimeReadback.packageRuntimeComponents.join(", ")}\n`
    + `- Package runtime Stage/Phase components: ${summary.stagePhaseRuntimeReadback.packageRuntimeComponents.join(", ")}\n`
    + `- Package runtime Stage/Phase counts: ${summary.stagePhaseRuntimeReadback.stageCount} stages / ${summary.stagePhaseRuntimeReadback.phaseRowCount} phase rows\n`
    + `- Operations Cockpit marker-only package component claims: ${summary.operationsCockpitCompletionRuntimeReadback.markerOnlyComponents.length}\n`
    + `- Docs Readiness package runtime components: ${summary.docsReadinessRuntimeReadback.packageRuntimeComponents.join(", ")}\n`
    + `- Docs Readiness marker-only package component claims: ${summary.docsReadinessRuntimeReadback.markerOnlyComponents.length}\n`
    + `- Docs Readiness disabled package NavItems: ${summary.docsReadinessRuntimeReadback.disabledNavItemCount}\n`
    + `- AOS-wide product design package runtime components: ${summary.aosWideTargetSetRuntimeReadback.packageRuntimeComponents.join(", ")}\n`
    + `- AOS-wide product design marker-only package component claims: ${summary.aosWideTargetSetRuntimeReadback.markerOnlyComponents.length}\n`
    + `- AOS-wide product design surface rows: ${summary.aosWideTargetSetRuntimeReadback.surfaceRowCount}\n`
    + `- AOS-wide product design disabled package NavItems: ${summary.aosWideTargetSetRuntimeReadback.disabledNavItemCount}\n`
    + `- Marker-only NavItems in cockpit nav: ${summary.navRuntimeReadback.markerOnlyNavItemCount}\n`
    + `- Deep import hits: ${summary.importReadback.deepImportHits.length}\n`
    + `- Storybook NavItem disabled reason reference ok: ${summary.storybookReferenceReadback.ok}\n\n`
    + `- AOS runtime sr-only / mobile TableShell style proof ok: ${summary.visualStyleReadback.ok}\n`
    + `- Product-visible internal-copy hits: ${summary.productVisibleCopyReadback.surfaceReadbacks.reduce((count, readback) => count + readback.hits.length, 0)}\n`
    + `${shellSidebarRows}\n`
    + `${claimRiskRows}\n`
    + `${topbarRows}\n`
    + `${rows}\n`
    + `${workIndexRows}\n`
    + `${detailDrawerRows}\n`
    + `${gateReadbackRows}\n`
    + `${stagePhaseRows}\n`
    + `${completionRows}\n`
    + `${docsReadinessRows}\n`
    + `${aosWideRows}\n`
    + `${accessibilityRows}\n\n`
    + `${docsAccessibilityRows}\n\n`
    + `${aosWideAccessibilityRows}\n\n`
    + `## Boundaries\n\n`
    + `This is a product-grade AOS frontend rebuild using registered TCRN Design System package runtime, tokens, and copy-state contracts. It is not product UI acceptance, product acceptance, final MVP acceptance, docs publication, release, GitHub mutation, CI mutation, VM freshness, or Owner Intent execution.\n`;
}
