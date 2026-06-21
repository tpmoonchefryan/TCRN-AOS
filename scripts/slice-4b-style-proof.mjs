import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  aosDesignSystemConsumerBridge,
  aosDesignSystemTokenReadback
} from "../dist/apps/web/src/design-system-bridge.js";
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
const visibleTextFragments = Array.from(html.matchAll(/>([^<>]+)</g)).map((match) => match[1]).join(" ");
const rawVisibleCopyHits = [
  "external_proof_required",
  "not_claimed",
  "release_proof_required",
  "owner_intent_required",
  "record_participant_position",
  "open_evidence_metadata"
].filter((phrase) => visibleTextFragments.includes(phrase));
const mockupReferenceCopyBoundary = baselinePaths.some((path) => path.startsWith("apps/web/mockup/"));
const designSystemBridgeOk = html.includes('data-design-system-consumer="tokens_copy_state_ui_react_operations_cockpit_runtime_pilot"')
  && html.includes('data-design-system-tokens="@tcrn/ui-tokens"')
  && html.includes('data-design-system-copy-state="@tcrn/ui-copy-state"')
  && html.includes('data-design-system-ui-react="@tcrn/ui-react"')
  && html.includes('data-package-backed-react-runtime-rendering="true"')
  && html.includes('data-package-runtime-scope="operations-cockpit-navitem"')
  && html.includes('data-package-runtime-surface="operations-cockpit-work-index"')
  && html.includes('data-package-runtime-surface="operations-cockpit-detail-drawer"')
  && html.includes('data-package-runtime-surface="operations-cockpit-gate-readback-cards"')
  && html.includes('data-package-runtime-component="WorkIndex"')
  && html.includes('data-package-runtime-component="DetailDrawer"')
  && html.includes('data-package-runtime-component="GateReadinessPanel"')
  && html.includes('data-package-runtime-component="ReadbackPanel"')
  && html.includes('data-package-runtime-component="KeyValueList"')
  && html.includes("--tcrn-color-brand-primary")
  && aosDesignSystemConsumerBridge.uiReactPackage === "@tcrn/ui-react"
  && aosDesignSystemConsumerBridge.packageBackedReactRuntimeRendering === true
  && aosDesignSystemConsumerBridge.uiReactRuntimeSurface === "operations_cockpit_navitem_sidebar_work_index_selected_detail_drawer_gate_readback_cards"
  && Boolean(aosDesignSystemTokenReadback.brandPrimary);
const ok = aggregateDigest === slice4bBaselineDigest
  && selectorProof.every((item) => item.present)
  && forbiddenHits.length === 0
  && rawVisibleCopyHits.length === 0
  && html.includes("Local checkpoint observed")
  && html.includes("Static fixture readback")
  && html.includes('data-service-backed="false"')
  && html.includes("Gate work order held")
  && html.includes("data-refresh-readback")
  && mockupReferenceCopyBoundary
  && designSystemBridgeOk;

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
    rawVisibleCopyHits,
    productionSurfaceOnly: true,
    mockupReferenceCopyBoundary
  },
  designSystemConsumption: {
    ok: designSystemBridgeOk,
    route: aosDesignSystemConsumerBridge.route,
    adoptionPosture: aosDesignSystemConsumerBridge.adoptionPosture,
    designSystemSourceHead: aosDesignSystemConsumerBridge.designSystemSourceHead,
    tokenPackage: aosDesignSystemConsumerBridge.tokenPackage,
    copyStatePackage: aosDesignSystemConsumerBridge.copyStatePackage,
    uiReactPackage: aosDesignSystemConsumerBridge.uiReactPackage,
    selectedTokenReadback: aosDesignSystemTokenReadback
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
