import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Badge,
  DisclosurePanel,
  EnvironmentBanner,
  EvidenceStrip,
  Heading,
  InlineAlert,
  KeyValueList,
  ProductShell,
  ReadbackPanel,
  StatusBadge,
  TableShell,
  Text,
  tcrnComponentCss,
  useProductShellController,
  type ProductShellNavGroup,
  type ProductShellSearchResult
} from "@tcrn/ui-react";
import {
  tcrnDefaultLocale,
  tcrnLocaleMetadata,
  tcrnSupportedLocales,
  type TcrnLocale
} from "@tcrn/ui-copy-state";
import { tcrnTokenCss } from "@tcrn/ui-tokens";
import { localeCopy, shellNavItems, workModuleRows, type ShellNavItem } from "./data.js";

const sideNavStorageKey = "tcrn-aos-side-nav-collapsed";
const themeStorageKey = "tcrn-aos-theme";
const localeStorageKey = "tcrn-aos-locale";
const lastSearchResultStorageKey = "tcrn-aos-last-search-result";
const defaultShellRoute = shellNavItems[0] as ShellNavItem;

const shellSearchRecords: ProductShellSearchResult[] = [
  ...shellNavItems.map((item) => ({
    id: `route-${item.id}`,
    title: item.label,
    meta: `Registered shell entry / ${item.description}`,
    href: item.path
  })),
  ...workModuleRows.map((row) => ({
    id: `work-${row.key}`,
    title: row.story,
    meta: `${row.project} / ${row.initiative} / ${row.gate} / ${row.evidence} / ${row.assignment}`,
    href: "/work"
  }))
];

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
  lastSearchResult: string;
  initialSearchQuery: string;
  initialSearchExpanded: boolean;
}

type AosRouteId = "cockpit" | "work";
type VisualInstanceSearchState = "rest" | "results";
type VisualInstanceViewportState = "desktop" | "mobile";

interface BrowserVisualState {
  viewport: VisualInstanceViewportState;
  reducedMotion: boolean;
}

export function renderAosShellHtml(): string {
  const appHtml = renderToStaticMarkup(<AosShellApp />);

  return `<!doctype html>
<html lang="en" data-tcrn-theme="light" data-current-locale="${tcrnDefaultLocale}" data-product-shell-html="true">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TCRN AOS Rebuild Workspace</title>
    <meta name="tcrn-aOS-frontend-slice" content="shell_dummy_cockpit_work_entry" />
    <meta name="tcrn-design-system-source" content="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state" />
    <meta name="tcrn-aOS-brand-source" content="@tcrn/ui-react ProductShell/ShellBrandLockup with registered tcrn-brand-mark.svg" />
    <link rel="icon" href="/assets/tcrn-brand-mark.svg" type="image/svg+xml" />
    <style data-tcrn-token-source="@tcrn/ui-tokens">${tcrnTokenCss}</style>
    <style data-tcrn-component-style-source="@tcrn/ui-react">${tcrnComponentCss}</style>
    <style data-product-document-baseline="tcrn-token-inheritance">${createDocumentCss()}</style>
  </head>
  <body data-product-shell-body="first-frontend-slice" data-product-acceptance="not-claimed" data-release-readiness="not-claimed" data-live-dispatch="not-enabled">
    <div id="aos-root">${appHtml}</div>
    <script type="module" src="/assets/aos-client.js" data-product-shell-client="ds-product-shell-semantic-boundary"></script>
  </body>
</html>`;
}

