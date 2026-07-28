// Usability proof — TCRN-AOS-STORY-106.
//
// Every other gate in this repository asks the same kind of question: does this
// route return 200, and is this named marker present in the bytes? Seventeen
// gates, sixty-plus marker assertions, and all of them were green on the day the
// Owner opened the app and found six defects in one sitting. None of them was a
// false green in the usual sense — each one truthfully reported what it read. The
// gap is what none of them reads: whether the page can be *used*.
//
// So this gate asserts usability invariants, not presence:
//   A. every offered locale is actually served (offering a locale the copy layer
//      cannot answer is worse than omitting it — the control claims a capability
//      the bytes do not have)
//   B. a page's own links preserve the state that produced the page (otherwise
//      every filter is a one-shot: you can set it, you cannot keep it)
//   C. a page reachable only by drilling down offers a way back that is not the
//      browser chrome
//   D. an identifier rendered on screen is traversable, not a string to go hunt
//   E. a module whose whole job is finding things has something to find with
//
// Scope note, in the house phrase: a gate only protects the bytes it reads. This
// reads the real service over HTTP on the real route table. A defect on a surface
// not listed here is still invisible to it — but unlike the marker gates, adding
// a route here does not require inventing a new marker to assert.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { tcrnDefaultLocale, tcrnSupportedLocales } from "@tcrn/ui-copy-state";
import { frontendShellRoutes, localeCopy, recordAddressableModulePaths } from "../dist/apps/web/src/data.js";
import { coversAllLocales } from "../dist/apps/web/src/copy.js";
import { cockpitData } from "../dist/apps/web/src/cockpit-data.generated.js";
import { startAosLocalServiceProof } from "../dist/apps/api/src/server.js";

const findings = [];
const checks = [];

// Named product chrome that must localize. Every entry was observed rendering in
// English on a non-English route, and each traces to a specific source:
//   - DS RelationshipChip hardcodes twelve English relationship labels with no
//     locale parameter (DataDisplay.tsx:510) — filed as the DS half of item 1
//   - AOS enum/badge labels written as English literals with no dictionary entry
//   - AOS skip-link and shell affordances
// Naming them rather than thresholding means a green here states something exact:
// none of these phrases reached the user untranslated.
const productChromeVocabulary = [
  "Skip to operations content",
  "blocks",
  "blocked by",
  "depends on",
  "relates to",
  "duplicates",
  "supersedes",
  "implements",
  "verifies",
  "reviews",
  "refreshes",
  "Review required",
  "Owner acceptance",
  "Release readiness",
  "not claimed",
  "Next action",
  "Static proof required",
  "Post-consumption clean-room re-review required"
];

// Declared here rather than beside statusOf: function declarations hoist, `const`
// does not, so a cache declared next to its function is in the temporal dead zone
// when an earlier check calls it.
const statusCache = new Map();

// Same reason as statusCache: module-level `const` used by a hoisted function has
// to be declared before the first call, not beside the function.
const localeMenuNames = new Set(["简体中文", "English", "日本語", "한국어", "Français"]);

/**
 * The DS regions whose links are filter controls rather than navigation.
 *
 * Same declaration rule as statusCache above: consumed by check B, so it has to be
 * declared before the first call rather than beside the helper that reads it.
 *
 * Named rather than derived, and that is the honest description — DS does not declare
 * anywhere that "these patterns are filter surfaces", so this is this gate's reading of
 * two DS pattern names. What keeps a named list from rotting is that the names are
 * checked against the DS source: a rename there empties the exemption, every filter
 * control reads as a scope drop, and check B goes red on working code. Better to assert
 * the names exist and fail loudly at the assertion than to have the exemption quietly
 * stop matching.
 *
 * Three regions, all three verified against the served markup rather than assumed:
 * `subnav` (`<nav class="tcrn-work-management-subnav">`) is where /work-items actually
 * renders its saved views and status chips — I had guessed `searchable-list` and the
 * gate corrected me; `searchable-list` is the surrounding facet list; and
 * `saved-view-toolbar` is the standalone toolbar DS also ships, which no route currently
 * uses but which a future view might.
 *
 * The fourth is not a DS region: `cockpit-clear` stands for AOS's own
 * `data-cockpit-clear` attribute, which the deliberation search-clear carries. That
 * control renders in unmarked chrome, so region reading had nothing to go on — but the
 * app states the intent on the element itself, and an explicit "this is a clear control"
 * is better evidence than any enclosure. Reading the app's declaration is the same
 * principle as deriving the probe sets from `recordAddressableModulePaths` instead of
 * restating them.
 *
 * `work-item-row` is deliberately absent, and that absence is the whole exemption: it is
 * where the reported defect lives, so a link inside a row is never exempt no matter what
 * its query looks like. `machine-token-cell` is absent for the same reason.
 */
const filterRegions = new Set(["searchable-list", "saved-view-toolbar", "subnav", "cockpit-clear"]);

// Fourth instance of the declaration rule above, and the reason it keeps recurring is
// that every one of these is read by a hoisted function called from the checks.
const voidElements = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "source", "track", "wbr"
]);

function record(id, ok, detail) {
  checks.push({ id, ok, detail });
  if (!ok) findings.push({ id, detail });
}

const service = await startAosLocalServiceProof();

