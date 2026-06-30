import { useEffect, useMemo, useRef, useState } from "react";
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
  tcrnComponentCss,
  useProductShellController,
  type ProductShellNavGroup,
  type ProductShellSearchResult,
  type WorkIndexRow
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
const defaultOwnerQualityVariant = "desktop-light-operations-cockpit";
const outsideAcceptedOwnerQualityMatrix = "aos-route-state-outside-owner-quality-oracle";
const aosProductLogoAsset = getTcrnProductLogoAsset("aos");

const shellSearchRecords: ProductShellSearchResult[] = [
  ...shellNavItems.map((item) => ({
    id: `route-${item.id}`,
    title: item.label,
    meta: `AOS operations route / ${item.description}`,
    href: item.path
  })),
  {
    id: "gate-owner-review",
    title: "Owner review gate",
    meta: "Evidence packet required",
    href: "/cockpit"
  },
  {
    id: "service-health",
    title: "Service health",
    meta: "Read-only local summary",
    href: "/cockpit"
  },
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

interface OwnerQualityRoutePolicy {
  forceExpanded: boolean;
  theme?: "light" | "dark";
  locale?: TcrnLocale;
  reason: "accepted_owner_quality_variant" | "search_results_expanded_variant" | "mobile_collapse_hidden_policy" | "unclaimed_state";
}

export function renderAosShellHtml(): string {
  const appHtml = renderToStaticMarkup(<AosShellApp />);

  return `<!doctype html>
<html lang="en" data-tcrn-theme="light" data-current-locale="${tcrnDefaultLocale}" data-product-shell-html="true">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TCRN AOS Rebuild Workspace</title>
    <meta name="tcrn-aOS-owner-quality-oracle" content="aos-owner-quality-product-shell" />
    <meta name="tcrn-design-system-source" content="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state" />
    <meta name="tcrn-aOS-brand-source" content="@tcrn/ui-react ProductShell/ShellBrandLockup/ProductLogo with registered tcrnProductLogoRegistry aos asset" />
    <link rel="icon" href="/assets/tcrn-brand-mark.svg" type="image/svg+xml" />
    <style data-tcrn-token-source="@tcrn/ui-tokens">${tcrnTokenCss}</style>
    <style data-tcrn-component-style-source="@tcrn/ui-react">${tcrnComponentCss}</style>
    <style data-product-document-baseline="tcrn-token-inheritance">${createDocumentCss()}</style>
  </head>
  <body data-product-shell-body="owner-quality-product-shell" data-product-acceptance="not-claimed" data-release-readiness="not-claimed" data-live-dispatch="not-enabled">
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
  }, []);

  const currentLocale = resolveLocale(controller.locale);
  const currentCopy = localeCopy[currentLocale] ?? localeCopy.en;
  const currentRouteId = currentRoute.id as AosRouteId;
  const searchState: VisualInstanceSearchState = controller.searchExpanded && controller.searchResults.length > 0 ? "results" : "rest";
  const forceExpandedOwnerQualityState = isForceExpandedOwnerQualityState({
    route: currentRouteId,
    theme: controller.theme,
    locale: currentLocale,
    searchState,
    viewport: browserVisualState.viewport,
    reducedMotion: browserVisualState.reducedMotion
  });
  const visualInstanceCollapsed = forceExpandedOwnerQualityState ? false : controller.collapsed;
  const visualInstanceVariant = resolveVisualInstanceVariant({
    route: currentRouteId,
    theme: controller.theme,
    locale: currentLocale,
    collapsed: visualInstanceCollapsed,
    searchState,
    viewport: browserVisualState.viewport,
    reducedMotion: browserVisualState.reducedMotion
  });
  const productShellControlProps = {
    ...controller.productShellControlProps,
    collapsed: visualInstanceCollapsed,
    onCollapsedChange: (collapsed: boolean) => {
      if (collapsed && controller.searchExpanded) {
        controller.setSearchExpanded(false, "controller");
        controller.setSearchQuery("");
      }
      controller.setCollapsed(collapsed);
    }
  };
  const shellSearchPlaceholder = copyText(currentCopy, "shellSearch", "Search work, gates, evidence, or owner actions");
  const currentRouteLabel = currentRouteId === "work"
    ? copyText(currentCopy, "workLabel", currentRoute.label)
    : copyText(currentCopy, "cockpitLabel", currentRoute.label);
  const navGroups: ProductShellNavGroup[] = [
    {
      id: "operations-modules",
      label: copyText(currentCopy, "navGroupLabel", "Operations modules"),
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
      {...productShellControlProps}
      productName={copyText(currentCopy, "productName", "AOS Rebuild Workspace")}
      moduleName={copyText(currentCopy, "moduleName", "Operations Cockpit")}
      brandProductId="aos"
      brandMarkSrc="/assets/tcrn-brand-mark.svg"
      currentRouteLabel={currentRouteLabel}
      currentLocationLabel={copyText(currentCopy, "currentLocation", "Current location")}
      navLabel={copyText(currentCopy, "navLabel", "AOS operations navigation")}
      navGroups={navGroups}
      locales={tcrnLocaleMetadata}
      collapsedStorageKey={sideNavStorageKey}
      contentId="content"
      contentRole="main"
      contentLabel={copyText(currentCopy, "contentLabel", "AOS operations workspace")}
      skipLinkLabel={copyText(currentCopy, "skipLink", "Skip to operations content")}
      search={{
        ...controller.productShellSearchProps,
        label: copyText(currentCopy, "searchLabel", "Search AOS operations"),
        placeholder: shellSearchPlaceholder,
        shortcut: "auto",
        resultsLabel: copyText(currentCopy, "searchResults", "AOS operations search results"),
        emptyLabel: copyText(currentCopy, "emptySearch", "No matching operations records")
      }}
      data-aos-shell="owner-quality-product-shell"
      data-storybook-visual-instance="aos-owner-quality-product-shell"
      data-visual-instance-name="AosOwnerQualityProductShell"
      data-visual-instance-disposition="ds_oracle_review_required_before_owner_admission"
      data-visual-instance-style-source="@tcrn/ui-react/tcrnComponentCss"
      data-visual-instance-owner-quality="product-first"
      data-visual-instance-slots="registered-product-logo side-nav topbar search operations-cockpit work-queue gates-evidence owner-actions service-health secondary-disclosure"
      data-visual-instance-primary-ia="operations-cockpit-work-queue"
      data-visual-instance-negative-criteria="no-proof-scaffold-hero no-dummy-cockpit no-raw-primary no-owner-readiness"
      data-visual-instance-product-logo={aosProductLogoAsset.assetId}
      data-product-logo-asset-id={aosProductLogoAsset.assetId}
      data-product-logo-line-one={aosProductLogoAsset.lineOne}
      data-product-logo-line-two={aosProductLogoAsset.lineTwo}
      data-visual-instance-mobile-collapse-policy="hidden-affordance"
      data-visual-instance-variant={visualInstanceVariant}
      data-visual-instance-theme={controller.theme}
      data-tcrn-theme={controller.theme}
      data-visual-instance-locale={currentLocale}
      data-visual-instance-collapsed={visualInstanceCollapsed ? "true" : "false"}
      data-owner-quality-collapse-policy={browserVisualState.viewport === "mobile" ? "mobile-hidden-collapse-affordance" : "desktop-actionable-collapse-toggle"}
      data-visual-instance-route={currentRouteId}
      data-visual-instance-search={searchState}
      data-visual-instance-viewport={browserVisualState.viewport}
      data-visual-instance-reduced-motion={browserVisualState.reducedMotion ? "true" : "false"}
      data-visual-instance-content={currentRouteId}
      data-owner-quality-product-shell-oracle="true"
      data-design-system-source="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state"
      data-storybook-contract-consumed="product-shell-semantic-boundary"
      data-storybook-visual-instance-consumed="aos-owner-quality-product-shell"
      data-ds-product-shell-boundary-consumed="ProductShell useProductShellController ProductShellSearch"
      data-local-wrapper-event-delegation="absent"
      data-local-shell-effect-clones="removed"
      data-cockpit-aggregation="deferred"
      data-aos-registered-module-boundary="cockpit-work-only"
      data-search-activation-readback={lastSearchResult}
      data-current-path={currentPath}
    >
      <OwnerQualityContent
        apiReadback={apiReadback}
        copy={currentCopy}
        locale={currentLocale}
        route={currentRouteId}
        variant={visualInstanceVariant}
      />
    </ProductShell>
  );
}

function OwnerQualityContent({
  apiReadback,
  copy,
  locale,
  route,
  variant
}: {
  apiReadback: ApiReadbackState;
  copy: Record<string, string>;
  locale: TcrnLocale;
  route: AosRouteId;
  variant: string;
}) {
  const isWorkFirst = route === "work";
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
    </div>
  );
}

function ownerQualityQueueRows(locale: TcrnLocale): WorkIndexRow[] {
  const isZh = locale === "zh-CN";
  return [
    {
      id: "owner-quality-oracle",
      title: isZh ? "定义 owner 质量视觉基准" : "Define owner-quality visual baseline",
      state: { state: "review_required" },
      owner: "Elara"
    },
    {
      id: "aos-remediation",
      title: isZh ? "将 AOS 首页映射到新基准" : "Map AOS first viewport to new baseline",
      state: { state: "blocked" },
      owner: "Ilya"
    },
    {
      id: "qa-evidence",
      title: isZh ? "专业 QA 证据包" : "Professional QA evidence packet",
      state: { state: "not_configured" },
      owner: "Rowan"
    }
  ];
}

function ownerQualityGateRows(locale: TcrnLocale) {
  const isZh = locale === "zh-CN";
  return [
    {
      gate: isZh ? "DS 视觉基准" : "DS visual baseline",
      evidence: isZh ? "Storybook owner 质量实例" : "Storybook owner-quality instance",
      decision: isZh ? "等待 review" : "Awaiting review",
      owner: "Elara",
      state: <StatusBadge state={{ state: "review_required" }} locale={locale} />
    },
    {
      gate: isZh ? "运行时新鲜度" : "Runtime freshness",
      evidence: isZh ? "4317 同端口刷新" : "4317 same-port refresh",
      decision: isZh ? "实现后路由" : "Route after implementation",
      owner: "Atlas",
      state: <StatusBadge state={{ state: "blocked" }} locale={locale} />
    },
    {
      gate: isZh ? "Owner 检查" : "Owner inspection",
      evidence: isZh ? "QA 与 PM 通过后" : "After QA and PM pass",
      decision: isZh ? "未准备" : "Not ready",
      owner: "Mara",
      state: <StatusBadge state={{ state: "not_claimed" }} locale={locale} />
    }
  ];
}

function ownerQualityActionRows(locale: TcrnLocale) {
  const isZh = locale === "zh-CN";
  return [
    {
      action: isZh ? "批准 owner 可见预览" : "Approve owner-visible preview",
      reason: isZh ? "等待 DS review、QA 与 PM" : "Waiting on DS review, QA, and PM",
      state: <Badge tone="warning">{isZh ? "已禁用" : "Disabled"}</Badge>
    },
    {
      action: isZh ? "打开实时派发" : "Enable live dispatch",
      reason: isZh ? "不在此切片范围" : "Out of scope for this slice",
      state: <Badge tone="neutral">{isZh ? "不可用" : "Unavailable"}</Badge>
    }
  ];
}

function ownerQualityServiceItems(locale: TcrnLocale, apiReadback: ApiReadbackState) {
  const isZh = locale === "zh-CN";
  return [
    { key: "api", label: isZh ? "API" : "API", value: <span data-metric-value="runtime">{apiReadback.runtime === "pending" ? (isZh ? "本地只读摘要" : "Read-only local summary") : apiReadback.runtime}</span> },
    { key: "queue", label: isZh ? "外部队列" : "External queue", value: <span data-metric-value="queue">{apiReadback.queue === "pending" ? (isZh ? "无" : "None") : apiReadback.queue}</span> },
    { key: "dispatch", label: isZh ? "实时派发" : "Live dispatch", value: isZh ? "未启用" : "Not enabled" },
    { key: "nextGate", label: isZh ? "下一门禁" : "Next gate", value: isZh ? "Elara 渲染评审" : "Elara rendered review" }
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
  const ownerQualityRoutePolicy = resolveOwnerQualityRoutePolicy(currentPath, params);
  return {
    collapsed: ownerQualityRoutePolicy.forceExpanded
      ? false
      : collapsedFromQuery === "true"
        ? true
        : collapsedFromQuery === "false"
          ? false
          : readStoredBoolean(sideNavStorageKey, false),
    theme: ownerQualityRoutePolicy.theme ?? resolveTheme(params?.get("theme") ?? readBrowserStorage(themeStorageKey)),
    locale: ownerQualityRoutePolicy.locale ?? resolveLocale(params?.get("locale") ?? readBrowserStorage(localeStorageKey)),
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
  if (reducedMotion && viewport === "desktop" && route === "cockpit" && theme === "light" && locale === "en" && !collapsed) {
    return "reduced-motion";
  }
  if (viewport === "mobile" && route === "work" && theme === "dark" && locale === "zh-CN") {
    return "mobile-dark-zh-cn-work-queue";
  }
  if (viewport === "desktop" && route === "work" && theme === "light" && locale === "en") {
    return collapsed ? "desktop-light-work-queue-collapsed" : "desktop-light-work-queue";
  }
  if (viewport === "desktop" && route === "cockpit" && theme === "dark" && locale === "en" && searchState === "rest") {
    return collapsed ? "desktop-dark-operations-cockpit-collapsed" : "desktop-dark-operations-cockpit";
  }
  if (viewport === "desktop" && route === "cockpit" && theme === "light" && locale === "en" && !collapsed && searchState === "results") {
    return "desktop-light-operations-search-results";
  }
  if (viewport === "desktop" && route === "cockpit" && theme === "light" && locale === "en" && searchState === "rest") {
    return collapsed ? "desktop-light-operations-cockpit-collapsed" : defaultOwnerQualityVariant;
  }
  return outsideAcceptedOwnerQualityMatrix;
}

function resolveOwnerQualityRoutePolicy(path: string, params: URLSearchParams | undefined): OwnerQualityRoutePolicy {
  const route = resolveCurrentRoute(path).id;
  const theme = params?.get("theme") ?? null;
  const locale = params?.get("locale") ?? null;
  const search = params?.get("search")?.trim() ?? "";
  if (route === "cockpit" && (locale === null || locale === tcrnDefaultLocale)) {
    if (theme === "dark" && search === "") {
      return { forceExpanded: false, theme: "dark", locale: tcrnDefaultLocale, reason: "accepted_owner_quality_variant" };
    }
    if ((theme === null || theme === "light") && search === "") {
      return { forceExpanded: false, theme: "light", locale: tcrnDefaultLocale, reason: "accepted_owner_quality_variant" };
    }
    if ((theme === null || theme === "light") && search.length > 0) {
      return { forceExpanded: true, theme: "light", locale: tcrnDefaultLocale, reason: "search_results_expanded_variant" };
    }
  }
  if (route === "work" && search === "") {
    if ((theme === null || theme === "light") && (locale === null || locale === tcrnDefaultLocale)) {
      return { forceExpanded: false, theme: "light", locale: tcrnDefaultLocale, reason: "accepted_owner_quality_variant" };
    }
    if (theme === "dark" && locale === "zh-CN") {
      return { forceExpanded: true, theme: "dark", locale: "zh-CN", reason: "mobile_collapse_hidden_policy" };
    }
  }
  return { forceExpanded: false, reason: "unclaimed_state" };
}

function isForceExpandedOwnerQualityState({
  route,
  theme,
  locale,
  searchState,
  viewport,
  reducedMotion
}: {
  route: AosRouteId;
  theme: "light" | "dark";
  locale: TcrnLocale;
  searchState: VisualInstanceSearchState;
  viewport: VisualInstanceViewportState;
  reducedMotion: boolean;
}): boolean {
  if (reducedMotion && viewport === "desktop" && route === "cockpit" && theme === "light" && locale === "en") return true;
  if (viewport === "mobile" && route === "work" && theme === "dark" && locale === "zh-CN") return true;
  if (viewport === "desktop" && route === "cockpit" && theme === "light" && locale === "en" && searchState === "results") return true;
  return false;
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
