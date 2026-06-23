import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { renderAOSWideProductDesignHtml } from "../dist/apps/web/src/aos-wide-product-design-view.js";
import { renderOperationsCockpitHtml } from "../dist/apps/web/src/cockpit-view.js";
import { renderDocsSearchReleaseReadinessHtml } from "../dist/apps/web/src/docs-readiness-view.js";

const repoRoot = process.cwd();
const route = "route_tcrn_aos_design_system_frontend_full_rebuild_parent_objective_remaining_surface_component_gap_audit_repair_implementation";
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const checkCurrentSource = process.argv.includes("--check-current-source");

const staticDir = join(repoRoot, "apps/web/static");
const serverSourcePath = "apps/api/src/server.ts";
const designSystemRoot = join(repoRoot, "..", "TCRN-Design-System");
const designSystemRegistrySourcePath = join(designSystemRoot, "packages/ui-react/src/index.tsx");
const designSystemStylesheetDraftPath = join(designSystemRoot, "packages/ui-react/src/styles.css");
const expectedDesignSystemCertificationHead = "4d03f4b4e5079f5c49a775f0bc613cfd3889fae3";
const acceptedExceptionRecordIds = [
  "aos-brand-lockup-product-specific",
  "aos-data-semantics-product-owned"
];
const receiptPath = join(repoRoot, "evidence/aos-design-system-parent-surface-inventory-proof.json");
const markdownPath = join(repoRoot, "evidence/aos-design-system-parent-surface-inventory-proof.md");

const expectedProductSurfaces = [
  {
    id: "operations-cockpit",
    certifiedStandardId: "ds-aos-operations-cockpit-v1",
    path: "apps/web/static/operations-cockpit.html",
    renderer: "renderOperationsCockpitHtml",
    html: renderOperationsCockpitHtml(),
    aliases: ["/", "/cockpit", "/operations-cockpit", "/operations-cockpit.html", "/apps/web/static/operations-cockpit.html"],
    sourcePaths: ["apps/web/src/cockpit-view.ts", "apps/web/src/cockpit-ui-react-runtime.ts", "apps/web/src/cockpit.ts"]
  },
  {
    id: "docs-search-release-readiness",
    certifiedStandardId: "ds-aos-docs-readiness-v1",
    path: "apps/web/static/docs-search-release-readiness.html",
    renderer: "renderDocsSearchReleaseReadinessHtml",
    html: renderDocsSearchReleaseReadinessHtml(),
    aliases: ["/docs-readiness", "/docs-search-release-readiness", "/docs-search-release-readiness.html", "/apps/web/static/docs-search-release-readiness.html"],
    sourcePaths: ["apps/web/src/docs-readiness-view.ts", "apps/web/src/docs-readiness-ui-react-runtime.ts"]
  },
  {
    id: "aos-wide-product-design",
    certifiedStandardId: "ds-aos-target-set-v1",
    path: "apps/web/static/aos-wide-product-design.html",
    renderer: "renderAOSWideProductDesignHtml",
    html: renderAOSWideProductDesignHtml(),
    aliases: ["/aos-wide-product-design", "/aos-wide-product-design.html", "/apps/web/static/aos-wide-product-design.html"],
    sourcePaths: [
      "apps/web/src/aos-wide-product-design-view.ts",
      "apps/web/src/aos-wide-product-design-ui-react-runtime.ts",
      "apps/web/src/aos-wide-product-design-data.ts"
    ]
  }
];

const productVisibleInternalTerms = [
  { id: "readback", pattern: /\breadback\b/i },
  { id: "checkpoint", pattern: /\bcheckpoint\b/i },
  { id: "route", pattern: /\broute\b/i },
  { id: "fixture", pattern: /\bfixture\b/i },
  { id: "proof_required", pattern: /\bproof required\b|\bproof_required\b/i },
  { id: "external_proof_required", pattern: /\bexternal proof required\b|\bexternal-proof-required\b|\bexternal_proof_required\b/i },
  { id: "package_runtime_pilot", pattern: /\bpackage-runtime pilot\b|\bpackage runtime pilot\b|\bpackage_runtime_pilot\b/i },
  { id: "functional_contract_readback_only", pattern: /\bfunctional contract readback only\b|\bfunctional_contract_readback_only\b/i },
  { id: "held_for_later", pattern: /\bheld for later\b|\bheld_for_later\b/i },
  { id: "unavailable_in_this_route", pattern: /\bunavailable in this route\b|\bunavailable_in_this_route\b/i },
  { id: "not_claimed", pattern: /\bnot claimed\b|\bnot_claimed\b/i },
  { id: "slice_language", pattern: /\bslice\s+\d+\b|\b59a[a-z]\b/i }
];

