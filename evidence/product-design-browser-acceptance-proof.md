# Product Design Browser Evidence Proof

## Receipt

Status: captured for Talia/Product Design review; not Product Design final acceptance.

- Evidence package: `evidence/product-design-browser-acceptance/361542b9171dd0f7d15d4b55992bcf025f76a3c3/`
- AOS checkpoint under review: `361542b9171dd0f7d15d4b55992bcf025f76a3c3` (`docs: repair AOS Slice 9 proof evidence`)
- Static target: `apps/web/static/operations-cockpit.html`
- Functional contract: `docs/operations-cockpit-functional-contract.md`
- Capture method: offline headless Chromium through Playwright `setContent(...)` from the committed static HTML source.
- Server/service posture: no dev server, static server, deployment, product runtime, live dispatch, persistent service, or remote/browser profile was started.
- Toolchain note: Playwright was imported from the existing local `TCRN-TMS` node_modules as a read-only renderer dependency source; no `TCRN-TMS` files were mutated.

This receipt packages current browser-rendered evidence for the committed static cockpit target so Talia/Product Design can make a later acceptance decision. Rowan does not claim Product Design UX/layout/visual/browser acceptance, browser acceptance closeout, deployment, release readiness, product acceptance, final MVP acceptance, docs publication/export, canonical promotion, live GitHub write/release/CI mutation, live dispatch, scanner/materialization, product-repo writes, Selene closeout, or public/legal readiness.

## Retained Artifacts

| Artifact | Purpose | SHA-256 |
| --- | --- | --- |
| `evidence/product-design-browser-acceptance/361542b9171dd0f7d15d4b55992bcf025f76a3c3/desktop-1440x900-fullpage.png` | Desktop full-page visual evidence | `6796c12cde1f114cfac54ac5339d0c00e11d391ba52b9106448281624a7b2dca` |
| `evidence/product-design-browser-acceptance/361542b9171dd0f7d15d4b55992bcf025f76a3c3/desktop-1440x900-viewport.png` | Desktop first-viewport visual evidence | `64e8150139d9f9319f559089b56616df2d1037e564bd0ac9a12d6e18dc2f123f` |
| `evidence/product-design-browser-acceptance/361542b9171dd0f7d15d4b55992bcf025f76a3c3/desktop-1440x900-filter-empty.png` | Work-index no-match filter state | `97bd07b8df5eb2069377b78b49f51f499771122f4b8e25405938fe75f3fa6896` |
| `evidence/product-design-browser-acceptance/361542b9171dd0f7d15d4b55992bcf025f76a3c3/desktop-1440x900-filter-restored-detail.png` | Work-index restored state and detail drawer evidence | `009439e19cfab6e569f9bc2d64449749e8f02b599dadcff99520d846e03b27d7` |
| `evidence/product-design-browser-acceptance/361542b9171dd0f7d15d4b55992bcf025f76a3c3/mobile-390x844-fullpage.png` | Mobile full-page visual evidence | `a70da2b9fbfdc81219393ccef8cb2e80c2266bb5334dcc7d333cdd093b7ec150` |
| `evidence/product-design-browser-acceptance/361542b9171dd0f7d15d4b55992bcf025f76a3c3/mobile-390x844-viewport.png` | Mobile first-viewport visual evidence | `1659d2f07760ec296ef15a5480a400a5bd9200fd50ba5cce9c93d9c1eec43d49` |
| `evidence/product-design-browser-acceptance/361542b9171dd0f7d15d4b55992bcf025f76a3c3/mobile-390x844-work-index-scrolled.png` | Mobile work-index horizontal scroll/readability evidence | `67d1d176fe98aa0bced9e1915fe0d53d99d7ea7455cb3b6bcabc26a9778ad43f` |
| `evidence/product-design-browser-acceptance/361542b9171dd0f7d15d4b55992bcf025f76a3c3/browser-evidence-summary.json` | Machine-readable DOM, interaction, focus, and no-overclaim readbacks | `e9310a5de0d3257dff419df46e49345c970ee2ab82898185f3462c90d3ac3acd` |

## Browser Readbacks

| Check | Observed result |
| --- | --- |
| Page title | `TCRN AOS Operations Cockpit` |
| Console warnings/errors | `0` |
| Page errors | `0` |
| Desktop viewport | `1440 x 900` |
| Mobile viewport | `390 x 844` |
| Desktop required regions visible | `9 / 9` |
| Mobile required regions visible | `9 / 9` |
| Desktop body horizontal overflow | `false` |
| Mobile body horizontal overflow | `false` |
| Product Design acceptance attribute | `not_claimed` |
| Claim strip | `external_proof_required not_claimed live dispatch false` |
| Positive overclaim hits | `0` desktop, `0` mobile |

Required visible regions:

- brand lockup
- project selector
- stage map
- AI employee phase
- blocker/gate card
- readback posture card
- work index
- detail drawer
- conference operating loop

## Interaction And Focus Evidence

| Check | Observed result |
| --- | --- |
| Work-index search input count | `1` |
| Filter `zzz-no-match` | visible rows `0` |
| Filter restored with `cockpit` | visible rows `1` |
| Work row count | `1` |
| Detail drawer visibility after row click | `true` |
| Mobile work-index horizontal scroll | before `scrollLeft=0`, after `scrollLeft=456`, `clientWidth=364`, `scrollWidth=820` |

Keyboard/focus sampling reached the brand link, primary cockpit navigation buttons, project selector, readback refresh, profile button, stage-detail button, and role-detail button in sequence. The focus sample is retained in `browser-evidence-summary.json`.

## Visual And Layout Notes

- Desktop and mobile evidence show the target is browser-rendered and not blank.
- Desktop stage-map labels are tight; the machine readback flags text overflow suspects inside the stage-line area. The retained desktop screenshot should be reviewed by Talia/Product Design before any final UX/layout/visual acceptance decision.
- Mobile body-level horizontal overflow is `false`. The work-index table is horizontally scrollable by design/readback (`scrollWidth=820`, `clientWidth=364`), and the scrolled mobile artifact is retained so Talia can inspect the right-side columns.
- The current static cockpit target does not visibly expose Slice 9 docs/search/release-candidate local-readiness surfaces. Treat this as current-target scope evidence, not final-target confirmation.

## Final-Target Disposition

The retained evidence supports review of the current committed static cockpit checkpoint target only. It does not confirm that this cockpit is the final Product Design target, does not replace Talia/Product Design acceptance, and does not answer the owner final-target confirmation question.

## Boundaries

No Product Design final UX/layout/visual/browser acceptance is claimed by this receipt. No browser acceptance closeout, deployment, release readiness, product acceptance, final MVP acceptance, docs publication/export, canonical knowledge promotion, GitHub write/release/CI mutation, live dispatch, scanner ingestion/materialization, product-repo write, Selene closeout, or public/legal readiness is claimed.
