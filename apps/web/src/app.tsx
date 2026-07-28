import { useEffect, useMemo, useState, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Badge,
  DisclosurePanel,
  EnvironmentBanner,
  EvidenceStrip,
  Heading,
  KeyValueList,
  ProductShell,
  StatusBadge,
  Surface,
  TableShell,
  Text,
  WorkIndex,
  getTcrnProductLogoAsset,
  readPreferenceCookieValues,
  tcrnComponentCss,
  tcrnProductTagline,
  useProductShellController,
  type ProductShellNavGroup,
  type WorkIndexRow
} from "@tcrn/ui-react";
import {
  tcrnDefaultLocale,
  tcrnLocaleMetadata,
  tcrnSupportedLocales,
  type TcrnLocale
} from "@tcrn/ui-copy-state";
import { tcrnTokenCss } from "@tcrn/ui-tokens";
import { chainPartitions, localeCopy, shellNavGroups, shellNavItems, type ShellNavItem } from "./data.js";
import { pick, type CopyEntry } from "./copy.js";
import { ShellHeaderActions } from "./shell-header-actions.js";
import { MyWorkView, ProjectsView } from "./cockpit-views.js";
import { CockpitEnvironmentBanner } from "./cockpit-mirror-banner.js";
import { DashboardView, InboxView } from "./cockpit-global.js";
import { WorkItemsView } from "./cockpit-work-items.js";
import { WorkItemDetailView } from "./cockpit-detail.js";
import { BoardView } from "./cockpit-board.js";
import { DeliberationsView } from "./cockpit-deliberation.js";
import { AuditView, ReleaseTrainsView, SnapshotHealthView } from "./cockpit-governance.js";
import { KnowledgeSpaceView } from "./cockpit-knowledge.js";
import { DeliberationRoomView } from "./cockpit-deliberation-room.js";
import { Phase3DogfoodReadback } from "./phase3-dogfood-readback.js";
import { WorkManagementMockups, getWorkMockupPageTitle } from "./work-management-mockups.js";

/**
 * The languages this product actually offers, which is not the same list as the
 * languages the Design System declares.
 *
 * `tcrnLocaleMetadata` is DS's roster — the five locales a consumer *may* offer. It
 * says nothing about whether this consumer's copy can answer in them, and it used to
 * be passed to the shell unchanged. That is how a menu comes to offer a language the
 * product does not speak: the control is present, the reader picks it, and the page
 * renders English. A missing translation should shorten the menu, not turn one of its
 * entries into a lie.
 *
 * So the offered set is derived from coverage. All five are covered today and the
 * rendered menu is unchanged by this — the point is what happens on the day one is
 * not, and that day is too late to add the derivation.
 *
 * Coverage is read from the shell dictionary because that is the copy every route
 * renders, whatever else it renders: a locale that cannot name the navigation cannot
 * usefully be offered. The per-view copy tables are the other half and they are held
 * at the source by `scripts/locale-coverage-proof.mjs`, which can see the entry on
 * the one screen no probe visits.
 */
const servedLocaleMetadata = tcrnLocaleMetadata.filter((entry) => {
  const dictionary = localeCopy[entry.locale as TcrnLocale];
  if (!dictionary) return false;
  return Object.keys(localeCopy.en).every((key) => key in dictionary);
});

/**
 * Preference storage keys, used as both `localStorage` keys and cookie names.
 *
 * One name per preference across both stores, deliberately: the cookie is what the
 * server reads and `localStorage` is what survives a cookie being cleared, and two
 * different names for the same preference is how they would drift apart.
 *
 * `locale` is new here. It had no storage key at all — the locale menu wrote the URL
 * and nothing else, so a reader who chose Japanese got Japanese for exactly as long
 * as they kept clicking links that carried `?locale=ja`, and a bookmark or a typed
 * address took them back to zh-CN. That is the same defect as the theme flash with
 * the flash lasting forever.
 */
const sideNavStorageKey = "tcrn-aos-side-nav-collapsed";
const themeStorageKey = "tcrn-aos-theme";
const localeStorageKey = "tcrn-aos-locale";
const defaultShellRoute = shellNavItems[0] as ShellNavItem;
const defaultOwnerQualityVariant = "desktop-light-operations-cockpit";
const outsideAcceptedOwnerQualityMatrix = "aos-route-state-outside-owner-quality-oracle";
const aosProductLogoAsset = getTcrnProductLogoAsset("aos");

interface ApiReadbackState {
  statusText: string;
  runtime: string;
  queue: string;
  policy: string;
  counts: string;
  metrics: {
    runtime: string;
    stories: string;
    gates: string;
    auditEvents: string;
  };
  summary: unknown;
}

const initialApiReadback: ApiReadbackState = {
  statusText: "Waiting for /api/health, /api/readback, and /api/policy.",
  runtime: "pending",
  queue: "pending",
  policy: "pending",
  counts: "pending",
  metrics: {
    runtime: "Fetching",
    stories: "--",
    gates: "--",
    auditEvents: "--"
  },
  summary: { status: "pending" }
};

interface InitialShellState {
  collapsed: boolean;
  theme: "light" | "dark";
  locale: TcrnLocale;
  currentPath: string;
  /**
   * The query the page was requested with, kept so links out of the page can
   * carry it (TCRN-AOS-INC-014).
   *
   * `currentPath` is a pathname; the query used to be dropped here and re-read
   * from `window.location.search` further down, which works in the browser and
   * returns nothing during SSR. So every server-rendered link lost every filter,
   * and the Owner's report — "changing a filter resets the project scope" — was
   * the visible half of a wider defect: the app reads fifteen query keys and used
   * to write back three.
   */
  currentSearch: string;
  /**
   * Which preferences this request decides explicitly, and so which ones a stored
   * value must not override.
   *
   * A query parameter outranks a standing preference — that is what makes a shared
   * link land on what the sender saw, and what makes a gate's `?theme=dark&locale=ja`
   * mean it. The owner-quality route policy is the same kind of claim made by the
   * route rather than the query. Recorded per preference rather than as one flag
   * because `?theme=dark` says nothing about the reader's language.
   */
  overriddenByRequest: {
    collapsed: boolean;
    theme: boolean;
    locale: boolean;
  };
}

// Route ids come from the nav model so adding a module cannot forget this union.
type AosRouteId = (typeof shellNavItems)[number]["id"];
type VisualInstanceViewportState = "desktop" | "mobile";

interface BrowserVisualState {
  viewport: VisualInstanceViewportState;
  reducedMotion: boolean;
}

interface OwnerQualityRoutePolicy {
  theme?: "light" | "dark";
  locale?: TcrnLocale;
  reason: "accepted_owner_quality_variant" | "unclaimed_state";
}

interface AosShellAppProps {
  initialShellState?: InitialShellState;
  /** Server-render hint for the environment banner; the client still probes. */
  initialSurface?: "local" | "mirror";
}

interface RenderAosShellHtmlOptions {
  path?: string;
  search?: string;
  /**
   * The request's `Cookie` header, when there is a request.
   *
   * The Owner's report: switching pages briefly shows the default language and the
   * light theme before snapping back. That flash is not slowness, it is a storage
   * choice — preferences lived in `localStorage`, which the server cannot read, so
   * every server-rendered page was `zh-CN`/light no matter what the reader had
   * chosen, and the correction only arrived once the client bundle had parsed and
   * mounted. Cookies are the only browser storage that travels with the request,
   * which is what makes the first byte able to be right.
   *
   * Optional, and the renderer works without it: `build.ts` and the mirror build
   * have no request at all, and the static outputs stay at the default.
   */
  cookie?: string;
  /**
   * Which copy of the cockpit these bytes are being rendered for, when the
   * renderer knows. The mirror build does know — it is building the mirror — and
   * saying so at render time means a reader without scripting still sees "this
   * is a copy" rather than only the data's age. The client still probes and
   * still gets the last word, so a wrong stamp is corrected rather than trusted.
   */
  surface?: "local" | "mirror";
}

/**
 * The document's own name, in the reader's language.
 *
 * `TCRN AOS` is the product's wordmark and stays Latin in every locale — a
 * translated name is a different product. `moduleName` is descriptive copy and
 * is already carried in all five locales by `localeCopy`; the title composed it
 * from neither, which made the browser tab and the first thing a screen reader
 * announces the one part of a localized page that never translated.
 */
function documentTitle(locale: TcrnLocale): string {
  const copy = localeCopy[locale] ?? localeCopy.en;
  return `${copyText(copy, "productName", "TCRN AOS")} ${copyText(copy, "moduleName", "Operations Cockpit")}`;
}

export function renderAosShellHtml(options: RenderAosShellHtmlOptions = {}): string {
  const initialShellState = readInitialShellState(options.path, options.search, options.cookie);
  const appHtml = renderToStaticMarkup(
    <AosShellApp
      initialShellState={initialShellState}
      {...(options.surface ? { initialSurface: options.surface } : {})}
    />);

  return `<!doctype html>
<html lang="${initialShellState.locale}" data-tcrn-theme="${initialShellState.theme}" data-current-locale="${initialShellState.locale}" data-product-shell-html="true">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtmlAttribute(documentTitle(initialShellState.locale))}</title>
    <meta name="tcrn-aOS-owner-quality-oracle" content="aos-owner-quality-product-shell" />
    <meta name="tcrn-design-system-source" content="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state" />
    <meta name="tcrn-aOS-brand-source" content="@tcrn/ui-react ProductShell/ShellBrandLockup/ProductLogo with registered tcrnProductLogoRegistry aos asset" />
    <link rel="icon" href="/assets/tcrn-brand-mark.svg" type="image/svg+xml" />
    <style data-tcrn-token-source="@tcrn/ui-tokens">${tcrnTokenCss}</style>
    <style data-tcrn-component-style-source="@tcrn/ui-react">${tcrnComponentCss}</style>
    <style data-product-document-baseline="tcrn-token-inheritance">${createDocumentCss()}</style>
  </head>
  <body data-product-shell-body="owner-quality-product-shell" data-product-acceptance="not-claimed" data-release-readiness="not-claimed" data-live-dispatch="not-enabled">
    <div id="aos-root" data-ssr-path="${escapeHtmlAttribute(initialShellState.currentPath)}">${appHtml}</div>
    <script type="module" src="/assets/aos-client.js" data-product-shell-client="ds-product-shell-semantic-boundary"></script>
  </body>
</html>`;
}