const designSystemRegistry = inspectDesignSystemRegistry();
const serverRouteReadback = inspectServerRoutes();
const staticOutputReadback = inspectStaticOutputs();
const productSurfaceReadbacks = expectedProductSurfaces.map((surface) => inspectProductSurface(surface, designSystemRegistry.componentNames));
const excludedFrontendArtifacts = inspectExcludedFrontendArtifacts();
const sourceBoundaryReadback = inspectSourceBoundary();
const sourceFreshnessReadback = inspectSourceFreshness();
const designSystemBoundaryReadback = inspectDesignSystemBoundary();
const designSystemCertificationReadback = inspectDesignSystemCertification();
const browserReceiptReadback = inspectExistingBrowserReceipts();
const ok = serverRouteReadback.ok
  && staticOutputReadback.ok
  && productSurfaceReadbacks.every((surface) => surface.ok)
  && excludedFrontendArtifacts.ok
  && sourceBoundaryReadback.ok
  && sourceFreshnessReadback.ok
  && designSystemBoundaryReadback.ok
  && designSystemCertificationReadback.ok
  && browserReceiptReadback.ok;

const summary = {
  ok,
  route,
  sourceHead,
  canonicalParentObjective: {
    ownerDirective: "不再做任何迁移，移除AOS现有所有前端组件，按照Design System要求和组件重建UI",
    disposition: "parent_objective_remaining_surface_component_gap_audit"
  },
  claimScope: {
    productFacingSurfaceInventory: true,
    productFacingSurfaceCount: expectedProductSurfaces.length,
    productUiAcceptanceReady: false,
    productDesignAcceptanceReady: false,
    productAcceptanceReady: false,
    finalMvpAcceptanceReady: false,
    releasePublicationReady: false,
    parentGoalCompletion: false
  },
  serverRouteReadback,
  staticOutputReadback,
  productSurfaceReadbacks,
  excludedFrontendArtifacts,
  sourceBoundaryReadback,
  designSystemBoundaryReadback,
  designSystemCertificationReadback,
  browserReceiptReadback,
  sourceFreshnessReadback
};

