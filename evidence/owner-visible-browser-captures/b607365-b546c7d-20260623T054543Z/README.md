# Owner-Visible Browser Capture Evidence Package

This package durably preserves the existing owner-visible browser capture that was produced for the bounded b607365/b546c7d AOS preview. It is an evidence-only package copied from the route-owned temporary capture directory; it does not recapture browser/API proof, refresh VM resources, change product source, or expand acceptance scope.

## Route And Basis

- Packaging route: `route_tcrn_aos_b607365_owner_visible_proof_durable_evidence_packaging_after_rowan_changes_requested`
- Capture timestamp: `20260623T054543Z`
- Source temporary directory: `/tmp/tcrn-aos-b607365-owner-visible-browser-capture-20260623T054543Z`
- Owner-visible preview URL: `http://127.0.0.1:4317/`
- Retained preview resource: `res-mqq79ps8-2woz9e`
- Retained tunnel resource: `res-mqnd25q9-3xnn8s`
- Preview host: `tcrn-platform-dev`
- Remote service PID at capture: `1253789`
- Service cwd: `/srv/tcrn/workspaces/TCRN-AOS-owner-trial`
- Workflow basis: `16c1f2c44cc13013b304f2cf9d8b4b562b1057c1`
- AOS evidence head: `b607365443b36bdee5169ea926135089b42dcbe0`
- AOS product source basis: `b546c7dc99bcc9e518135c9edfb299ff81b7892d`
- Design System basis: `b0c00828a813d3c62392eb6e53d7d6b85b6affeb`
- TMS basis: `6356d3b6b730311fe09a0d3eb2f57a07b10bb3c5`

Rowan returned `changes_requested` because the capture was internally coherent but only existed under `/tmp`; later broader/full/product/final/owner acceptance-entry readers would have needed chat reconstruction or a volatile path. This package preserves the exact captured artifacts in TCRN-AOS evidence so Rowan can re-review durable discoverability.

## Preserved Artifacts

| Artifact | Durable path | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `capture-summary.json` | `evidence/owner-visible-browser-captures/b607365-b546c7d-20260623T054543Z/capture-summary.json` | 20548 | `c4be836e723057ec21ba1f9bcaa1d12bae5b8c1a266d9ce84e4c77eee70fbbc2` |
| `operations-desktop-1440x900.png` | `evidence/owner-visible-browser-captures/b607365-b546c7d-20260623T054543Z/operations-desktop-1440x900.png` | 233914 | `e46de1a560fc0155c0aea9d85fc3dab001067fbd2516ef33ff5d48244dc3ea6f` |
| `operations-mobile-390x844.png` | `evidence/owner-visible-browser-captures/b607365-b546c7d-20260623T054543Z/operations-mobile-390x844.png` | 210155 | `582a49bac299d1903b82087176f1a6a721a0b3f944f065107bf5d0bac6974483` |
| `docs-readiness-desktop-1440x900.png` | `evidence/owner-visible-browser-captures/b607365-b546c7d-20260623T054543Z/docs-readiness-desktop-1440x900.png` | 188019 | `0c5ab8d97b3b4500fa1ce0ac0d333ebeff146c38a5f55c360e6bd41c8a7e6b99` |
| `docs-readiness-mobile-390x844.png` | `evidence/owner-visible-browser-captures/b607365-b546c7d-20260623T054543Z/docs-readiness-mobile-390x844.png` | 149313 | `b24879109086137b3712cf340da32df0f7b9a751fa8ce3474a2b3955c287299f` |
| `aos-wide-product-design-desktop-1440x900.png` | `evidence/owner-visible-browser-captures/b607365-b546c7d-20260623T054543Z/aos-wide-product-design-desktop-1440x900.png` | 264063 | `7035d848086d4ddf640b1a1d77603843ef35a007825282dafaf1d8a606df24e4` |
| `aos-wide-product-design-mobile-390x844.png` | `evidence/owner-visible-browser-captures/b607365-b546c7d-20260623T054543Z/aos-wide-product-design-mobile-390x844.png` | 215387 | `0c7bf2353f54524354a5ac795c517f9e42112826e3ef95b195a7d6dd7ec610c7` |