export function AosShellApp({ initialShellState: initialShellStateOverride, initialSurface }: AosShellAppProps = {}) {
  const initialShellState = useMemo(() => initialShellStateOverride ?? readInitialShellState(), [initialShellStateOverride]);
  const [currentPath] = useState(initialShellState.currentPath);
  // The query the page was requested with. Held in state for the same reason as
  // the path: it is the request's own value, and re-reading it from the browser
  // would give SSR nothing and the client something different.
  const [currentSearch] = useState(initialShellState.currentSearch);
  const [apiReadback, setApiReadback] = useState<ApiReadbackState>(initialApiReadback);
  const [browserVisualState, setBrowserVisualState] = useState<BrowserVisualState>(() => readBrowserVisualState());

  const currentRoute = resolveCurrentRoute(currentPath);
  const activePartitionId = resolveActivePartition(currentPath, initialShellState.currentSearch);
  // Persistence is the shell's, not ours.
  //
  // This used to pass storage keys nowhere and hand-roll both halves here: a local
  // cookie reader threaded through `initial*`, and `writeStoredPreference` writing
  // both stores on every change. That was a workaround for a DS controller that read
  // only `localStorage` — and the workaround was itself the evidence the defect lived
  // in DS, because the next product to consume the shell would have had to write it
  // again. The controller now reads and writes both stores itself, so what is left
  // here is the part only this product can know: which query parameters it honours,
  // and what each preference change means for the document outside React's tree.
  //
  // `initialShellState` still resolves query-over-stored-over-default, and a storage
  // key is withheld for exactly the preference a query is overriding. The controller's
  // stored read outranks the `initial*` value it is given, so passing the key while a
  // query says otherwise would let the standing preference win over the explicit link
  // — the precedence inverted, which is how a gate's `?theme=dark` would come back
  // light for anyone who had ever chosen light.
  // No `requestPreferences` on purpose: this product resolves the request itself
  // (query over cookie over default, through the DS parser in
  // `readInitialShellState`) because it also has to land the winner on
  // `<html lang>` and the theme attribute, outside this controller's tree. The
  // resolved winner arrives as `initial*`; handing the controller the cookie
  // values as well would be the same value by a second door — and for a
  // query-overridden preference, the wrong door, since a request value outranks
  // `initial*` and would put the standing preference back above the explicit link.
  const controller = useProductShellController({
    initialCollapsed: initialShellState.collapsed,
    initialTheme: initialShellState.theme,
    initialLocale: initialShellState.locale,
    navId: "aos-primary-side-nav",
    ...(initialShellState.overriddenByRequest.collapsed ? {} : { collapsedStorageKey: sideNavStorageKey }),
    ...(initialShellState.overriddenByRequest.theme ? {} : { themeStorageKey }),
    ...(initialShellState.overriddenByRequest.locale ? {} : { localeStorageKey }),
    onThemeChange: (theme) => {
      applyRootTheme(theme);
    },
    onLocaleChange: (locale) => {
      const resolvedLocale = resolveLocale(locale);
      // The locale was the one preference that was never stored — it went to the URL
      // and nowhere else. The shell stores it now; what stays here is the URL, which
      // is this product's own vocabulary, and the document attributes outside the
      // React tree.
      updateUrlLocale(resolvedLocale);
      applyRootLocale(resolvedLocale);
    }
  });

  useEffect(() => {
    removeUnsupportedSearchParam();
  }, []);

  useEffect(() => {
    applyRootTheme(controller.theme);
  }, [controller.theme]);

  useEffect(() => {
    applyRootLocale(resolveLocale(controller.locale));
  }, [controller.locale]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const viewportMedia = window.matchMedia("(max-width: 760px)");
    const reducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateVisualState = () => {
      setBrowserVisualState({
        viewport: viewportMedia.matches ? "mobile" : "desktop",
        reducedMotion: reducedMotionMedia.matches
      });
    };
    updateVisualState();
    viewportMedia.addEventListener("change", updateVisualState);
    reducedMotionMedia.addEventListener("change", updateVisualState);
    return () => {
      viewportMedia.removeEventListener("change", updateVisualState);
      reducedMotionMedia.removeEventListener("change", updateVisualState);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (currentPath === "/work/readback") {
      setApiReadback({
        statusText: "Scoped Work readback route uses /api/work/readback only.",
        runtime: "scoped readback",
        queue: "none",
        policy: "filtered readback methods",
        counts: "ticket list and story audit only",
        metrics: {
          runtime: "service proof only",
          stories: "--",
          gates: "--",
          auditEvents: "--"
        },
        summary: {
          ok: true,
          surface: "work.readback",
          legacyReadbackFetched: false,
          endpoints: ["/api/work/readback/tickets", "/api/work/readback/audit", "/api/work/readback/policy"]
        }
      });
      return;
    }
    async function fetchJson(path: string) {
      const response = await fetch(path, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`${path} returned ${response.status}`);
      return response.json() as Promise<Record<string, unknown>>;
    }

    Promise.all([fetchJson("/api/health"), fetchJson("/api/readback"), fetchJson("/api/policy")])
      .then(([health, readback, policy]) => {
        if (cancelled) return;
        const counts = readback.operationalRecordCounts as Record<string, unknown> | undefined;
        const summary = {
          health: {
            ok: health.ok,
            runtimeDatabase: health.runtimeDatabase,
            externalQueue: health.externalQueue,
            liveCodexDispatchAuthorized: health.liveCodexDispatchAuthorized
          },
          readbackCounts: counts,
          policy: {
            allowedRuntimeMutation: policy.allowedRuntimeMutation,
            serviceProofOnly: policy.serviceProofOnly
          }
        };
        setApiReadback({
          statusText: "API summaries available from read-only local service.",
          runtime: health.runtimeDatabase === "local fixture" ? "read-only local summary" : String(health.runtimeDatabase ?? "read-only local summary"),
          queue: String(health.externalQueue ?? "none"),
          policy: policy.serviceProofOnly === true ? "service summary only" : "unavailable",
          counts: `stories ${String(counts?.stories ?? "--")}, gates ${String(counts?.gates ?? "--")}`,
          metrics: {
            runtime: health.ok === true ? "read-only local summary" : "unavailable",
            stories: String(counts?.stories ?? "--"),
            gates: String(counts?.gates ?? "--"),
            auditEvents: String(counts?.auditEvents ?? "--")
          },
          summary
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "unknown error";
        setApiReadback({
          statusText: `API readbacks unavailable: ${message}`,
          runtime: "fail-closed",
          queue: "unavailable",
          policy: "unavailable",
          counts: "unavailable",
          metrics: {
            runtime: "fail-closed",
            stories: "--",
            gates: "--",
            auditEvents: "--"
          },
          summary: { ok: false, error: message }
        });
      });

    return () => {
      cancelled = true;
    };
  }, [currentPath]);

  const currentLocale = resolveLocale(controller.locale);
  const currentCopy = localeCopy[currentLocale] ?? localeCopy.en;
  const currentRouteId = currentRoute.id as AosRouteId;
  // The variant matrix speaks page identities, the nav speaks module ones;
  // /cockpit and /work belong to the former and only alias into the latter.
  const oracleRouteId = resolveOwnerQualityOracleRoute(currentPath) as AosRouteId;
  // Was `forceExpandedOwnerQualityState ? false : controller.collapsed`. The
  // override existed only to keep the mobile rail pinned open, because the
  // control that could have put it away was hidden and there was nothing else
  // to hold the accepted variant in place. The navigation shows and hides on
  // its own now, so the reader's collapse state is simply the reader's.
  const visualInstanceCollapsed = controller.collapsed;
  const visualInstanceVariant = resolveVisualInstanceVariant({
    route: oracleRouteId,
    theme: controller.theme,
    locale: currentLocale,
    collapsed: visualInstanceCollapsed,
    viewport: browserVisualState.viewport,
    reducedMotion: browserVisualState.reducedMotion
  });
  const productShellControlProps = {
    collapsed: visualInstanceCollapsed,
    collapsedStorageKey: sideNavStorageKey,
    currentTheme: controller.theme,
    currentLocale,
    localeMenuOpen: controller.localeMenuOpen,
    // Forwarded straight through: the mobile show/hide state is the shell's own
    // and this product has nothing to add to it. It is deliberately not a URL
    // parameter and not a stored preference — putting the navigation away is a
    // thing you do on one screen, not a thing you mean to still be true
    // tomorrow, and `collapsed` (which is both) travels in every link.
    mobileNavExpanded: controller.mobileNavExpanded,
    onMobileNavExpandedChange: controller.setMobileNavExpanded,
    navId: "aos-primary-side-nav",
    onCollapsedChange: (collapsed: boolean) => {
      controller.setCollapsed(collapsed);
    },
    onThemeChange: controller.setTheme,
    onLocaleMenuOpenChange: controller.setLocaleMenuOpen,
    onLocaleChange: controller.setLocale
  };
  const currentRouteLabel = currentPath === "/work/readback"
    // The fallback here was a bilingual ternary, which was dead code twice over:
    // `workReadbackLabel` is present in all five locales in `data.ts`, and
    // `copyText` already falls back through the English table before reaching the
    // literal. A two-branch fallback would only ever fire if the key vanished
    // from every locale at once, and then it would answer in the wrong language
    // on three routes out of five.
    ? copyText(currentCopy, "workReadbackLabel", "Work readback")
    : currentPath.startsWith("/work/")
      ? getWorkMockupPageTitle(currentPath, currentLocale)
      : pick(currentLocale, currentRoute.label);
  const navGroups: ProductShellNavGroup[] = shellNavGroups.map((group) => ({
    id: group.id,
    // `pick` where three ternaries used to be: the nav is on every screen, so a
    // two-branch label here was the app's most-rendered English leak.
    label: pick(currentLocale, group.label),
    sectionLabel: pick(currentLocale, group.label),
    selected: group.items.some((item) => item.id === currentRouteId),
    items: group.items.map((item) => ({
      id: item.id,
      label: pick(currentLocale, item.label),
      href: buildRouteHref(item.path, {
        locale: currentLocale,
        theme: controller.theme,
        collapsed: visualInstanceCollapsed,
        inheritedSearch: currentSearch
      }),
      iconName: item.icon,
      selected: item.id === currentRouteId
    }))
  }));
  return (
    <ProductShell
      {...productShellControlProps}
      productName={copyText(currentCopy, "productName", "TCRN AOS")}
      moduleName={copyText(currentCopy, "moduleName", "Operations Cockpit")}
      brandProductId="aos"
      brandMarkSrc="/assets/tcrn-brand-mark.svg"
      // DS defaults brandHref to a bare "/", which was the one link on every page
      // that dropped the user's scope (TCRN-AOS-INC-014). The route table's own
      // root entry, carried through routeHref, keeps the home link in step with
      // every other link the shell draws.
      brandHref={buildRouteHref("/", {
        locale: currentLocale,
        theme: controller.theme,
        collapsed: visualInstanceCollapsed,
        inheritedSearch: currentSearch
      })}
      currentRouteLabel={currentRouteLabel}
      currentLocationLabel={copyText(currentCopy, "currentLocation", "Current location")}
      navLabel={copyText(currentCopy, "navLabel", "AOS operations navigation")}
      navGroups={navGroups}
      headerActions={
        <ShellHeaderActions
          locale={currentLocale}
          partitions={chainPartitions}
          activePartitionId={activePartitionId}
          requiresSingleProject={requiresSingleProject(currentPath)}
          routeHref={(path) => buildRouteHref(path, {
            locale: currentLocale,
            theme: controller.theme,
            collapsed: visualInstanceCollapsed,
            inheritedSearch: currentSearch
          })}
        />
      }
      locales={servedLocaleMetadata}
      collapsedStorageKey={sideNavStorageKey}
      contentId="content"
      contentRole="main"
      contentLabel={copyText(currentCopy, "contentLabel", "AOS operations workspace")}
      skipLinkLabel={copyText(currentCopy, "skipLink", "Skip to operations content")}
      data-aos-shell="owner-quality-product-shell"
      data-storybook-visual-instance="aos-owner-quality-product-shell"
      data-visual-instance-name="AosOwnerQualityProductShell"
      data-visual-instance-disposition="ds_oracle_review_required_before_owner_admission"
      data-visual-instance-style-source="@tcrn/ui-react/tcrnComponentCss"
      data-visual-instance-owner-quality="product-first"
      data-visual-instance-slots="registered-product-logo side-nav topbar theme-locale operations-cockpit work-queue gates-evidence owner-actions service-health secondary-disclosure"
      data-visual-instance-primary-ia="operations-cockpit-work-queue"
      data-visual-instance-negative-criteria="no-proof-scaffold-hero no-dummy-cockpit no-raw-primary no-owner-readiness"
      data-visual-instance-product-logo={aosProductLogoAsset.assetId}
      data-product-logo-asset-id={aosProductLogoAsset.assetId}
      data-product-logo-line-one={aosProductLogoAsset.lineOne}
      // `lineTwo` became a per-locale record when the tagline was localized, and this
      // attribute was still handed the whole record, so the marker read
      // `[object Object]` on every page in every locale. A `data-*` attribute takes
      // any value and stringifies it, which is why this typechecked and built; the
      // gate that requires the marker's exact text was the only thing that could
      // catch it. DS exports the resolver for exactly this.
      data-product-logo-line-two={tcrnProductTagline("aos", currentLocale)}
      data-visual-instance-mobile-collapse-policy="hidden-affordance"
      data-visual-instance-variant={visualInstanceVariant}
      data-visual-instance-theme={controller.theme}
      data-tcrn-theme={controller.theme}
      data-visual-instance-locale={currentLocale}
      data-visual-instance-collapsed={visualInstanceCollapsed ? "true" : "false"}
      // Re-scoped, not retired: below the breakpoint the *width-collapse*
      // control is still hidden, because narrowing a rail to 92px in a
      // full-width stacked layout is a control that does nothing. What the old
      // value silently also claimed — that no way to put the navigation away
      // was needed — was never ruled on, and stopped being true when the shell
      // went from two destinations to eleven (TCRN-AOS-MIN-006).
      data-owner-quality-collapse-policy={browserVisualState.viewport === "mobile" ? "mobile-hidden-width-collapse-affordance" : "desktop-actionable-collapse-toggle"}
      data-visual-instance-route={oracleRouteId}
      data-visual-instance-search="not-rendered"
      data-visual-instance-viewport={browserVisualState.viewport}
      data-visual-instance-reduced-motion={browserVisualState.reducedMotion ? "true" : "false"}
      data-visual-instance-content={oracleRouteId}
      data-owner-quality-product-shell-oracle="true"
      data-design-system-source="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state"
      data-storybook-contract-consumed="product-shell-semantic-boundary"
      data-storybook-visual-instance-consumed="aos-owner-quality-product-shell"
      data-ds-product-shell-boundary-consumed="ProductShell useProductShellController no-global-search"
      data-product-shell-global-search="not-rendered"
      data-product-shell-search-capability="absent"
      data-product-shell-header-actions-consumed="workspace-switcher as-of"
      data-product-shell-locale-persistence="url-canonical"
      data-local-wrapper-event-delegation="absent"
      data-local-shell-effect-clones="removed"
      data-cockpit-aggregation="deferred"
      data-aos-registered-module-boundary="cockpit-work-only"
      data-current-path={currentPath}
    >
      <OwnerQualityContent
        apiReadback={apiReadback}
        copy={currentCopy}
        currentPath={currentPath}
        search={currentSearch}
        collapsed={visualInstanceCollapsed}
        theme={controller.theme}
        locale={currentLocale}
        route={currentRouteId}
        variant={visualInstanceVariant}
        viewport={browserVisualState.viewport}
        routeHref={(path) => buildRouteHref(path, {
          locale: currentLocale,
          theme: controller.theme,
          collapsed: visualInstanceCollapsed,
          inheritedSearch: currentSearch
        })}
        {...(initialSurface ? { surface: initialSurface } : {})}
      />
    </ProductShell>
  );
}

function OwnerQualityContent({
  surface,
  apiReadback,
  copy,
  currentPath,
  search,
  collapsed,
  theme,
  locale,
  route,
  variant,
  viewport,
  routeHref
}: {
  apiReadback: ApiReadbackState;
  copy: Record<string, string>;
  currentPath: string;
  /** The query the page was requested with; see readSearch. */
  search: string;
  collapsed: boolean;
  theme: "light" | "dark";
  locale: TcrnLocale;
  route: AosRouteId;
  variant: string;
  viewport: VisualInstanceViewportState;
  routeHref: (path: string) => string;
  surface?: "local" | "mirror";
}) {
  // Legacy paths are matched on the path itself and matched FIRST. The module
  // routes below are reached by nav id, and /work/* resolves to the work-items
  // module so the shell can highlight something truthful — which would otherwise
  // let a module view swallow the legacy views their receipts still assert.
  const isLegacyWorkRoute = currentPath === "/work" || currentPath.startsWith("/work/");
  const isWorkFirst = isLegacyWorkRoute || route === "work-items";

  // Module views are addressed by their own exact paths, not by the resolved
  // route id. `resolveCurrentRoute` falls back to a default so the shell always
  // highlights something, and routing on that fallback would let a module view
  // swallow every legacy path whose receipts still assert the old content.
  const modulePath = currentPath === "/" ? "/my-work" : currentPath.split("?")[0] ?? currentPath;
  const moduleId = shellNavItems.find((item) =>
    item.path === modulePath || modulePath.startsWith(`${item.path}/`))?.id;
  // Every module view is wrapped, so the "which copy, how fresh" statement is
  // standing rather than something a reader only meets on certain screens.
  const framed = (view: ReactNode) => (
    <>
      <CockpitEnvironmentBanner locale={locale} {...(surface ? { initialSurface: surface } : {})} />
      {view}
    </>
  );

  if (!isLegacyWorkRoute) {
    if (moduleId === "my-work") {
      return framed(<MyWorkView locale={locale} routeHref={routeHref} />);
    }
    if (moduleId === "inbox") {
      return framed(<InboxView locale={locale} routeHref={routeHref} />);
    }
    if (moduleId === "projects") {
      return framed(<ProjectsView locale={locale} routeHref={routeHref} />);
    }
    if (moduleId === "work-items") {
      // A path under the module addresses one item; the module root lists them.
      const key = modulePath.startsWith("/work-items/")
        ? decodeURIComponent(modulePath.slice("/work-items/".length))
        : null;
      return framed(key
        ? <WorkItemDetailView locale={locale} routeHref={routeHref} itemKey={key} />
        : <WorkItemsView locale={locale} routeHref={routeHref} search={readSearch(currentPath, search)} />);
    }
    if (moduleId === "deliberations") {
      const key = modulePath.startsWith("/deliberations/")
        ? decodeURIComponent(modulePath.slice("/deliberations/".length))
        : null;
      return framed(key
        ? <DeliberationRoomView locale={locale} routeHref={routeHref} conferenceKey={key} />
        : <DeliberationsView locale={locale} routeHref={routeHref} search={readSearch(currentPath, search)} />);
    }
    if (moduleId === "dashboard") {
      return framed(<DashboardView locale={locale} routeHref={routeHref} />);
    }
    if (moduleId === "board") {
      return framed(<BoardView locale={locale} routeHref={routeHref} search={readSearch(currentPath, search)} />);
    }
    if (moduleId === "release-trains") {
      return framed(<ReleaseTrainsView locale={locale} routeHref={routeHref} />);
    }
    if (moduleId === "audit") {
      return framed(<AuditView locale={locale} routeHref={routeHref} />);
    }
    if (moduleId === "snapshots") {
      return framed(<SnapshotHealthView locale={locale} routeHref={routeHref} />);
    }
    if (moduleId === "knowledge-space") {
      return framed(<KnowledgeSpaceView locale={locale} routeHref={routeHref} search={readSearch(currentPath, search)} />);
    }
  }
  if (isLegacyWorkRoute) {
    if (currentPath === "/work/readback") {
      return (
        <Phase3DogfoodReadback
          locale={locale}
          theme={theme}
          routeHref={routeHref}
        />
      );
    }
    return (
      <>
        <WorkManagementMockups
          path={currentPath}
          locale={locale}
          theme={theme}
          collapsed={collapsed}
          variant={variant}
          viewport={viewport}
          routeHref={routeHref}
        />
        <EnvironmentBanner label={copyText(copy, "boundary", "Read-only preview")} state={{ state: "local_only" }} locale={locale} />
        <DeveloperDisclosure apiReadback={apiReadback} copy={copy} />
      </>
    );
  }
  return (
    <div className="tcrn-product-shell-content-stack" data-package-owned-spacing-rhythm="product-shell-content-stack">
      <Surface
        data-owner-quality-primary-heading="true"
        data-owner-quality-first-viewport="product-led"
      >
        <Heading level={1} visualLevel={2} id={isWorkFirst ? "work-heading" : "operations-heading"}>
          {isWorkFirst
            ? copyText(copy, "workTitle", "Work queue")
            : copyText(copy, "primaryTitle", "AOS Operations Cockpit")}
        </Heading>
        <Text>
          {isWorkFirst
            ? copyText(copy, "workIntro", "Scan current work by owner, gate, and next action.")
            : copyText(copy, "primaryDescription", "Track current rebuild work, gates, evidence, decisions, and owner actions without live dispatch.")}
        </Text>
        <EvidenceStrip items={[
          copyText(copy, "boundary", "Read-only preview"),
          copyText(copy, "localProof", "Local proof only"),
          copyText(copy, "noDispatch", "No live dispatch")
        ]} />
      </Surface>
      <div className="tcrn-product-shell-section-grid" data-package-owned-section-rhythm="work-gates">
        <Surface data-owner-quality-work-queue="true" data-aos-work-module-entry="owner-quality-work-queue" aria-label={`${copyText(copy, "workTitle", "Work queue")}: ${variant}`}>
          <Heading level={2}>{copyText(copy, "workTitle", "Work queue")}</Heading>
          <WorkIndex rows={ownerQualityQueueRows(locale)} label={copyText(copy, "workTitle", "Work queue")} locale={locale} />
        </Surface>
        <Surface data-owner-quality-gates="true" aria-label={`${copyText(copy, "gateTitle", "Gates and evidence")}: ${variant}`}>
          <Heading level={2}>{copyText(copy, "gateTitle", "Gates and evidence")}</Heading>
          <TableShell
            label={copyText(copy, "gateTitle", "Gates and evidence")}
            columns={[
              { key: "gate", label: copyText(copy, "gate", "Gate") },
              { key: "evidence", label: copyText(copy, "evidence", "Evidence") },
              { key: "decision", label: copyText(copy, "decision", "Decision") },
              { key: "owner", label: "Owner" },
              { key: "state", label: copyText(copy, "state", "State") }
            ]}
            rows={ownerQualityGateRows(locale)}
          />
        </Surface>
      </div>
      <Surface data-owner-quality-actions="true" aria-label={`${copyText(copy, "actionTitle", "Owner actions")}: ${variant}`}>
        <Heading level={2}>{copyText(copy, "actionTitle", "Owner actions")}</Heading>
        <TableShell
          label={copyText(copy, "actionTitle", "Owner actions")}
          columns={[
            { key: "action", label: copyText(copy, "action", "Action") },
            { key: "reason", label: copyText(copy, "reason", "Reason") },
            { key: "state", label: copyText(copy, "state", "State") }
          ]}
          rows={ownerQualityActionRows(locale)}
        />
      </Surface>
      <Surface data-owner-quality-service-health="true" aria-label={`${copyText(copy, "healthTitle", "Service health")}: ${variant}`}>
        <Heading level={2}>{copyText(copy, "healthTitle", "Service health")}</Heading>
        <KeyValueList items={ownerQualityServiceItems(locale, apiReadback)} />
      </Surface>
      <Surface data-owner-quality-activity="true" aria-label={`${copyText(copy, "activityTitle", "Activity")}: ${variant}`}>
        <Heading level={2}>{copyText(copy, "activityTitle", "Activity")}</Heading>
        <Text>{copyText(copy, "activityText", "Recent activity focuses on the DS baseline, AOS implementation, QA evidence, and PM readiness.")}</Text>
      </Surface>
      <EnvironmentBanner label={copyText(copy, "boundary", "Read-only preview")} state={{ state: "local_only" }} locale={locale} />
      <DeveloperDisclosure apiReadback={apiReadback} copy={copy} />
    </div>
  );
}

function DeveloperDisclosure({ apiReadback, copy }: { apiReadback: ApiReadbackState; copy: Record<string, string> }) {
  return (
    <DisclosurePanel
      expanded={false}
      title={copyText(copy, "disclosureTitle", "Developer details")}
      data-owner-quality-secondary-disclosure="true"
      data-aos-registered-module-boundary="cockpit-work-only"
      data-raw-json-disclosure="secondary"
    >
      <Text data-api-state>{apiReadback.statusText}</Text>
      <KeyValueList
        items={[
          { key: "runtime", label: copyText(copy, "api", "API"), value: <span data-api-runtime>{apiReadback.runtime}</span> },
          { key: "queue", label: copyText(copy, "externalQueue", "External queue"), value: <span data-api-queue>{apiReadback.queue}</span> },
          { key: "policy", label: "Policy", value: <span data-api-policy>{apiReadback.policy}</span> },
          { key: "counts", label: copyText(copy, "readbackCounts", "Readback counts"), value: <span data-api-counts>{apiReadback.counts}</span> }
        ]}
      />
      <Text>{copyText(copy, "developerDetailsText", "Technical receipts, API summaries, and debug payloads stay in secondary disclosure and must not become the owner first-viewport story.")}</Text>
      <pre hidden data-api-summary>{JSON.stringify(apiReadback.summary, null, 2)}</pre>
    </DisclosurePanel>
  );
}

/**
 * Owner-quality fixture copy in all five locales.
 *
 * These four tables are the visual-proof fixture: fixed prose, deliberately not
 * read from the chain, so that a screenshot of this route means the same thing
 * from one build to the next. Fixed does not mean English — it is still prose a
 * reader reads, and it was bilingual, so the ja, ko and fr instances of the
 * proof were three tables of English inside a translated shell. Every string a
 * reader sees goes through `pick`, fixture or not; what makes this copy special
 * is that it does not move, not that it does not need translating.
 */
const ownerQualityCopy = {
  oracleTitle: {
    "zh-CN": "定义 owner 质量视觉基准",
    en: "Define owner-quality visual baseline",
    ja: "owner 品質の視覚基準を定義する",
    ko: "owner 품질 시각 기준 정의",
    fr: "Définir la référence visuelle de qualité owner"
  },
  remediationTitle: {
    "zh-CN": "将 AOS 首页映射到新基准",
    en: "Map AOS first viewport to new baseline",
    ja: "AOS の初期表示を新基準に対応させる",
    ko: "AOS 첫 화면을 새 기준에 대응",
    fr: "Aligner le premier écran AOS sur la nouvelle référence"
  },
  qaEvidenceTitle: {
    "zh-CN": "专业 QA 证据包",
    en: "Professional QA evidence packet",
    ja: "専門 QA の証跡パッケージ",
    ko: "전문 QA 증거 패킷",
    fr: "Dossier de preuves QA professionnel"
  },
  gateVisualBaseline: {
    "zh-CN": "DS 视觉基准",
    en: "DS visual baseline",
    ja: "DS の視覚基準",
    ko: "DS 시각 기준",
    fr: "Référence visuelle DS"
  },
  gateVisualEvidence: {
    "zh-CN": "Storybook owner 质量实例",
    en: "Storybook owner-quality instance",
    ja: "Storybook の owner 品質インスタンス",
    ko: "Storybook owner 품질 인스턴스",
    fr: "Instance de qualité owner dans Storybook"
  },
  gateVisualDecision: {
    "zh-CN": "等待 review",
    en: "Awaiting review",
    ja: "レビュー待ち",
    ko: "검토 대기",
    fr: "En attente de revue"
  },
  gateFreshness: {
    "zh-CN": "运行时新鲜度",
    en: "Runtime freshness",
    ja: "実行時の鮮度",
    ko: "런타임 신선도",
    fr: "Fraîcheur d'exécution"
  },
  gateFreshnessEvidence: {
    "zh-CN": "4317 同端口刷新",
    en: "4317 same-port refresh",
    ja: "4317 同一ポートでの再読み込み",
    ko: "4317 동일 포트 새로 고침",
    fr: "Rechargement sur le même port 4317"
  },
  gateFreshnessDecision: {
    "zh-CN": "实现后路由",
    en: "Route after implementation",
    ja: "実装後に経路を通す",
    ko: "구현 후 라우팅",
    fr: "Router après l'implémentation"
  },
  gateInspection: {
    "zh-CN": "Owner 检查",
    en: "Owner inspection",
    ja: "Owner による検査",
    ko: "Owner 점검",
    fr: "Inspection par l'owner"
  },
  gateInspectionEvidence: {
    "zh-CN": "QA 与 PM 通过后",
    en: "After QA and PM pass",
    ja: "QA と PM の通過後",
    ko: "QA와 PM 통과 후",
    fr: "Après validation QA et PM"
  },
  gateInspectionDecision: {
    "zh-CN": "未准备",
    en: "Not ready",
    ja: "未準備",
    ko: "준비되지 않음",
    fr: "Pas prêt"
  },
  actionApprove: {
    "zh-CN": "批准 owner 可见预览",
    en: "Approve owner-visible preview",
    ja: "owner が見るプレビューを承認する",
    ko: "owner 가시 미리보기 승인",
    fr: "Approuver l'aperçu visible par l'owner"
  },
  actionApproveReason: {
    "zh-CN": "等待 DS review、QA 与 PM",
    en: "Waiting on DS review, QA, and PM",
    ja: "DS レビュー・QA・PM を待っています",
    ko: "DS 검토, QA, PM 대기 중",
    fr: "En attente de la revue DS, du QA et du PM"
  },
  actionDispatch: {
    "zh-CN": "打开实时派发",
    en: "Enable live dispatch",
    ja: "実時間ディスパッチを有効にする",
    ko: "실시간 디스패치 활성화",
    fr: "Activer la répartition en direct"
  },
  actionDispatchReason: {
    "zh-CN": "不在此切片范围",
    en: "Out of scope for this slice",
    ja: "このスライスの範囲外です",
    ko: "이 슬라이스의 범위 밖입니다",
    fr: "Hors périmètre de cette tranche"
  },
  disabled: { "zh-CN": "已禁用", en: "Disabled", ja: "無効", ko: "사용 중지", fr: "Désactivé" },
  unavailable: { "zh-CN": "不可用", en: "Unavailable", ja: "利用不可", ko: "사용 불가", fr: "Indisponible" },
  externalQueue: {
    "zh-CN": "外部队列",
    en: "External queue",
    ja: "外部キュー",
    ko: "외부 큐",
    fr: "File externe"
  },
  liveDispatch: {
    "zh-CN": "实时派发",
    en: "Live dispatch",
    ja: "実時間ディスパッチ",
    ko: "실시간 디스패치",
    fr: "Répartition en direct"
  },
  nextGate: { "zh-CN": "下一门禁", en: "Next gate", ja: "次のゲート", ko: "다음 게이트", fr: "Porte suivante" },
  readOnlySummary: {
    "zh-CN": "本地只读摘要",
    en: "Read-only local summary",
    ja: "ローカルの読み取り専用サマリ",
    ko: "로컬 읽기 전용 요약",
    fr: "Résumé local en lecture seule"
  },
  none: { "zh-CN": "无", en: "None", ja: "なし", ko: "없음", fr: "Aucune" },
  notEnabled: {
    "zh-CN": "未启用",
    en: "Not enabled",
    ja: "有効化されていません",
    ko: "활성화되지 않음",
    fr: "Non activé"
  },
  renderedReview: {
    "zh-CN": "Elara 渲染评审",
    en: "Elara rendered review",
    ja: "Elara による描画レビュー",
    ko: "Elara 렌더링 검토",
    fr: "Revue de rendu par Elara"
  }
} satisfies Record<string, CopyEntry>;

function ownerQualityQueueRows(locale: TcrnLocale): WorkIndexRow[] {
  return [
    {
      id: "owner-quality-oracle",
      title: pick(locale, ownerQualityCopy.oracleTitle),
      state: { state: "review_required" },
      owner: "Elara"
    },
    {
      id: "aos-remediation",
      title: pick(locale, ownerQualityCopy.remediationTitle),
      state: { state: "blocked" },
      owner: "Ilya"
    },
    {
      id: "qa-evidence",
      title: pick(locale, ownerQualityCopy.qaEvidenceTitle),
      state: { state: "not_configured" },
      owner: "Rowan"
    }
  ];
}

function ownerQualityGateRows(locale: TcrnLocale) {
  return [
    {
      gate: pick(locale, ownerQualityCopy.gateVisualBaseline),
      evidence: pick(locale, ownerQualityCopy.gateVisualEvidence),
      decision: pick(locale, ownerQualityCopy.gateVisualDecision),
      owner: "Elara",
      state: <StatusBadge state={{ state: "review_required" }} locale={locale} />
    },
    {
      gate: pick(locale, ownerQualityCopy.gateFreshness),
      evidence: pick(locale, ownerQualityCopy.gateFreshnessEvidence),
      decision: pick(locale, ownerQualityCopy.gateFreshnessDecision),
      owner: "Atlas",
      state: <StatusBadge state={{ state: "blocked" }} locale={locale} />
    },
    {
      gate: pick(locale, ownerQualityCopy.gateInspection),
      evidence: pick(locale, ownerQualityCopy.gateInspectionEvidence),
      decision: pick(locale, ownerQualityCopy.gateInspectionDecision),
      owner: "Mara",
      state: <StatusBadge state={{ state: "not_claimed" }} locale={locale} />
    }
  ];
}

function ownerQualityActionRows(locale: TcrnLocale) {
  return [
    {
      action: pick(locale, ownerQualityCopy.actionApprove),
      reason: pick(locale, ownerQualityCopy.actionApproveReason),
      state: <Badge tone="warning">{pick(locale, ownerQualityCopy.disabled)}</Badge>
    },
    {
      action: pick(locale, ownerQualityCopy.actionDispatch),
      reason: pick(locale, ownerQualityCopy.actionDispatchReason),
      state: <Badge tone="neutral">{pick(locale, ownerQualityCopy.unavailable)}</Badge>
    }
  ];
}

function ownerQualityServiceItems(locale: TcrnLocale, apiReadback: ApiReadbackState) {
  return [
    {
      key: "api",
      // "API" is the same three letters in all five locales, so it is written once
      // rather than as a five-way entry that would only ever pick the same string.
      label: "API",
      value: (
        <span data-metric-value="runtime">
          {apiReadback.runtime === "pending"
            ? pick(locale, ownerQualityCopy.readOnlySummary)
            : apiReadback.runtime}
        </span>
      )
    },
    {
      key: "queue",
      label: pick(locale, ownerQualityCopy.externalQueue),
      value: (
        <span data-metric-value="queue">
          {apiReadback.queue === "pending" ? pick(locale, ownerQualityCopy.none) : apiReadback.queue}
        </span>
      )
    },
    {
      key: "dispatch",
      label: pick(locale, ownerQualityCopy.liveDispatch),
      value: pick(locale, ownerQualityCopy.notEnabled)
    },
    {
      key: "nextGate",
      label: pick(locale, ownerQualityCopy.nextGate),
      value: pick(locale, ownerQualityCopy.renderedReview)
    }
  ];
}

function copyText(copy: Record<string, string>, key: string, fallback: string): string {
  return copy[key] ?? localeCopy.en[key] ?? fallback;
}

/**
 * The state the first byte is rendered with.
 *
 * Precedence is query → stored preference → default, and the order is the whole
 * point. The query is an explicit instruction about *this* request — a shared link,
 * a gate's `?locale=ja&theme=dark`, an accepted visual variant — so it outranks a
 * standing preference. The stored preference outranks the default, which is what
 * removes the flash. The default is what a first-time reader gets.
 *
 * `locale` used to skip the middle term entirely: it read the query and fell
 * straight to `tcrnDefaultLocale`, so a chosen language survived only as long as
 * links kept carrying it.
 */
function readInitialShellState(ssrPath = "/cockpit", ssrSearch = "", cookieHeader?: string): InitialShellState {
  const params = typeof window === "undefined"
    ? new URLSearchParams(ssrSearch.replace(/^\?/, ""))
    : new URLSearchParams(window.location.search);
  const currentPath = typeof window === "undefined" ? ssrPath : window.location.pathname;
  const collapsedFromQuery = params?.get("collapsed");
  const ownerQualityRoutePolicy = resolveOwnerQualityRoutePolicy(currentPath, params);
  // The cookie parse is the Design System's, so the whole platform narrows the
  // same way; this file used to carry its own copy of it. `localStorage` still
  // outranks the cookie where it can answer — it is the store the browser cannot
  // drop on its own — and on the server only the parsed cookie exists.
  const cookiePreferences = readPreferenceCookieValues(
    cookieHeader ?? readDocumentCookie(),
    { collapsedKey: sideNavStorageKey, themeKey: themeStorageKey, localeKey: localeStorageKey }
  );
  const browserCollapsed = readBrowserStorage(sideNavStorageKey);
  const browserTheme = readBrowserStorage(themeStorageKey);
  const storedCollapsed = browserCollapsed !== null ? browserCollapsed === "true" : cookiePreferences.collapsed;
  const storedTheme = browserTheme !== null ? resolveTheme(browserTheme) : cookiePreferences.theme;
  const storedLocale = readBrowserStorage(localeStorageKey) ?? cookiePreferences.locale;
  const themeFromQuery = params?.get("theme");
  const localeFromQuery = params?.get("locale");
  return {
    currentSearch: params.toString(),
    collapsed: collapsedFromQuery === "true"
        ? true
        : collapsedFromQuery === "false"
          ? false
          : storedCollapsed ?? false,
    theme: ownerQualityRoutePolicy.theme
      ?? (themeFromQuery !== null ? resolveTheme(themeFromQuery) : storedTheme ?? "light"),
    // `resolveLocale` rejects an unsupported value, so a stale cookie naming a locale
    // the product has dropped resolves to the default rather than rendering nothing.
    locale: ownerQualityRoutePolicy.locale ?? resolveLocale(localeFromQuery ?? storedLocale),
    // Which of the three the request decided for itself. The shell is handed a storage
    // key only for the others, so a stored preference cannot outrank an explicit link.
    overriddenByRequest: {
      collapsed: collapsedFromQuery === "true" || collapsedFromQuery === "false",
      theme: Boolean(ownerQualityRoutePolicy.theme) || themeFromQuery !== null,
      locale: Boolean(ownerQualityRoutePolicy.locale) || localeFromQuery !== null
    },
    currentPath
  };
}

function readBrowserVisualState(): BrowserVisualState {
  if (typeof window === "undefined") {
    return { viewport: "desktop", reducedMotion: false };
  }
  return {
    viewport: window.matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop",
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
  };
}

function resolveVisualInstanceVariant({
  route,
  theme,
  locale,
  collapsed,
  viewport,
  reducedMotion
}: {
  route: AosRouteId;
  theme: "light" | "dark";
  locale: TcrnLocale;
  collapsed: boolean;
  viewport: VisualInstanceViewportState;
  reducedMotion: boolean;
}): string {
  if (reducedMotion && viewport === "desktop" && route === "cockpit" && theme === "light" && locale === "en" && !collapsed) {
    return "reduced-motion";
  }
  if (viewport === "mobile" && route === "work" && theme === "dark" && locale === "zh-CN") {
    return "mobile-dark-zh-cn-work-queue";
  }
  if (viewport === "desktop" && route === "work" && theme === "light" && locale === "en") {
    return collapsed ? "desktop-light-work-queue-collapsed" : "desktop-light-work-queue";
  }
  if (viewport === "desktop" && route === "cockpit" && theme === "dark" && locale === "en") {
    return collapsed ? "desktop-dark-operations-cockpit-collapsed" : "desktop-dark-operations-cockpit";
  }
  if (viewport === "desktop" && route === "cockpit" && theme === "light" && locale === "en") {
    return collapsed ? "desktop-light-operations-cockpit-collapsed" : defaultOwnerQualityVariant;
  }
  return outsideAcceptedOwnerQualityMatrix;
}

/**
 * The oracle's idea of where we are — a page identity, not a nav highlight.
 *
 * `/cockpit` and `/work` predate the module navigation. `resolveCurrentRoute`
 * maps them onto the nearest module so the sidebar highlights something
 * truthful, and that is exactly how they stopped matching the accepted-variant
 * matrix: the matrix names the pages the Owner accepted, and those pages kept
 * their own addresses while their nav identity moved. Behind the earlier red
 * gates nothing ran to notice. The two aliases here are the two the matrix
 * names; every other path is its nav identity.
 */
function resolveOwnerQualityOracleRoute(path: string): string {
  if (path === "/cockpit" || path === "/operations-cockpit" || path.endsWith("/operations-cockpit.html")) {
    return "cockpit";
  }
  if (path === "/work" || path.startsWith("/work/")) return "work";
  return resolveCurrentRoute(path).id;
}

function resolveOwnerQualityRoutePolicy(path: string, params: URLSearchParams | undefined): OwnerQualityRoutePolicy {
  const route = resolveOwnerQualityOracleRoute(path);
  const theme = params?.get("theme") ?? null;
  const locale = params?.get("locale") ?? null;
  // Both named, or no policy. This used to fire on an absent `theme`/`locale`
  // too, which made the accepted-variant pin outrank a stored preference on the
  // product's own front page: a reader who chose Japanese and dark got English
  // and light on /cockpit and nowhere else. That is the defect INC-017 was
  // filed about, reappearing as an acceptance rule. An accepted variant is a
  // *named* state — every row of the matrix names it in the query — so the
  // policy now requires the request to say so, and silence belongs to the
  // reader's own preference.
  if (theme === null || locale === null) {
    return { reason: "unclaimed_state" };
  }
  if (route === "cockpit" && locale === tcrnDefaultLocale) {
    if (theme === "dark") {
      return { theme: "dark", locale: tcrnDefaultLocale, reason: "accepted_owner_quality_variant" };
    }
    if (theme === "light") {
      return { theme: "light", locale: tcrnDefaultLocale, reason: "accepted_owner_quality_variant" };
    }
  }
  if (route === "work") {
    if (theme === "light" && locale === tcrnDefaultLocale) {
      return { theme: "light", locale: tcrnDefaultLocale, reason: "accepted_owner_quality_variant" };
    }
    if (theme === "dark" && locale === "zh-CN") {
      return { theme: "dark", locale: "zh-CN", reason: "accepted_owner_quality_variant" };
    }
  }
  return { reason: "unclaimed_state" };
}

/**
 * A link that carries the shell's own state alongside whatever query the caller
 * asked for.
 *
 * The caller's query is merged rather than appended. Appending produced a second
 * `?`, which browsers and `URLSearchParams` alike read as part of the preceding
 * value — so `/work-items?project=TCRN-TMS` plus shell state became a filter for
 * the project literally named "TCRN-TMS?locale=en", and every facet on the work
 * items page returned nothing. Shell keys are set last so a caller cannot
 * accidentally send the shell somewhere the user did not ask to go.
 *
 * An empty value **removes** a key. Inheritance alone can only ever add, and a
 * cockpit full of filters needs links that take something away: "clear search",
 * "reset view", "all deliberations". Before this rule those links were written
 * the only way the helper allowed — as a bare route with no query — and under
 * inheritance a link that names no keys keeps every one of them, so each of them
 * led back to the state it was offering to leave. Absence cannot mean "drop
 * this", because absence is also what every unrelated link says about every key
 * it does not care about; subtraction has to be stated.
 */
function buildRouteHref(
  path: string,
  state: {
    locale: TcrnLocale;
    theme: "light" | "dark";
    collapsed: boolean;
    /** The query in force on the page this link is rendered on. */
    inheritedSearch?: string;
  }
): string {
  const mark = path.indexOf("?");
  const pathname = mark >= 0 ? path.slice(0, mark) : path;
  // Three layers, weakest first: the query in force on this page, then whatever
  // the caller asked for, then the shell's own keys.
  //
  // Inheriting rather than listing is deliberate. A list of keys to carry would
  // be a second copy of "which keys matter", and it would drift the moment a view
  // read a new one — which is how this defect got its size: fifteen keys read,
  // three carried, and only the three the shell happened to own. Inheritance has
  // no list to fall out of date.
  const params = new URLSearchParams(state.inheritedSearch ?? "");
  for (const [key, value] of new URLSearchParams(mark >= 0 ? path.slice(mark + 1) : "")) {
    // `?q=` — the key present with an empty value — is how a caller says "drop
    // this one". It cannot collide with a real filter: every view treats an
    // empty string as unset already, so a key that survived here with no value
    // would filter on nothing and only make the URL longer.
    if (value === "") params.delete(key);
    else params.set(key, value);
  }
  params.set("locale", state.locale);
  params.set("theme", state.theme);
  params.set("collapsed", state.collapsed ? "true" : "false");
  return `${pathname}?${params.toString()}`;
}

function updateUrlLocale(locale: TcrnLocale): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("locale", locale);
  url.searchParams.delete("search");
  window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
}

function removeUnsupportedSearchParam(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("search")) return;
  url.searchParams.delete("search");
  const query = url.searchParams.toString();
  window.history.replaceState(window.history.state, "", `${url.pathname}${query ? `?${query}` : ""}${url.hash}`);
}

