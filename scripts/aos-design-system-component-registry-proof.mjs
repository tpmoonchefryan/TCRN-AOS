import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";
import {
  aosDesignSystemRegisteredComponentNames,
  aosRequiredStaticSurfaceComponents
} from "../dist/apps/web/src/static-component-registry.js";
import {
  aosWideProductDesignUiReactRuntime
} from "../dist/apps/web/src/aos-wide-product-design-ui-react-runtime.js";
import { renderAOSWideProductDesignHtml } from "../dist/apps/web/src/aos-wide-product-design-view.js";
import { renderOperationsCockpitHtml } from "../dist/apps/web/src/cockpit-view.js";
import { renderDocsSearchReleaseReadinessHtml } from "../dist/apps/web/src/docs-readiness-view.js";

const repoRoot = process.cwd();
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const designSystemRoot = join(repoRoot, "..", "TCRN-Design-System");
const designSystemRegistrySourcePath = join(designSystemRoot, "packages/ui-react/src/index.tsx");
const designSystemStylesheetDraftPath = join(designSystemRoot, "packages/ui-react/src/styles.css");
const designSystemSource = readFileSync(designSystemRegistrySourcePath, "utf8");
const registrySourceMatch = designSystemSource.match(/componentLibraryPublicComponentNames\s*=\s*\[([\s\S]*?)\]\s+as const/);

if (!registrySourceMatch) {
  throw new Error("design_system_component_registry_not_found");
}

const designSystemRegistry = Array.from(registrySourceMatch[1].matchAll(/"([^"]+)"/g)).map((match) => match[1]);
const localRegistryDiff = symmetricDiff(aosDesignSystemRegisteredComponentNames, designSystemRegistry);

const surfaces = [
  {
    id: "operations-cockpit",
    path: "apps/web/static/operations-cockpit.html",
    html: renderOperationsCockpitHtml(),
    required: aosRequiredStaticSurfaceComponents,
    expectedDisabledNavItems: [
      "Dashboard",
      "Work Index",
      "Stage Map",
      "Gate Queue",
      "Conferences",
      "Evidence",
      "Dependency",
      "Resources",
      "Audit"
    ]
  },
  {
    id: "docs-search-release-readiness",
    path: "apps/web/static/docs-search-release-readiness.html",
    html: renderDocsSearchReleaseReadinessHtml(),
    required: aosRequiredStaticSurfaceComponents,
    expectedDisabledNavItems: [
      "Dashboard",
      "Cockpit",
      "Evidence",
      "Release Linkage"
    ]
  },
  {
    id: "aos-wide-product-design",
    path: "apps/web/static/aos-wide-product-design.html",
    html: renderAOSWideProductDesignHtml(),
    required: aosRequiredStaticSurfaceComponents,
    expectedDisabledNavItems: [
      "Initiative Detail",
      "AI Employee",
      "Gate Queue",
      "Conference",
      "Gateway / Adapter",
      "Knowledge Modules",
      "Dependency Console",
      "Resource Library",
      "Admin / Access"
    ]
  }
];
const browserSummaryPath = join(repoRoot, "evidence", "aos-design-system-browser-readback", "summary.json");
const designSystemBasis = inspectDesignSystemBasis();

const registered = new Set(designSystemRegistry);
const surfaceReadbacks = surfaces.map((surface) => {
  const componentNames = Array.from(surface.html.matchAll(/data-tcrn-component="([^"]+)"/g)).map((match) => match[1]);
  const unregistered = componentNames.filter((name) => !registered.has(name));
  const missingRequired = surface.required.filter((name) => !componentNames.includes(name));
  const navItemSemantics = inspectNavItemSemantics(surface);
  return {
    id: surface.id,
    path: surface.path,
    componentCount: componentNames.length,
    registeredComponents: Array.from(new Set(componentNames)).sort(),
    unregistered,
    missingRequired,
    expectedDisabledNavItems: surface.expectedDisabledNavItems,
    disabledNavItemSemanticFailures: navItemSemantics.disabledFailures,
    disabledNavItemCount: navItemSemantics.disabledCount,
    disabledNavItemLabels: navItemSemantics.disabledLabels
  };
});
const browserReadbackPathLeakage = inspectBrowserReadbackPathLeakage(browserSummaryPath);
const packageRuntimeReadback = inspectPackageRuntimeReadback(surfaces.find((surface) => surface.id === "operations-cockpit"));
const docsReadinessPackageRuntimeReadback = inspectDocsReadinessPackageRuntimeReadback(surfaces.find((surface) => surface.id === "docs-search-release-readiness"));
const aosWidePackageRuntimeReadback = inspectAosWidePackageRuntimeReadback(surfaces.find((surface) => surface.id === "aos-wide-product-design"));
const designSystemCertificationReadback = inspectDesignSystemCertification();
const proofSelfChecks = runProofSelfChecks();

const ok = localRegistryDiff.length === 0
  && surfaceReadbacks.every((readback) => readback.unregistered.length === 0)
  && surfaceReadbacks.every((readback) => readback.missingRequired.length === 0)
  && surfaceReadbacks.every((readback) => readback.disabledNavItemSemanticFailures.length === 0)
  && packageRuntimeReadback.ok
  && docsReadinessPackageRuntimeReadback.ok
  && aosWidePackageRuntimeReadback.ok
  && designSystemCertificationReadback.ok
  && browserReadbackPathLeakage.present === true
  && browserReadbackPathLeakage.absolutePathHits.length === 0
  && proofSelfChecks.every((check) => check.passed);