try {
  // ── A. every offered locale is served ────────────────────────────────────────
  //
  // The shell's locale menu is driven by tcrnLocaleMetadata, so AOS offers all
  // five locales DS declares. The copy layer must be able to answer all five.
  // Measured two ways: the dictionary's own key coverage, and the rendered page.
  const englishKeys = Object.keys(localeCopy.en);
  for (const locale of tcrnSupportedLocales) {
    const keys = Object.keys(localeCopy[locale] ?? {});
    const missing = englishKeys.filter((key) => !(key in (localeCopy[locale] ?? {})));
    record(
      `locale-dictionary-complete:${locale}`,
      missing.length === 0,
      `${keys.length}/${englishKeys.length} keys present; ${missing.length} missing` +
        (missing.length ? ` (first: ${missing.slice(0, 6).join(" ")})` : "")
    );
  }

  // `localeCopy` is locale-major, so the check above can only see whether a key
  // exists. A key present with an empty string passes it and renders as nothing.
  // Transposing to one entry per key is the runtime-assembled dictionary case the
  // compile-time `CopyEntry` guarantee cannot reach, which is what `coversAllLocales`
  // is for — so it is called here rather than reimplemented.
  const hollow = englishKeys.filter((key) => !coversAllLocales(
    Object.fromEntries(tcrnSupportedLocales.map((locale) => [locale, localeCopy[locale]?.[key]]))
  ));
  record(
    "locale-dictionary-non-empty",
    hollow.length === 0,
    `${englishKeys.length - hollow.length}/${englishKeys.length} keys carry a non-empty string in all ` +
      `${tcrnSupportedLocales.length} locales` + (hollow.length ? ` (first hollow: ${hollow.slice(0, 6).join(" ")})` : "")
  );

  // Rendered form: a non-English locale must not come back byte-identical to
  // English. Identical bytes mean the locale was offered and then ignored.
  //
  // Routes are taken from the real table, not guessed — but being in the table was
  // not enough. This probe first named `/conference`, on the reasoning that it was
  // the deliberation module; it was in `frontendShellRoutes` and answered 200, so
  // the probe ran and passed. It was a fallthrough to the cockpit (TCRN-AOS-INC-021),
  // which means one of the four locale probes was measuring /cockpit twice. The
  // deliberation module is `/deliberations`. A route table says a path is admitted,
  // not that it renders anything of its own.
  const localeProbeRoutes = ["/cockpit", "/work", "/deliberations", "/work/gates"];
  for (const route of localeProbeRoutes) {
    const english = await fetchText(`${route}?locale=en&theme=light`);
    for (const locale of tcrnSupportedLocales) {
      if (locale === "en") continue;
      const localized = await fetchText(`${route}?locale=${locale}&theme=light`);
      // Compare visible text runs, not bytes. Comparing bytes was a false green:
      // data-visual-instance-locale="ja" changes with the locale even when no copy
      // does, so "the bytes differ" was true for a page that translated nothing.
      // A ratio cannot express this judgement, so it is not used. On /work at
      // zh-CN, 24 of 53 chrome runs match English — 45% — and inspecting all 24
      // shows they are three different things: the product name (correct in every
      // locale), fixture domain data (the tenant's content, not the product's
      // vocabulary), and eight genuine leaks. Any threshold that reds ja/ko at
      // 82/82 also reds zh-CN, whose copy is translated. So the check names the
      // chrome vocabulary that must localize and asserts on those strings.
      const leaked = productChromeVocabulary.filter((phrase) =>
        localized.includes(`>${phrase}<`) || localized.includes(`>${phrase} <`));
      record(
        `locale-served:${locale}:${route}`,
        leaked.length === 0,
        leaked.length
          ? `${leaked.length} English chrome phrase(s) render unlocalized: ${JSON.stringify(leaked.slice(0, 8))}`
          : "no named chrome phrase renders in English"
      );
    }
  }

  // ── B. a page's links preserve the state that produced the page ──────────────
  //
  // Not "does project survive" — every query key the app reads must survive,
  // because the app reads fifteen and writes back three. Keys are taken from the
  // app's own reads so the gate cannot drift out of step with the code.
  // TCRN-AOS-STORY-102. The first four probes were `/work` and `/work/board`, which
  // are static mockups, plus `/deliberations`. The Owner met this defect on the
  // module routes — a project filter on the work list, then a click that dropped
  // back to all projects — and three of the four routes that carry a project filter
  // were not probed. Same lesson as checks C and D: the invariant was right and it
  // was measured where it was not at risk.
  //
  // `q` is included because the deliberation search is a scope too. A reader who
  // searched, then opened a result, then came back to a cleared box has lost the
  // same thing as one whose project selection reset.
  const statefulProbes = [
    { route: "/work", key: "project", value: "TCRN-TMS" },
    { route: "/work", key: "status", value: "active" },
    { route: "/deliberations", key: "project", value: "TCRN-TMS" },
    { route: "/work/board", key: "project", value: "TCRN-TMS" },
    { route: "/work-items", key: "project", value: "TCRN-TMS" },
    { route: "/work-items", key: "status", value: "active" },
    { route: "/inbox", key: "project", value: "TCRN-TMS" },
    { route: "/audit", key: "project", value: "TCRN-TMS" },
    { route: "/my-work", key: "project", value: "TCRN-TMS" },
    { route: "/deliberations", key: "q", value: "gate" }
  ];
  for (const probe of statefulProbes) {
    const url = `${probe.route}?locale=en&theme=light&${probe.key}=${probe.value}`;
    const html = await fetchText(url);
    // Every link with the region it is rendered in, because the exemption below turns
    // on *where* a link sits and not on what its query looks like.
    const links = [...html.matchAll(/<a\s(?:"[^"]*"|'[^']*'|[^>"'])*?href="([^"]*)"(?:"[^"]*"|'[^']*'|[^>"'])*>/g)]
      .map((match) => ({
        href: decodeHtml(match[1]),
        region: /data-cockpit-clear="/.test(match[0])
          ? "cockpit-clear"
          : enclosingRegion(html, match.index)
      }))
      .filter((link) => link.href.startsWith("/") && !link.href.startsWith("/assets/"));
    const hrefs = links.map((link) => link.href);
    // The control that *sets* this scope is exempt, and it has to be: a status chip
    // reading "blocked" whose href carried `status=active` forward would be a chip
    // that cannot be clicked, and a clear-all that preserved what it clears would not
    // clear anything. Widening the probe set surfaced nine such links — eight saved
    // views and two clear controls — and every one of them is this exemption, not a
    // defect. The invariant is "a link that navigates keeps the reader's scope", and a
    // filter control does not navigate: it *is* the scope.
    //
    // The exemption is the risky half of this fix, because a rule saying "some links
    // need not carry the scope" fails by swallowing the defect it was carved around.
    // My first attempt keyed on the shape of the query — same route, plus either a
    // different value for the key or no filter at all — and mutation testing killed it:
    // re-pointing the work-item row links at `/work-items?project=` left the gate green,
    // because a row link that lost its scope and a clear-all control are the same bytes.
    // A predicate reading only the URL cannot tell them apart, and one that tries will
    // always resolve the ambiguity in favour of passing.
    //
    // So the exemption keys on region instead. DS marks its work-management regions in
    // the served markup — `data-work-management-pattern="searchable-list"` around the
    // facet and saved-view controls, `"work-item-row"` around a row — and that is a
    // structural fact about where the reader is clicking, not a guess about intent. A
    // link inside the filter region is a filter control; the identical href inside a row
    // is the reported defect. Both mutations now red, and they red with the region named,
    // so the failure says which surface broke.
    //
    // Still required alongside it: the link must stay on this route. A control that
    // navigates away is not setting this page's scope, whatever region it renders in.
    //
    // Known limit, stated because an exemption without its boundary written down reads
    // as broader than it is. What this check guarantees is: *no link outside a filter
    // region may drop the reader's scope.* It does not catch a filter control that has
    // silently become a clear-all — mutation-tested, stays green — because a chip that
    // sets nothing and a clear-all control are the same bytes, and no predicate over
    // served HTML can separate them. That case is visible in the saved-view counts and
    // `current` flags instead, which would disagree with the list on screen.
    const scopeControls = [];
    const preserved = [];
    const lost = [];
    for (const link of links) {
      if (link.href.includes(`${probe.key}=${probe.value}`)) { preserved.push(link.href); continue; }
      const target = new URL(link.href, "http://127.0.0.1");
      const setsThisScope = target.pathname === probe.route && filterRegions.has(link.region);
      (setsThisScope ? scopeControls : lost).push(`${link.href} [${link.region}]`);
    }
    record(
      `state-preserved:${probe.route}:${probe.key}`,
      hrefs.length > 0 && lost.length === 0,
      `${preserved.length}/${hrefs.length} in-page links carry ${probe.key}=${probe.value}` +
        (scopeControls.length ? `; ${scopeControls.length} are ${probe.key} controls (exempt)` : "") +
        (lost.length ? `; ${lost.length} lose it: ${lost.slice(0, 3).join(" ")}` : "")
    );
  }

  // The exemption above depends on two DS pattern names, and a rename there would not
  // break it loudly — it would empty it, every filter control would read as a scope
  // drop, and check B would fail on working code with a message pointing at the app.
  // So the names are asserted against the DS source that emits them. An exemption whose
  // key has silently stopped matching is the same class of defect as check C's two
  // invented marker names, caught one layer earlier.
  const dsPatternSource = readFileSync(
    new URL("../../TCRN-Design-System/packages/ui-react/src/components/DataDisplay/DataDisplay.tsx", import.meta.url),
    "utf8"
  );
  const emitted = new Set([...dsPatternSource.matchAll(/data-work-management-pattern="([^"]+)"/g)].map((m) => m[1]));
  // `cockpit-clear` is AOS's own attribute, not a DS pattern, so it is checked against
  // the app source that emits it. Both halves matter: the exemption spans two repos and
  // a rename on either side would empty it just as quietly.
  const viewSourceDir = new URL("../apps/web/src/", import.meta.url);
  const cockpitClearEmitted = readdirSync(viewSourceDir)
    .filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".d.ts") && !name.endsWith(".generated.ts"))
    .some((name) => /data-cockpit-clear=/.test(readFileSync(new URL(name, viewSourceDir), "utf8")));
  if (cockpitClearEmitted) emitted.add("cockpit-clear");
  const unknown = [...filterRegions].filter((region) => !emitted.has(region));
  record(
    "filter-region-names-exist-in-source",
    unknown.length === 0,
    unknown.length
      ? `check B exempts marker(s) nothing emits any more: ${unknown.join(" ")} — the exemption has gone stale`
      : `all ${filterRegions.size} exempted markers are emitted (${[...filterRegions].join(" ")})`
  );

  // ── C. a drilled-down page offers a way back ─────────────────────────────────
  //
  // "Back" means an in-page affordance: an ancestor link or an explicit back
  // control. The browser's own button does not count — it is not ours, it does
  // not survive a deep link, and it is what the Owner had to fall back on.
  // The nine detail-shaped entries in `frontendShellRoutes` are all static work
  // mockups. The two routes that a reader actually drills *into* — a work item and
  // a deliberation room — are addressed by record key, so they are not table
  // entries at all and this check never saw either of them. That is the same
  // blindness as check D's empty probe set, one level up: the invariant named the
  // right property and measured it only where the property was never at risk.
  //
  // `recordAddressableModulePaths` is the declaration the server already uses to
  // admit these paths, so the probe is derived from it rather than restated, and a
  // real key comes from the projection — an unknown key renders an empty state
  // with no ancestors to link, which would prove nothing about the trail.
  const recordDetailRoutes = recordAddressableModulePaths
    .map((module) => sampleRecordPath(module))
    .filter((route) => route !== null);
  const detailRoutes = [
    ...frontendShellRoutes.filter((route) => route.split("/").length > 2),
    ...recordDetailRoutes
  ];
  for (const route of detailRoutes) {
    const html = await fetchText(`${route}?locale=en&theme=light`);
    const ancestor = ancestorPaths(route);
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((match) => decodeHtml(match[1]));
    // On a record page the sidebar is not an escape route, and counting it as one is
    // the fourth way this check has managed to pass without asserting anything. The
    // module link labelled "Projects" points at `/work-items`, which is literally the
    // parent path of `/work-items/<key>` — so stripping every href out of the
    // breadcrumb left the check green, because the nav rail supplied the ancestor the
    // trail no longer did. It resolves 200, so the resolve-check cannot catch it
    // either. But a module link goes to the unfiltered list; it is where the reader
    // would land having lost the scope they arrived with, which is the difference
    // between navigating and starting again.
    //
    // So for the record routes the trail is the only accepted answer. The static
    // mockups keep the ancestor form: they have no record identity to preserve, and
    // their parent link is a genuine ancestor rather than a rail entry.
    const isRecordRoute = recordDetailRoutes.includes(route);
    const candidates = isRecordRoute
      ? []
      : hrefs.filter((href) => ancestor.includes(href.split("?")[0]));
    // A link is only a way back if it resolves. This was the gate's second false
    // green: the eleven sidebar module hrefs look like ancestor paths, so they were
    // all counted as escape routes — and all eleven answer 404. Proving "there is a
    // way back" with a dead link is exactly the kind of green this gate exists to
    // stop, so the target is fetched rather than pattern-matched.
    let liveAncestor = null;
    for (const candidate of candidates) {
      const status = await statusOf(candidate);
      if (status === 200) { liveAncestor = candidate; break; }
    }
    // The second disjunct asked for `data-back-affordance` or
    // `data-breadcrumb-navigable`, and neither string exists anywhere in this
    // repository or in the Design System — I invented two marker names when writing
    // this check and never made anything emit them. It was dead code that read as a
    // second line of defence, which is worse than having one: the first disjunct did
    // all the work and this one could only ever contribute a false green if some
    // unrelated page later happened to print the word.
    //
    // What a navigable trail actually looks like in the served bytes is the DS
    // breadcrumb with a linked crumb inside it — `Breadcrumb` renders `<a>` for a
    // crumb carrying an href and an inert `<span aria-current="page">` for the one
    // the reader is standing on. Asserting the anchor, not the nav, is the point: an
    // all-inert trail is exactly the decorative component INC-016 reported.
    const trail = /<nav class="tcrn-breadcrumb"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    const hasBackControl = Boolean(trail && /<a\s[^>]*href="/.test(trail[1]));
    record(
      `way-back:${route}`,
      Boolean(liveAncestor) || hasBackControl,
      liveAncestor
        ? `ancestor link ${liveAncestor.split("?")[0]} resolves 200`
        : hasBackControl
          ? "a linked crumb in the DS breadcrumb trail"
          : candidates.length
            ? `${candidates.length} ancestor-shaped link(s) present but none resolve 200`
            : trail
              ? "a breadcrumb trail is rendered but every crumb is inert"
              : isRecordRoute
                ? "a record page with no breadcrumb trail — the nav rail does not count here"
                : `no link to any of ${ancestor.join(" ")} and no breadcrumb trail`
    );
  }

  // ── D. a rendered identifier is traversable ──────────────────────────────────
  //
  // The Owner's words: it shows "minutes:4fdc3f1caf4adfb2374090f7" and the user
  // has to go find it. An id printed as text is a dead end; the page holding it
  // knows the route.
  // The three static work mockups were the whole probe list at first, and each of
  // them renders zero chain ids — their identifiers are hand-written keys like
  // `AOS-128`, not `minutes:<24 hex>`. So the check ran three times, found nothing to
  // measure, took the `unique.length === 0` branch, and recorded three passes while
  // three of the six files that render real chain ids were printing them as bare
  // text. An empty probe set is the quietest false green there is: it does not look
  // like a skip, it looks like a clean result. The five routes added here are the
  // ones whose ids come from the projection, which is where the Owner met the defect.
  // TCRN-AOS-STORY-103, rule ②. Two things were wrong with the hand-kept list below it.
  // Five of its eight routes render no chain id at all, so they passed on "no chain id
  // rendered on this route" — a sentence that says the check measured nothing. And
  // /knowledge, which prints eight minutes references as machine tokens and is the exact
  // surface INC-018 reported, was not on it.
  //
  // Every shell route is probed now. A route with no ids reports as a skip with its
  // reason rather than a pass, so the count no longer absorbs empty probes, and a route
  // that starts rendering ids is covered by existing — which is the property the list
  // could not have.
  for (const route of frontendShellRoutes) {
    const html = await fetchText(`${route}?locale=en&theme=light`);
    // Ids the *reader* sees, which is not every id in the file. A repaired reference
    // puts the record id inside its own `href` — `/deliberations/conference:<hex>` for
    // the 117 of 128 conferences the chain never gave a key — so scanning raw HTML
    // finds ids that exist only as destinations and reports the fix as the defect.
    // Attribute values are dropped before matching; text nodes are what an id printed
    // as a dead end lives in.
    //
    // The separator is a space, and it has to be written as one. It was a literal NUL
    // byte for a while — indistinguishable on screen, identical in behaviour for the
    // `\b` boundary this relies on, and it made the whole file `data` rather than text,
    // so every `grep` against this gate returned nothing at all. Not fewer matches:
    // none, silently, exit 0. Two searches for `statefulProbes` came back empty on a
    // file that contains it twice before the byte was found.
    const visibleText = html.replace(/<[^>]*>/g, " ");
    const unique = [...new Set(
      [...visibleText.matchAll(/\b(minutes|conference|evidence|gate|work|knowledge):[0-9a-f]{12,}/g)]
        .map((match) => match[0])
    )];
    // Containment, not proximity. This first asked whether an `<a href` appeared in
    // the 400 characters before the id, which is a guess about markup shape rather
    // than a question about the DOM: a `WorkItemRow` with an href wraps the whole row
    // in one anchor, and its own fields push the opening tag ~600 characters back, so
    // /inbox — where every id *is* inside a link — measured as zero linked. The
    // distance between an element and its ancestor's opening tag is a fact about how
    // much content the ancestor holds, and it carries no information about whether
    // the ancestor is a link. Every occurrence is tried, because a page may print the
    // same id in a linked row and again in prose.
    //
    // The `href="…"` fallback was the last hole here, and it is the one the STORY-103
    // mutation found: it asked whether *the page* links that record anywhere, not
    // whether *this occurrence* does. Stripping the href off /knowledge's minutes tokens
    // left the check green, because each of those records is also linked from the
    // deliberation list further down the same page. A reader looking at an inert token
    // cannot use a link somewhere else on the page they have not scrolled to. So the
    // fallback now requires the anchor to be near this occurrence — the enclosing
    // element, not the document. With that tightened, dropping `{...hrefAttr(link)}` from
    // /knowledge's minutes tokens goes red twice, once here and once below: `0/1 rendered
    // chain ids are inside a link` and `1 reference(s) link somewhere that cannot show
    // them`. Under the page-wide fallback the same mutation was green.
    const linked = unique.filter((id) => {
      for (let at = html.indexOf(id); at >= 0; at = html.indexOf(id, at + 1)) {
        const open = html.lastIndexOf("<a ", at);
        if (open >= 0 && open > html.lastIndexOf("</a>", at)) return true;
        const target = `href="${routeForId(id)}`;
        const nearby = html.lastIndexOf(target, at);
        if (nearby >= 0 && html.lastIndexOf("<li", at) <= nearby) return true;
      }
      return false;
    });
    // An empty probe reports as a skip, not a pass. Both false greens this gate has
    // shipped were readable in a passing detail — "no chain id rendered on this route",
    // counted as +1 toward 74/74 — so a route with nothing to measure now says so
    // without contributing a green.
    if (unique.length === 0) {
      checks.push({ id: `traversable-ids:${route}`, ok: true, skipped: true, detail: "no chain id rendered on this route" });
    } else {
      record(
        `traversable-ids:${route}`,
        linked.length === unique.length,
        `${linked.length}/${unique.length} rendered chain ids are inside a link` +
          (linked.length === unique.length
            ? ""
            : `; inert: ${unique.filter((id) => !linked.includes(id)).slice(0, 3).join(" ")}`)
      );
    }

    // Inside a link is not the same as inside the *right* link, and the difference is
    // not cosmetic: /inbox's ninety-seven open issues each named a minutes record and
    // each linked to `/work-items?project=…`, a filtered list that does not contain
    // the ruling. Every one satisfied the check above. A reader following it arrived
    // somewhere real and still had to go find the thing — which is the Owner's report
    // word for word, surviving a green gate.
    //
    // So this asks the second question: for an id whose kind has a destination, does
    // the anchor holding it point at a route that can show *that record*. Nothing is
    // required of an id whose kind has no surface yet — a gate has no page, and
    // demanding a link would only buy a link to the wrong page.
    const misrouted = [];
    for (const id of unique) {
      const [kind] = id.split(":");
      if (kind !== "minutes" && kind !== "conference") continue;
      let addressed = false;
      for (let at = html.indexOf(id); at >= 0 && !addressed; at = html.indexOf(id, at + 1)) {
        const open = html.lastIndexOf("<a ", at);
        if (open < 0 || open <= html.lastIndexOf("</a>", at)) continue;
        const href = /href="([^"]*)"/.exec(html.slice(open, at))?.[1];
        // The room's own token is the page a reader is standing on; a self-reference
        // needs no link and gets none. Any other minutes or conference id has a room.
        if (href && decodeHtml(href).split("?")[0].startsWith("/deliberations/")) addressed = true;
      }
      if (!addressed && !route.startsWith("/deliberations/")) misrouted.push(id);
    }
    record(
      `id-links-reach-record:${route}`,
      misrouted.length === 0,
      misrouted.length === 0
        ? `every deliberation reference on this route links into /deliberations/<key>`
        : `${misrouted.length} reference(s) link somewhere that cannot show them: ${misrouted.slice(0, 3).join(" ")}`
    );
  }

  // ── F. every link the app renders resolves ───────────────────────────────────
  //
  // Added after this gate's own false green exposed a defect nobody had reported:
  // all eleven sidebar module routes answer 404 on a direct request. Clicking works
  // because the client router intercepts it, so the defect is invisible to anyone
  // navigating by mouse — and invisible to all seventeen existing gates, whose
  // assertion URLs are pinned to /cockpit and /work, the two routes the sidebar
  // never points at. A refresh, a bookmark, or a shared deep link lands on 404.
  // Read from the whole table rather than a hand-picked few. Picking routes is
  // how the existing gates came to assert only /cockpit and /work — the two the
  // sidebar never points at — so this check is not allowed to pick.
  const linkSourceRoutes = frontendShellRoutes;
  for (const route of linkSourceRoutes) {
    const html = await fetchText(`${route}?locale=en&theme=light`);
    const hrefs = [...new Set([...html.matchAll(/href="([^"]*)"/g)]
      .map((match) => decodeHtml(match[1]).split("#")[0])
      .filter((href) => href.startsWith("/") && !href.startsWith("/assets/")))];
    const dead = [];
    for (const href of hrefs) {
      if (await statusOf(href) !== 200) dead.push(href);
    }
    record(
      `links-resolve:${route}`,
      dead.length === 0,
      `${hrefs.length - dead.length}/${hrefs.length} rendered links resolve 200` +
        (dead.length ? `; dead: ${dead.slice(0, 12).join(" ")}` : "")
    );
  }

  // ── G. the server admits every path the client router claims ─────────────────
  //
  // INC-019's second half. The client resolves a module path by prefix and parses
  // a record key out of it; the server used to compare against an exact Set. Two
  // rules for one question, and the halves disagreed for every record link in the
  // app — 424 dead link instances behind eleven module roots that had just been
  // fixed. The prefixes are now declared once and consumed by both ends, so what
  // is left to protect is that the declaration keeps up with the router: this
  // reads the parsed prefixes back out of app.tsx rather than restating them,
  // because a gate that keeps its own copy of the answer is a third copy.
  const routerSource = readFileSync(new URL("../apps/web/src/app.tsx", import.meta.url), "utf8");
  const parsedPrefixes = [...new Set([...routerSource.matchAll(/modulePath\.startsWith\("(\/[^"]+)\/"\)/g)]
    .map((match) => match[1]))];
  const declared = new Set(recordAddressableModulePaths);
  const undeclared = parsedPrefixes.filter((prefix) => !declared.has(prefix));
  record(
    "router-prefixes-declared",
    parsedPrefixes.length > 0 && undeclared.length === 0,
    parsedPrefixes.length === 0
      ? "found no parsed module prefixes in app.tsx — this probe has gone stale"
      : `${parsedPrefixes.length} prefix(es) parsed by the router` +
        (undeclared.length
          ? `; ${undeclared.length} absent from recordAddressableModulePaths: ${undeclared.join(" ")}`
          : "; all declared to the server"));

  // And that the declaration is live, not merely present: a record path under
  // each declared prefix must actually be served.
  for (const module of recordAddressableModulePaths) {
    const status = await statusOf(`${module}/PROBE-UNKNOWN-KEY`);
    record(
      `record-path-served:${module}`,
      status === 200,
      `${module}/<key> responds ${status}` +
        (status === 200 ? " (unknown keys render an empty state, not a 404)" : ""));
  }

  // ── H. a route serves its own page ───────────────────────────────────────────
  //
  // TCRN-AOS-INC-021, and the reason the two probes above named the wrong routes:
  // 34 of the then-46 entries in the route table answered 200 with bytes identical
  // to /cockpit. `resolveWorkMockupPageId` returns "queue" for anything it does not
  // recognise and `resolveCurrentRoute` falls back to the default nav item, so a
  // name nobody implemented resolved to a real page with real markers — which is
  // precisely what a marker gate reads as a pass. The thirty-two placeholder names
  // have since been removed from the table, and this check is what holds the line:
  // re-adding a name without a view reds it.
  //
  // Two aliases are exempt and each says why in one clause. Nothing else is: an
  // exemption granted because a route is broken is the same move as a false green.
  const cockpitAliases = new Set([
    "/",                          // the landing route; the cockpit is what it is for
    "/cockpit",                   // the page being compared against
    "/operations-cockpit",        // named alias, kept for the four admitted visual variants
    "/operations-cockpit.html"
  ]);
  const cockpitBytes = normalizeForRouteComparison(await fetchText("/cockpit?locale=en&theme=light"));
  const impostors = [];
  for (const route of frontendShellRoutes) {
    if (cockpitAliases.has(route)) continue;
    const body = normalizeForRouteComparison(await fetchText(`${route}?locale=en&theme=light`));
    if (body === cockpitBytes) impostors.push(route);
  }
  record(
    "route-serves-own-page",
    impostors.length === 0,
    impostors.length
      ? `${impostors.length} route(s) serve bytes identical to /cockpit: ${impostors.slice(0, 10).join(" ")}` +
        (impostors.length > 10 ? ` (+${impostors.length - 10} more)` : "")
      : `every route serves a page distinct from the cockpit (${frontendShellRoutes.length - cockpitAliases.size} compared)`);

  // The other half of the same defect: a path that is *not* in the table must not
  // answer 200 either. Removing the placeholder names only helps if the server
  // refuses them — and `isFrontendShellRoute` is what makes the removal load-bearing
  // rather than cosmetic.
  const retiredNames = ["/conference", "/docs", "/settings", "/knowledge-modules", "/project-workspace.html"];
  const stillServed = [];
  for (const retired of retiredNames) {
    if (frontendShellRoutes.includes(retired)) continue;
    if ((await statusOf(`${retired}?locale=en&theme=light`)) !== 404) stillServed.push(retired);
  }
  record(
    "retired-route-refused",
    stillServed.length === 0,
    stillServed.length
      ? `${stillServed.length} retired name(s) still answer with a page: ${stillServed.join(" ")}`
      : `${retiredNames.length} retired placeholder name(s) 404 instead of serving another page's bytes`);

  // ── E. a finding module has something to find with ───────────────────────────
  //
  // The deliberation module receives a URLSearchParams and uses it for exactly
  // one key. A module whose purpose is locating a past deliberation, with no way
  // to search, is a browse-only list wearing a module's name.
  // TCRN-AOS-STORY-103. The rule is a threshold rule — an index surface holding more
  // than a screenful of records must offer local search — and it was measured against a
  // hand-kept list of two routes, both of which already had search. So it asserted
  // nothing: the list *was* the answer. Its own comment records being wrong twice about
  // which routes belong on it, which is the tell for a list that should be derived.
  //
  // Derived now from the two numbers the rule is actually about: how many records the
  // projection holds behind a route, and how many the route renders. A route that shows
  // everything it has needs no search — that is the DS contract's "omit the inert
  // placeholder" — and a route that holds 422 and shows 40 does, whatever its name is.
  // /work-items was over the threshold and unprobed the whole time; it has search, which
  // is luck rather than proof, and now it is proof.
  //
  // The earlier corrections still hold and are still worth keeping, because they are the
  // reason the numbers are read from the projection rather than from the page: /work/evidence
  // is a six-row fixture, /knowledge-modules and /conference were route-table fallthroughs
  // rendering unrelated pages (removed under INC-021). A count that comes from the data
  // cannot be fooled by a route whose name promises a module it does not serve.
  // `held` is what *this route* is an index of, which is not always "everything in the
  // projection". Getting it wrong in the generous direction is not a safe error: the
  // first pass credited /audit and /my-work with 422 records each and demanded a search
  // box on both. Reading them showed the number was the defect, not the page —
  //
  //   /audit is an aggregate, not an index: four partitions of counts (total, keys
  //   recovered, with scope, with ruling, chain version). There is nothing to search;
  //   a box there is exactly the inert placeholder the DS contract says to omit.
  //
  //   /my-work renders every active and every blocked item in full and truncates only
  //   the completed band, whose footer links to /work-items?status=done — a surface that
  //   does have search. It hands the reader onward instead of stranding them, so what it
  //   is an index of is the work that is live, and it shows all of it.
  //
  // A gate that demands a control the design deliberately omits teaches people to add
  // dead controls to satisfy it, which is a worse outcome than the gap it was chasing.
  //
  // Falsified, not assumed. Replacing the DS `SearchInput` with a bare `<input>` — the
  // one-token change that keeps the box on screen and removes the capability — turns each
  // owed surface red on its own line: /work-items (holds 422, renders 120),
  // /deliberations (128/30), /knowledge (128/8). `<NotSearchInput` would have been the
  // obvious mutation and it proves nothing, because it fails `tsc` and the gate never
  // runs; `<input` compiles, all four props being valid DOM props, and drops exactly
  // `type="search"`.
  const liveWork = cockpitData.work.filter((row) => row.status === "active" || row.status === "blocked").length;
  const indexSurfaces = [
    { route: "/deliberations", held: cockpitData.conferences.length },
    { route: "/knowledge", held: cockpitData.conferences.length },
    { route: "/work-items", held: cockpitData.work.length },
    { route: "/inbox", held: cockpitData.inbox.length },
    { route: "/my-work", held: liveWork },
    { route: "/audit", held: cockpitData.partitions.length }
  ];
  // One screenful. Below this a reader scans; above it they need to ask. The number is a
  // judgement rather than a measurement, so it is stated once here and the check reports
  // it, instead of being implied by which routes someone remembered to list.
  const searchThreshold = 40;
  for (const surface of indexSurfaces) {
    if (!frontendShellRoutes.includes(surface.route)) {
      record(`search-present:${surface.route}`, false, "route not in frontendShellRoutes — probe is stale");
      continue;
    }
    const html = await fetchText(`${surface.route}?locale=en&theme=light`);
    // Rows as each surface emits them, not one assumed marker. Counting only
    // `work-item-row` read 0 on /deliberations, /knowledge and /audit — none of which
    // uses it — and a zero denominator makes "truncating" trivially true, which is the
    // same free pass this gate has now removed three times. A surface matching no row
    // shape at all still reads 0, so it reads as maximally truncating: the failure
    // direction is demanding a control the page may not need, which is visible and
    // arguable, rather than excusing a missing one, which is silent.
    const rowCounts = [
      [...html.matchAll(/data-work-management-pattern="work-item-row"/g)].length,
      [...html.matchAll(/data-conference-key="/g)].length,
      [...html.matchAll(/<li\b/g)].length
    ];
    const rendered = Math.max(...rowCounts);
    // What makes something a search control is that it *is* one, in the served bytes:
    // `type="search"`, or an explicit searchbox role. I briefly had a third disjunct
    // accepting `data-cockpit-search="…"` — an attribute the app writes on the element —
    // and mutation testing killed it: replacing DS `SearchInput` with a bare `<input>`
    // keeps the attribute and loses the control, and all four mutations passed. An
    // attribute is a label the app applies to itself; it survives exactly the change
    // that matters. Same mistake as check C's two invented marker names, one layer over.
    // The region-marker disjunct went the same way, for the same reason one level down:
    // `data-work-management-pattern="searchable-list"` is the container DS emits
    // unconditionally, and it renders its `SearchInput` only when `showSearch` is set. So
    // the marker can be present on a list with no search control at all — and /work-items
    // renders both a `SearchableList` and its own input, which is why removing the input
    // left this green until the disjunct went. A container is not a control.
    const hasSearchControl = /data-tcrn-search-input|type="search"|role="searchbox"/.test(html);
    // Owed only when the surface truncates. `held` is what the projection has; `rendered`
    // is what the reader can see and scan. Equal means the page is the whole answer.
    const owed = surface.held > searchThreshold && rendered < surface.held;
    record(
      `search-present:${surface.route}`,
      !owed || hasSearchControl,
      `holds ${surface.held}, renders ${rendered}` +
        (owed
          ? `; over the ${searchThreshold}-record threshold and truncating, so search is owed — ` +
            (hasSearchControl ? "rendered" : "**absent**")
          : `; at or under the threshold or showing everything, search not owed` +
            (hasSearchControl ? " (rendered anyway)" : ""))
    );
  }

  // ── I. the first response body already honours a stored preference ───────────
  //
  // The Owner's report: switching pages briefly shows the default language and the
  // light theme, then snaps back. Every existing gate here fetches with an explicit
  // `?locale=&theme=`, so every one of them was blind to it — the query said what
  // the page should be, and the page obeyed. The defect only exists on a request
  // that carries no query, which no gate made.
  //
  // What is asserted is the *first response body*, not the settled DOM. A settled
  // assertion passes on the broken code too: the client did correct the page, and
  // the flash was the interval before it. Only the served bytes can distinguish
  // "was right" from "became right".
  const preferenceCookie = "tcrn-aos-locale=ja; tcrn-aos-theme=dark";
  for (const route of ["/cockpit", "/work-items", "/deliberations", "/audit"]) {
    const served = await fetch(`${service.url}${route}`, { headers: { cookie: preferenceCookie } });
    const html = await served.text();
    const lang = /<html lang="([^"]*)"/.exec(html)?.[1] ?? null;
    const theme = /data-tcrn-theme="([^"]*)"/.exec(html)?.[1] ?? null;
    // `Vary: Cookie` is part of the invariant rather than a nicety: these bytes now
    // differ by cookie, so a cache keyed on URL alone would serve one reader's
    // language to another. A correct render with a wrong cache header is a defect
    // that only appears once something is in front of the service.
    const vary = (served.headers.get("vary") ?? "").toLowerCase();
    record(
      `stored-preference-served:${route}`,
      lang === "ja" && theme === "dark" && vary.includes("cookie"),
      `first response body: lang=${lang} theme=${theme} vary=${vary || "(none)"}`
    );
  }

  // An explicit query still outranks a standing preference, or a shared link stops
  // being shareable: sending someone `?locale=fr` would render in the language they
  // happen to have stored. Precedence is query → stored → default, and the middle
  // term is the only one that was missing.
  const overridden = await fetch(`${service.url}/cockpit?locale=fr`, { headers: { cookie: preferenceCookie } });
  const overriddenLang = /<html lang="([^"]*)"/.exec(await overridden.text())?.[1] ?? null;
  record(
    "query-outranks-stored-preference",
    overriddenLang === "fr",
    `?locale=fr with a ja cookie renders lang=${overriddenLang}`
  );

  // A cookie is attacker-reachable input. An unsupported locale and a malformed
  // percent-escape must both resolve to the default — the second one throws out of
  // `decodeURIComponent`, which without a guard is a 500 on every page for anyone
  // holding that cookie.
  for (const [label, cookie] of [
    ["unsupported-locale", "tcrn-aos-locale=klingon"],
    ["malformed-escape", "tcrn-aos-locale=%E0%A4%A"]
  ]) {
    const response = await fetch(`${service.url}/cockpit`, { headers: { cookie } });
    const lang = /<html lang="([^"]*)"/.exec(await response.text())?.[1] ?? null;
    record(
      `hostile-preference-cookie:${label}`,
      response.status === 200 && lang === tcrnDefaultLocale,
      `status=${response.status} lang=${lang}`
    );
  }
} finally {
  await service.close();
}

