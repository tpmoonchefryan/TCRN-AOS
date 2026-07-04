import { useEffect, useMemo, useState } from "react";
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
  type WorkIndexRow
} from "@tcrn/ui-react";
import {
  tcrnDefaultLocale,
  tcrnLocaleMetadata,
  tcrnSupportedLocales,
  type TcrnLocale
} from "@tcrn/ui-copy-state";
import { tcrnTokenCss } from "@tcrn/ui-tokens";
import { localeCopy, shellNavItems, type ShellNavItem } from "./data.js";
import { WorkManagementMockups, getWorkMockupPageTitle } from "./work-management-mockups.js";

const sideNavStorageKey = "tcrn-aos-side-nav-collapsed";
const themeStorageKey = "tcrn-aos-theme";
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
}

type AosRouteId = "cockpit" | "work";
type VisualInstanceViewportState = "desktop" | "mobile";

interface BrowserVisualState {
  viewport: VisualInstanceViewportState;
  reducedMotion: boolean;
}

interface OwnerQualityRoutePolicy {
  forceExpanded: boolean;
  theme?: "light" | "dark";
  locale?: TcrnLocale;
  reason: "accepted_owner_quality_variant" | "mobile_collapse_hidden_policy" | "unclaimed_state";
}

interface AosShellAppProps {
  initialShellState?: InitialShellState;
}

interface RenderAosShellHtmlOptions {
  path?: string;
  search?: string;
}

