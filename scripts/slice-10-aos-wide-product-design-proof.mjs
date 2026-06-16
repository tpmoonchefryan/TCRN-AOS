import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createAOSWideProductDesignModel,
  forbiddenAosWidePositiveCopy,
  renderAOSWideProductDesignHtml,
  requiredAosWideSelectors,
  slice10LocalCheckpoint,
  slice10PreImplementationBasis,
  slice10WorkflowPacketBasis
} from "../dist/apps/web/src/aos-wide-product-design-view.js";

const repoRoot = process.cwd();
const model = createAOSWideProductDesignModel();
const html = renderAOSWideProductDesignHtml(model);
const staticPath = join(repoRoot, "apps/web/static/aos-wide-product-design.html");
mkdirSync(dirname(staticPath), { recursive: true });
writeFileSync(staticPath, html);

const targetPaths = {
  operationsCockpit: "apps/web/static/operations-cockpit.html",
  docsSearchRelease: "apps/web/static/docs-search-release-readiness.html",
  aosWideTarget: "apps/web/static/aos-wide-product-design.html"
};
const targetPathReadback = Object.fromEntries(
  Object.entries(targetPaths).map(([key, value]) => [key, { path: value, exists: existsSync(join(repoRoot, value)) }])
);
const selectorProof = requiredAosWideSelectors.map((selector) => {
  const dataRegion = selector.match(/data-region='([^']+)'/)?.[1];
  const present = dataRegion ? html.includes(`data-region="${dataRegion}"`) : false;
  return { selector, present };
});
const forbiddenHits = forbiddenAosWidePositiveCopy.filter((phrase) => html.toLowerCase().includes(phrase.toLowerCase()));
const htmlDigest = createHash("sha256").update(html).digest("hex");
const requiredState = model.requiredState;
const requiredStateOk = requiredState.productDesignStatus === "target_set_implemented_pending_review"
  && requiredState.aosWideProductDesignAccepted === false
  && requiredState.deploymentProof === "not_claimed"
  && requiredState.liveDispatch === false
  && requiredState.threadRegistryMutation === false
  && requiredState.releaseReadiness === "not_claimed"
  && requiredState.productAcceptance === "not_claimed"
  && requiredState.finalMvpAcceptance === "not_claimed"
  && requiredState.docsExport === "not_executed"
  && requiredState.docsPublication === "not_claimed"
  && requiredState.canonicalPromotion === "not_claimed"
  && requiredState.githubMutation === false
  && requiredState.scannerIngestion === false
  && requiredState.materializationExecuted === false
  && requiredState.productRepoWrite === false
  && requiredState.codexSecurityScan === "not_run"
  && requiredState.externalProofRequired === true;