if (checkCurrentSource) {
  const retained = JSON.parse(readFileSync(receiptPath, "utf8"));
  const retainedDigest = retained.sourceFreshnessReadback?.sourceContentDigest;
  const retainedStrategy = retained.sourceFreshnessReadback?.strategy;
  const retainedOk = retained.ok === true;
  const result = {
    ok: retainedOk
      && retainedDigest === sourceFreshnessReadback.sourceContentDigest
      && retainedStrategy === sourceFreshnessReadback.strategy,
    command: "node scripts/aos-design-system-parent-surface-inventory-proof.mjs --check-current-source",
    retainedReceipt: relative(repoRoot, receiptPath),
    retainedSourceHeadAtProofRun: retained.sourceHead,
    retainedStrategy,
    currentStrategy: sourceFreshnessReadback.strategy,
    retainedDigest,
    currentDigest: sourceFreshnessReadback.sourceContentDigest
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
  process.exit(0);
}

mkdirSync(dirname(receiptPath), { recursive: true });
writeFileSync(receiptPath, `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(markdownPath, markdownReceipt(summary));

console.log(JSON.stringify({
  ok,
  route,
  sourceHead,
  productFacingSurfaceCount: expectedProductSurfaces.length,
  productFacingSurfaces: productSurfaceReadbacks.map((surface) => surface.id),
  excludedReferenceArtifacts: excludedFrontendArtifacts.artifacts.map((artifact) => artifact.path),
  unregisteredComponentCount: productSurfaceReadbacks.reduce((count, surface) => count + surface.unregisteredComponents.length, 0),
  markerOnlyComponentCount: productSurfaceReadbacks.reduce((count, surface) => count + surface.markerOnlyComponents.length, 0),
  productVisibleInternalCopyHitCount: productSurfaceReadbacks.reduce((count, surface) => count + surface.productVisibleCopyReadback.hits.length, 0),
  duplicateIdCount: productSurfaceReadbacks.reduce((count, surface) => count + surface.fullDocumentAccessibilityReadback.duplicateIds.length, 0),
  ariaReferenceFailureCount: productSurfaceReadbacks.reduce((count, surface) => count + surface.fullDocumentAccessibilityReadback.ariaReferenceFailures.length, 0),
  disabledControlReasonFailureCount: productSurfaceReadbacks.reduce((count, surface) => count + surface.fullDocumentAccessibilityReadback.disabledControlReasonFailures.length, 0),
  deepImportHits: sourceBoundaryReadback.deepImportHits,
  copiedSourceHits: sourceBoundaryReadback.copiedSourceHits,
  untrackedStylesheetUsageHits: sourceBoundaryReadback.untrackedStylesheetUsageHits,
  sourceFreshnessStrategy: sourceFreshnessReadback.strategy,
  sourceContentDigest: sourceFreshnessReadback.sourceContentDigest,
  receipt: relative(repoRoot, receiptPath)
}, null, 2));

if (!ok) process.exit(1);

function inspectDesignSystemRegistry() {
  const source = readFileSync(designSystemRegistrySourcePath, "utf8");
  const registrySourceMatch = source.match(/componentLibraryPublicComponentNames\s*=\s*\[([\s\S]*?)\]\s+as const/);
  if (!registrySourceMatch) {
    return { ok: false, componentNames: [], failure: "design_system_component_registry_not_found" };
  }
  return {
    ok: true,
    sourcePath: relative(repoRoot, designSystemRegistrySourcePath),
    componentNames: Array.from(registrySourceMatch[1].matchAll(/"([^"]+)"/g)).map((match) => match[1]).sort()
  };
}

function inspectServerRoutes() {
  const source = readFileSync(join(repoRoot, serverSourcePath), "utf8");
  const htmlRoutes = expectedProductSurfaces.map((surface) => ({
    id: surface.id,
    renderer: surface.renderer,
    aliases: surface.aliases,
    aliasesPresent: surface.aliases.every((alias) => source.includes(`path === "${alias}"`)),
    rendererPresent: source.includes(surface.renderer)
  }));
  const jsonRoutes = ["/health", "/api/health", "/api/cockpit", "/readback", "/api/readback", "/policy", "/api/policy"];
  const forbiddenServedMockup = source.includes("apps/web/mockup") || source.includes("mockup/index.html");
  const extraHtmlSenders = Array.from(source.matchAll(/sendHtml\(request, response, ([^)]+)\)/g)).map((match) => match[1]);
  const expectedRenderers = new Set(expectedProductSurfaces.map((surface) => `${surface.renderer}(`));
  const unexpectedHtmlSenders = extraHtmlSenders.filter((sender) => !Array.from(expectedRenderers).some((expected) => sender.includes(expected)));
  const failures = [
    ...htmlRoutes.filter((route) => !route.aliasesPresent || !route.rendererPresent).map((route) => `missing_html_route:${route.id}`),
    ...(forbiddenServedMockup ? ["mockup_served_as_product_route"] : []),
    ...unexpectedHtmlSenders.map((sender) => `unexpected_html_sender:${sender}`)
  ];
  return {
    ok: failures.length === 0,
    sourcePath: serverSourcePath,
    htmlRoutes,
    apiJsonRoutes: jsonRoutes,
    mockupServed: forbiddenServedMockup,
    unexpectedHtmlSenders,
    failures
  };
}

function inspectStaticOutputs() {
  const htmlFiles = readdirSync(staticDir).filter((file) => file.endsWith(".html")).sort();
  const expectedFiles = expectedProductSurfaces.map((surface) => surface.path.replace("apps/web/static/", "")).sort();
  const unexpectedHtmlFiles = htmlFiles.filter((file) => !expectedFiles.includes(file));
  const missingHtmlFiles = expectedFiles.filter((file) => !htmlFiles.includes(file));
  return {
    ok: unexpectedHtmlFiles.length === 0 && missingHtmlFiles.length === 0,
    directory: "apps/web/static",
    htmlFiles,
    expectedHtmlFiles: expectedFiles,
    unexpectedHtmlFiles,
    missingHtmlFiles
  };
}

function inspectProductSurface(surface, registeredComponentNames) {
  const registered = new Set(registeredComponentNames);
  const staticHtml = readFileSync(join(repoRoot, surface.path), "utf8");
  const renderedHash = sha256(surface.html);
  const staticHash = sha256(staticHtml);
  const certifiedStandardPresent = surface.html.includes(`data-design-system-certified-standard-id="${surface.certifiedStandardId}"`);
  const exceptionRecordPresent = acceptedExceptionRecordIds.every((id) => surface.html.includes(id));
  const componentInstances = Array.from(surface.html.matchAll(/<([a-zA-Z][\w:-]*)\b(?=[^>]*data-tcrn-component="([^"]+)")([^>]*)>/g))
    .map((match) => ({
      element: match[1],
      component: match[2],
      attributes: match[3],
      attributeSnippet: redactAttributeSnippet(match[3])
    }));
  const componentNames = componentInstances.map((component) => component.component);
  const packageRuntimeComponentNames = Array.from(surface.html.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1]);
  const markerOnlyComponents = componentInstances
    .filter((component) => !component.attributes.includes("data-package-runtime-component=") && !component.attributes.includes("data-package-runtime-subcomponent="))
    .map((component) => ({ element: component.element, component: component.component, attributes: component.attributeSnippet }));
  const unregisteredComponents = componentNames.filter((name) => !registered.has(name));
  const productVisibleCopyReadback = inspectProductVisibleCopy(surface.html);
  const fullDocumentAccessibilityReadback = inspectFullDocumentAccessibility(surface.html);
  const navigationStorybookAlignmentReadback = inspectNavigationStorybookAlignment(surface.html);
  const packageRuntimeSourceFailures = componentInstances
    .filter((component) => component.attributes.includes("data-package-runtime-component=") && !component.attributes.includes("data-package-runtime-source=\"@tcrn/ui-react\""))
    .map((component) => ({ component: component.component, attributes: component.attributes }));
  const failures = [
    ...(staticHash !== renderedHash ? ["static_output_not_current_with_renderer"] : []),
    ...(certifiedStandardPresent ? [] : [`certified_standard_marker_missing:${surface.certifiedStandardId}`]),
    ...(exceptionRecordPresent ? [] : ["design_system_exception_records_missing"]),
    ...unregisteredComponents.map((name) => `unregistered_component:${name}`),
    ...markerOnlyComponents.map((component) => `marker_only_component:${component.component}`),
    ...productVisibleCopyReadback.hits.map((hit) => `product_visible_internal_copy:${hit.term}`),
    ...fullDocumentAccessibilityReadback.duplicateIds.map((item) => `duplicate_id:${item.id}`),
    ...fullDocumentAccessibilityReadback.ariaReferenceFailures.map((item) => `aria_reference_failure:${item.attribute}:${item.value}`),
    ...fullDocumentAccessibilityReadback.disabledControlReasonFailures.map((item) => `disabled_control_reason_failure:${item.label}:${item.failures.join("+")}`),
    ...navigationStorybookAlignmentReadback.failures.map((failure) => `navigation_storybook_alignment:${failure}`),
    ...packageRuntimeSourceFailures.map((item) => `missing_package_runtime_source:${item.component}`)
  ];
  return {
    ok: failures.length === 0,
    id: surface.id,
    path: surface.path,
    renderer: surface.renderer,
    sourcePaths: surface.sourcePaths,
    certifiedStandardId: surface.certifiedStandardId,
    certifiedStandardPresent,
    acceptedExceptionRecords: acceptedExceptionRecordIds,
    exceptionRecordPresent,
    staticSha256: staticHash,
    renderedSha256: renderedHash,
    staticOutputCurrent: staticHash === renderedHash,
    componentInstanceCount: componentNames.length,
    registeredComponents: Array.from(new Set(componentNames)).sort(),
    packageRuntimeComponents: Array.from(new Set(packageRuntimeComponentNames)).sort(),
    unregisteredComponents,
    markerOnlyComponents,
    productVisibleCopyReadback,
    fullDocumentAccessibilityReadback,
    navigationStorybookAlignmentReadback,
    packageRuntimeSourceFailures,
    failures
  };
}

function inspectNavigationStorybookAlignment(html) {
  const sidebarHtml = html.match(/<nav\b(?=[^>]*data-region="sidebar-nav")[\s\S]*?<\/nav>/)?.[0] ?? "";
  const styleText = Array.from(html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi))
    .map((match) => match[1] ?? "")
    .join("\n");
  const sidebarAttributes = parseAttributes(sidebarHtml.match(/<nav\b([^>]*)>/)?.[1] ?? "");
  const navGroupCount = (sidebarHtml.match(/data-navigation-primitive="nav-group"/g) ?? []).length;
  const navItemCount = (sidebarHtml.match(/data-navigation-primitive="nav-item"/g) ?? []).length;
  const selectedNavItemCount = (sidebarHtml.match(/data-selected="true"|aria-current="page"/g) ?? []).length;
  const forbiddenClassHits = Array.from(html.matchAll(/class="[^"]*(?:\baos-sidebar\b|\bnav-row\b|\bnav-stack\b)[^"]*"/g))
    .map((match) => match[0]);
  const forbiddenStyleSelectorHits = [".aos-sidebar", ".nav-row", ".nav-stack"]
    .filter((selector) => styleText.includes(selector));
  const failures = [];

  if (!sidebarHtml) failures.push("sidebar_missing");
  if (!sidebarAttributes.class?.split(/\s+/).includes("tcrn-side-nav")) failures.push("sidebar_class_not_storybook_sidenav");
  if (sidebarAttributes["data-navigation-primitive"] !== "side-nav") failures.push("sidebar_primitive_missing");
  if (navGroupCount === 0) failures.push("nav_group_missing");
  if (navItemCount === 0) failures.push("nav_item_missing");
  if (selectedNavItemCount === 0) failures.push("selected_nav_item_missing");
  if (forbiddenClassHits.length > 0) failures.push("product_local_navigation_class_hit");
  if (forbiddenStyleSelectorHits.length > 0) failures.push("product_local_navigation_style_selector_hit");

  return {
    ok: failures.length === 0,
    sideNavClass: sidebarAttributes.class ?? "",
    sideNavPrimitive: sidebarAttributes["data-navigation-primitive"] ?? "",
    navGroupCount,
    navItemCount,
    selectedNavItemCount,
    forbiddenClassHits,
    forbiddenStyleSelectorHits,
    failures
  };
}

function inspectExcludedFrontendArtifacts() {
  const artifacts = [
    "apps/web/mockup/index.html",
    "apps/web/mockup/mockup.js",
    "apps/web/mockup/styles.css"
  ].map((path) => ({
    path,
    exists: existsSync(join(repoRoot, path)),
    servedByAosService: false,
    completionPathDisposition: "excluded_reference_only_historical_style_baseline_not_product_route",
    reason: "Not routed by apps/api/src/server.ts and not present under apps/web/static product outputs."
  }));
  const referencedByDocsOrProof = [
    "README.md",
    "docs/frontend-style-baseline.md",
    "scripts/slice-4b-style-proof.mjs"
  ].filter((path) => existsSync(join(repoRoot, path)));
  return {
    ok: artifacts.every((artifact) => artifact.exists && artifact.servedByAosService === false),
    artifacts,
    referencedByDocsOrProof
  };
}

function inspectSourceBoundary() {
  const sourceFiles = [
    ...listFiles(join(repoRoot, "apps/web/src")).filter((path) => path.endsWith(".ts")),
    ...listFiles(join(repoRoot, "apps/api/src")).filter((path) => path.endsWith(".ts")),
    "package.json"
  ];
  const deepImportHits = [];
  const copiedSourceHits = [];
  const untrackedStylesheetUsageHits = [];
  const publicImportHits = [];
  for (const absolutePath of sourceFiles.map((path) => path.startsWith(repoRoot) ? path : join(repoRoot, path))) {
    const rel = relative(repoRoot, absolutePath);
    const source = readFileSync(absolutePath, "utf8");
    if (/@tcrn\/ui-react\//.test(source)) deepImportHits.push(rel);
    if (/packages\/ui-react\/src\/index|TCRN-Design-System\/packages\/ui-react\/src\/index/.test(source)) copiedSourceHits.push(rel);
    if (/packages\/ui-react\/src\/styles\.css|TCRN-Design-System\/packages\/ui-react\/src\/styles\.css/.test(source)) untrackedStylesheetUsageHits.push(rel);
    if (/@tcrn\/ui-react/.test(source)) publicImportHits.push(rel);
  }
  const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const dependencies = packageJson.dependencies ?? {};
  const dependencyReadback = {
    uiReact: dependencies["@tcrn/ui-react"],
    uiTokens: dependencies["@tcrn/ui-tokens"],
    uiCopyState: dependencies["@tcrn/ui-copy-state"],
    react: dependencies.react,
    reactDom: dependencies["react-dom"]
  };
  const ok = deepImportHits.length === 0
    && copiedSourceHits.length === 0
    && untrackedStylesheetUsageHits.length === 0
    && dependencyReadback.uiReact === "file:../TCRN-Design-System/packages/ui-react"
    && dependencyReadback.uiTokens === "file:../TCRN-Design-System/packages/ui-tokens"
    && dependencyReadback.uiCopyState === "file:../TCRN-Design-System/packages/ui-copy-state";
  return {
    ok,
    scannedFiles: sourceFiles.map((path) => path.startsWith(repoRoot) ? relative(repoRoot, path) : path).sort(),
    publicImportHits: Array.from(new Set(publicImportHits)).sort(),
    deepImportHits: Array.from(new Set(deepImportHits)).sort(),
    copiedSourceHits: Array.from(new Set(copiedSourceHits)).sort(),
    untrackedStylesheetUsageHits: Array.from(new Set(untrackedStylesheetUsageHits)).sort(),
    dependencyReadback
  };
}

function inspectDesignSystemBoundary() {
  const gitStatus = execFileSync("git", ["-C", designSystemRoot, "status", "--short", "--", "packages/ui-react/src/styles.css"], { encoding: "utf8" }).trim();
  const trackedHead = execFileSync("git", ["-C", designSystemRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const stylesheetPresent = existsSync(designSystemStylesheetDraftPath);
  const stylesheetTracked = gitStatus.length > 0 && !gitStatus.startsWith("??");
  return {
    ok: designSystemRegistry.ok && stylesheetPresent && !stylesheetTracked,
    trackedHead,
    registrySourcePath: relative(repoRoot, designSystemRegistrySourcePath),
    registrySourceReadable: designSystemRegistry.ok,
    unacceptedStylesheetDraft: {
      path: relative(repoRoot, designSystemStylesheetDraftPath),
      present: stylesheetPresent,
      tracked: stylesheetTracked,
      gitStatus,
      disposition: "unaccepted_context_only_not_imported_copied_or_used_as_truth"
    }
  };
}

function inspectDesignSystemCertification() {
  const expectedStandards = expectedProductSurfaces.map((surface) => surface.certifiedStandardId);
  const receiptPaths = [
    "docs/verification/internal-alpha/aos-served-surface-standard-proof.json",
    "docs/verification/internal-alpha/visual-baseline-manifest.json",
    "docs/verification/internal-alpha/intentional-diff-manifest.json",
    "docs/verification/internal-alpha/browser-proof-summary.json",
    "docs/verification/internal-alpha-hardening-proof.json"
  ];
  const trackedHead = execFileSync("git", ["-C", designSystemRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const standardProof = JSON.parse(readFileSync(join(designSystemRoot, "docs/verification/internal-alpha/aos-served-surface-standard-proof.json"), "utf8"));
  const hardeningProof = JSON.parse(readFileSync(join(designSystemRoot, "docs/verification/internal-alpha-hardening-proof.json"), "utf8"));
  const receiptReadbacks = receiptPaths.map((path) => {
    const content = readFileSync(join(designSystemRoot, path));
    return {
      path: relative(repoRoot, join(designSystemRoot, path)),
      bytes: content.length,
      sha256: sha256(content)
    };
  });
  const exceptionCoverage = acceptedExceptionRecordIds.map((id) => {
    const record = standardProof.exceptionReadback?.find((item) => item.id === id);
    return {
      id,
      present: Boolean(record),
      broadVisualSystemException: record?.broadVisualSystemException ?? null
    };
  });
  const failures = [];
  if (trackedHead !== expectedDesignSystemCertificationHead) failures.push("design_system_head_mismatch");
  if (standardProof.ok !== true) failures.push("aos_served_surface_standard_proof_not_ok");
  if (hardeningProof.ok !== true) failures.push("internal_alpha_hardening_proof_not_ok");
  for (const id of expectedStandards) {
    if (!standardProof.acceptedDsStandardIds?.includes(id)) failures.push(`certified_standard_missing:${id}`);
    if (!hardeningProof.aosServedSurfaceStandardIds?.includes(id)) failures.push(`hardening_standard_missing:${id}`);
  }
  for (const readback of exceptionCoverage) {
    if (!readback.present) failures.push(`exception_record_missing:${readback.id}`);
    if (readback.broadVisualSystemException !== false) failures.push(`exception_scope_too_broad:${readback.id}`);
  }
  return {
    ok: failures.length === 0,
    designSystemHead: trackedHead,
    expectedDesignSystemHead: expectedDesignSystemCertificationHead,
    consumedDsStandardIds: expectedStandards,
    consumedExceptionRecords: acceptedExceptionRecordIds,
    receiptReadbacks,
    exceptionCoverage,
    productVisibleCopyProofDisposition: "AOS served surface visible and accessibility text remains the proof source; DS synthetic Storybook fixture vocabulary is not substituted.",
    failures
  };
}

function inspectExistingBrowserReceipts() {
  const receipts = [
    "evidence/aos-design-system-browser-readback/summary.json",
    "evidence/aos-design-system-consumer-slice-1-browser/e61c22d3b99f3a9e0d53f3572985dae0fded47f8/browser-evidence-summary.json",
    "evidence/slice-9b-visible-readiness-browser/e61c22d3b99f3a9e0d53f3572985dae0fded47f8/browser-evidence-summary.json",
    "evidence/slice-10-aos-wide-product-design-browser/e61c22d3b99f3a9e0d53f3572985dae0fded47f8/browser-evidence-summary.json"
  ].map((path) => ({ path, exists: existsSync(join(repoRoot, path)) }));
  return {
    ok: receipts.every((receipt) => receipt.exists),
    receipts,
    disposition: "retained_browser_receipts_exist_for_current_product_source_basis; this proof performs exact_current_source_static_route_inventory"
  };
}

function inspectSourceFreshness() {
  const sourcePaths = [
    "apps/api/src/server.ts",
    "apps/web/src/aos-wide-product-design-data.ts",
    "apps/web/src/aos-wide-product-design-ui-react-runtime.ts",
    "apps/web/src/aos-wide-product-design-view.ts",
    "apps/web/src/cockpit-ui-react-runtime.ts",
    "apps/web/src/cockpit-view.ts",
    "apps/web/src/cockpit.ts",
    "apps/web/src/design-system-bridge.ts",
    "apps/web/src/docs-readiness-ui-react-runtime.ts",
    "apps/web/src/docs-readiness-view.ts",
    "apps/web/src/static-component-registry.ts",
    "apps/web/test/aos-wide-product-design-view.test.mjs",
    "apps/web/test/cockpit-view.test.mjs",
    "apps/web/test/docs-readiness-view.test.mjs",
    "scripts/aos-design-system-component-registry-proof.mjs",
    "scripts/aos-design-system-package-runtime-proof.mjs",
    "scripts/aos-design-system-parent-surface-inventory-proof.mjs",
    "scripts/slice-9b-visible-readiness-proof.mjs",
    "scripts/slice-10-aos-wide-product-design-proof.mjs",
    "package.json"
  ];
  const digestInput = sourcePaths
    .map((path) => `${path}\n${readFileSync(join(repoRoot, path), "utf8")}`)
    .join("\n---aos-parent-objective-source---\n");
  return {
    ok: true,
    strategy: "source_content_digest_for_parent_surface_inventory",
    sourceHeadAtProofRun: sourceHead,
    exactFinalCommitHeadRequired: false,
    sourceContentDigest: sha256(digestInput),
    sourcePaths
  };
}

function inspectProductVisibleCopy(html) {
  const text = `${visibleText(html)} ${accessibilityText(html)}`;
  const hits = productVisibleInternalTerms
    .filter((term) => term.pattern.test(text))
    .map((term) => ({ term: term.id }));
  return {
    ok: hits.length === 0,
    bannedTerms: productVisibleInternalTerms.map((term) => term.id),
    hits,
    scannedTextLength: text.length
  };
}

function inspectFullDocumentAccessibility(html) {
  const ids = new Map();
  for (const match of html.matchAll(/(?:^|\s)id="([^"]+)"/g)) {
    ids.set(match[1], (ids.get(match[1]) ?? 0) + 1);
  }
  const duplicateIds = Array.from(ids.entries())
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ id, count }));
  const ariaReferenceFailures = [];
  for (const match of html.matchAll(/\b(aria-describedby|aria-labelledby)="([^"]+)"/g)) {
    const attribute = match[1];
    const values = match[2].trim().split(/\s+/).filter(Boolean);
    for (const value of values) {
      const targetCount = ids.get(value) ?? 0;
      if (targetCount !== 1) ariaReferenceFailures.push({ attribute, value, targetCount });
    }
  }
  const disabledControlReasonFailures = collectDisabledControls(html)
    .map((control) => ({ ...control, failures: inspectDisabledControlReason(control, html, ids) }))
    .filter((control) => control.failures.length > 0);
  return {
    ok: duplicateIds.length === 0 && ariaReferenceFailures.length === 0 && disabledControlReasonFailures.length === 0,
    duplicateIds,
    ariaReferenceFailures,
    disabledControlCount: collectDisabledControls(html).length,
    disabledControlReasonFailures
  };
}

function collectDisabledControls(html) {
  const controls = [];
  for (const match of html.matchAll(/<(button|select|input|textarea|a)\b([^>]*)>([\s\S]*?)(?:<\/\1>)?/g)) {
    const tag = match[1].toLowerCase();
    const attributes = match[2];
    const body = match[3] ?? "";
    const parsed = parseAttributes(attributes);
    const disabled = Object.prototype.hasOwnProperty.call(parsed, "disabled") || parsed["aria-disabled"] === "true";
    if (!disabled) continue;
    controls.push({
      tag,
      label: normalizeText(visibleText(body) || parsed["aria-label"] || parsed.title || tag),
      attributes: redactAttributeSnippet(attributes),
      parsed
    });
  }
  return controls;
}

function inspectDisabledControlReason(control, html, ids) {
  const failures = [];
  const reason = control.parsed["data-disabled-reason"]?.trim();
  const title = control.parsed.title?.trim();
  const describedby = control.parsed["aria-describedby"]?.trim();
  if (!reason) failures.push("missing_data_disabled_reason");
  if (!title) failures.push("missing_title");
  if (!describedby) {
    failures.push("missing_aria_describedby");
    return failures;
  }
  const describedIds = describedby.split(/\s+/).filter(Boolean);
  for (const id of describedIds) {
    const count = ids.get(id) ?? 0;
    if (count !== 1) failures.push(`bad_aria_target_count:${id}:${count}`);
    const targetText = extractElementTextById(html, id);
    if (!targetText.trim()) failures.push(`empty_aria_target_text:${id}`);
    if (reason && targetText.trim() && normalizeText(targetText) !== normalizeText(reason)) {
      failures.push(`aria_target_reason_mismatch:${id}`);
    }
  }
  return failures;
}

function visibleText(html) {
  return normalizeText(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&"));
}

function accessibilityText(html) {
  const values = [];
  for (const match of html.matchAll(/\b(?:aria-label|title|data-disabled-reason|alt)="([^"]*)"/g)) {
    values.push(match[1]);
  }
  return normalizeText(values.join(" "));
}

function extractElementTextById(html, id) {
  const escaped = escapeRegExp(id);
  const match = html.match(new RegExp(`<[^>]+\\bid="${escaped}"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i"));
  return match ? visibleText(match[1]) : "";
}

function parseAttributes(attributes) {
  const parsed = {};
  for (const match of attributes.matchAll(/([:@\w-]+)(?:="([^"]*)")?/g)) {
    parsed[match[1].toLowerCase()] = match[2] ?? "";
  }
  return parsed;
}

function redactAttributeSnippet(attributes) {
  return normalizeText(attributes).slice(0, 320);
}

function listFiles(root) {
  const entries = [];
  for (const entry of readdirSync(root)) {
    const absolute = join(root, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) entries.push(...listFiles(absolute));
    else entries.push(absolute);
  }
  return entries;
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markdownReceipt(summary) {
  const surfaceRows = summary.productSurfaceReadbacks
    .map((surface) => `| ${surface.id} | ${surface.componentInstanceCount} | ${surface.unregisteredComponents.length} | ${surface.markerOnlyComponents.length} | ${surface.productVisibleCopyReadback.hits.length} | ${surface.navigationStorybookAlignmentReadback.failures.length} | ${surface.fullDocumentAccessibilityReadback.duplicateIds.length} | ${surface.fullDocumentAccessibilityReadback.ariaReferenceFailures.length} | ${surface.fullDocumentAccessibilityReadback.disabledControlReasonFailures.length} |`)
    .join("\n");
  return `# AOS Design System Parent Surface Inventory Proof

- Route: ${summary.route}
- Source head at proof run: ${summary.sourceHead}
- OK: ${summary.ok}
- Product-facing HTML route count: ${summary.serverRouteReadback.htmlRoutes.length}
- Static product HTML outputs: ${summary.staticOutputReadback.htmlFiles.join(", ")}
- Excluded reference-only frontend artifacts: ${summary.excludedFrontendArtifacts.artifacts.map((artifact) => artifact.path).join(", ")}
- Design System certification head: ${summary.designSystemCertificationReadback.designSystemHead}
- Consumed DS standard IDs: ${summary.designSystemCertificationReadback.consumedDsStandardIds.join(", ")}
- Consumed DS exception records: ${summary.designSystemCertificationReadback.consumedExceptionRecords.join(", ")}
- Product-visible copy proof disposition: ${summary.designSystemCertificationReadback.productVisibleCopyProofDisposition}
- Source freshness strategy: ${summary.sourceFreshnessReadback.strategy}
- Source content digest: ${summary.sourceFreshnessReadback.sourceContentDigest}

| Surface | Component instances | Unregistered | Marker-only | Internal copy hits | Navigation alignment failures | Duplicate IDs | ARIA failures | Disabled reason failures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${surfaceRows}

## Boundaries

- Product UI acceptance: false
- Product Design acceptance: false
- Product acceptance: false
- Final MVP acceptance: false
- Release/publication readiness: false
- Parent-goal completion: false
- TCRN-DESIGN-SYSTEM untracked stylesheet disposition: ${summary.designSystemBoundaryReadback.unacceptedStylesheetDraft.disposition}
`;
}