export function renderAosShellHtml(options: RenderAosShellHtmlOptions = {}): string {
  const initialShellState = readInitialShellState(options.path, options.search);
  const appHtml = renderToStaticMarkup(<AosShellApp initialShellState={initialShellState} />);

  return `<!doctype html>
<html lang="${initialShellState.locale}" data-tcrn-theme="${initialShellState.theme}" data-current-locale="${initialShellState.locale}" data-product-shell-html="true">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TCRN AOS Operations Cockpit</title>
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

export function AosShellApp({ initialShellState: initialShellStateOverride }: AosShellAppProps = {}) {
  const initialShellState = useMemo(() => initialShellStateOverride ?? readInitialShellState(), [initialShellStateOverride]);
  const [currentPath] = useState(initialShellState.currentPath);
  const [apiReadback, setApiReadback] = useState<ApiReadbackState>(initialApiReadback);
  const [browserVisualState, setBrowserVisualState] = useState<BrowserVisualState>(() => readBrowserVisualState());

  const currentRoute = resolveCurrentRoute(currentPath);
  const controller = useProductShellController({
    initialCollapsed: initialShellState.collapsed,
    initialTheme: initialShellState.theme,
    initialLocale: initialShellState.locale,
    navId: "aos-primary-side-nav",
    onCollapsedChange: (collapsed) => {
      writeBrowserStorage(sideNavStorageKey, String(collapsed));
    },
    onThemeChange: (theme) => {
      writeBrowserStorage(themeStorageKey, theme);
      applyRootTheme(theme);
    },
    onLocaleChange: (locale) => {
      const resolvedLocale = resolveLocale(locale);
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
  const forceExpandedOwnerQualityState = isForceExpandedOwnerQualityState({
    route: currentRouteId,
    theme: controller.theme,
    locale: currentLocale,
    viewport: browserVisualState.viewport,
    reducedMotion: browserVisualState.reducedMotion
  });
  const visualInstanceCollapsed = forceExpandedOwnerQualityState ? false : controller.collapsed;
  const visualInstanceVariant = resolveVisualInstanceVariant({
    route: currentRouteId,
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
    navId: "aos-primary-side-nav",
    onCollapsedChange: (collapsed: boolean) => {
      controller.setCollapsed(collapsed);
    },
    onThemeChange: controller.setTheme,
    onLocaleMenuOpenChange: controller.setLocaleMenuOpen,
    onLocaleChange: controller.setLocale
  };
  const currentRouteLabel = currentRouteId === "work"
    ? getWorkMockupPageTitle(currentPath, currentLocale)
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
        href: buildRouteHref(item.path, {
          locale: currentLocale,
          theme: controller.theme,
          collapsed: visualInstanceCollapsed
        }),
        iconName: item.icon,
        selected: item.path === currentRoute.path
      }))
    }
  ];
  return (
    <ProductShell
      {...productShellControlProps}
      productName={copyText(currentCopy, "productName", "TCRN AOS")}
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
      data-product-logo-line-two={aosProductLogoAsset.lineTwo}
      data-visual-instance-mobile-collapse-policy="hidden-affordance"
      data-visual-instance-variant={visualInstanceVariant}
      data-visual-instance-theme={controller.theme}
      data-tcrn-theme={controller.theme}
      data-visual-instance-locale={currentLocale}
      data-visual-instance-collapsed={visualInstanceCollapsed ? "true" : "false"}
      data-owner-quality-collapse-policy={browserVisualState.viewport === "mobile" ? "mobile-hidden-collapse-affordance" : "desktop-actionable-collapse-toggle"}
      data-visual-instance-route={currentRouteId}
      data-visual-instance-search="not-rendered"
      data-visual-instance-viewport={browserVisualState.viewport}
      data-visual-instance-reduced-motion={browserVisualState.reducedMotion ? "true" : "false"}
      data-visual-instance-content={currentRouteId}
      data-owner-quality-product-shell-oracle="true"
      data-design-system-source="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state"
      data-storybook-contract-consumed="product-shell-semantic-boundary"
      data-storybook-visual-instance-consumed="aos-owner-quality-product-shell"
      data-ds-product-shell-boundary-consumed="ProductShell useProductShellController no-global-search"
      data-product-shell-global-search="not-rendered"
      data-product-shell-search-capability="absent"
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
        collapsed={visualInstanceCollapsed}
        theme={controller.theme}
        locale={currentLocale}
        route={currentRouteId}
        variant={visualInstanceVariant}
        viewport={browserVisualState.viewport}
        routeHref={(path) => buildRouteHref(path, {
          locale: currentLocale,
          theme: controller.theme,
          collapsed: visualInstanceCollapsed
        })}
      />
    </ProductShell>
  );
}

function OwnerQualityContent({
  apiReadback,
  copy,
  currentPath,
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
  collapsed: boolean;
  theme: "light" | "dark";
  locale: TcrnLocale;
  route: AosRouteId;
  variant: string;
  viewport: VisualInstanceViewportState;
  routeHref: (path: string) => string;
}) {
  const isWorkFirst = route === "work";
  if (isWorkFirst) {
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

function readInitialShellState(ssrPath = "/cockpit", ssrSearch = ""): InitialShellState {
  const params = typeof window === "undefined"
    ? new URLSearchParams(ssrSearch.replace(/^\?/, ""))
    : new URLSearchParams(window.location.search);
  const currentPath = typeof window === "undefined" ? ssrPath : window.location.pathname;
  const collapsedFromQuery = params?.get("collapsed");
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
    locale: ownerQualityRoutePolicy.locale ?? resolveLocale(params?.get("locale")),
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

function resolveOwnerQualityRoutePolicy(path: string, params: URLSearchParams | undefined): OwnerQualityRoutePolicy {
  const route = resolveCurrentRoute(path).id;
  const theme = params?.get("theme") ?? null;
  const locale = params?.get("locale") ?? null;
  if (route === "cockpit" && (locale === null || locale === tcrnDefaultLocale)) {
    if (theme === "dark") {
      return { forceExpanded: false, theme: "dark", locale: tcrnDefaultLocale, reason: "accepted_owner_quality_variant" };
    }
    if (theme === null || theme === "light") {
      return { forceExpanded: false, theme: "light", locale: tcrnDefaultLocale, reason: "accepted_owner_quality_variant" };
    }
  }
  if (route === "work") {
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
  viewport,
  reducedMotion
}: {
  route: AosRouteId;
  theme: "light" | "dark";
  locale: TcrnLocale;
  viewport: VisualInstanceViewportState;
  reducedMotion: boolean;
}): boolean {
  if (reducedMotion && viewport === "desktop" && route === "cockpit" && theme === "light" && locale === "en") return true;
  if (viewport === "mobile" && route === "work" && theme === "dark" && locale === "zh-CN") return true;
  return false;
}

function buildRouteHref(
  path: string,
  state: { locale: TcrnLocale; theme: "light" | "dark"; collapsed: boolean }
): string {
  const params = new URLSearchParams();
  params.set("locale", state.locale);
  params.set("theme", state.theme);
  params.set("collapsed", state.collapsed ? "true" : "false");
  return `${path}?${params.toString()}`;
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

function resolveCurrentRoute(path: string): ShellNavItem {
  return shellNavItems.find((item) => item.path === path)
    ?? shellNavItems.find((item) => item.id === "work" && path.startsWith("/work/"))
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
[data-work-page-eyebrow="true"] {
  margin: 0 0 6px;
  color: var(--tcrn-color-text-secondary);
  font-size: 12px;
  font-weight: 700;
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
[data-work-backlog-groups="shaped-unshaped"] {
  align-items: start;
  grid-template-columns: minmax(0, 1fr);
}
`;
}