const result = {
  ok: findings.length === 0,
  gate: "aos-usability-proof",
  invariants: [
    "every offered locale is served",
    "a page's links preserve the state that produced the page",
    "a drilled-down page offers a way back that is not browser chrome",
    "a rendered identifier is traversable",
    "a finding module has something to find with",
    "every link the app renders resolves",
    "the server admits every path the client router claims",
    "a route serves its own page",
    "an id links to a route that can show that record",
    "the first response body already honours a stored preference"
  ],
  checksRun: checks.length,
  failed: findings.length,
  findings,
  // Every check's own detail line, passing ones included, because both false greens
  // this gate has shipped were readable in a passing detail and unreadable from the
  // summary. `traversable-ids:/work/evidence` passed with "no chain id rendered on
  // this route" — the sentence says the check measured nothing — and the count said
  // 74/74. A pass whose reason is "there was nothing here" and a pass whose reason
  // is "all twenty-three resolve" are different facts, and collapsing both to +1 is
  // what let three empty probes stand in for a working invariant.
  checks
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  console.error(
    `\n${findings.length} of ${checks.length} usability invariant(s) fail. ` +
    "A route that renders is not a route that can be used.");
  process.exit(1);
}

async function fetchText(path) {
  const response = await fetch(`${service.url}${path}`);
  assert.equal(response.status, 200, `${path} responds 200`);
  return await response.text();
}

