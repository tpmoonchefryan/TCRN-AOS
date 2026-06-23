import {
  createTokenMap,
  tcrnTokenCss
} from "@tcrn/ui-tokens";
import {
  presentCopyState,
  type CopyStatePresentation,
  type ReadinessState
} from "@tcrn/ui-copy-state";

export const aosDesignSystemConsumerBridge = {
  route: "route_tcrn_aos_c3e1aa8_narrow_aos_ds_certification_consumption_repair_proof_refresh_after_mara_triage",
  adoptionPosture: "tokens_copy_state_ui_react_product_frontend_rebuild",
  designSystemSourceHead: "4d03f4b4e5079f5c49a775f0bc613cfd3889fae3",
  tokenPackage: "@tcrn/ui-tokens",
  copyStatePackage: "@tcrn/ui-copy-state",
  uiReactPackage: "@tcrn/ui-react",
  uiReactPackageSpecifier: "file:../TCRN-Design-System/packages/ui-react",
  servedSurfaceStandardIds: {
    operationsCockpit: "ds-aos-operations-cockpit-v1",
    docsSearchReleaseReadiness: "ds-aos-docs-readiness-v1",
    projectWorkspace: "ds-aos-target-set-v1",
    initiativeDetail: "ds-aos-target-set-v1",
    aosWideProductDesign: "ds-aos-target-set-v1"
  },
  acceptedExceptionRecords: [
    "aos-brand-lockup-product-specific",
    "aos-data-semantics-product-owned"
  ],
  designSystemCertificationReceipts: [
    "../TCRN-Design-System/docs/verification/internal-alpha/aos-served-surface-standard-proof.json",
    "../TCRN-Design-System/docs/verification/internal-alpha/aos-served-surface-standard-proof.md",
    "../TCRN-Design-System/docs/verification/internal-alpha/visual-baseline-manifest.json",
    "../TCRN-Design-System/docs/verification/internal-alpha/intentional-diff-manifest.json",
    "../TCRN-Design-System/docs/verification/internal-alpha/browser-proof-summary.json",
    "../TCRN-Design-System/docs/verification/internal-alpha-hardening-proof.json"
  ],
  productVisibleCopyProofSource: "AOS served Operations Cockpit, Docs Readiness, and AOS-wide product HTML/accessibility text only",
  designSystemSyntheticStorybookVocabularyDisposition: "accepted_as_design_system_fixture_evidence_not_aos_customer_copy_proof",
  uiReactRuntimeSurface: "aos_product_frontend_rebuilt_registered_design_system_runtime",
  uiReactRuntimeComponentScope: [
    "NavItem",
    "SideNav",
    "NavGroup",
    "LinkButton",
    "TopBar",
    "WorkIndex",
    "TableShell",
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
    "EvidenceStrip"
  ],
  uiReactRuntimeInternalSubcomponents: [
    "SearchInput.control"
  ],
  packageBackedReactRuntimeRendering: true,
  productAcceptanceReady: false,
  finalMvpAcceptanceReady: false,
  releasePublicationReady: false
} as const;

const tokenMap = createTokenMap();

export const aosDesignSystemTokenCss = tcrnTokenCss;

export const aosDesignSystemNavigationCss = `
.tcrn-side-nav {
  display: grid;
  gap: 12px;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--tcrn-color-border-subtle) 82%, transparent);
  border-radius: var(--tcrn-radius-surface);
  background:
    linear-gradient(160deg, color-mix(in srgb, var(--tcrn-color-brand-primary-bg) 42%, transparent) 0%, transparent 38%),
    linear-gradient(180deg, var(--tcrn-color-surface-panel) 0%, color-mix(in srgb, var(--tcrn-color-brand-secondary-bg) 36%, var(--tcrn-color-surface-panel)) 100%);
  padding: 10px;
}
.tcrn-nav-group {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.tcrn-nav-group__label {
  padding: 0 8px;
  color: var(--tcrn-color-text-primary);
  font-size: var(--tcrn-type-size-caption);
  font-weight: 700;
}
.tcrn-nav-group__items {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.tcrn-nav-item {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 34px;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: var(--tcrn-radius-control);
  color: var(--tcrn-color-text-secondary);
  padding: 7px 9px;
  text-decoration: none;
  width: 100%;
}
.tcrn-nav-item:hover {
  border-color: color-mix(in srgb, var(--tcrn-color-border-subtle) 86%, var(--tcrn-color-brand-primary-bg));
  background: color-mix(in srgb, var(--tcrn-color-brand-primary-bg) 42%, transparent);
  color: var(--tcrn-color-text-primary);
}
.tcrn-nav-item[aria-current="page"],
.tcrn-nav-item[data-selected="true"] {
  border-color: color-mix(in srgb, var(--tcrn-color-brand-primary) 26%, var(--tcrn-color-border-subtle));
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--tcrn-color-brand-primary-bg) 84%, var(--tcrn-color-surface-panel)) 0%, color-mix(in srgb, var(--tcrn-color-brand-secondary-bg) 34%, var(--tcrn-color-surface-panel)) 100%);
  color: var(--tcrn-color-text-primary);
  box-shadow: inset 4px 0 0 color-mix(in srgb, var(--tcrn-color-brand-primary) 74%, var(--tcrn-color-brand-secondary));
}
.tcrn-nav-item[aria-disabled="true"] {
  cursor: not-allowed;
  color: var(--tcrn-color-text-muted);
  opacity: 0.74;
}
.tcrn-nav-item__content {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.tcrn-nav-item__label,
.tcrn-nav-item__disabled-reason {
  min-width: 0;
  overflow-wrap: anywhere;
}
.tcrn-nav-item__disabled-reason {
  color: var(--tcrn-color-text-muted);
  font-size: 12px;
  line-height: 1.25;
}
.tcrn-nav-item .tcrn-icon {
  width: 16px;
  height: 16px;
  color: var(--tcrn-color-brand-primary);
}
`;