const readinessRows = model.surfaces.map((surface) => ({
  id: surface.id,
  title: surface.title,
  state: surface.state,
  desktopReadyForCapture: model.evidenceReadiness[surface.id]?.desktopReadyForCapture === true,
  mobileReadyForCapture: model.evidenceReadiness[surface.id]?.mobileReadyForCapture === true,
  bodyOverflowExpected: model.evidenceReadiness[surface.id]?.bodyOverflowExpected,
  denseOverflowConfinedTo: model.evidenceReadiness[surface.id]?.denseOverflowConfinedTo,
  consolePageErrorExpectation: model.evidenceReadiness[surface.id]?.consolePageErrorExpectation
}));
const interactionReadiness = {
  primaryNavigation: html.includes("data-nav-surface="),
  searchFilter: html.includes("id=\"surface-search\""),
  stateFilters: ["all", "review_required", "blocked", "current", "pending_external_proof"].every((state) => html.includes(`data-filter-state="${state}"`)),
  rowDetailSelection: html.includes("data-surface-row") && html.includes("data-detail-title"),
  emptyState: html.includes("data-empty-state"),
  disabledGateControls: html.includes("Owner action locked") && html.includes("disabled"),
  focusStateCss: html.includes(":focus-visible")
};
const overflowReadiness = {
  bodyPageOverflowExpected: false,
  shellClipsHorizontalOverflow: html.includes("overflow-x: clip"),
  denseTableOverflowConfined: html.includes(".surface-index { border-radius: 6px 0 0 6px; overflow-x: auto; }"),
  mobileDenseTableWidth: html.includes(".surface-table { width: max-content; min-width: 820px; }")
};
const restrictedPayloadCheck = {
  rawSourceStored: model.restrictedPayloadPosture.rawSourceStored,
  secretsStored: model.restrictedPayloadPosture.secretsStored,
  authStateStored: model.restrictedPayloadPosture.authStateStored,
  shellHistoryStored: model.restrictedPayloadPosture.shellHistoryStored,
  browserKeychainStored: model.restrictedPayloadPosture.browserKeychainStored,
  rawScannerOutputStored: model.restrictedPayloadPosture.rawScannerOutputStored,
  localAbsolutePathStored: model.restrictedPayloadPosture.localAbsolutePathStored
};
const d024Boundary = model.d024Boundary;
const ok = slice10WorkflowPacketBasis === "bcff619a406f2028e6c70ea76a3ade1674e3ca21"
  && slice10PreImplementationBasis === "06cded11e97be6d4a738a21ae942128d5b4688cd"
  && slice10LocalCheckpoint === "slice-10-aos-wide-product-design-surface-set"
  && model.surfaces.length === 10
  && selectorProof.every((item) => item.present)
  && Object.values(targetPathReadback).every((item) => item.exists)
  && forbiddenHits.length === 0
  && requiredStateOk
  && readinessRows.every((row) => row.desktopReadyForCapture && row.mobileReadyForCapture && row.bodyOverflowExpected === false)
  && Object.values(interactionReadiness).every(Boolean)
  && overflowReadiness.bodyPageOverflowExpected === false
  && overflowReadiness.shellClipsHorizontalOverflow
  && overflowReadiness.denseTableOverflowConfined
  && overflowReadiness.mobileDenseTableWidth
  && Object.values(restrictedPayloadCheck).every((value) => value === false)
  && d024Boundary.localFirstOperationalData === true
  && d024Boundary.runtimeOperationalDumpCommitted === false;

console.log(JSON.stringify({
  ok,
  checkpoint: {
    workflowPacketBasis: slice10WorkflowPacketBasis,
    preImplementationBasis: slice10PreImplementationBasis,
    localCheckpoint: slice10LocalCheckpoint
  },
  staticRender: {
    path: "apps/web/static/aos-wide-product-design.html",
    bytes: Buffer.byteLength(html),
    sha256: htmlDigest,
    productDesignStatus: model.context.productDesignStatus,
    selectorProof
  },
  targetPathReadback,
  surfaceReadiness: {
    count: readinessRows.length,
    rows: readinessRows
  },
  interactionReadiness,
  overflowReadiness,
  copyScan: {
    forbiddenHits,
    productionSurfaceOnly: true
  },
  requiredState,
  noOverclaim: {
    aosWideProductDesignAccepted: requiredState.aosWideProductDesignAccepted,
    deploymentProof: requiredState.deploymentProof,
    liveDispatch: requiredState.liveDispatch,
    threadRegistryMutation: requiredState.threadRegistryMutation,
    releaseReadiness: requiredState.releaseReadiness,
    productAcceptance: requiredState.productAcceptance,
    finalMvpAcceptance: requiredState.finalMvpAcceptance,
    docsExport: requiredState.docsExport,
    docsPublication: requiredState.docsPublication,
    canonicalPromotion: requiredState.canonicalPromotion,
    githubMutation: requiredState.githubMutation,
    scannerIngestion: requiredState.scannerIngestion,
    materializationExecuted: requiredState.materializationExecuted,
    productRepoWrite: requiredState.productRepoWrite,
    codexSecurityScan: requiredState.codexSecurityScan
  },
  d024Boundary,
  restrictedPayloadCheck,
  evidenceReadiness: {
    markdownReceipt: "evidence/slice-10-aos-wide-product-design-surface-set-proof.md",
    jsonOutput: "stdout",
    consolePageErrorReadiness: "none_expected_for_later_browser_capture"
  }
}, null, 2));

if (!ok) {
  process.exit(1);
}