async function statusOf(href) {
  const path = href.split("#")[0];
  if (statusCache.has(path)) return statusCache.get(path);
  const response = await fetch(`${service.url}${path}`, { method: "GET" });
  statusCache.set(path, response.status);
  return response.status;
}

// A run is translatable if it is prose a translator would be given: at least two
// words of letters. Excluded, deliberately and by category rather than by listing
// individual strings:
//   - machine tokens and keys        AOS-128, DS-88, P0, work:abc123
//   - pure numbers and punctuation   4, 7, ▾, /
//   - single words                   they are usually labels shared across locales
//                                    (Ilya, TCRN, AOS) and single-word copy is
//                                    caught by the dictionary-coverage check above
//   - the locale menu's own names    简体中文 / English / 日本語 appear in every locale
function isTranslatableRun(run) {
  if (localeMenuNames.has(run)) return false;
  if (/^[\s\d\p{P}\p{S}]+$/u.test(run)) return false;
  if (/^[a-z]+:[0-9a-f]{8,}$/i.test(run)) return false;
  if (/^[A-Z][A-Za-z]*-\d+$/.test(run)) return false;
  const words = run.split(/\s+/).filter((word) => /[A-Za-z一-鿿]/.test(word));
  return words.length >= 2;
}

function visibleTextRuns(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, "\n")
    .split("\n")
    .map((run) => run.trim())
    .filter(Boolean);
}