/**
 * Which chain the cockpit is currently scoped to. Project-scoped routes name it
 * in the path; everywhere else the cockpit is cross-project and shows the
 * platform governance chain, whose version is the one a global view is read at.
 */
/**
 * The query in force for a route.
 *
 * `search` is the request's own query, threaded down from the shell state. It is
 * a parameter rather than something read from `window` because reading the
 * browser was the defect (TCRN-AOS-INC-014): during SSR there is no `window`, so
 * every server-rendered page filtered on an empty query and every link it drew
 * carried nothing. The path is still accepted with a query on it for callers that
 * hold a full URL, and wins when present.
 */
function readSearch(path: string, search = ""): URLSearchParams {
  const mark = path.indexOf("?");
  if (mark >= 0) return new URLSearchParams(path.slice(mark + 1));
  return new URLSearchParams(search);
}

/**
 * Which project the cockpit is scoped to, or null for all of them.
 *
 * It reads the same `?project=` the pages filter on, so the header and the list
 * can never disagree: they are two views of one value rather than two controls
 * over the same idea. Null is a real answer — a cross-project route is scoped to
 * everything, and the header used to claim one partition while the list showed
 * four, which is a scope statement the page did not honour.
 */
function resolveActivePartition(path: string, search = ""): string | null {
  const scoped = chainPartitions.find((partition) => path.startsWith(`/projects/${partition.id}`));
  if (scoped) return scoped.id;
  const requested = readSearch(path, search).get("project");
  return chainPartitions.some((partition) => partition.id === requested) ? requested : null;
}