const summary = {
  ok,
  route: "route_tcrn_aos_design_system_frontend_rebuild_registered_component_proof",
  sourceHead,
  registrySource: relative(repoRoot, designSystemRegistrySourcePath),
  designSystemBasis,
  claimScope: {
    implementationKind: "mixed_static_renderer_registered_component_metadata_with_operations_cockpit_completion_docs_readiness_and_aos_wide_target_set_package_runtime",
    packageBackedReactRuntimeRendering: "operations_cockpit_completion_docs_readiness_search_release_and_aos_wide_target_set_runtime_adoption",
    storybookVisualStyleParity: "consumed_ds_4d03f4b_certified_visual_standard_receipts_for_served_scope",
    docsReadinessPackageRuntimeRendering: true,
    aosWidePackageRuntimeRendering: true,
    productAcceptanceReady: false,
    finalMvpAcceptanceReady: false
  },
  localRegistryDiff,
  surfaces: surfaceReadbacks,
  packageRuntimeReadback,
  docsReadinessPackageRuntimeReadback,
  aosWidePackageRuntimeReadback,
  designSystemCertificationReadback,
  browserReadbackPathLeakage,
  proofSelfChecks,
  noOverclaim: {
    productAcceptanceReady: false,
    finalMvpAcceptanceReady: false,
    releasePublicationReady: false,
    broadUiReactRuntimeMigration: false
  }
};

