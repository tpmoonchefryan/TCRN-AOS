/**
 * The consumer-style boundary, as an executable predicate.
 *
 * Ruled in TCRN-AOS-MIN-005 after the strict no-local-classes assertion spent two
 * days red without anyone seeing it: a consumer MAY hold purely structural layout
 * classes in its own namespace, with values taken from DS tokens; anything that
 * paints must sit in a closed, per-family ledger naming the DS export it is
 * waiting on and the date the entry dies. The scan face is the whole
 * `createDocumentCss` template — measured 124 rules of which only 89 carried the
 * `tcrn-aos-` prefix, and the unprefixed remainder held exactly the literals the
 * DS contract names — so a prefix-scoped gate would have been green precisely
 * where it most needed to be red.
 *
 * Three checks per rule, none of which reads the built artifact:
 *   1. namespace — every class token in every selector starts with `tcrn-aos-`;
 *   2. declaration discipline — each declaration's property is structural, or its
 *      value is a DS token reference, or it is one of the named inert keywords;
 *      grid track minimums and at-rule breakpoint conditions are the two ruled
 *      bare-value allowances;
 *   3. paint containment — a class-bearing rule with any non-structural property
 *      makes its family paint-carrying, and the set of paint-carrying families
 *      must equal the ledger exactly, in both directions: an unledgered family is
 *      new paint, and a ledgered family with no paint left is an entry that must
 *      be retired rather than squatted on.
 *
 * Source-position scanning is also what keeps this gate honest about data: a
 * chain record whose prose mentions a class name never enters a CSS template, so
 * the false positive class recorded in TCRN-AOS-INC-012 (a minutes sentence read
 * as a demo-surface leak) cannot recur here.
 */

const STRUCTURAL_PROPERTIES = new Set([
  "display", "position", "inset", "top", "right", "bottom", "left", "z-index",
  "order", "isolation",
  "grid-template-columns", "grid-template-rows", "grid-template-areas",
  "grid-area", "grid-column", "grid-row", "grid-auto-flow", "grid-auto-rows",
  "grid-auto-columns", "gap", "row-gap", "column-gap",
  "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
  "align-items", "align-content", "align-self",
  "justify-content", "justify-items", "justify-self",
  "place-items", "place-content", "place-self",
  "width", "min-width", "max-width", "height", "min-height", "max-height",
  "inline-size", "min-inline-size", "max-inline-size",
  "block-size", "min-block-size", "max-block-size",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "margin-inline", "margin-block", "margin-inline-start", "margin-inline-end",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "padding-inline", "padding-block", "padding-inline-start", "padding-inline-end",
  "overflow", "overflow-x", "overflow-y", "overflow-wrap", "word-break",
  "white-space", "text-overflow", "text-align", "vertical-align",
  "box-sizing", "aspect-ratio", "object-fit", "visibility",
  "container", "container-type", "container-name", "contain",
  "list-style", "cursor", "pointer-events", "float", "clear", "columns",
  "appearance", "resize", "scrollbar-gutter",
  "inset-inline-start", "inset-inline-end", "inset-block-start", "inset-block-end",
  "inset-inline", "inset-block",
  // The screen-reader-only idiom is geometry, not paint.
  "clip", "clip-path"
]);

/**
 * Properties whose only expressible values are keywords — there is no DS token
 * to reference because there is nothing scalar to tokenize. They still count as
 * paint for ledger purposes when they sit on a class.
 */
const KEYWORD_PROPERTIES = new Set(["color-scheme", "text-transform", "font-variant-numeric", "font-style"]);

/** Values that state an absence rather than a look. */
const INERT_VALUES = new Set(["none", "0", "auto", "inherit", "initial", "unset", "transparent", "currentcolor", "\"\"", "''"]);

export function extractDocumentCss(appSource) {
  const marker = appSource.indexOf("function createDocumentCss");
  if (marker < 0) throw new Error("createDocumentCss not found in app source");
  const start = appSource.indexOf("`", marker);
  let index = start + 1;
  let css = "";
  while (index < appSource.length) {
    const char = appSource[index];
    if (char === "\\") { css += appSource.slice(index, index + 2); index += 2; continue; }
    if (char === "`") break;
    if (char === "$" && appSource[index + 1] === "{") {
      // An interpolation is a value the template computes; for the audit its
      // exact text does not matter, only that it is not a bare literal.
      let depth = 1;
      index += 2;
      while (index < appSource.length && depth > 0) {
        if (appSource[index] === "{") depth += 1;
        if (appSource[index] === "}") depth -= 1;
        index += 1;
      }
      css += "var(--tcrn-interpolated)";
      continue;
    }
    css += char;
    index += 1;
  }
  return css;
}