export function AosShellApp() {
  const initialShellState = useMemo(() => readInitialShellState(), []);
  const initialSearchApplied = useRef(false);
  const [currentPath] = useState(initialShellState.currentPath);
  const [lastSearchResult, setLastSearchResult] = useState(initialShellState.lastSearchResult);
  const [apiReadback, setApiReadback] = useState<ApiReadbackState>(initialApiReadback);
  const [browserVisualState, setBrowserVisualState] = useState<BrowserVisualState>(() => readBrowserVisualState());

  const currentRoute = resolveCurrentRoute(currentPath);
  const controller = useProductShellController({
    initialCollapsed: initialShellState.collapsed,
    initialTheme: initialShellState.theme,
    initialLocale: initialShellState.locale,
    navId: "aos-primary-side-nav",
    searchRecords: shellSearchRecords,
    onCollapsedChange: (collapsed) => {
      writeBrowserStorage(sideNavStorageKey, String(collapsed));
    },
    onThemeChange: (theme) => {
      writeBrowserStorage(themeStorageKey, theme);
      applyRootTheme(theme);
    },
    onLocaleChange: (locale) => {
      const resolvedLocale = resolveLocale(locale);
      writeBrowserStorage(localeStorageKey, resolvedLocale);
      applyRootLocale(resolvedLocale);
    },
    onSearchResultActivate: (result) => {
      writeBrowserStorage(lastSearchResultStorageKey, result.id);
      setLastSearchResult(result.id);
    }
  });

  useEffect(() => {
    if (initialSearchApplied.current) return;
    initialSearchApplied.current = true;
    if (!initialShellState.initialSearchQuery) return;
    controller.setSearchQuery(initialShellState.initialSearchQuery);
    controller.setSearchExpanded(initialShellState.initialSearchExpanded, "controller");
  }, [controller.setSearchExpanded, controller.setSearchQuery, initialShellState.initialSearchExpanded, initialShellState.initialSearchQuery]);

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
          statusText: "API readbacks available from local proof service.",
          runtime: String(health.runtimeDatabase ?? "local fixture"),
          queue: String(health.externalQueue ?? "none"),
          policy: policy.serviceProofOnly === true ? "service proof only" : "unavailable",
          counts: `stories ${String(counts?.stories ?? "--")}, gates ${String(counts?.gates ?? "--")}`,
          metrics: {
            runtime: health.ok === true ? "local fixture" : "unavailable",
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
  }, []);

  const currentLocale = resolveLocale(controller.locale);
  const currentCopy = localeCopy[currentLocale] ?? localeCopy.en;
  const currentRouteId = currentRoute.id as AosRouteId;
  const searchState: VisualInstanceSearchState = controller.searchExpanded && controller.searchResults.length > 0 ? "results" : "rest";
  const visualInstanceVariant = resolveVisualInstanceVariant({
    route: currentRouteId,
    theme: controller.theme,
    locale: currentLocale,
    collapsed: controller.collapsed,
    searchState,
    viewport: browserVisualState.viewport,
    reducedMotion: browserVisualState.reducedMotion
  });
  const shellSearchPlaceholder = copyText(currentCopy, "shellSearch", "Search modules, work items, or proof");
  const dummyCockpitLabel = copyText(currentCopy, "dummyCockpit", "Dummy Cockpit");
  const workModuleLabel = copyText(currentCopy, "workModule", "Work module entry");
  const navGroups: ProductShellNavGroup[] = [
    {
      id: "registered-shell-entries",
      label: copyText(currentCopy, "navGroupLabel", "Registered shell entries"),
      selected: true,
      items: shellNavItems.map((item) => ({
        id: item.id,
        label: item.id === "work"
          ? copyText(currentCopy, "workLabel", item.label)
          : copyText(currentCopy, "cockpitLabel", item.label),
        href: item.path,
        iconName: item.icon,
        selected: item.path === currentRoute.path
      }))
    }
  ];

  return (
    <ProductShell
      {...controller.productShellControlProps}
      productName={copyText(currentCopy, "productName", "AOS Rebuild Workspace")}
      moduleName={copyText(currentCopy, "moduleName", "Frontend shell slice")}
      brandSuffix="AOS"
      brandCaption={copyText(currentCopy, "brandCaption", "Rebuild workspace")}
      brandMarkSrc="/assets/tcrn-brand-mark.svg"
      brandMarkAlt="TCRN registered brand mark"
      currentRouteLabel={currentRouteId === "work"
        ? copyText(currentCopy, "workLabel", currentRoute.label)
        : copyText(currentCopy, "cockpitLabel", currentRoute.label)}
      navLabel={copyText(currentCopy, "navLabel", "Registered AOS modules")}
      navGroups={navGroups}
      locales={tcrnLocaleMetadata}
      collapsedStorageKey={sideNavStorageKey}
      contentId="content"
      contentRole="main"
      contentLabel={copyText(currentCopy, "contentLabel", "AOS shell content")}
      skipLinkLabel={copyText(currentCopy, "skipLink", "Skip to shell content")}
      search={{
        ...controller.productShellSearchProps,
        label: copyText(currentCopy, "searchLabel", "Search AOS shell"),
        placeholder: shellSearchPlaceholder,
        shortcut: "auto",
        resultsLabel: copyText(currentCopy, "searchResults", "AOS shell search results"),
        emptyLabel: copyText(currentCopy, "emptySearch", "No local fixture results")
      }}
      data-aos-shell="first-frontend-slice"
      data-storybook-visual-instance="aos-frontend-shell-slice"
      data-visual-instance-name="AosFrontendShellSliceVisualInstance"
      data-visual-instance-disposition="ds_oracle_review_required_before_owner_admission"
      data-visual-instance-style-source="@tcrn/ui-react/tcrnComponentCss"
      data-visual-instance-slots="brand side-nav topbar search content secondary-disclosure"
      data-visual-instance-primary-ia="cockpit-work-only"
      data-visual-instance-negative-criteria="no-local-visible-css no-storybook-only-prototype no-raw-primary no-owner-readiness"
      data-visual-instance-variant={visualInstanceVariant}
      data-visual-instance-theme={controller.theme}
      data-tcrn-theme={controller.theme}
      data-visual-instance-locale={currentLocale}
      data-visual-instance-collapsed={controller.collapsed ? "true" : "false"}
      data-visual-instance-route={currentRouteId}
      data-visual-instance-search={searchState}
      data-visual-instance-viewport={browserVisualState.viewport}
      data-visual-instance-reduced-motion={browserVisualState.reducedMotion ? "true" : "false"}
      data-visual-instance-content={currentRouteId}
      data-aos-visual-instance-oracle="true"
      data-design-system-source="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state"
      data-storybook-contract-consumed="product-shell-semantic-boundary"
      data-storybook-visual-instance-consumed="aos-frontend-shell-slice"
      data-ds-product-shell-boundary-consumed="ProductShell useProductShellController ProductShellSearch"
      data-local-wrapper-event-delegation="absent"
      data-local-shell-effect-clones="removed"
      data-cockpit-aggregation="deferred"
      data-aos-registered-module-boundary="cockpit-work-only"
      data-search-activation-readback={lastSearchResult}
      data-current-path={currentPath}
    >
      {currentRouteId === "cockpit" ? (
        <>
          <EnvironmentBanner label={copyText(currentCopy, "localOnly", "Local structural slice only")} state={{ state: "local_only" }} />
          <InlineAlert tone="warning">
            <strong>{copyText(currentCopy, "localOnly", "Local structural slice only")}</strong>
            <span>{copyText(currentCopy, "noOverclaim", "Local fixture data only; no external queue, live dispatch, product acceptance, or release-readiness state is claimed.")}</span>
          </InlineAlert>
          <ReadbackPanel title={copyText(currentCopy, "shellOverview", "AOS frontend shell")}>
            <Heading level={1} id="shell-overview-heading">{copyText(currentCopy, "shellOverview", "AOS frontend shell")}</Heading>
            <Text>{copyText(currentCopy, "shellOverviewText", "This product surface consumes the accepted DS Storybook visual instance.")}</Text>
            <KeyValueList
              items={[
                { key: "runtime", label: copyText(currentCopy, "runtime", "Runtime"), value: <span data-metric-value="runtime">{apiReadback.metrics.runtime}</span> },
                { key: "stories", label: copyText(currentCopy, "stories", "Stories"), value: <span data-metric-value="stories">{apiReadback.metrics.stories}</span> },
                { key: "gates", label: copyText(currentCopy, "gates", "Gates"), value: <span data-metric-value="gates">{apiReadback.metrics.gates}</span> },
                { key: "auditEvents", label: copyText(currentCopy, "auditEvents", "Audit events"), value: <span data-metric-value="auditEvents">{apiReadback.metrics.auditEvents}</span> }
              ]}
            />
            <EvidenceStrip items={[
              currentLocale === "zh-CN" ? "已注册 DS 表面" : "registered DS surfaces",
              "ProductShell boundary",
              currentLocale === "zh-CN" ? "仅 Cockpit + Work" : "Cockpit + Work only"
            ]} />
          </ReadbackPanel>
          {renderCockpitSection({ currentCopy, dummyCockpitLabel })}
          {renderWorkSection({ currentCopy, workModuleLabel, currentLocale, apiReadback })}
          {renderBoundarySection(currentCopy)}
        </>
      ) : (
        <>
          {renderWorkSection({ currentCopy, workModuleLabel, currentLocale, apiReadback })}
          {renderCockpitSection({ currentCopy, dummyCockpitLabel })}
          {renderBoundarySection(currentCopy)}
        </>
      )}
    </ProductShell>
  );
}

