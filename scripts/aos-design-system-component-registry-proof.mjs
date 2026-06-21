import { readFileSync, writeFileSync } from "node:fs";
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
const designSystemSource = readFileSync(join(designSystemRoot, "packages/ui-react/src/index.tsx"), "utf8");
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
    required: aosRequiredStaticSurfaceComponents
  },
  {
    id: "docs-search-release-readiness",
    path: "apps/web/static/docs-search-release-readiness.html",
    html: renderDocsSearchReleaseReadinessHtml(),
    required: aosRequiredStaticSurfaceComponents
  },
  {
    id: "aos-wide-product-design",
    path: "apps/web/static/aos-wide-product-design.html",
    html: renderAOSWideProductDesignHtml(),
    required: aosRequiredStaticSurfaceComponents
  }
];

const registered = new Set(designSystemRegistry);
const surfaceReadbacks = surfaces.map((surface) => {
  const componentNames = Array.from(surface.html.matchAll(/data-tcrn-component="([^"]+)"/g)).map((match) => match[1]);
  const unregistered = componentNames.filter((name) => !registered.has(name));
  const missingRequired = surface.required.filter((name) => !componentNames.includes(name));
  return {
    id: surface.id,
    path: surface.path,
    componentCount: componentNames.length,
    registeredComponents: Array.from(new Set(componentNames)).sort(),
    unregistered,
    missingRequired
  };
});

const ok = localRegistryDiff.length === 0
  && surfaceReadbacks.every((readback) => readback.unregistered.length === 0)
  && surfaceReadbacks.every((readback) => readback.missingRequired.length === 0);

const summary = {
  ok,
  route: "route_tcrn_aos_design_system_frontend_rebuild_registered_component_proof",
  registrySource: relative(repoRoot, join(designSystemRoot, "packages/ui-react/src/index.tsx")),
  localRegistryDiff,
  surfaces: surfaceReadbacks,
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