export function parseCssRules(css) {
  const rules = [];
  const atStack = [];
  let buffer = "";
  let index = 0;
  while (index < css.length) {
    const char = css[index];
    if (char === "/" && css[index + 1] === "*") {
      const end = css.indexOf("*/", index + 2);
      index = end < 0 ? css.length : end + 2;
      continue;
    }
    if (char === "{") {
      const head = buffer.trim();
      buffer = "";
      index += 1;
      if (head.startsWith("@")) { atStack.push(head); continue; }
      let declarations = "";
      while (index < css.length && css[index] !== "}") {
        if (css[index] === "/" && css[index + 1] === "*") {
          const end = css.indexOf("*/", index + 2);
          index = end < 0 ? css.length : end + 2;
          continue;
        }
        declarations += css[index];
        index += 1;
      }
      index += 1;
      rules.push({ selector: head.replace(/\s+/g, " "), declarations, at: [...atStack] });
      continue;
    }
    if (char === "}") { atStack.pop(); buffer = ""; index += 1; continue; }
    // A statement at-rule ends at a semicolon and never opens a block:
    // `@layer base;`, `@import`, `@charset`, `@namespace`. Without this the
    // text stayed in the buffer, was concatenated with the NEXT selector, and
    // the combined head started with `@` — so the parser pushed it as an
    // at-rule and swallowed that rule's declarations whole. One legal CSS
    // statement placed above a rule was enough to make the rule invisible to
    // all three checks, which is a gate with a documented way around it.
    if (char === ";" && buffer.trim().startsWith("@")) { buffer = ""; index += 1; continue; }
    buffer += char;
    index += 1;
  }
  return rules;
}

export function classTokensOf(selector) {
  // A class inside :has()/:not()/:is()/:where() is a structural query — "does
  // this element contain that" — not a styling target, so a DS class there is
  // composition rather than override. Only what is being styled must sit in
  // the aos namespace.
  const styledOnly = selector.replace(/:(?:has|not|is|where)\([^)]*\)/g, "");
  return [...styledOnly.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map((match) => match[1]);
}

export function familyOf(classToken) {
  return classToken.split("__")[0].split("--")[0];
}

export function auditConsumerDocumentCss(appSource, ledgerFamilies) {
  const findings = [];
  const paintFamilies = new Set();
  const rules = parseCssRules(extractDocumentCss(appSource));

  for (const rule of rules) {
    const classTokens = classTokensOf(rule.selector);
    for (const token of classTokens) {
      if (!token.startsWith("tcrn-aos-")) {
        findings.push(`selector reaches outside the aos namespace: .${token} in "${rule.selector}"`);
      }
    }
    const families = new Set(classTokens.filter((token) => token.startsWith("tcrn-aos-")).map(familyOf));

    for (const declaration of rule.declarations.split(";")) {
      const trimmed = declaration.trim();
      if (!trimmed) continue;
      const colon = trimmed.indexOf(":");
      if (colon < 0) continue;
      const property = trimmed.slice(0, colon).trim().toLowerCase();
      const value = trimmed.slice(colon + 1).trim().toLowerCase();
      const structural = STRUCTURAL_PROPERTIES.has(property);
      const tokenValued = value.includes("var(--tcrn-");
      const inert = INERT_VALUES.has(value);
      const keywordOnly = KEYWORD_PROPERTIES.has(property);
      if (!structural && !tokenValued && !inert && !keywordOnly) {
        findings.push(`bare non-token declaration: "${property}: ${value}" in "${rule.selector}"`);
      }
      // An inert value states an absence (border: 0, text-decoration: none);
      // a family is paint-carrying only when something actually shows.
      if (!structural && !inert && classTokens.length > 0) {
        for (const family of families) paintFamilies.add(family);
      }
    }
  }

  const ledger = new Set(ledgerFamilies);
  for (const family of paintFamilies) {
    if (!ledger.has(family)) {
      findings.push(`paint-carrying family not in ledger: ${family}`);
    }
  }
  for (const family of ledger) {
    if (!paintFamilies.has(family)) {
      findings.push(`ledger entry with no remaining paint (retire it): ${family}`);
    }
  }

  return { findings, paintFamilies: [...paintFamilies].sort(), ruleCount: rules.length };
}