// Chrome copy = the product's own vocabulary. Fixture domain data is dropped by
// removing the subtrees that carry it before extracting text, so the gate measures
// what the product says and not what the tenant's data says.
function chromeTextRuns(html) {
  const withoutDomainData = html
    .replace(/<span[^>]*class="tcrn-relationship-chip__target"[^>]*>[\s\S]*?<\/span>/g, "")
    .replace(/<span[^>]*data-work-relationship=[^>]*>[\s\S]*?<\/span>/g, "")
    .replace(/<[^>]*class="[^"]*tcrn-work-item-row__title[^"]*"[^>]*>[\s\S]*?<\/[a-z]+>/g, "")
    .replace(/<code[\s\S]*?<\/code>/g, "");
  return visibleTextRuns(withoutDomainData).filter(isTranslatableRun);
}

// The lang / data-current-locale / locale=xx attributes always differ per locale
// even when no copy does. Comparing raw bytes would call that a difference and
// pass a page that translated nothing.
// Two responses are "the same page" if they differ only in the attributes that
// name the request. Those vary by construction on every route, so leaving them in
// would make every comparison unequal — the false green this gate already made
// once, with data-visual-instance-locale in the locale check.
function normalizeForRouteComparison(html) {
  return html
    .replace(/data-(?:ssr-path|current-path|visual-instance-variant)="[^"]*"/g, "")
    .replace(/<title>[\s\S]*?<\/title>/, "");
}

