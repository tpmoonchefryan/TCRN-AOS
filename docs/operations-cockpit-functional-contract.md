# Operations Cockpit Functional Contract

Slice 4 adds a deterministic read-model contract for the AOS Operations Cockpit. It is not a Product Design visual target, browser visual acceptance artifact, prototype, deployment proof, or product acceptance claim.

Observed proof receipt: `../evidence/slice-4-operations-cockpit-proof.md`.

## Contract Surfaces

The contract exports `OperationsCockpitReadModel` from `apps/web/src/cockpit.ts` with these first-level regions:

- `context_header`
- `stage_map`
- `workstream_overview`
- `gate_queue`
- `conference_visibility`
- `evidence_readback`
- `risk_warning`
- `dependency_resource`
- `detail_panel`

The route remains a non-visual functional checkpoint. The navigation and region identifiers exist so later Product Design work can map user mental models onto stable data surfaces without treating this implementation as an accepted UI.

## Scenario Fixtures

`pnpm slice4:proof` exercises three deterministic scenarios:

- `moving`: active work with current evidence, ordinary role gate, conference position, dependency/resource inspection, and local-only readbacks.
- `blocked`: blocked story/stage/evidence/gate/dependency/resource states surfaced as review blockers without release-readiness overclaim.
- `owner_intent_required`: Owner Intent gate separated from ordinary role gates with `autoExecutable=false`.

## Product Design Boundary

```yaml
product_design_status:
  brief: accepted
  visual_ideation: not_required_before_slice_4_functional_contract_implementation
  prototype: not_applicable_to_this_packet
  browser_visual_acceptance: not_claimed
  ux_layout_visual_acceptance: not_claimed
  later_gate: exactly_three_product_design_visual_options_required_before_visual_target_selection_or_polished_ux_acceptance
```

This contract does not select visual direction, polished IA, dashboard composition style, or interaction model. Exactly three Product Design visual options remain required before visual target selection or UX/layout/visual acceptance.

## No-Overclaim Boundary

The read model fixes these non-claims:

- `releaseReadinessClaim=external_proof_required`
- `productDesignAcceptance=not_claimed`
- `visualTarget=visual_target_required_before_acceptance`
- `liveCodexDispatch=false`
- `deployment=false`
- `productAcceptance=false`
- `runtimeDataCommittedToGit=false`

Dependency and resource inspection items expose posture and linked review state, but they keep `cleanClaim=false`, `legalCompletionClaim=false`, `scannerIngestionClaim=false`, and `materializationExecuted=false`.