/**
 * Routes that render one project at a time. The board's columns are one
 * project's work; there is no cross-project form of it, so the scope picker
 * offers "all projects" disabled with that reason rather than omitting it.
 */
function requiresSingleProject(path: string): boolean {
  const route = path.split("?")[0] ?? path;
  return route === "/board" || route.startsWith("/board/");
}

function resolveCurrentRoute(path: string): ShellNavItem {
  // Longest matching prefix wins, so /work-items/TCRN-CROSS-STORY-105 stays under
  // its module instead of falling through to the default route.
  const exact = shellNavItems.find((item) => item.path === path);
  if (exact) return exact;
  // Legacy work routes (/work, /work/readback, /work/board …) predate the module
  // navigation and are asserted by existing receipts. They resolve to the work
  // items module so the shell highlights something truthful, while their views
  // continue to render from the path.
  if (path === "/work" || path.startsWith("/work/")) {
    const workItems = shellNavItems.find((item) => item.id === "work-items");
    if (workItems) return workItems;
  }
  const prefixed = shellNavItems
    .filter((item) => path.startsWith(`${item.path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0];
  if (prefixed) return prefixed;
  return shellNavItems.find((item) => path.endsWith(`${item.path}.html`)) ?? defaultShellRoute;
}

/**
 * A requested locale, or the default.
 *
 * Checked against what this product serves rather than what DS supports, for the same
 * reason the menu is: a `?locale=` naming a declared-but-uncovered language would
 * otherwise render a page of English under a Japanese `lang` attribute, which is worse
 * than rendering the default — it tells the reader, and any assistive technology
 * reading the attribute, that the page is in a language it is not.
 */
function resolveLocale(value: string | null | undefined): TcrnLocale {
  const served = servedLocaleMetadata.some((entry) => entry.locale === value);
  return served && tcrnSupportedLocales.includes(value as TcrnLocale)
    ? value as TcrnLocale
    : tcrnDefaultLocale;
}

function resolveTheme(value: string | null | undefined): "light" | "dark" {
  return value === "dark" ? "dark" : "light";
}

function readBrowserStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

/**
 * Reading stays here; writing and parsing do not.
 *
 * The write half used to live alongside this — a local `writeStoredPreference`
 * putting the value in `localStorage` and in a cookie — and after it went, a
 * local cookie parser was still here: a second implementation of the narrowing
 * the Design System's `readPreferenceCookieValues` owns, which is how the next
 * consumer would have inherited a third. What stays is only what this product
 * alone can know: which header to hand the parser, because AOS emits
 * `<html lang>` and the theme attribute from its own server, outside the
 * ProductShell tree, before the controller exists.
 */
function readDocumentCookie(): string {
  if (typeof document === "undefined") return "";
  return document.cookie;
}

function applyRootTheme(theme: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.tcrnTheme = theme;
}

function applyRootLocale(locale: TcrnLocale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dataset.currentLocale = locale;
  // The title lives in `<head>`, outside the tree React re-renders, so switching
  // locale in the browser would leave the tab and the document's accessible name
  // saying the language the page was first served in.
  document.title = documentTitle(locale);
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function createDocumentCss(): string {
  return `
* { box-sizing: border-box; }
.tcrn-aos-environment {
  margin-block-end: var(--tcrn-space-3);
}
.tcrn-aos-view {
  display: grid;
  gap: var(--tcrn-space-4);
}
.tcrn-aos-band {
  display: grid;
  gap: var(--tcrn-space-2h);
}
.tcrn-aos-row-asof {
  display: inline-flex;
  align-items: center;
  gap: var(--tcrn-space-1h);
  white-space: nowrap;
}
.tcrn-aos-project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--tcrn-space-3);
}
.tcrn-aos-project-card {
  display: grid;
  gap: var(--tcrn-space-2h);
  align-content: start;
}
.tcrn-aos-project-card__meta {
  display: flex;
  align-items: center;
  gap: var(--tcrn-space-2);
}
.tcrn-aos-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--tcrn-space-2h);
  margin: 0;
}
.tcrn-aos-stat dt {
  color: var(--tcrn-color-text-secondary);
  font-size: var(--tcrn-type-size-caption);
}
.tcrn-aos-stat dd {
  margin: 0;
  font-size: var(--tcrn-type-size-heading-3);
  font-weight: var(--tcrn-type-weight-strong);
}
.tcrn-aos-project-card__link {
  color: var(--tcrn-color-brand-primary);
  font-size: var(--tcrn-type-size-meta);
  text-decoration: none;
}
.tcrn-aos-detail-head {
  display: grid;
  gap: var(--tcrn-space-2h);
}
.tcrn-aos-detail-head__title {
  display: grid;
  gap: var(--tcrn-space-1);
}
.tcrn-aos-detail-head__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--tcrn-space-2);
}
.tcrn-aos-detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 320px);
  gap: var(--tcrn-space-3);
  align-items: start;
}
@media (max-width: 900px) {
  .tcrn-aos-detail-grid { grid-template-columns: minmax(0, 1fr); }
}
.tcrn-aos-detail-main,
.tcrn-aos-detail-side {
  display: grid;
  gap: var(--tcrn-space-3);
  min-width: 0;
}
.tcrn-aos-board {
  display: grid;
  grid-template-columns: repeat(5, minmax(180px, 1fr));
  gap: var(--tcrn-space-2h);
  align-items: start;
  overflow-x: auto;
}
@media (max-width: 1100px) {
  .tcrn-aos-board { grid-template-columns: repeat(2, minmax(200px, 1fr)); }
}
.tcrn-aos-board__column {
  display: grid;
  gap: var(--tcrn-space-2);
  padding: var(--tcrn-space-2);
  border-radius: var(--tcrn-radius-surface);
  background: var(--tcrn-color-surface-muted);
  align-content: start;
  min-width: 0;
}
.tcrn-aos-board__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tcrn-space-2);
}
.tcrn-aos-board__cards {
  display: grid;
  gap: var(--tcrn-space-1h);
  margin: 0;
  padding: 0;
  list-style: none;
}
.tcrn-aos-board__card {
  display: grid;
  gap: var(--tcrn-space-1);
  padding: var(--tcrn-space-2);
  border: 1px solid var(--tcrn-color-border-subtle);
  border-radius: var(--tcrn-radius-control);
  background: var(--tcrn-color-surface-panel);
  color: inherit;
  text-decoration: none;
  min-width: 0;
}
.tcrn-aos-board__card-title {
  font-size: var(--tcrn-type-size-meta);
  line-height: var(--tcrn-type-line-ui);
  overflow-wrap: anywhere;
}
.tcrn-aos-board__card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tcrn-space-1);
}
.tcrn-aos-room {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 340px);
  gap: var(--tcrn-space-3);
  align-items: start;
}
@media (max-width: 960px) {
  .tcrn-aos-room { grid-template-columns: minmax(0, 1fr); }
}
.tcrn-aos-room__thread,
.tcrn-aos-room__minutes {
  display: grid;
  gap: var(--tcrn-space-3);
  min-width: 0;
}
.tcrn-aos-round {
  display: grid;
  gap: var(--tcrn-space-2);
}
.tcrn-aos-round__label {
  display: flex;
  align-items: center;
  gap: var(--tcrn-space-2);
  color: var(--tcrn-color-text-secondary);
}
.tcrn-aos-round__label::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--tcrn-color-border-subtle);
}
.tcrn-aos-bubble {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: var(--tcrn-space-2h);
  padding: var(--tcrn-space-3);
  border: 1px solid var(--tcrn-color-border-subtle);
  border-radius: var(--tcrn-radius-surface);
  background: var(--tcrn-color-surface-panel);
}
/* An adversarial position is the one trying to refute; marking it is what makes
   an attack-and-answer round legible as one rather than as a list. */