function stripLocaleAttributes(html) {
  return html
    .replace(/lang="[^"]*"/g, "")
    .replace(/data-current-locale="[^"]*"/g, "")
    .replace(/locale=[a-zA-Z-]+/g, "");
}

function decodeHtml(value) {
  return value.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

/**
 * The DS work-management region a byte offset actually falls inside.
 *
 * Nearest-preceding marker is the obvious implementation and it is wrong, in the
 * direction that matters: it credits a link to a region that has already closed. The
 * `/deliberations` clear control came back as `machine-token-cell`, a `<span>` that ends
 * hundreds of bytes earlier — the same proximity-instead-of-containment mistake check F
 * records making with a 400-character window. Proximity in a byte stream carries no
 * information about ancestry.
 *
 * So the tags are walked and depth is tracked: a marked element is in scope from its
 * opening tag until the close that returns to the depth it opened at. Void and
 * self-closing tags never open a scope. The innermost region still open at `offset` is
 * the answer, and "(unmarked)" when none is — unmarked is never exempt, which is the
 * safe direction for a predicate that hands out exemptions.
 */
function enclosingRegion(html, offset) {
  const stack = [];
  let depth = 0;
  for (const tag of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g)) {
    if (tag.index >= offset) break;
    const [, closing, name, attributes] = tag;
    if (closing) {
      depth -= 1;
      while (stack.length && stack[stack.length - 1].depth > depth) stack.pop();
      continue;
    }
    if (/\/\s*$/.test(attributes) || voidElements.has(name.toLowerCase())) continue;
    const marked = /data-work-management-pattern="([^"]+)"/.exec(attributes);
    if (marked) stack.push({ region: marked[1], depth });
    depth += 1;
  }
  return stack.length ? stack[stack.length - 1].region : "(unmarked)";
}


