import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";
import {
  aosDesignSystemRegisteredComponentNames,
  aosRequiredStaticSurfaceComponents
} from "../dist/apps/web/src/static-component-registry.js";
import { renderAOSWideProductDesignHtml } from "../dist/apps/web/src/aos-wide-product-design-view.js";
import { renderOperationsCockpitHtml } from "../dist/apps/web/src/cockpit-view.js";
import { renderDocsSearchReleaseReadinessHtml } from "../dist/apps/web/src/docs-readiness-view.js";

const repoRoot = process.cwd();
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
const proofSelfChecks = runProofSelfChecks();

const ok = localRegistryDiff.length === 0
  && surfaceReadbacks.every((readback) => readback.unregistered.length === 0)
  && surfaceReadbacks.every((readback) => readback.missingRequired.length === 0)
  && surfaceReadbacks.every((readback) => readback.disabledNavItemSemanticFailures.length === 0)
  && browserReadbackPathLeakage.present === true
  && browserReadbackPathLeakage.absolutePathHits.length === 0
  && proofSelfChecks.every((check) => check.passed);

const summary = {
  ok,
  route: "route_tcrn_aos_design_system_frontend_rebuild_registered_component_proof",
  registrySource: relative(repoRoot, designSystemRegistrySourcePath),
  designSystemBasis,
  claimScope: {
    implementationKind: "static_renderer_registered_component_metadata",
    packageBackedReactRuntimeRendering: false,
    storybookVisualStyleParity: false,
    productAcceptanceReady: false,
    finalMvpAcceptanceReady: false
  },
  localRegistryDiff,
  surfaces: surfaceReadbacks,
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
    if (!/\btabindex="-1"/.test(attributes)) failures.push("disabled_navitem_missing_tabindex_minus_1");
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
    .replace('aria-disabled="true" tabindex="-1"', 'href="#dashboard"')
    .replace(' data-disabled-reason="Dashboard view is held for a later routed AOS slice; this service read-model checkpoint keeps Cockpit available only."', "");
  const unresolvedReasonHtml = operationsSurface.html.replace('aria-describedby="nav-reason-dashboard"', 'aria-describedby="missing-nav-reason-dashboard"');
  const emptyReasonHtml = operationsSurface.html.replace(
    '<span class="nav-unavailable-reason" id="nav-reason-dashboard">Held for later route</span>',
    '<span class="nav-unavailable-reason" id="nav-reason-dashboard"></span>'
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
    Array.from(attributes.matchAll(/\s([^\s=]+)="([^"]*)"/g)).map((match) => [match[1], match[2]])
  );
}

function extractNavItemLabel(body) {
  const labelMatch = body.match(/<span\b(?=[^>]*class="[^"]*\bnav-label\b[^"]*")[^>]*>([\s\S]*?)<\/span>/);
  const labelSource = labelMatch?.[1] ?? body;
  return labelSource.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function findVisibleReasonByDescribedby(body, describedby) {
  for (const id of describedby.split(/\s+/).filter(Boolean)) {
    const elementMatch = body.match(new RegExp(`<span\\b(?=[^>]*\\bid="${escapeRegExp(id)}")(?=[^>]*class="[^"]*\\bnav-unavailable-reason\\b[^"]*")[^>]*>([\\s\\S]*?)<\\/span>`));
    if (elementMatch) {
      return {
        resolved: true,
        text: elementMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      };
    }
  }

  return { resolved: false, text: "" };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactAttributeSnippet(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}
