import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  forbiddenProductionCopy,
  renderOperationsCockpitHtml,
  requiredProductionSelectors,
  slice4bBaselineDigest
} from "../dist/apps/web/src/cockpit-view.js";

const repoRoot = process.cwd();
const baselinePaths = [
  "README.md",
  "apps/web/mockup/index.html",
  "apps/web/mockup/mockup.js",
  "apps/web/mockup/styles.css",
  "docs/brand/aos-favicon.png",
  "docs/brand/favicon.ico",
  "docs/brand/tcrn-aos-impression.png",
  "docs/brand/tcrn-aos-wordmark-geometric-dark-preview.png",
  "docs/brand/tcrn-aos-wordmark-geometric-dark.png",
  "docs/brand/tcrn-aos-wordmark-geometric-spec.md",
  "docs/brand/tcrn-aos-wordmark.png",
  "docs/brand/tcrn-aos-wordmark.svg"
];

const manifestRows = baselinePaths.map((relativePath) => {
  const body = readFileSync(join(repoRoot, relativePath));
  return {
    path: relativePath,
    bytes: body.byteLength,
    sha256: createHash("sha256").update(body).digest("hex")
  };
});
const aggregateDigest = createHash("sha256")
  .update(manifestRows.map((row) => `${row.sha256} ${row.bytes} ${row.path}\n`).join(""))
  .digest("hex");

const html = renderOperationsCockpitHtml();
const staticPath = join(repoRoot, "apps/web/static/operations-cockpit.html");
mkdirSync(dirname(staticPath), { recursive: true });
writeFileSync(staticPath, html);

const selectorProof = requiredProductionSelectors.map((selector) => {
  const dataRegion = selector.match(/data-region='([^']+)'/)?.[1];
  const present = dataRegion ? html.includes(`data-region="${dataRegion}"`) : false;
  return { selector, present };
});
const forbiddenHits = forbiddenProductionCopy.filter((phrase) => html.toLowerCase().includes(phrase.toLowerCase()));
const mockupReferenceCopyBoundary = baselinePaths.some((path) => path.startsWith("apps/web/mockup/"));
const ok = aggregateDigest === slice4bBaselineDigest
  && selectorProof.every((item) => item.present)
  && forbiddenHits.length === 0
  && html.includes("Local checkpoint observed")
  && html.includes("local fixture readback current")
  && html.includes('data-service-backed="false"')
  && html.includes("Gate work order held")
  && html.includes("data-refresh-readback")
  && mockupReferenceCopyBoundary;

console.log(JSON.stringify({
  ok,
  baseline: {
    expectedDigest: slice4bBaselineDigest,
    aggregateDigest,
    entries: manifestRows.length,
    totalBytes: manifestRows.reduce((sum, row) => sum + row.bytes, 0)
  },
  staticRender: {
    path: "apps/web/static/operations-cockpit.html",
    bytes: Buffer.byteLength(html),
    requiredSelectorsPresent: selectorProof.every((item) => item.present),
    selectorProof
  },
  copyScan: {
    forbiddenHits,
    productionSurfaceOnly: true,
    mockupReferenceCopyBoundary
  },
  productDesignStatus: {
    brief: "accepted",
    ownerStyleBaseline: "accepted_for_now_from_current_static_mockup",
    selectedWordmark: "03 / Geometric Product",
    visualIdeation: "not_required_before_this_style_baseline_implementation",
    prototype: "not_claimed",
    browserVisualAcceptance: "proof_required_after_implementation_not_claimed_by_packet",
    uxLayoutVisualAcceptance: "not_claimed"
  },
  noOverclaim: {
    productDesignAcceptance: false,
    browserAcceptanceComplete: false,
    deployment: false,
    releaseReadiness: false,
    dependencyClean: false,
    legalCompletion: false,
    publicReadiness: false,
    productAcceptance: false,
    finalMvpAcceptance: false,
    liveCodexDispatch: false,
    scannerIngestion: false,
    resourceMaterialization: false
  }
}, null, 2));

if (!ok) {
  process.exit(1);
}
