# Frontend Style Baseline

Slice 4B records and implements the owner-accepted Operations Cockpit style baseline for the local AOS web surface.

## Baseline Source

- Accepted static mockup: `apps/web/mockup/index.html`.
- Static mockup script: `apps/web/mockup/mockup.js`.
- Static mockup styles: `apps/web/mockup/styles.css`.
- Selected wordmark: `03 / Geometric Product`.
- Baseline checkpoint: `e6e73ec6115092bf91eff86fb076d1fbc916e147`.
- Baseline manifest digest: `2bccfa9ab9ed95b785135965c4494f38258a27de3c6f4e9cc1fdad51ed75fb90`.

The mockup remains a reference artifact. Its draft copy does not define production claim language.

## Production Surface

- Render module: `apps/web/src/cockpit-view.ts`.
- Local static render: `apps/web/static/operations-cockpit.html`.
- Proof command: `pnpm slice4b:proof`.

The production surface keeps these first-level regions:

- sidebar navigation
- brand lockup
- topbar project selector
- local checkpoint strip
- stage map
- AI employee phase visibility
- blocker/gate card
- readback posture card
- work index
- detail drawer

## Copy Boundary

The production surface uses local proof and posture language. It avoids broad system health, release, legal, dependency-clean, public-readiness, Product Design acceptance, browser acceptance, deployment, scanner-ingestion, resource-materialization, product-acceptance, and final-MVP claims.

## Product Design Status

```yaml
product_design_status:
  brief: accepted
  owner_style_baseline: accepted_for_now_from_current_static_mockup
  selected_wordmark: "03 / Geometric Product"
  visual_ideation: not_required_before_this_style_baseline_implementation
  prototype: not_claimed
  browser_visual_acceptance: proof_required_after_implementation_not_claimed_by_packet
  ux_layout_visual_acceptance: not_claimed
  later_gate: product_design_or_owner_review_required_before_final_visual_acceptance_or_major_redesign
```

Slice 4B does not claim final visual acceptance. Product Design or owner review is still required before final UX/layout/visual acceptance, selected target changes, major redesign, prototype acceptance, or image-to-code acceptance.