/**
 * A real record path under a module, for the checks that need a populated page.
 *
 * `/work-items/PROBE-UNKNOWN-KEY` is the right probe for "is this path admitted"
 * and the wrong one for anything about the page's content: an unknown key renders
 * an empty state, which has no ancestors and so no trail to assert. A key from the
 * projection is what makes "this page offers a way back" a question with an answer.
 *
 * Returns null when the projection holds no keyed record for a module rather than
 * guessing a key — a check skipped for a stated reason is recoverable; a check that
 * probes a fabricated key measures the empty state and calls it a pass.
 */
function sampleRecordPath(module) {
  const keyed = module === "/deliberations"
    ? cockpitData.conferences.find((entry) => entry.externalKey)
    : cockpitData.work.find((entry) => entry.externalKey && entry.parentId);
  return keyed ? `${module}/${keyed.externalKey}` : null;
}

/**
 * The paths a reader on `route` could sensibly be trying to get back to.
 *
 * `/` used to be in this list, and it made check C unfalsifiable. Every shell page
 * carries exactly one link to the site root — the brand mark in the header — so
 * `candidates` was never empty on any route, the first disjunct always won, and all
 * eleven probes passed with "ancestor link / resolves 200" including the ones that
 * render no breadcrumb trail at all. That is the third false green this one check
 * has produced, and it has the same shape as the other two: the assertion was true,
 * it just was not about the thing being claimed. A link to the home page is not a
 * way back out of a drilled-down page; it is a way to start over.
 *
 * So the root is excluded and only genuine ancestors count. A top-level route has
 * no ancestor, which is correct — it is not drilled down, and check C's route list
 * only contains routes that are.
 */
function ancestorPaths(route) {
  const segments = route.split("/").filter(Boolean);
  const paths = [];
  for (let index = segments.length - 1; index >= 1; index -= 1) {
    paths.push(`/${segments.slice(0, index).join("/")}`);
  }
  return paths;
}

/**
 * The route that can show a record of this kind, used as the fallback signal when an
 * id is rendered outside an anchor but the page links to its destination elsewhere.
 *
 * `minutes` and `conference` resolved to `/work/deliberations` here, which has never
 * been a route in `frontendShellRoutes` — the deliberation surface is `/deliberations`
 * and a room is `/deliberations/<key>`. The wrong value was harmless only because the
 * three routes this check probed rendered no chain ids at all, so the branch that
 * reads it never ran.
 */
function routeForId(id) {
  const [kind] = id.split(":");
  if (kind === "minutes" || kind === "conference") return "/deliberations";
  if (kind === "evidence") return "/work/evidence";
  if (kind === "gate") return "/work/gates";
  if (kind === "knowledge") return "/knowledge";
  return "/work-items";
}