export const aosDesignSystemTokenReadback = {
  textPrimary: tokenMap["--tcrn-color-text-primary"],
  surfaceCanvas: tokenMap["--tcrn-color-surface-canvas"],
  surfacePanel: tokenMap["--tcrn-color-surface-panel"],
  borderSubtle: tokenMap["--tcrn-color-border-subtle"],
  brandPrimary: tokenMap["--tcrn-color-brand-primary"],
  stateWarning: tokenMap["--tcrn-color-state-warning"],
  stateBlocked: tokenMap["--tcrn-color-state-blocked"],
  focusRing: tokenMap["--tcrn-color-focus-ring"]
} as const;

interface AosCopyAlias {
  state: ReadinessState;
  label?: string;
}

const aosCopyAliases: Record<string, AosCopyAlias> = {
  accepted: { state: "local_only", label: "Accepted locally" },
  accepted_with_residual_risk: { state: "proof_required", label: "Review complete with residual risk" },
  active: { state: "local_only", label: "Active locally" },
  blocked: { state: "blocked", label: "Blocked" },
  closed: { state: "local_only", label: "Closed locally" },
  collecting_positions: { state: "proof_required", label: "Collecting positions" },
  complete: { state: "local_only", label: "Complete locally" },
  current: { state: "local_only", label: "Current state" },
  d024: { state: "proof_required", label: "D-024 boundary" },
  dependency: { state: "proof_required", label: "Dependency review" },
  discussion_only: { state: "local_only", label: "Discussion only" },
  evidence_missing: { state: "proof_required", label: "Evidence missing" },
  evidence: { state: "proof_required", label: "Evidence review" },
  evidence_proof: { state: "proof_required", label: "Evidence review" },
  external_proof_required: { state: "external_proof_needed", label: "Evidence review pending" },
  external_release_proof_required: { state: "external_proof_needed", label: "Release review pending" },
  gate: { state: "proof_required", label: "Gate review" },
  conference: { state: "proof_required", label: "Conference review" },
  in_progress: { state: "local_only", label: "In progress" },
  license: { state: "proof_required", label: "License review" },
  local_functional_contract_only: { state: "local_only", label: "Read-only local view" },
  metadata_only: { state: "local_only", label: "Metadata only" },
  minutes_ready: { state: "local_only", label: "Minutes ready" },
  none: { state: "not_configured", label: "Metadata present" },
  not_applicable: { state: "not_configured", label: "Not applicable" },
  not_claimed: { state: "not_claimed", label: "Not enabled" },
  not_started: { state: "not_configured", label: "Not started" },
  open_evidence_metadata: { state: "local_only", label: "Open evidence metadata" },
  owner_intent: { state: "unavailable", label: "Owner Intent gate" },
  owner_intent_required: { state: "unavailable", label: "Owner Intent required" },
  pending_role: { state: "proof_required", label: "Role review pending" },
  product_design: { state: "proof_required", label: "Product Design review" },
  product_design_visual_target_pending: { state: "proof_required", label: "Product Design visual target pending" },
  proof: { state: "proof_required", label: "Review lane" },
  proof_required: { state: "proof_required", label: "Review needed" },
  proposed: { state: "proof_required", label: "Proposed" },
  ready_for_draft: { state: "local_only", label: "Ready for draft" },
  recommendation: { state: "local_only", label: "Recommendation" },
  record_participant_position: { state: "local_only", label: "Record participant position" },
  release_proof_required: { state: "proof_required", label: "Release review needed" },
  release: { state: "proof_required", label: "Release review" },
  review_required: { state: "proof_required", label: "Review required" },
  resource: { state: "proof_required", label: "Resource review" },
  route: { state: "proof_required", label: "Review gate" },
  security_license: { state: "proof_required", label: "Security/license gate" },
  security: { state: "proof_required", label: "Security review" },
  stale: { state: "proof_required", label: "Review needed" },
  stage: { state: "proof_required", label: "Stage review" },
  story: { state: "local_only", label: "Selected work" },
  static_fixture: { state: "fixture_only", label: "Local service snapshot" },
  superseded: { state: "not_configured", label: "Superseded" },
  unavailable: { state: "unavailable", label: "Unavailable" },
  unknown: { state: "unknown", label: "Unknown" },
  valid: { state: "local_only", label: "Valid local evidence" },
  visual_target_required_before_acceptance: { state: "proof_required", label: "Visual target required before acceptance" }
};

export const aosClientCopyStateLabels = Object.fromEntries(
  Object.keys(aosCopyAliases).map((key) => [key, presentAosCopyState(key).label])
) as Record<string, string>;

export function presentAosCopyState(value: string | undefined): CopyStatePresentation {
  const key = normalizeAosCopyKey(value);
  const alias = aosCopyAliases[key];
  if (!alias) {
    return presentCopyState({ state: "unknown" }, "en");
  }
  return presentCopyState({
    state: alias.state,
    ...(alias.label ? { label: alias.label } : {})
  }, "en");
}

export function copyAosState(value: string | undefined): string {
  return presentAosCopyState(value).label;
}

export function copyAosFreshness(value: string | undefined): string {
  return copyAosState(value);
}

export function copyAosPosture(value: string | undefined): string {
  return copyAosState(value);
}

export function copyAosAction(value: string | undefined): string {
  return copyAosState(value);
}

function normalizeAosCopyKey(value: string | undefined): string {
  return value?.trim().toLowerCase() || "unknown";
}