The source files were copied from:

- `/tmp/tcrn-aos-b607365-owner-visible-browser-capture-20260623T054543Z/capture-summary.json`
- `/tmp/tcrn-aos-b607365-owner-visible-browser-capture-20260623T054543Z/operations-desktop-1440x900.png`
- `/tmp/tcrn-aos-b607365-owner-visible-browser-capture-20260623T054543Z/operations-mobile-390x844.png`
- `/tmp/tcrn-aos-b607365-owner-visible-browser-capture-20260623T054543Z/docs-readiness-desktop-1440x900.png`
- `/tmp/tcrn-aos-b607365-owner-visible-browser-capture-20260623T054543Z/docs-readiness-mobile-390x844.png`
- `/tmp/tcrn-aos-b607365-owner-visible-browser-capture-20260623T054543Z/aos-wide-product-design-desktop-1440x900.png`
- `/tmp/tcrn-aos-b607365-owner-visible-browser-capture-20260623T054543Z/aos-wide-product-design-mobile-390x844.png`

## Browser And DOM Summary

The preserved capture summary records six nonblank screenshots across Operations Cockpit, Docs Readiness, and AOS-wide Product Design at desktop and mobile viewports. Each capture reported the expected surface title/content markers, `@tcrn/ui-react` runtime markers, and `data-design-system-consumer` markers. The retained DOM readback reported:

- `staleE61=false`
- `duplicateIds=[]`
- `ariaReferenceFailures=[]`
- `disabledFailures=[]`
- `disabledDescriptionMismatches=[]`
- `bodyHorizontalOverflow=false`
- `forbiddenVisibleHits=[]`
- product/final/release/Owner Intent/live dispatch claim booleans all false
- page errors: 0
- request failures: 0
- resource failures: 0

The API/readback posture consumed by this packaging route remained bounded:

- health `ok=true`
- runtime database: `local_fixture`
- runtime data committed: `false`
- policy `ok=true`
- `liveSend=false`
- external queue: `none`
- service proof only: `true`
- `/api/cockpit ok=true`
- schema: `aos.cockpit.service_read_model.v1`
- service-backed: `true`
- product acceptance: `false`
- final MVP acceptance: `false`
- release publication: `false`
- Owner Intent execution: `false`
- live dispatch: `false`
- stale e61 marker: `false`

Verity accepted the targeted current-preview owner-visible browser/DOM/screenshot proof sufficiency for this retained b607365/b546c7d preview with no missing or insufficient proofs for that route-local scope. Janus targeted gate readback was consumed as a route-local gate input. Rowan then requested this durable packaging because the capture artifacts remained under `/tmp`.

The exact Verity and Janus route identifiers were not present in the committed AOS/Workflow packet surfaces inspected during this evidence-only lane; their sufficiency/gate readbacks are recorded here as consumed from Arturo's source-visible handoff for the packaging route.

## Residual Caveat

Docs Readiness desktop emitted one favicon network console message for `http://127.0.0.1:4317/docs/brand/aos-favicon.png`. Verity accepted this as a nonblocking residual for targeted owner-visible proof sufficiency because page errors were zero, request failures were zero, DOM/resource failures were empty, screenshots were nonblank, and page content/title rendered correctly. Carry this as a polish or stricter auxiliary-asset-gate caveat if a later route requires zero auxiliary asset diagnostics.

## No-Overclaim Boundaries

This evidence package only preserves an existing capture for durable discoverability. It does not authorize or claim:

- new browser/API proof capture
- screenshot regeneration
- VM/resource refresh
- source transfer
- service restart or replacement
- product source mutation
- Workflow status/evidence sync
- generated technical-context write
- Design System mutation or use of untracked `packages/ui-react/src/styles.css`
- TMS mutation
- release, publication, GitHub push, Batch Push Gate, or Selene
- Owner Intent, live dispatch, or external action execution
- product UI acceptance, Product Design acceptance, product acceptance, final MVP acceptance, owner-final acceptance, release acceptance, evidence discoverability acceptance, owner-visible acceptance proof acceptance, or parent-goal completion

Durable discoverability remains subject to Rowan re-review after this package is committed.