.tcrn-aos-bubble[data-adversarial="true"] {
  border-left: 3px solid var(--tcrn-color-state-blocked);
}
.tcrn-aos-bubble__avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--tcrn-radius-pill);
  background: var(--tcrn-color-brand-primary-bg);
  color: var(--tcrn-color-brand-primary);
  font-weight: var(--tcrn-type-weight-strong);
}
.tcrn-aos-bubble__body {
  display: grid;
  gap: var(--tcrn-space-1h);
  min-width: 0;
}
.tcrn-aos-bubble__who {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--tcrn-space-2);
}
.tcrn-aos-bubble__text {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: var(--tcrn-type-size-reading);
  line-height: var(--tcrn-type-line-reading);
}
.tcrn-aos-decisions {
  display: grid;
  gap: var(--tcrn-space-1);
  margin: 0;
  padding-left: var(--tcrn-space-4);
  font-size: var(--tcrn-type-size-meta);
}
.tcrn-aos-minutes-list {
  display: grid;
  gap: var(--tcrn-space-1h);
  margin: 0;
  padding: 0;
  list-style: none;
}
.tcrn-aos-minutes-list li {
  display: flex;
  align-items: center;
  gap: var(--tcrn-space-2);
  flex-wrap: wrap;
}
.tcrn-aos-conference-list {
  display: grid;
  gap: var(--tcrn-space-1h);
  margin: 0;
  padding: 0;
  list-style: none;
}
.tcrn-aos-conference-row {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) max-content;
  align-items: center;
  gap: var(--tcrn-space-2);
  padding: var(--tcrn-space-2);
  border-bottom: 1px solid var(--tcrn-color-border-subtle);
  color: inherit;
  text-decoration: none;
}
@media (max-width: 760px) {
  .tcrn-aos-conference-row { grid-template-columns: minmax(0, 1fr); }
}
.tcrn-aos-conference-row__title {
  overflow-wrap: anywhere;
}
.tcrn-aos-conference-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tcrn-space-1);
}
.tcrn-aos-filters {
  display: grid;
  gap: var(--tcrn-space-2h);
}
/* One row of conditions rather than six rows of enumerated options. */
.tcrn-aos-toolbar {
  display: flex;
  align-items: center;
  gap: var(--tcrn-space-2);
  flex-wrap: wrap;
}
.tcrn-aos-toolbar__rule {
  inline-size: 1px;
  block-size: 22px;
  background: var(--tcrn-color-border-subtle);
  flex: none;
}
.tcrn-aos-toolbar__spacer { flex: 1 1 auto; }
.tcrn-aos-searchbar {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 240px;
  max-inline-size: 26rem;
  min-inline-size: 0;
}
/* The search control's width is the DS fill prop now; the rule that used to
   size it from here was this file reaching into the component's class name. */