function renderCockpitSection({
  currentCopy,
  dummyCockpitLabel
}: {
  currentCopy: Record<string, string>;
  dummyCockpitLabel: string;
}) {
  return (
    <section id="cockpit" data-aos-dummy-cockpit="true" aria-labelledby="cockpit-heading">
      <ReadbackPanel title={dummyCockpitLabel}>
        <Heading level={2} id="cockpit-heading">{dummyCockpitLabel}</Heading>
        <Badge tone="warning">{copyText(currentCopy, "structuralPlaceholder", "structural placeholder")}</Badge>
        <KeyValueList
          items={[
            { key: "queue", label: copyText(currentCopy, "externalQueue", "External queue"), value: copyText(currentCopy, "none", "none") },
            { key: "dispatch", label: copyText(currentCopy, "liveDispatch", "Live dispatch"), value: copyText(currentCopy, "notEnabled", "not enabled") },
            { key: "acceptance", label: copyText(currentCopy, "productAcceptance", "Product acceptance"), value: copyText(currentCopy, "notClaimed", "not claimed") },
            { key: "release", label: copyText(currentCopy, "releaseReadiness", "Release readiness"), value: copyText(currentCopy, "notClaimed", "not claimed") }
          ]}
        />
        <EvidenceStrip items={[
          copyText(currentCopy, "localFixture", "local fixture"),
          copyText(currentCopy, "dummyCockpitOnly", "Dummy Cockpit only"),
          copyText(currentCopy, "noLiveDispatch", "no live dispatch")
        ]} />
      </ReadbackPanel>
    </section>
  );
}

