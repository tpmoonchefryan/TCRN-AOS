# Product Design Browser Evidence Proof

## Receipt

Status: recaptured for Rowan/Talia cockpit-only review; not Product Design final acceptance.

- Evidence package: `evidence/product-design-browser-acceptance/330da15b666ea0cc0b5dcfee1197e1136557b824/`
- AOS implementation checkpoint under review: `330da15b666ea0cc0b5dcfee1197e1136557b824` (`fix: hide filtered cockpit work rows`)
- Previous browser-evidence package basis: `f0bdf49a1194e6bb9d16714d350684c86693d1fb` (`docs: record AOS product design browser evidence`)
- Static target: `apps/web/static/operations-cockpit.html`
- Functional contract: `docs/operations-cockpit-functional-contract.md`
- Capture method: offline headless Chromium through Playwright `setContent(...)` from the committed static HTML source.
- Server/service posture: no dev server, static server, deployment, product runtime, live dispatch, persistent service, or remote/browser profile was started.
- Toolchain note: Playwright was imported from the existing local `TCRN-TMS` node_modules as a read-only renderer dependency source; no `TCRN-TMS` files were mutated.

This receipt recaptures browser-rendered evidence for the committed static cockpit target after the no-match filter repair. The evidence successor commit is route-carried by the handoff return and is not self-referenced here.

## Retained Artifacts

| Artifact | Purpose | SHA-256 |
| --- | --- | --- |
| `evidence/product-design-browser-acceptance/330da15b666ea0cc0b5dcfee1197e1136557b824/desktop-1440x900-fullpage.png` | Desktop full-page visual evidence | `6796c12cde1f114cfac54ac5339d0c00e11d391ba52b9106448281624a7b2dca` |
| `evidence/product-design-browser-acceptance/330da15b666ea0cc0b5dcfee1197e1136557b824/desktop-1440x900-viewport.png` | Desktop first-viewport visual evidence | `64e8150139d9f9319f559089b56616df2d1037e564bd0ac9a12d6e18dc2f123f` |
| `evidence/product-design-browser-acceptance/330da15b666ea0cc0b5dcfee1197e1136557b824/desktop-1440x900-filter-empty.png` | Work-index no-match filter state after repair | `74246e0979981be784d1a1402d2eeea70fddb02b315ac3b70cad79fb4b3c827c` |
| `evidence/product-design-browser-acceptance/330da15b666ea0cc0b5dcfee1197e1136557b824/desktop-1440x900-filter-restored-detail.png` | Work-index restored state and detail drawer evidence | `009439e19cfab6e569f9bc2d64449749e8f02b599dadcff99520d846e03b27d7` |
| `evidence/product-design-browser-acceptance/330da15b666ea0cc0b5dcfee1197e1136557b824/mobile-390x844-fullpage.png` | Mobile full-page visual evidence | `a70da2b9fbfdc81219393ccef8cb2e80c2266bb5334dcc7d333cdd093b7ec150` |
| `evidence/product-design-browser-acceptance/330da15b666ea0cc0b5dcfee1197e1136557b824/mobile-390x844-viewport.png` | Mobile first-viewport visual evidence | `1659d2f07760ec296ef15a5480a400a5bd9200fd50ba5cce9c93d9c1eec43d49` |
| `evidence/product-design-browser-acceptance/330da15b666ea0cc0b5dcfee1197e1136557b824/mobile-390x844-work-index-scrolled.png` | Mobile work-index horizontal scroll/readability evidence | `1659d2f07760ec296ef15a5480a400a5bd9200fd50ba5cce9c93d9c1eec43d49` |
| `evidence/product-design-browser-acceptance/330da15b666ea0cc0b5dcfee1197e1136557b824/browser-evidence-summary.json` | Machine-readable DOM, interaction, focus, and no-overclaim readbacks | `a769a89940134f3ba726ab42539e1e6d0953f27d45337f9169fc07452b4ea3f5` |

## Browser Readbacks

| Check | Observed result |
| --- | --- |
| Page title | `TCRN AOS Operations Cockpit` |
| Console warnings/errors | `0` |
| Page errors | `0` |
| Page URL | `about:blank` |
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

## Filter Repair Evidence

| Check | Observed result |
| --- | --- |
| Baseline defect | Rowan/route readback reproduced `hidden=true`, `display=grid`, nonzero row geometry, and one visible work row for `zzz-no-match` before this repair. |
| Repair rule | `.table-row[hidden] { display: none !important; }` is present in source render CSS and committed static HTML. |
| Filter `zzz-no-match` | visible rows `0` |
| Hidden row DOM state | `hidden=true`, `hasHiddenAttribute=true`, `display=none`, `offsetParentNull=true`, `rect.width=0`, `rect.height=0` |
| Screenshot agreement | `desktop-1440x900-filter-empty.png` retains the empty work-index table with no visible work row. |
| Filter restored with `cockpit` | visible rows `1` |
| Work row count | `1` |
| Detail drawer visibility after row click | `true` |
| Mobile work-index horizontal scroll | before `scrollLeft=0`, after `scrollLeft=456`, `clientWidth=364`, `scrollWidth=820` |

Keyboard/focus sampling reached the brand link, primary cockpit navigation buttons, project selector, readback refresh, profile button, stage-detail button, and role-detail button in sequence. The focus sample is retained in `browser-evidence-summary.json`.

## Visual And Layout Notes

- Desktop and mobile evidence show the target is browser-rendered and not blank.
- Desktop stage-map labels remain tight; the machine readback still flags text overflow suspects inside the stage-line area. This remains advisory for Talia/Product Design and is not part of the no-match filter blocker.
- Mobile body-level horizontal overflow is `false`. The work-index table is horizontally scrollable by design/readback (`scrollWidth=820`, `clientWidth=364`), and the scrolled mobile artifact is retained.
- The current static cockpit target intentionally does not include Slice 9 docs/search/release-candidate local-readiness surfaces. Mara accepted that those are not required for this cockpit-only Product Design/browser gate.

## Final-Target Disposition

Mara accepted `apps/web/static/operations-cockpit.html` as the intended final target for this narrow Operations Cockpit static/browser gate only. This receipt supports Rowan/Talia re-review of that target after the no-match filter repair. It does not broaden into AOS-wide Product Design acceptance, product acceptance, final MVP acceptance, deployment, release readiness, publication, public readiness, docs export, or canonical promotion.

## Boundaries

No Product Design final UX/layout/visual/browser acceptance is claimed by this receipt. No browser acceptance closeout, deployment, release readiness, product acceptance, final MVP acceptance, docs publication/export, canonical knowledge promotion, GitHub write/release/CI mutation, live dispatch, scanner ingestion/materialization, product-repo write, Selene closeout, or public/legal readiness is claimed.