/* The honesty note lives in a hover affordance rather than a sentence beside the
   field: the claim still has to be available, but it is not worth a line of the
   toolbar on every render. */
.tcrn-aos-searchbar__note {
  position: absolute;
  inset-inline-end: var(--tcrn-space-2);
  font-size: var(--tcrn-type-size-meta);
  color: var(--tcrn-color-text-secondary);
  background: var(--tcrn-color-surface-muted);
  border-radius: var(--tcrn-radius-control);
  padding: 2px var(--tcrn-space-1h);
  cursor: help;
}
.tcrn-aos-count {
  font-size: var(--tcrn-type-size-meta);
  color: var(--tcrn-color-text-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.tcrn-aos-count strong { color: var(--tcrn-color-text-primary); }
.tcrn-aos-reset {
  font-size: var(--tcrn-type-size-meta);
  color: var(--tcrn-color-text-secondary);
}

/* Compact disclosure: current value on the trigger, options in the panel. */
.tcrn-aos-menu { position: relative; }
.tcrn-aos-menu__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--tcrn-space-1h);
  min-block-size: 36px;
  padding: 0 var(--tcrn-space-2h);
  border: 1px solid var(--tcrn-color-border-subtle);
  border-radius: var(--tcrn-radius-control);
  background: var(--tcrn-color-surface-panel);
  cursor: pointer;
  white-space: nowrap;
  list-style: none;
}
.tcrn-aos-menu__trigger::-webkit-details-marker { display: none; }
.tcrn-aos-menu__key { color: var(--tcrn-color-text-secondary); }
.tcrn-aos-menu__caret { color: var(--tcrn-color-text-muted); font-size: var(--tcrn-type-size-meta); }
/* A dimension with a value in force is a framed control holding a selection, so
   it says so the way every framed control in the system does: its border. */
