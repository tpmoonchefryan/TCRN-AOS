import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createSlice9bDocsSearchReleaseReadModel,
  forbiddenDocsReadinessCopy,
  renderDocsSearchReleaseReadinessHtml,
  requiredDocsReadinessSelectors,
  slice9bPreImplementationBasis,
  slice9bWorkflowPacketBasis
} from "../dist/apps/web/src/docs-readiness-view.js";

const repoRoot = process.cwd();
const model = createSlice9bDocsSearchReleaseReadModel();
const html = renderDocsSearchReleaseReadinessHtml(model);
const staticPath = join(repoRoot, "apps/web/static/docs-search-release-readiness.html");
mkdirSync(dirname(staticPath), { recursive: true });
writeFileSync(staticPath, html);

const selectorProof = requiredDocsReadinessSelectors.map((selector) => {
  const dataRegion = selector.match(/data-region='([^']+)'/)?.[1];
  const present = dataRegion ? html.includes(`data-region="${dataRegion}"`) : false;
  return { selector, present };
});
const forbiddenHits = forbiddenDocsReadinessCopy.filter((phrase) => html.toLowerCase().includes(phrase.toLowerCase()));
const htmlDigest = createHash("sha256").update(html).digest("hex");
const noExecutionClaims = {
  docsPublished: model.docsReadiness.docsPublished,
  rawSourceIndexed: model.searchIndex.rawSourceIndexed,
  githubWriteExecuted: model.githubMetadata.githubWriteExecuted,
  releaseCreated: model.releaseCandidate.releaseCreated,
  ciStatusMutated: model.prCiReadiness.ciStatusMutated,
  deploymentExecuted: model.releaseCandidate.deploymentExecuted,
  productAccepted: model.releaseCandidate.productAccepted,
  finalMvpAccepted: model.releaseCandidate.finalMvpAccepted
};
const ok = slice9bWorkflowPacketBasis === "624127182da417f65c790de155e3297e77828181"
  && slice9bPreImplementationBasis === "9d7980f46245bb783b520c9f90945da8609c01ce"
  && model.context.docsSearchReleaseSurfacesVisible === true
  && selectorProof.every((item) => item.present)
  && forbiddenHits.length === 0
  && Object.values(noExecutionClaims).every((value) => value === false)
  && html.includes("id=\"readiness-search\"")
  && html.includes("data-empty-state")
  && html.includes("publication not executed")
  && html.includes("release creation not executed");

console.log(JSON.stringify({
  ok,
  checkpoint: {
    workflowPacketBasis: slice9bWorkflowPacketBasis,
    preImplementationBasis: slice9bPreImplementationBasis,
    localCheckpoint: model.context.localCheckpoint
  },
  staticRender: {
    path: "apps/web/static/docs-search-release-readiness.html",
    bytes: Buffer.byteLength(html),
    sha256: htmlDigest,
    docsSearchReleaseSurfacesVisible: model.context.docsSearchReleaseSurfacesVisible,
    selectorProof
  },
  readModel: {
    rowCount: model.rows.length,
    storyScope: model.rows.map((row) => row.storyId),
    docsReadiness: model.aggregateIndex.docsReadinessRecordIds.length,
    searchIndexRecords: model.aggregateIndex.searchIndexRecordIds.length,
    githubMetadata: model.aggregateIndex.githubMetadataIds.length,
    prCiReadiness: model.aggregateIndex.prCiReadinessIds.length,
    releaseCandidates: model.aggregateIndex.releaseCandidateIds.length,
    blockedReadiness: model.aggregateIndex.blockedReadinessIds.length,
    blockedReleaseCandidates: model.aggregateIndex.blockedReleaseCandidateIds.length
  },
  copyScan: {
    forbiddenHits,
    productionSurfaceOnly: true
  },
  noExecutionClaims,
  noOverclaim: {
    docsPublication: model.noClaims.docsPublication,
    docsExport: model.noClaims.docsExport,
    canonicalPromotion: model.noClaims.canonicalPromotion,
    githubMutation: model.noClaims.githubMutation,
    releaseCreation: model.noClaims.releaseCreation,
    ciMutation: model.noClaims.ciMutation,
    deployment: model.noClaims.deployment,
    liveCodexDispatch: model.noClaims.liveCodexDispatch,
    productDesignFinalAcceptance: model.noClaims.productDesignFinalAcceptance,
    browserAcceptanceCloseout: model.noClaims.browserAcceptanceCloseout,
    productAcceptance: model.noClaims.productAcceptance,
    finalMvpAcceptance: model.noClaims.finalMvpAcceptance
  },
  evidenceReadback: model.evidencePanel
}, null, 2));

if (!ok) {
  process.exit(1);
}