function renderWorkSection({
  currentCopy,
  workModuleLabel,
  currentLocale,
  apiReadback
}: {
  currentCopy: Record<string, string>;
  workModuleLabel: string;
  currentLocale: TcrnLocale;
  apiReadback: ApiReadbackState;
}) {
  return (
    <section id="work" data-aos-work-module-entry="jira-like" aria-labelledby="work-heading">
      <ReadbackPanel title={workModuleLabel}>
        <Heading level={2} id="work-heading">{workModuleLabel}</Heading>
        <Badge tone="neutral">{copyText(currentCopy, "fixtureRows", "fixture-safe rows")}</Badge>
        <TableShell
          label={workModuleLabel}
          columns={[
            { key: "project", label: copyText(currentCopy, "project", "Project") },
            { key: "initiative", label: copyText(currentCopy, "initiative", "Initiative") },
            { key: "story", label: copyText(currentCopy, "story", "Story") },
            { key: "gate", label: copyText(currentCopy, "gate", "Gate") },
            { key: "evidence", label: copyText(currentCopy, "evidence", "Evidence") },
            { key: "assignment", label: copyText(currentCopy, "assignment", "Assignment") },
            { key: "state", label: copyText(currentCopy, "state", "State") }
          ]}
          rows={localizedWorkRows(currentLocale).map((row) => ({
            project: row.project,
            initiative: row.initiative,
            story: row.story,
            gate: row.gate,
            evidence: row.evidence,
            assignment: row.assignment,
            state: <StatusBadge state={{ state: row.state }} />
          }))}
        />
      </ReadbackPanel>
      <ReadbackPanel title={copyText(currentCopy, "backendReadback", "Backend readback")}>
        <Text data-api-state>{apiReadback.statusText}</Text>
        <Text>{copyText(currentCopy, "backendReadbackText", "API readbacks use fixture-safe service summaries, not a primary raw JSON/debug surface.")}</Text>
        <KeyValueList
          items={[
            { key: "runtime", label: copyText(currentCopy, "runtime", "Runtime"), value: <span data-api-runtime>{apiReadback.runtime}</span> },
            { key: "queue", label: copyText(currentCopy, "externalQueue", "External queue"), value: <span data-api-queue>{apiReadback.queue}</span> },
            { key: "policy", label: "Policy", value: <span data-api-policy>{apiReadback.policy}</span> },
            { key: "readback", label: copyText(currentCopy, "readbackCounts", "Readback counts"), value: <span data-api-counts>{apiReadback.counts}</span> }
          ]}
        />
        <EvidenceStrip items={["/api/health", "/api/readback", "/api/policy"]} />
        <DisclosurePanel expanded={false} title={copyText(currentCopy, "technicalPayload", "Technical API payload")} data-raw-json-disclosure="secondary">
          <pre hidden data-api-summary>{JSON.stringify(apiReadback.summary, null, 2)}</pre>
        </DisclosurePanel>
      </ReadbackPanel>
    </section>
  );
}