.tcrn-aos-menu[data-set="true"] > .tcrn-aos-menu__trigger {
  border-color: var(--tcrn-selection-edge);
}
.tcrn-aos-menu__panel,
.tcrn-aos-scope__panel {
  position: absolute;
  inset-block-start: calc(100% + var(--tcrn-space-1));
  inset-inline-start: 0;
  min-inline-size: 15rem;
  padding: var(--tcrn-space-1h);
  border: 1px solid var(--tcrn-color-border-subtle);
  border-radius: var(--tcrn-radius-surface);
  background: var(--tcrn-color-surface-panel);
  box-shadow: var(--tcrn-elevation-floating);
  z-index: var(--tcrn-z-popover);
}

/* Scope lives in the shell utility row and is the only project control. */
.tcrn-aos-scope {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--tcrn-space-2);
}
.tcrn-aos-scope__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--tcrn-space-1h);
  min-block-size: 34px;
  padding: 0 var(--tcrn-space-2h);
  border: 1px solid var(--tcrn-color-border-subtle);
  border-radius: var(--tcrn-radius-control);
  background: var(--tcrn-color-surface-panel);
  color: var(--tcrn-color-text-primary);
  cursor: pointer;
  white-space: nowrap;
}
.tcrn-aos-scope__trigger[data-selected="true"] { border-color: var(--tcrn-selection-edge); }
.tcrn-aos-scope__key { color: var(--tcrn-color-text-secondary); font-size: var(--tcrn-type-size-meta); }
.tcrn-aos-scope__caret { color: var(--tcrn-color-text-muted); font-size: var(--tcrn-type-size-meta); }
.tcrn-aos-scope__panel { inset-inline-start: auto; inset-inline-end: 0; min-inline-size: 18rem; }

