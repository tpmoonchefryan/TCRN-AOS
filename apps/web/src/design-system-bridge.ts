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
  route: "route_tcrn_aos_design_system_frontend_rebuild_59au_cockpit_shell_sidebar_package_runtime_implementation",
  adoptionPosture: "tokens_copy_state_ui_react_operations_cockpit_runtime_pilot",
  designSystemSourceHead: "b0c00828a813d3c62392eb6e53d7d6b85b6affeb",
  tokenPackage: "@tcrn/ui-tokens",
  copyStatePackage: "@tcrn/ui-copy-state",
  uiReactPackage: "@tcrn/ui-react",
  uiReactPackageSpecifier: "file:../TCRN-Design-System/packages/ui-react",
  uiReactRuntimeSurface: "operations_cockpit_shell_sidebar_navitem_work_index_selected_detail_drawer_gate_readback_cards_stage_phase_topbar_checkpoint_claim_risk_strips",
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
  accepted: { state: "local_only", label: "Accepted for local readback" },
  accepted_with_residual_risk: { state: "proof_required", label: "Accepted with residual risk" },
  active: { state: "local_only", label: "Active locally" },
  blocked: { state: "blocked", label: "Blocked" },
  closed: { state: "local_only", label: "Closed locally" },
  collecting_positions: { state: "proof_required", label: "Collecting positions" },
  complete: { state: "local_only", label: "Complete in local readback" },
  current: { state: "local_only", label: "Readback current" },
  d024: { state: "proof_required", label: "D-024 boundary" },
  dependency: { state: "proof_required", label: "Dependency proof" },
  discussion_only: { state: "local_only", label: "Discussion only" },
  evidence_missing: { state: "proof_required", label: "Evidence missing" },
  evidence: { state: "proof_required", label: "Evidence proof" },
  evidence_proof: { state: "proof_required", label: "Evidence proof" },
  external_proof_required: { state: "external_proof_needed", label: "External proof required" },
  external_release_proof_required: { state: "external_proof_needed", label: "External release proof required" },
  gate: { state: "proof_required", label: "Gate proof" },
  conference: { state: "proof_required", label: "Conference proof" },
  in_progress: { state: "local_only", label: "In progress" },
  license: { state: "proof_required", label: "License proof" },
  local_functional_contract_only: { state: "local_only", label: "Local functional contract only" },
  metadata_only: { state: "local_only", label: "Metadata only" },
  minutes_ready: { state: "local_only", label: "Minutes ready" },
  none: { state: "not_configured", label: "Metadata present" },
  not_applicable: { state: "not_configured", label: "Not applicable" },
  not_claimed: { state: "not_claimed", label: "Not claimed" },
  not_started: { state: "not_configured", label: "Not started" },
  open_evidence_metadata: { state: "local_only", label: "Open evidence metadata" },
  owner_intent: { state: "unavailable", label: "Owner Intent gate" },
  owner_intent_required: { state: "unavailable", label: "Owner Intent required" },
  pending_role: { state: "proof_required", label: "Role review pending" },
  product_design: { state: "proof_required", label: "Product Design review" },
  product_design_visual_target_pending: { state: "proof_required", label: "Product Design visual target pending" },
  proof: { state: "proof_required", label: "Proof lane" },
  proof_required: { state: "proof_required", label: "Proof required" },
  proposed: { state: "proof_required", label: "Proposed" },
  ready_for_draft: { state: "local_only", label: "Ready for draft" },
  recommendation: { state: "local_only", label: "Recommendation" },
  record_participant_position: { state: "local_only", label: "Record participant position" },
  release_proof_required: { state: "proof_required", label: "Proof required" },
  release: { state: "proof_required", label: "Release proof" },
  review_required: { state: "proof_required", label: "Review required" },
  resource: { state: "proof_required", label: "Resource proof" },
  route: { state: "proof_required", label: "Route gate" },
  security_license: { state: "proof_required", label: "Security/license gate" },
  security: { state: "proof_required", label: "Security proof" },
  stale: { state: "proof_required", label: "Proof required" },
  stage: { state: "proof_required", label: "Stage proof" },
  story: { state: "local_only", label: "Story readback" },
  static_fixture: { state: "fixture_only", label: "Static fixture readback" },
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