function renderBoundarySection(currentCopy: Record<string, string>) {
  return (
    <section aria-labelledby="slice-boundary-heading" data-aos-registered-module-boundary="cockpit-work-only">
      <ReadbackPanel title={copyText(currentCopy, "registeredBoundary", "Registered slice boundary")}>
        <Heading level={2} id="slice-boundary-heading">{copyText(currentCopy, "registeredBoundary", "Registered slice boundary")}</Heading>
        <Badge tone="neutral">{copyText(currentCopy, "cockpitAndWork", "Cockpit and Work")}</Badge>
        <KeyValueList
          items={[
            { key: "visible-nav", label: copyText(currentCopy, "visibleNavigation", "Visible primary navigation"), value: copyText(currentCopy, "cockpitAndWork", "Cockpit and Work") },
            { key: "future-modules", label: copyText(currentCopy, "futureModules", "Future modules"), value: copyText(currentCopy, "separateOwnerRoute", "require separate owner route") },
            { key: "raw-payload", label: copyText(currentCopy, "rawPayload", "Raw technical payload"), value: copyText(currentCopy, "secondaryDisclosureOnly", "secondary disclosure only") },
            { key: "acceptance", label: copyText(currentCopy, "acceptance", "Acceptance"), value: copyText(currentCopy, "notClaimed", "not claimed") }
          ]}
        />
      </ReadbackPanel>
    </section>
  );
}

function localizedWorkRows(locale: TcrnLocale) {
  const copy = localeCopy[locale] ?? localeCopy.en;
  if (locale !== "zh-CN") return workModuleRows;
  return [
    {
      key: "aos-shell",
      project: "TCRN-AOS",
      initiative: copyText(copy, "frontendRecovery", "前端壳恢复"),
      story: copyText(copy, "registeredShellSlice", "已注册壳切片"),
      gate: copyText(copy, "dsVisualInstance", "DS 视觉实例"),
      evidence: copyText(copy, "storybookParityProof", "Storybook 奇偶性证明"),
      assignment: "Ilya",
      state: "local_only" as const
    },
    {
      key: "cockpit-final",
      project: "TCRN-AOS",
      initiative: copyText(copy, "cockpitStory", "驾驶舱"),
      story: copyText(copy, "dummyCockpitOnly", "仅 Dummy Cockpit"),
      gate: copyText(copy, "deferredAggregation", "聚合延后"),
      evidence: copyText(copy, "noLiveDispatch", "无实时派发"),
      assignment: copyText(copy, "productRoute", "产品路线"),
      state: "proof_required" as const
    },
    {
      key: "readback",
      project: "TCRN-AOS",
      initiative: copyText(copy, "runtimeReadbacks", "运行时读回"),
      story: copyText(copy, "healthPolicyApi", "健康、策略、读回 API"),
      gate: copyText(copy, "browserFetchFailClosed", "浏览器拉取失败关闭"),
      evidence: "/api/health /api/readback /api/policy",
      assignment: copyText(copy, "localFixture", "本地样例"),
      state: "fixture_only" as const
    }
  ];
}