writeFileSync(join(repoRoot, "evidence", "aos-design-system-registered-components-proof.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));

if (!ok) {
  process.exit(1);
}

function symmetricDiff(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  return [
    ...left.filter((item) => !b.has(item)).map((item) => `local_only:${item}`),
    ...right.filter((item) => !a.has(item)).map((item) => `design_system_only:${item}`)
  ].sort();
}

function inspectNavItemSemantics(surface) {
  const html = surface.html;
  const expectedLabels = surface.expectedDisabledNavItems;
  const expectedLabelSet = new Set(expectedLabels);
  const disabledFailures = [];
  const disabledLabels = [];
  const seenLabels = [];

  for (const match of html.matchAll(/<a\b(?=[^>]*data-tcrn-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g)) {
    const attributes = match[1];
    const body = match[2];
    const parsedAttributes = parseAttributes(attributes);
    const label = extractNavItemLabel(body);
    const disabled = /\baria-disabled="true"/.test(attributes);
    seenLabels.push(label);

    const failures = [];
    if (expectedLabelSet.has(label) && !disabled) {
      failures.push("expected_disabled_navitem_is_actionable");
    }

    if (!disabled) {
      if (failures.length > 0) {
        disabledFailures.push({
          label,
          attributes: redactAttributeSnippet(attributes),
          failures
        });
      }
      continue;
    }

    disabledLabels.push(label);
    if (/\bhref=/.test(attributes)) failures.push("disabled_navitem_has_href");
    if (parsedAttributes.tabindex !== "-1") failures.push("disabled_navitem_missing_tabindex_minus_1");
    if (!parsedAttributes.title?.trim()) failures.push("disabled_navitem_missing_title_reason");
    if (!parsedAttributes["data-disabled-reason"]?.trim()) failures.push("disabled_navitem_missing_data_disabled_reason");
    if (!parsedAttributes["aria-describedby"]?.trim()) {
      failures.push("disabled_navitem_missing_aria_describedby");
    } else {
      const visibleReason = findVisibleReasonByDescribedby(body, parsedAttributes["aria-describedby"]);
      if (!visibleReason.resolved) failures.push("disabled_navitem_aria_describedby_unresolved");
      if (visibleReason.resolved && !visibleReason.text.trim()) failures.push("disabled_navitem_visible_reason_empty");
    }
    if (!expectedLabelSet.has(label)) failures.push("unexpected_disabled_navitem_label");

    if (failures.length > 0) {
      disabledFailures.push({
        label,
        attributes: redactAttributeSnippet(attributes),
        failures
      });
    }
  }

  const disabledLabelSet = new Set(disabledLabels);
  const missingExpected = expectedLabels.filter((label) => !disabledLabelSet.has(label));
  const missingFromSurface = expectedLabels.filter((label) => !seenLabels.includes(label));
  const unexpectedDisabled = disabledLabels.filter((label) => !expectedLabelSet.has(label));

  if (disabledLabels.length !== expectedLabels.length) {
    disabledFailures.push({
      label: "__surface__",
      failures: ["disabled_navitem_count_mismatch"],
      expectedCount: expectedLabels.length,
      observedCount: disabledLabels.length
    });
  }
  if (missingExpected.length > 0) {
    disabledFailures.push({
      label: "__surface__",
      failures: ["expected_disabled_navitems_missing"],
      missingExpected
    });
  }
  if (missingFromSurface.length > 0) {
    disabledFailures.push({
      label: "__surface__",
      failures: ["expected_navitems_missing_from_surface"],
      missingFromSurface
    });
  }
  if (unexpectedDisabled.length > 0) {
    disabledFailures.push({
      label: "__surface__",
      failures: ["unexpected_disabled_navitems_present"],
      unexpectedDisabled
    });
  }

  return { disabledCount: disabledLabels.length, disabledLabels, disabledFailures };
}

function inspectBrowserReadbackPathLeakage(summaryPath) {
  if (!existsSync(summaryPath)) {
    return {
      path: relative(repoRoot, summaryPath),
      present: false,
      required: true,
      absolutePathHits: []
    };
  }

  const raw = readFileSync(summaryPath, "utf8");
  const absolutePathHits = findAbsoluteLocalPathHits(raw);
  return {
    path: relative(repoRoot, summaryPath),
    present: true,
    required: true,
    absolutePathHits
  };
}

function runProofSelfChecks() {
  const operationsSurface = surfaces.find((surface) => surface.id === "operations-cockpit");
  const actionableRegressionHtml = operationsSurface.html
    .replace(/\saria-disabled="true"/, " href=\"#dashboard\"")
    .replace(/\stabindex="-1"|\stabIndex="-1"/, "");
  const unresolvedReasonHtml = operationsSurface.html.replace(/aria-describedby="([^"]+)"/, 'aria-describedby="missing-nav-reason-dashboard"');
  const emptyReasonHtml = operationsSurface.html.replace(
    /(<span\b(?=[^>]*class="[^"]*(?:nav-unavailable-reason|tcrn-nav-item__disabled-reason)[^"]*")[^>]*>)([\s\S]*?)(<\/span>)/,
    "$1$3"
  );
  const pathLeakHits = findAbsoluteLocalPathHits(JSON.stringify({
    one: "/Users/example/private.png",
    two: "file:///private/tmp/example.png",
    three: "/tmp/example-proof.json"
  }));

  return [
    {
      id: "expected_disabled_navitem_becomes_actionable",
      passed: inspectNavItemSemantics({ ...operationsSurface, html: actionableRegressionHtml })
        .disabledFailures
        .some((failure) => failure.failures.includes("expected_disabled_navitem_is_actionable"))
    },
    {
      id: "aria_describedby_must_resolve_visible_reason",
      passed: inspectNavItemSemantics({ ...operationsSurface, html: unresolvedReasonHtml })
        .disabledFailures
        .some((failure) => failure.failures.includes("disabled_navitem_aria_describedby_unresolved"))
    },
    {
      id: "visible_disabled_reason_must_be_nonempty",
      passed: inspectNavItemSemantics({ ...operationsSurface, html: emptyReasonHtml })
        .disabledFailures
        .some((failure) => failure.failures.includes("disabled_navitem_visible_reason_empty"))
    },
    {
      id: "absolute_local_path_patterns_are_detected",
      passed: ["/Users/example/private.png", "file:///private/tmp/example.png", "/tmp/example-proof.json"]
        .every((expected) => pathLeakHits.includes(expected))
    }
  ];
}

function findAbsoluteLocalPathHits(raw) {
  return Array.from(new Set(
    Array.from(raw.matchAll(/(?:file:\/\/)?(?:\/Users|\/private|\/Volumes|\/var\/folders|\/tmp)\/[^\s"',)\\]+/g))
      .map((match) => match[0])
  )).sort();
}

function inspectDesignSystemCertification() {
  const expectedHead = "4d03f4b4e5079f5c49a775f0bc613cfd3889fae3";
  const expectedStandards = [
    "ds-aos-operations-cockpit-v1",
    "ds-aos-docs-readiness-v1",
    "ds-aos-target-set-v1"
  ];
  const expectedExceptions = [
    "aos-brand-lockup-product-specific",
    "aos-data-semantics-product-owned"
  ];
  const receiptPaths = [
    "docs/verification/internal-alpha/aos-served-surface-standard-proof.json",
    "docs/verification/internal-alpha/visual-baseline-manifest.json",
    "docs/verification/internal-alpha/intentional-diff-manifest.json",
    "docs/verification/internal-alpha/browser-proof-summary.json",
    "docs/verification/internal-alpha-hardening-proof.json"
  ];
  const dsHead = git(["rev-parse", "HEAD"], designSystemRoot).trim();
  const standardProof = JSON.parse(readFileSync(join(designSystemRoot, "docs/verification/internal-alpha/aos-served-surface-standard-proof.json"), "utf8"));
  const hardeningProof = JSON.parse(readFileSync(join(designSystemRoot, "docs/verification/internal-alpha-hardening-proof.json"), "utf8"));
  const receiptReadbacks = receiptPaths.map((path) => {
    const content = readFileSync(join(designSystemRoot, path));
    return {
      path: relative(repoRoot, join(designSystemRoot, path)),
      bytes: content.length,
      sha256: createHash("sha256").update(content).digest("hex")
    };
  });
  const exceptionCoverage = expectedExceptions.map((id) => {
    const record = standardProof.exceptionReadback?.find((item) => item.id === id);
    return {
      id,
      present: Boolean(record),
      broadVisualSystemException: record?.broadVisualSystemException ?? null
    };
  });
  const failures = [];
  if (dsHead !== expectedHead) failures.push("design_system_head_mismatch");
  if (standardProof.ok !== true) failures.push("aos_served_surface_standard_proof_not_ok");
  if (hardeningProof.ok !== true) failures.push("internal_alpha_hardening_proof_not_ok");
  for (const id of expectedStandards) {
    if (!standardProof.acceptedDsStandardIds?.includes(id)) failures.push(`certified_standard_missing:${id}`);
    if (!hardeningProof.aosServedSurfaceStandardIds?.includes(id)) failures.push(`hardening_standard_missing:${id}`);
  }
  for (const record of exceptionCoverage) {
    if (!record.present) failures.push(`exception_record_missing:${record.id}`);
    if (record.broadVisualSystemException !== false) failures.push(`exception_scope_too_broad:${record.id}`);
  }
  return {
    ok: failures.length === 0,
    designSystemHead: dsHead,
    expectedDesignSystemHead: expectedHead,
    consumedDsStandardIds: expectedStandards,
    consumedExceptionRecords: expectedExceptions,
    exceptionCoverage,
    receiptReadbacks,
    productVisibleCopyBoundary: "AOS product-visible/accessibility-visible copy proof remains owned by AOS served surface proofs, not DS synthetic Storybook fixtures.",
    failures
  };
}

function inspectDesignSystemBasis() {
  const stylesheetStatus = git(["status", "--short", "--", "packages/ui-react/src/styles.css"], designSystemRoot).trim();
  return {
    trackedHead: git(["rev-parse", "HEAD"], designSystemRoot).trim(),
    registrySourcePath: relative(repoRoot, designSystemRegistrySourcePath),
    registrySourceTracked: gitOk(["ls-files", "--error-unmatch", "packages/ui-react/src/index.tsx"], designSystemRoot),
    unacceptedStylesheetDraft: {
      path: relative(repoRoot, designSystemStylesheetDraftPath),
      present: existsSync(designSystemStylesheetDraftPath),
      tracked: gitOk(["ls-files", "--error-unmatch", "packages/ui-react/src/styles.css"], designSystemRoot),
      gitStatus: stylesheetStatus || "absent_or_clean",
      disposition: "unaccepted_context_only_not_used_as_registry_truth"
    }
  };
}

function git(args, cwd, options = {}) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" });
  } catch (error) {
    if (options.allowFailure) {
      return { ok: false, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
    }
    throw error;
  }
}

function gitOk(args, cwd) {
  try {
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

function parseAttributes(attributes) {
  return Object.fromEntries(
    Array.from(attributes.matchAll(/\s([^\s=]+)="([^"]*)"/g)).map((match) => [match[1].toLowerCase(), match[2]])
  );
}

function extractNavItemLabel(body) {
  const labelMatch = body.match(/<span\b(?=[^>]*class="[^"]*(?:\bnav-label\b|\btcrn-nav-item__label\b)[^"]*")[^>]*>([\s\S]*?)<\/span>/);
  const labelSource = labelMatch?.[1] ?? body;
  return labelSource.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function findVisibleReasonByDescribedby(body, describedby) {
  for (const id of describedby.split(/\s+/).filter(Boolean)) {
    const elementMatch = body.match(new RegExp(`<span\\b(?=[^>]*\\bid="${escapeRegExp(id)}")(?=[^>]*class="[^"]*(?:\\bnav-unavailable-reason\\b|\\btcrn-nav-item__disabled-reason\\b)[^"]*")[^>]*>([\\s\\S]*?)<\\/span>`));
    if (elementMatch) {
      return {
        resolved: true,
        text: elementMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      };
    }
  }

  return { resolved: false, text: "" };
}

function inspectPackageRuntimeReadback(surface) {
  const navItems = Array.from(surface.html.matchAll(/<a\b(?=[^>]*data-tcrn-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g))
    .map((match) => ({ attributes: match[1], body: match[2], parsed: parseAttributes(match[1]) }));
  const packageRuntimeNavItems = navItems.filter((item) => item.parsed["data-package-runtime-component"] === "NavItem");
  const markerOnlyNavItems = navItems.filter((item) => item.parsed["data-package-runtime-component"] !== "NavItem");
  const disabledPackageRuntimeNavItems = packageRuntimeNavItems.filter((item) => item.parsed["aria-disabled"] === "true");
  const activePackageRuntimeNavItems = packageRuntimeNavItems.filter((item) => item.parsed["aria-current"] === "page");
  const claimRisk = inspectClaimRiskEvidenceStripRuntime(surface.html);
  const shellSidebar = inspectShellSidebarRuntime(surface.html);
  const topbarCheckpoint = inspectTopbarCheckpointRuntime(surface.html);
  const workIndexCluster = extractWorkIndexClusterHtml(surface.html);
  const workIndexPackageRuntimeComponents = Array.from(new Set(
    Array.from(workIndexCluster.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredWorkIndexComponents = [
    "Badge",
    "Button",
    "Field",
    "FilterBar",
    "SearchInput",
    "StateView",
    "TableShell",
    "WorkIndex"
  ];
  const missingWorkIndexComponents = requiredWorkIndexComponents.filter((component) => !workIndexPackageRuntimeComponents.includes(component));
  const workIndexRows = Array.from(workIndexCluster.matchAll(/<button\b(?=[^>]*data-work-row)([^>]*)>/g))
    .map((match) => ({ parsed: parseAttributes(match[1]) }));
  const workIndexRowFailures = workIndexRows.filter((row) => row.parsed["data-package-runtime-component"] !== "TableShell"
    || row.parsed["data-package-runtime-source"] !== "@tcrn/ui-react"
    || row.parsed["data-package-runtime-surface"] !== "operations-cockpit-work-index"
    || !row.parsed["data-row-id"]?.trim());
  const detailDrawer = inspectDetailDrawerRuntime(surface.html);
  const gateReadbackCards = inspectGateReadbackCardsRuntime(surface.html);
  const stagePhase = inspectStagePhaseRuntime(surface.html);
  const completion = inspectOperationsCockpitCompletionRuntime(surface.html);
  return {
    ok: packageRuntimeNavItems.length === 10
      && markerOnlyNavItems.length === 0
      && disabledPackageRuntimeNavItems.length === 9
      && activePackageRuntimeNavItems.length === 1
      && shellSidebar.ok
      && claimRisk.ok
      && topbarCheckpoint.ok
      && workIndexCluster.includes('data-package-runtime-component="WorkIndex"')
      && workIndexCluster.includes('data-package-runtime-subcomponent="SearchInput.control"')
      && !workIndexCluster.includes('data-package-runtime-component="Input"')
      && missingWorkIndexComponents.length === 0
      && workIndexRows.length > 0
      && workIndexRowFailures.length === 0
      && detailDrawer.ok
      && gateReadbackCards.ok
      && stagePhase.ok
      && completion.ok
      && surface.html.includes('data-package-backed-react-runtime-rendering="true"'),
    surface: surface.id,
    packageRuntimeComponent: "Surface+SideNav+NavGroup+LinkButton+NavItem+TopBar+EvidenceStrip+WorkIndex+DetailDrawer+GateReadinessPanel+ReadbackPanel+StagePhase",
    packageRuntimeSource: "@tcrn/ui-react",
    shellSidebarRuntimeReadback: shellSidebar,
    claimRiskEvidenceStripRuntimeReadback: claimRisk,
    topbarCheckpointRuntimeReadback: topbarCheckpoint,
    packageRuntimeNavItemCount: packageRuntimeNavItems.length,
    markerOnlyNavItemCount: markerOnlyNavItems.length,
    disabledPackageRuntimeNavItemCount: disabledPackageRuntimeNavItems.length,
    activePackageRuntimeNavItemCount: activePackageRuntimeNavItems.length,
    workIndexRuntimeSurface: "operations-cockpit-work-index",
    workIndexPackageRuntimeComponents,
    missingWorkIndexComponents,
    searchInputControlDisposition: "internal_subcomponent_not_separate_package_runtime_scope",
    packageRuntimeWorkRowCount: workIndexRows.length,
    workIndexRowFailureCount: workIndexRowFailures.length,
    detailDrawerRuntimeReadback: detailDrawer,
    gateReadbackCardsRuntimeReadback: gateReadbackCards,
    stagePhaseRuntimeReadback: stagePhase,
    operationsCockpitCompletionRuntimeReadback: completion,
    packageBackedReactRuntimeShellMarkerPresent: surface.html.includes('data-package-backed-react-runtime-rendering="true"')
  };
}

function inspectDocsReadinessPackageRuntimeReadback(surface) {
  if (!surface) {
    return {
      ok: false,
      surface: "docs-search-release-readiness",
      failures: ["docs_readiness_surface_missing"]
    };
  }
  const html = surface.html;
  const packageRuntimeComponents = Array.from(new Set(
    Array.from(html.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredComponents = [
    "Badge",
    "Button",
    "DetailDrawer",
    "EvidenceStrip",
    "Field",
    "FilterBar",
    "Heading",
    "KeyValueList",
    "LinkButton",
    "NavGroup",
    "NavItem",
    "ReadbackPanel",
    "SearchInput",
    "Select",
    "SideNav",
    "StateView",
    "StatusBadge",
    "Surface",
    "TableShell",
    "Text",
    "TopBar",
    "WorkIndex"
  ];
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  const markerOnlyComponents = Array.from(html.matchAll(/<([a-zA-Z][\w:-]*)\b(?=[^>]*data-tcrn-component="([^"]+)")(?![^>]*data-package-runtime-component=)(?![^>]*data-package-runtime-subcomponent=)([^>]*)>/g))
    .map((match) => ({ tag: match[1], component: match[2] }));
  const mainAttributes = parseAttributes(html.match(/<main\b([^>]*)>/)?.[1] ?? "");
  const navItems = Array.from(html.matchAll(/<a\b(?=[^>]*data-tcrn-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g))
    .map((match) => ({ attributes: match[1], body: match[2], parsed: parseAttributes(match[1]) }));
  const disabledNavItems = navItems.filter((item) => item.parsed["aria-disabled"] === "true");
  const failures = [];
  if (missingComponents.length > 0) failures.push("docs_readiness_required_package_components_missing");
  if (markerOnlyComponents.length > 0) failures.push("docs_readiness_marker_only_component_claim_present");
  if (mainAttributes["data-package-runtime-surface"] !== "docs_readiness_search_release_package_runtime_adoption") failures.push("docs_readiness_runtime_surface_mismatch");
  if (mainAttributes["data-package-backed-react-runtime-rendering"] !== "true") failures.push("docs_readiness_runtime_flag_missing");
  if (navItems.length !== 5) failures.push("docs_readiness_navitem_count_mismatch");
  if (disabledNavItems.length !== 4) failures.push("docs_readiness_disabled_navitem_count_mismatch");
  if (!html.includes('data-package-runtime-subcomponent="SearchInput.control"')) failures.push("docs_readiness_search_input_control_missing");
  if (html.includes('data-package-runtime-component="Input"')) failures.push("docs_readiness_input_scope_overclaim_present");
  if (!html.includes("data-detail-title")) failures.push("docs_readiness_detail_title_hook_missing");
  return {
    ok: failures.length === 0,
    surface: surface.id,
    packageRuntimeComponent: "Surface+SideNav+NavGroup+LinkButton+NavItem+TopBar+EvidenceStrip+ReadbackPanel+WorkIndex+DetailDrawer",
    packageRuntimeSource: "@tcrn/ui-react",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    markerOnlyComponents,
    packageRuntimeNavItemCount: navItems.length,
    disabledPackageRuntimeNavItemCount: disabledNavItems.length,
    searchInputControlDisposition: "internal_subcomponent_not_separate_package_runtime_scope",
    packageBackedReactRuntimeShellMarkerPresent: html.includes('data-package-backed-react-runtime-rendering="true"'),
    failures
  };
}

function inspectAosWidePackageRuntimeReadback(surface) {
  if (!surface) {
    return {
      ok: false,
      surface: "aos-wide-product-design",
      failures: ["aos_wide_surface_missing"]
    };
  }
  const html = surface.html;
  const packageRuntimeComponents = Array.from(new Set(
    Array.from(html.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredComponents = Array.from(aosWideProductDesignUiReactRuntime.componentScope).sort();
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  const markerOnlyComponents = Array.from(html.matchAll(/<([a-zA-Z][\w:-]*)\b(?=[^>]*data-tcrn-component="([^"]+)")(?![^>]*data-package-runtime-component=)(?![^>]*data-package-runtime-subcomponent=)([^>]*)>/g))
    .map((match) => ({ tag: match[1], component: match[2] }));
  const mainAttributes = parseAttributes(html.match(/<main\b([^>]*)>/)?.[1] ?? "");
  const navItems = Array.from(html.matchAll(/<a\b(?=[^>]*data-tcrn-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g))
    .map((match) => ({ attributes: match[1], body: match[2], parsed: parseAttributes(match[1]) }));
  const disabledNavItems = navItems.filter((item) => item.parsed["aria-disabled"] === "true");
  const surfaceRows = Array.from(html.matchAll(/<button\b(?=[^>]*data-surface-row)([^>]*)>/g))
    .map((match) => ({ parsed: parseAttributes(match[1]) }));
  const surfaceRowFailures = surfaceRows.filter((row) => row.parsed["data-package-runtime-component"] !== "TableShell"
    || row.parsed["data-package-runtime-source"] !== "@tcrn/ui-react"
    || !row.parsed["data-row-id"]?.trim());
  const failures = [];

  if (missingComponents.length > 0) failures.push("aos_wide_required_package_components_missing");
  if (markerOnlyComponents.length > 0) failures.push("aos_wide_marker_only_component_claim_present");
  if (mainAttributes["data-package-runtime-surface"] !== aosWideProductDesignUiReactRuntime.implementationKind) failures.push("aos_wide_runtime_surface_mismatch");
  if (mainAttributes["data-package-backed-react-runtime-rendering"] !== "true") failures.push("aos_wide_runtime_flag_missing");
  if (mainAttributes["data-aos-wide-product-design-accepted"] !== "false") failures.push("aos_wide_acceptance_boundary_missing");
  if (navItems.length !== 10) failures.push("aos_wide_navitem_count_mismatch");
  if (disabledNavItems.length !== 9) failures.push("aos_wide_disabled_navitem_count_mismatch");
  if (surfaceRows.length !== 10) failures.push("aos_wide_surface_row_count_mismatch");
  if (surfaceRowFailures.length > 0) failures.push("aos_wide_surface_row_runtime_metadata_missing");
  if (!html.includes('data-package-runtime-subcomponent="SearchInput.control"')) failures.push("aos_wide_search_input_control_missing");
  if (html.includes('data-package-runtime-component="Input"')) failures.push("aos_wide_input_scope_overclaim_present");
  if (!html.includes("data-detail-title")) failures.push("aos_wide_detail_title_hook_missing");
  if (!html.includes('data-region="disabled-action-gate"')) failures.push("aos_wide_disabled_action_gate_missing");
  if (!html.includes('data-region="evidence-readiness-panel"')) failures.push("aos_wide_evidence_readiness_panel_missing");

  return {
    ok: failures.length === 0,
    surface: surface.id,
    packageRuntimeComponent: "AOS-wide target-set public @tcrn/ui-react runtime surface",
    packageRuntimeSource: "@tcrn/ui-react",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    markerOnlyComponents,
    packageRuntimeNavItemCount: navItems.length,
    disabledPackageRuntimeNavItemCount: disabledNavItems.length,
    surfaceRowCount: surfaceRows.length,
    surfaceRowFailureCount: surfaceRowFailures.length,
    searchInputControlDisposition: "internal_subcomponent_not_separate_package_runtime_scope",
    packageBackedReactRuntimeShellMarkerPresent: html.includes('data-package-backed-react-runtime-rendering="true"'),
    failures
  };
}

function inspectShellSidebarRuntime(html) {
  const mainHtml = extractMainShellHtml(html);
  const sidebarHtml = extractSidebarHtml(html);
  const brandHtml = extractRegionElementHtml(html, "brand-lockup", "a");
  const mainTagHtml = mainHtml.match(/<main\b[^>]*>/)?.[0] ?? "";
  const combinedHtml = `${mainTagHtml}\n${sidebarHtml}`;
  const packageRuntimeComponents = Array.from(new Set(
    Array.from(combinedHtml.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
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
  const failures = [];
  const mainAttributes = parseAttributes(mainHtml.match(/<main\b([^>]*)>/)?.[1] ?? "");
  const sidebarAttributes = parseAttributes(sidebarHtml.match(/<nav\b([^>]*)>/)?.[1] ?? "");
  const brandAttributes = parseAttributes(brandHtml.match(/<a\b([^>]*)>/)?.[1] ?? "");
  const navGroupAttributes = parseAttributes(sidebarHtml.match(/<div\b(?=[^>]*data-package-runtime-component="NavGroup")([^>]*)>/)?.[1] ?? "");

  if (!mainHtml) failures.push("shell_surface_missing");
  if (!sidebarHtml) failures.push("sidebar_nav_missing");
  if (!brandHtml) failures.push("brand_lockup_missing");
  if (missingComponents.length > 0) failures.push("shell_sidebar_required_components_missing");
  if (mainAttributes["data-package-runtime-component"] !== "Surface") failures.push("shell_surface_missing_runtime_marker");
  if (mainAttributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push("shell_surface_missing_package_source");
  if (!/shell_sidebar/.test(mainAttributes["data-package-runtime-surface"] ?? "")) failures.push("shell_surface_implementation_scope_mismatch");
  if (sidebarAttributes["data-package-runtime-component"] !== "SideNav") failures.push("sidebar_missing_runtime_marker");
  if (sidebarAttributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push("sidebar_missing_package_source");
  if (sidebarAttributes["data-region"] !== "sidebar-nav") failures.push("sidebar_region_missing");
  if (sidebarAttributes["data-navigation-primitive"] !== "side-nav") failures.push("sidebar_primitive_missing");
  if (brandAttributes["data-package-runtime-component"] !== "LinkButton") failures.push("brand_missing_linkbutton_runtime_marker");
  if (brandAttributes["data-region"] !== "brand-lockup") failures.push("brand_region_missing");
  if (brandAttributes.href !== "#cockpit") failures.push("brand_href_mismatch");
  if (navGroupAttributes["data-package-runtime-component"] !== "NavGroup") failures.push("nav_group_missing_runtime_marker");
  if (navGroupAttributes["data-package-runtime-scope"] !== "operations-cockpit-navitem") failures.push("nav_group_scope_missing");
  if (!/Primary cockpit views/.test(sidebarHtml)) failures.push("nav_group_label_missing");
  if (!/Local operations posture recorded/.test(sidebarHtml)) failures.push("sidebar_footer_copy_missing");
  if (!/data-package-runtime-component="Text"/.test(sidebarHtml)) failures.push("sidebar_footer_text_runtime_missing");

  const markerOnlyComponents = Array.from(sidebarHtml.matchAll(/<([a-zA-Z][\w:-]*)\b(?=[^>]*data-tcrn-component="([^"]+)")(?![^>]*data-package-runtime-component=)([^>]*)>/g))
    .map((match) => ({ tag: match[1], component: match[2] }));
  if (markerOnlyComponents.length > 0) failures.push("shell_sidebar_marker_only_runtime_claim_present");

  return {
    ok: failures.length === 0,
    surface: "operations-cockpit-shell-sidebar",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    markerOnlyComponents,
    navItemCount: (sidebarHtml.match(/data-package-runtime-component="NavItem"/g) ?? []).length,
    failures
  };
}

function inspectClaimRiskEvidenceStripRuntime(html) {
  const claimHtml = extractRegionHtml(html, "claim-strip");
  const riskHtml = extractRegionHtml(html, "risk-lane");
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
  const failures = [];
  const claimAttributes = parseAttributes(claimHtml.match(/<section\b([^>]*)>/)?.[1] ?? "");
  const riskAttributes = parseAttributes(riskHtml.match(/<section\b([^>]*)>/)?.[1] ?? "");
  if (!claimHtml) failures.push("claim_strip_missing");
  if (!riskHtml) failures.push("risk_lane_missing");
  if (missingComponents.length > 0) failures.push("claim_risk_required_package_components_missing");
  if (claimAttributes["data-package-runtime-component"] !== "EvidenceStrip") failures.push("claim_strip_missing_evidence_strip_runtime_marker");
  if (riskAttributes["data-package-runtime-component"] !== "EvidenceStrip") failures.push("risk_lane_missing_evidence_strip_runtime_marker");
  if (claimAttributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push("claim_strip_missing_package_source");
  if (riskAttributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push("risk_lane_missing_package_source");
  if (claimAttributes["data-package-runtime-surface"] !== "operations-cockpit-claim-risk-strips") failures.push("claim_strip_missing_runtime_surface");
  if (riskAttributes["data-package-runtime-surface"] !== "operations-cockpit-claim-risk-strips") failures.push("risk_lane_missing_runtime_surface");
  if (Number(claimAttributes["data-package-runtime-item-count"] ?? 0) !== 3) failures.push("claim_strip_item_count_mismatch");
  if (Number(riskAttributes["data-package-runtime-item-count"] ?? 0) !== 4) failures.push("risk_lane_item_count_mismatch");
  if ((claimHtml.match(/data-claim-key=/g) ?? []).length !== 3) failures.push("claim_strip_claim_keys_missing");
  if ((riskHtml.match(/data-risk-id=/g) ?? []).length !== 4) failures.push("risk_lane_risk_ids_missing");
  if ((riskHtml.match(/data-risk-summary=/g) ?? []).length !== 4) failures.push("risk_lane_summaries_missing");
  if (!/Evidence review pending/.test(claimHtml)) failures.push("claim_strip_release_boundary_missing");
  if (!/Live operations disabled/.test(claimHtml)) failures.push("claim_strip_live_dispatch_boundary_missing");
  if (!/Review required|Blocked|Not applicable|Accepted with residual risk/.test(riskHtml)) failures.push("risk_lane_state_copy_missing");
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
  return {
    ok: failures.length === 0,
    surface: "operations-cockpit-claim-risk-strips",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    claimCount: Number(claimAttributes["data-package-runtime-item-count"] ?? 0),
    riskWarningCount: Number(riskAttributes["data-package-runtime-item-count"] ?? 0),
    markerOnlyComponents,
    forbiddenClaimHits,
    failures
  };
}

function inspectTopbarCheckpointRuntime(html) {
  const topbarHtml = extractHeaderHtml(html, "topbar-checkpoint");
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
  const failures = [];
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  const topbarAttributes = parseAttributes(topbarHtml.match(/<header\b([^>]*)>/)?.[1] ?? "");
  if (!topbarHtml) failures.push("topbar_checkpoint_missing");
  if (missingComponents.length > 0) failures.push("topbar_checkpoint_required_components_missing");
  if (topbarAttributes["data-package-runtime-component"] !== "TopBar") failures.push("topbar_missing_runtime_marker");
  if (topbarAttributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push("topbar_missing_package_source");
  if (topbarAttributes["data-package-runtime-surface"] !== "operations-cockpit-topbar-checkpoint") failures.push("topbar_missing_runtime_surface");
  if (!/data-region="project-selector"/.test(topbarHtml)) failures.push("project_selector_region_missing");
  if (!/data-package-runtime-component="Select"/.test(topbarHtml)) failures.push("project_selector_select_runtime_missing");
  if (!/data-region="checkpoint-strip"/.test(topbarHtml)) failures.push("checkpoint_strip_region_missing");
  if (!/data-service-status/.test(topbarHtml)) failures.push("service_status_readback_missing");
  if (!/data-service-model-readback/.test(topbarHtml)) failures.push("service_model_readback_missing");
  if (!/data-refresh-readback/.test(topbarHtml)) failures.push("refresh_readback_control_missing");
  if (!/data-package-runtime-component="IconButton"/.test(topbarHtml)) failures.push("profile_icon_button_runtime_missing");
  return {
    ok: failures.length === 0,
    surface: "operations-cockpit-topbar-checkpoint",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    failures
  };
}

function inspectGateReadbackCardsRuntime(html) {
  const gateHtml = extractRegionArticleHtml(html, "blocker-gate-card");
  const readbackHtml = extractRegionArticleHtml(html, "readback-posture-card");
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
  const failures = [];
  const gateAttributes = parseAttributes(gateHtml.match(/<article\b([^>]*)>/)?.[1] ?? "");
  const readbackAttributes = parseAttributes(readbackHtml.match(/<article\b([^>]*)>/)?.[1] ?? "");
  if (!gateHtml) failures.push("gate_work_order_card_missing");
  if (!readbackHtml) failures.push("readback_posture_card_missing");
  if (missingComponents.length > 0) failures.push("gate_readback_required_package_components_missing");
  if (gateAttributes["data-package-runtime-component"] !== "GateReadinessPanel") failures.push("gate_card_missing_runtime_marker");
  if (readbackAttributes["data-package-runtime-component"] !== "ReadbackPanel") failures.push("readback_card_missing_runtime_marker");
  if (gateAttributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push("gate_card_missing_package_source");
  if (readbackAttributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push("readback_card_missing_package_source");
  if (gateAttributes["data-package-runtime-surface"] !== "operations-cockpit-gate-readback-cards") failures.push("gate_card_missing_runtime_surface");
  if (readbackAttributes["data-package-runtime-surface"] !== "operations-cockpit-gate-readback-cards") failures.push("readback_card_missing_runtime_surface");
  if (!/Gate request held/.test(gateHtml)) failures.push("gate_card_disabled_action_missing");
  if (!/Evidence detail held/.test(readbackHtml)) failures.push("readback_card_disabled_action_missing");
  if ((readbackHtml.match(/<dt>/g) ?? []).length !== 4) failures.push("readback_key_value_rows_missing");
  return {
    ok: failures.length === 0,
    surface: "operations-cockpit-gate-readback-cards",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    failures
  };
}

function inspectStagePhaseRuntime(html) {
  const stageHtml = extractRegionHtml(html, "stage-map");
  const phaseHtml = extractRegionHtml(html, "ai-employee-phase");
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
  const failures = [];
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  const stageAttributes = parseAttributes(stageHtml.match(/<(?:section|article)\b([^>]*)>/)?.[1] ?? "");
  const phaseAttributes = parseAttributes(phaseHtml.match(/<(?:section|article)\b([^>]*)>/)?.[1] ?? "");
  const stageCount = Array.from(stageHtml.matchAll(/<li\b(?=[^>]*data-stage-id)([^>]*)>/g)).length;
  const phaseRowCount = Array.from(phaseHtml.matchAll(/<div\b(?=[^>]*class="[^"]*\bphase-row\b)(?=[^>]*data-phase-stage-id)([^>]*)>/g)).length;
  if (!stageHtml) failures.push("stage_map_card_missing");
  if (!phaseHtml) failures.push("ai_employee_phase_card_missing");
  if (missingComponents.length > 0) failures.push("stage_phase_required_package_components_missing");
  if (stageAttributes["data-package-runtime-component"] !== "Surface") failures.push("stage_map_missing_runtime_marker");
  if (phaseAttributes["data-package-runtime-component"] !== "Surface") failures.push("ai_employee_phase_missing_runtime_marker");
  if (stageAttributes["data-package-runtime-surface"] !== "operations-cockpit-stage-phase") failures.push("stage_map_missing_runtime_surface");
  if (phaseAttributes["data-package-runtime-surface"] !== "operations-cockpit-stage-phase") failures.push("ai_employee_phase_missing_runtime_surface");
  if (stageCount !== 4) failures.push("stage_map_stage_count_mismatch");
  if (phaseRowCount !== 4) failures.push("ai_employee_phase_row_count_mismatch");
  if ((combinedHtml.match(/data-package-runtime-component="Button"/g) ?? []).length !== 2) failures.push("stage_phase_disabled_button_count_mismatch");
  if (!/data-disabled-reason="Stage details open after the stage workspace is available\./.test(combinedHtml)) failures.push("stage_detail_disabled_reason_missing");
  if (!/data-disabled-reason="Role details open after the staffing workspace is available\./.test(combinedHtml)) failures.push("role_detail_disabled_reason_missing");
  return {
    ok: failures.length === 0,
    surface: "operations-cockpit-stage-phase",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    stageCount,
    phaseRowCount,
    failures
  };
}

function inspectDetailDrawerRuntime(html) {
  const detailHtml = extractDetailDrawerHtml(html);
  if (!detailHtml) {
    return {
      ok: false,
      present: false,
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
  const failures = [];
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  if (missingComponents.length > 0) failures.push("detail_drawer_required_package_components_missing");
  if (asideAttributes["data-package-runtime-component"] !== "DetailDrawer") failures.push("detail_drawer_missing_runtime_marker");
  if (asideAttributes["data-package-runtime-source"] !== "@tcrn/ui-react") failures.push("detail_drawer_missing_package_source");
  if (asideAttributes["data-package-runtime-surface"] !== "operations-cockpit-detail-drawer") failures.push("detail_drawer_missing_runtime_surface");
  if (!asideAttributes["data-service-detail-id"]?.trim()) failures.push("detail_drawer_missing_service_detail_id");
  if (asideAttributes["data-service-detail-type"] !== "story") failures.push("detail_drawer_unexpected_service_detail_type");
  if (asideAttributes["data-selected-story-id"] !== asideAttributes["data-service-detail-id"]) failures.push("detail_drawer_selected_story_mismatch");
  if (!/data-detail-list/.test(detailHtml)) failures.push("detail_drawer_key_value_list_missing");
  if (!/data-drawer-title/.test(detailHtml)) failures.push("detail_drawer_title_missing");
  return {
    ok: failures.length === 0,
    present: true,
    surface: "operations-cockpit-detail-drawer",
    packageRuntimeComponents,
    requiredComponents,
    missingComponents,
    selectedDetailId: asideAttributes["data-service-detail-id"] ?? "",
    selectedDetailType: asideAttributes["data-service-detail-type"] ?? "",
    selectedStoryId: asideAttributes["data-selected-story-id"] ?? "",
    keyValueRowCount: detailHtml.match(/<dt>/g)?.length ?? 0,
    failures
  };
}

function inspectOperationsCockpitCompletionRuntime(html) {
  const mainHtml = extractMainShellHtml(html);
  const packageRuntimeComponents = Array.from(new Set(
    Array.from(mainHtml.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredComponents = [
    "Badge",
    "Button",
    "DetailDrawer",
    "EvidenceStrip",
    "Field",
    "FilterBar",
    "GateReadinessPanel",
    "Heading",
    "IconButton",
    "KeyValueList",
    "LinkButton",
    "NavGroup",
    "NavItem",
    "ReadbackPanel",
    "SearchInput",
    "Select",
    "SideNav",
    "StateView",
    "StatusBadge",
    "Surface",
    "TableShell",
    "Text",
    "TopBar",
    "WorkIndex"
  ];
  const missingComponents = requiredComponents.filter((component) => !packageRuntimeComponents.includes(component));
  const markerOnlyComponents = Array.from(mainHtml.matchAll(/<([a-zA-Z][\w:-]*)\b(?=[^>]*data-tcrn-component="([^"]+)")(?![^>]*data-package-runtime-component=)([^>]*)>/g))
    .map((match) => ({ tag: match[1], component: match[2], snippet: redactAttributeSnippet(match[0]) }));
  const failures = [];
  if (!mainHtml) failures.push("operations_cockpit_main_missing");
  if (missingComponents.length > 0) failures.push("operations_cockpit_required_package_components_missing");
  if (markerOnlyComponents.length > 0) failures.push("operations_cockpit_marker_only_component_claim_present");
  if (!/data-region="hero-title"/.test(mainHtml)) failures.push("hero_title_region_missing");
  if (!/data-package-runtime-surface="operations-cockpit-hero-title"/.test(mainHtml)) failures.push("hero_title_runtime_surface_missing");
  if (!/<h2\b(?=[^>]*data-package-runtime-component="Heading")(?=[^>]*data-package-runtime-surface="operations-cockpit-work-index")[^>]*>Work Index<\/h2>/.test(mainHtml)) {
    failures.push("work_index_heading_runtime_missing");
  }
  return {
    ok: failures.length === 0,
    surface: "operations-cockpit-package-runtime-completion",
    requiredComponents,
    packageRuntimeComponents,
    missingComponents,
    markerOnlyComponents,
    failures
  };
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactAttributeSnippet(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}
