/**
 * The closed ledger of paint-carrying consumer style families.
 *
 * Ruled in TCRN-AOS-MIN-005: a consumer class that paints — background, border,
 * type, anything visible — is either consumption of an admitted DS export or an
 * entry here, and this list is exact in both directions. One more family than
 * the ledger is new unruled paint and the gate goes red; one fewer is a debt
 * repaid, and the entry must be retired rather than squatted on. No blanket
 * exemption exists: that would turn a byte-decidable gate back into an
 * intent-reading one, which is the shape that let two days of red go unseen.
 *
 * Every entry answers three questions: which DS export would replace it, what
 * capability that export is missing today, and when the entry dies. "aos-domain"
 * means the Design System has no concept for this surface (deliberation-room
 * furniture, chain-record chrome) and forcing one in would make DS a downstream
 * of one product's vocabulary — the review date is when that judgement is
 * re-examined, not a licence to forget it.
 */
export const consumerPaintLedger = [
  { family: "tcrn-aos-applied", dsTarget: "Badge", missing: "applied-filter chip row idiom", sunset: "2026-08-15" },
  { family: "tcrn-aos-board", dsTarget: "WorkBoard/WorkBoardCard", missing: "chain-status to CopyStateInput mapping; href landed 2026-07-28", sunset: "2026-08-15" },
  { family: "tcrn-aos-bubble", dsTarget: "aos-domain (deliberation position bubble)", missing: "no DS concept", sunset: "2026-08-15" },
  { family: "tcrn-aos-chip", dsTarget: "TableToolbar chip geometry", missing: "chip not exported standalone", sunset: "2026-08-15" },
  { family: "tcrn-aos-comments", dsTarget: "aos-domain (domain-panel comment list)", missing: "no DS concept", sunset: "2026-08-15" },
  { family: "tcrn-aos-conference-row", dsTarget: "aos-domain (deliberation index row)", missing: "no DS concept", sunset: "2026-08-15" },
  { family: "tcrn-aos-count", dsTarget: "Badge", missing: "tabular-numeral count variant", sunset: "2026-08-15" },
  { family: "tcrn-aos-decisions", dsTarget: "aos-domain (minutes decision list)", missing: "no DS concept", sunset: "2026-08-15" },
  { family: "tcrn-aos-domain-edit", dsTarget: "Form field group", missing: "labelled field-stack idiom", sunset: "2026-08-15" },
  { family: "tcrn-aos-environment", dsTarget: "InlineAlert", missing: "environment banner tone", sunset: "2026-08-15" },
  { family: "tcrn-aos-menu", dsTarget: "SearchableList trigger", missing: "menu trigger not exported standalone", sunset: "2026-08-15" },
  { family: "tcrn-aos-phase3-readback", dsTarget: "aos-domain (phase-3 dogfood readback page)", missing: "predates cockpit; retire with the page", sunset: "2026-08-15" },
  { family: "tcrn-aos-picker-row", dsTarget: "WorkItemRow", missing: "row-as-link with selection state", sunset: "2026-08-15" },
  { family: "tcrn-aos-preview", dsTarget: "DetailInspector", missing: "inline preview pane idiom", sunset: "2026-08-15" },
  { family: "tcrn-aos-project-card", dsTarget: "Surface", missing: "card-as-link affordance", sunset: "2026-08-15" },
  { family: "tcrn-aos-reset", dsTarget: "Button", missing: "quiet reset-link variant", sunset: "2026-08-15" },
  { family: "tcrn-aos-round", dsTarget: "aos-domain (deliberation round group)", missing: "no DS concept", sunset: "2026-08-15" },
  { family: "tcrn-aos-scope", dsTarget: "SearchableList panel", missing: "anchored scope-picker popover", sunset: "2026-08-15" },
  { family: "tcrn-aos-searchbar", dsTarget: "SearchInput", missing: "note-affordance beside the field; fill landed 2026-07-28", sunset: "2026-08-15" },
  { family: "tcrn-aos-stat", dsTarget: "aos-domain (cockpit stat tile)", missing: "no DS stat-tile export", sunset: "2026-08-15" },
  { family: "tcrn-aos-toolbar", dsTarget: "TableToolbar", missing: "toolbar accepts only table children", sunset: "2026-08-15" }
];

export const consumerPaintLedgerFamilies = consumerPaintLedger.map((entry) => entry.family);