/* The cockpit's own editable fields, and the discussion beside them. */
.tcrn-aos-domain-edit {
  display: grid;
  gap: var(--tcrn-space-2);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  align-items: end;
}
.tcrn-aos-domain-edit__field {
  display: grid;
  gap: var(--tcrn-space-1);
  font-size: var(--tcrn-type-size-meta);
  color: var(--tcrn-color-text-secondary);
  min-inline-size: 0;
}
.tcrn-aos-relations {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tcrn-space-2);
}
.tcrn-aos-comments {
  display: grid;
  gap: var(--tcrn-space-2h);
  margin: 0;
  padding: 0;
  list-style: none;
}
.tcrn-aos-comments__head {
  display: flex;
  align-items: center;
  gap: var(--tcrn-space-2);
  color: var(--tcrn-color-text-secondary);
  font-size: var(--tcrn-type-size-meta);
}

/* Applied conditions: each removable on its own. */
.tcrn-aos-applied {
  display: flex;
  align-items: center;
  gap: var(--tcrn-space-2);
  flex-wrap: wrap;
  font-size: var(--tcrn-type-size-meta);
}
.tcrn-aos-applied__label { color: var(--tcrn-color-text-secondary); }
.tcrn-aos-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--tcrn-space-1h);
  padding: 3px var(--tcrn-space-1h) 3px var(--tcrn-space-2h);
  border: 1px solid var(--tcrn-color-border-subtle);
  border-radius: var(--tcrn-radius-pill);
  background: var(--tcrn-color-surface-panel);
  color: var(--tcrn-color-text-primary);
  text-decoration: none;
}
.tcrn-aos-chip:hover { border-color: var(--tcrn-color-border-control); }
.tcrn-aos-chip__x { color: var(--tcrn-color-text-muted); }
.tcrn-aos-chip:hover .tcrn-aos-chip__x { color: var(--tcrn-color-text-primary); }
.tcrn-aos-batchbar {
  display: flex;
  align-items: center;
  gap: var(--tcrn-space-2);
  flex-wrap: wrap;
  padding: var(--tcrn-space-2);
}
.tcrn-aos-picker {
  display: grid;
  gap: var(--tcrn-space-1);
}
.tcrn-aos-picker-row {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: var(--tcrn-space-2);
}
.tcrn-aos-picker-row:not(:has(.tcrn-checkbox)) {
  grid-template-columns: minmax(0, 1fr);
}
.tcrn-aos-picker-row__link {
  display: block;
  min-width: 0;
  text-decoration: none;
  color: inherit;
  border-radius: var(--tcrn-radius-md);
}
/* Selection is signalled once, by the DS row itself (border + left 3px inset).
   A wrapper outline on top of that drew a second frame around the same row. */
.tcrn-aos-preview {
  display: grid;
  gap: var(--tcrn-space-2);
  align-content: start;
}
.tcrn-aos-preview__counts,
.tcrn-aos-preview__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tcrn-space-2);
}
.tcrn-aos-preview__open {
  font-size: var(--tcrn-type-size-meta);
}
/* Scope annotations and position bodies are written with intentional line
   breaks; collapsing them merges paragraphs into one block. */
.tcrn-aos-prose {
  white-space: pre-wrap;
}
/* The split view's stacking used to be forced from here with a viewport media
   query and three rules reaching into DS class names — a number that was only
   right for this shell's width. The DS component owns it now: a container
   query stacks it wherever it actually runs out of room, and the
   detailPopulated prop carries the one bit only the consumer knows. */
.tcrn-aos-as-of {
  display: inline-flex;
  align-items: center;
  gap: var(--tcrn-space-1h);
  white-space: nowrap;
}
html {
  background: var(--tcrn-color-surface-canvas);
  color: var(--tcrn-color-text-primary);
  color-scheme: light;
}
html[data-tcrn-theme="dark"] { color-scheme: dark; }
body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  /* The DS ramp, not a local stack: this file used to carry its own fallback
     list, which is a second type ramp the moment Inter fails to load. */
  font-family: var(--tcrn-type-family-ui);
  font-size: var(--tcrn-type-size-reading);
  line-height: var(--tcrn-type-line-reading);
  background: var(--tcrn-color-surface-canvas);
  color: var(--tcrn-color-text-primary);
}
a { color: inherit; }
button, input { font: inherit; }
[data-work-page-eyebrow="true"] {
  margin: 0 0 var(--tcrn-space-1h);
  color: var(--tcrn-color-text-secondary);
  font-size: var(--tcrn-type-size-meta);
  font-weight: var(--tcrn-type-weight-strong);
  text-transform: uppercase;
  letter-spacing: 0;
}
[data-work-mockup-nav="package-work-management-subnav"],
[data-work-action-row="true"] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.tcrn-aos-work-module-sr-only {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
[data-work-list="compact"],
[data-work-chain="true"] {
  margin: 0;
  padding-left: 18px;
}
[data-work-list="compact"] li,
[data-work-chain="true"] li {
  margin: 8px 0;
}
[data-registered-ds-work-components="true"],
[data-aos-work-module-entry="registered-ds-work-board"],
[data-work-initiative-graph="true"],
[data-work-evidence-page="true"],
[data-work-gates-page="true"],
[data-work-codex-activity-page="true"],
[data-work-saved-view="owner-feedback"],
[data-work-saved-view-toolbar-wrapper],
[data-work-split-inspector],
[data-work-backlog-groups] {
  min-width: 0;
}
[data-registered-ds-work-components="true"] *,
[data-work-saved-view-toolbar-wrapper] *,
[data-work-split-inspector] *,
[data-work-backlog-groups] * {
  min-width: 0;
}
[data-work-saved-view-toolbar-wrapper],
[data-work-split-inspector] {
  display: grid;
  gap: var(--tcrn-space-4);
}
[data-work-route-chrome="compact-ds-public-exports"],
.tcrn-aos-work-module-detail-stack {
  display: grid;
  gap: var(--tcrn-space-3);
  min-width: 0;
}
.tcrn-aos-work-module-secondary-grid {
  display: grid;
  gap: var(--tcrn-space-3);
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  min-width: 0;
}
[data-work-backlog-groups="shaped-unshaped"] {
  align-items: start;
  grid-template-columns: minmax(0, 1fr);
}
.tcrn-aos-phase3-readback {
  display: grid;
  gap: var(--tcrn-space-4);
  min-width: 0;
}
.tcrn-aos-phase3-readback *,
.tcrn-aos-phase3-readback__layout,
.tcrn-aos-phase3-readback__detail,
.tcrn-aos-phase3-readback__story-summary,
.tcrn-aos-phase3-readback__knowledge,
.tcrn-aos-phase3-readback__knowledge-entry {
  min-width: 0;
}
.tcrn-aos-phase3-readback__filter-band,
.tcrn-aos-phase3-readback__policy,
.tcrn-aos-phase3-readback__section-heading,
.tcrn-aos-phase3-readback__story-card,
.tcrn-aos-phase3-readback__audit-card,
.tcrn-aos-phase3-readback__knowledge-search,
.tcrn-aos-phase3-readback__knowledge-detail,
.tcrn-aos-phase3-readback__knowledge-results,
.tcrn-aos-phase3-readback__knowledge-entry {
  display: grid;
  gap: var(--tcrn-space-3);
}
.tcrn-aos-phase3-readback__tokens,
.tcrn-aos-phase3-readback__pagination,
.tcrn-aos-phase3-readback__status-line,
.tcrn-aos-phase3-readback__empty,
.tcrn-aos-phase3-readback__subtask,
.tcrn-aos-phase3-readback__knowledge-form,
.tcrn-aos-phase3-readback__knowledge-result-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--tcrn-space-2);
}
.tcrn-aos-phase3-readback__layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.95fr) minmax(320px, 1.35fr);
  gap: var(--tcrn-space-4);
  align-items: start;
}
.tcrn-aos-phase3-readback__list,
.tcrn-aos-phase3-readback__detail {
  display: grid;
  gap: var(--tcrn-space-3);
}
.tcrn-aos-phase3-readback__story-summary {
  display: grid;
  gap: var(--tcrn-space-3);
}
.tcrn-aos-phase3-readback__knowledge {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(320px, 1fr);
  gap: var(--tcrn-space-4);
  align-items: start;
}
.tcrn-aos-phase3-readback__knowledge-label {
  font-weight: var(--tcrn-font-weight-semibold);
}
.tcrn-aos-phase3-readback__knowledge-input {
  flex: 1 1 220px;
  max-width: 34rem;
  min-height: 2.25rem;
  border: 1px solid var(--tcrn-color-border-subtle);
  border-radius: var(--tcrn-radius-2);
  padding: 0 var(--tcrn-space-3);
  background: var(--tcrn-color-surface-panel);
  color: var(--tcrn-color-text-primary);
}
.tcrn-aos-phase3-readback__knowledge-result {
  display: grid;
  gap: var(--tcrn-space-2);
  border-block-start: 1px solid var(--tcrn-color-border-subtle);
  padding-block-start: var(--tcrn-space-3);
}
.tcrn-aos-phase3-readback__knowledge-body {
  display: grid;
  gap: var(--tcrn-space-2);
}
.tcrn-aos-phase3-readback__subtasks {
  display: grid;
  gap: var(--tcrn-space-2);
}
.tcrn-aos-phase3-readback__error {
  border-color: var(--tcrn-color-border-warning);
}
@media (max-width: 820px) {
  .tcrn-aos-phase3-readback__layout,
  .tcrn-aos-phase3-readback__knowledge {
    grid-template-columns: minmax(0, 1fr);
  }
}
`;
}