function copyText(copy: Record<string, string>, key: string, fallback: string): string {
  return copy[key] ?? localeCopy.en[key] ?? fallback;
}

function readInitialShellState(): InitialShellState {
  const params = typeof window === "undefined" ? undefined : new URLSearchParams(window.location.search);
  const currentPath = typeof window === "undefined" ? "/cockpit" : window.location.pathname;
  const collapsedFromQuery = params?.get("collapsed");
  const initialSearchQuery = params?.get("search") ?? "";
  return {
    collapsed: collapsedFromQuery === "true" ? true : collapsedFromQuery === "false" ? false : readStoredBoolean(sideNavStorageKey, false),
    theme: resolveTheme(params?.get("theme") ?? readBrowserStorage(themeStorageKey)),
    locale: resolveLocale(params?.get("locale") ?? readBrowserStorage(localeStorageKey)),
    currentPath,
    lastSearchResult: readBrowserStorage(lastSearchResultStorageKey) ?? "none",
    initialSearchQuery,
    initialSearchExpanded: initialSearchQuery.trim().length > 0
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
  searchState,
  viewport,
  reducedMotion
}: {
  route: AosRouteId;
  theme: "light" | "dark";
  locale: TcrnLocale;
  collapsed: boolean;
  searchState: VisualInstanceSearchState;
  viewport: VisualInstanceViewportState;
  reducedMotion: boolean;
}): string {
  if (reducedMotion && route === "cockpit" && theme === "light" && locale === "en" && !collapsed) {
    return "reduced-motion";
  }
  if (viewport === "mobile" && route === "work" && theme === "dark" && locale === "zh-CN") {
    return "mobile-dark-work-stacked";
  }
  if (route === "work" && theme === "light" && locale === "en" && collapsed) {
    return "desktop-light-collapsed-work";
  }
  if (route === "cockpit" && theme === "dark" && locale === "en" && !collapsed) {
    return "desktop-dark-expanded-cockpit";
  }
  if (route === "cockpit" && theme === "light" && locale === "en" && !collapsed && searchState === "results") {
    return "desktop-light-expanded-cockpit-search-results";
  }
  return "aos-route-state-outside-accepted-oracle-matrix";
}

function resolveCurrentRoute(path: string): ShellNavItem {
  return shellNavItems.find((item) => item.path === path)
    ?? shellNavItems.find((item) => path.endsWith(`${item.path}.html`))
    ?? defaultShellRoute;
}

function resolveLocale(value: string | null | undefined): TcrnLocale {
  return tcrnSupportedLocales.includes(value as TcrnLocale) ? value as TcrnLocale : tcrnDefaultLocale;
}

function resolveTheme(value: string | null | undefined): "light" | "dark" {
  return value === "dark" ? "dark" : "light";
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  const storedValue = readBrowserStorage(key);
  return storedValue === null ? fallback : storedValue === "true";
}

function readBrowserStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function writeBrowserStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function applyRootTheme(theme: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.tcrnTheme = theme;
}

function applyRootLocale(locale: TcrnLocale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dataset.currentLocale = locale;
}

function createDocumentCss(): string {
  return `
* { box-sizing: border-box; }
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
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: var(--tcrn-type-size-reading);
  line-height: 1.45;
  background: var(--tcrn-color-surface-canvas);
  color: var(--tcrn-color-text-primary);
}
a { color: inherit; }
button, input { font: inherit; }
`;
}
