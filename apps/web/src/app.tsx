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
import { chainPartitions, localeCopy, shellNavGroups, shellNavItems, type ShellNavItem } from "./data.js";
import { ShellHeaderActions } from "./shell-header-actions.js";
import { MyWorkView, ProjectsView } from "./cockpit-views.js";
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

// Route ids come from the nav model so adding a module cannot forget this union.
type AosRouteId = (typeof shellNavItems)[number]["id"];
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
  const activePartitionId = resolveActivePartition(currentPath);
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
  const currentRouteLabel = currentPath === "/work/readback"
    ? copyText(currentCopy, "workReadbackLabel", currentLocale === "zh-CN" ? "工作读回" : "Work readback")
    : currentPath.startsWith("/work/")
      ? getWorkMockupPageTitle(currentPath, currentLocale)
      : currentLocale === "zh-CN" ? currentRoute.labelZh : currentRoute.label;
  const navGroups: ProductShellNavGroup[] = shellNavGroups.map((group) => ({
    id: group.id,
    label: currentLocale === "zh-CN" ? group.labelZh : group.label,
    sectionLabel: currentLocale === "zh-CN" ? group.labelZh : group.label,
    selected: group.items.some((item) => item.id === currentRouteId),
    items: group.items.map((item) => ({
      id: item.id,
      label: currentLocale === "zh-CN" ? item.labelZh : item.label,
      href: buildRouteHref(item.path, {
        locale: currentLocale,
        theme: controller.theme,
        collapsed: visualInstanceCollapsed
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
            collapsed: visualInstanceCollapsed
          })}
        />
      }
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
  if (!isLegacyWorkRoute) {
    if (moduleId === "my-work") {
      return <MyWorkView locale={locale} routeHref={routeHref} />;
    }
    if (moduleId === "inbox") {
      return <InboxView locale={locale} routeHref={routeHref} />;
    }
    if (moduleId === "projects") {
      return <ProjectsView locale={locale} routeHref={routeHref} />;
    }
    if (moduleId === "work-items") {
      // A path under the module addresses one item; the module root lists them.
      const key = modulePath.startsWith("/work-items/")
        ? decodeURIComponent(modulePath.slice("/work-items/".length))
        : null;
      return key
        ? <WorkItemDetailView locale={locale} routeHref={routeHref} itemKey={key} />
        : <WorkItemsView locale={locale} routeHref={routeHref} search={readSearch(currentPath)} />;
    }
    if (moduleId === "deliberations") {
      const key = modulePath.startsWith("/deliberations/")
        ? decodeURIComponent(modulePath.slice("/deliberations/".length))
        : null;
      return key
        ? <DeliberationRoomView locale={locale} routeHref={routeHref} conferenceKey={key} />
        : <DeliberationsView locale={locale} routeHref={routeHref} search={readSearch(currentPath)} />;
    }
    if (moduleId === "dashboard") {
      return <DashboardView locale={locale} routeHref={routeHref} />;
    }
    if (moduleId === "board") {
      return <BoardView locale={locale} routeHref={routeHref} search={readSearch(currentPath)} />;
    }
    if (moduleId === "release-trains") {
      return <ReleaseTrainsView locale={locale} routeHref={routeHref} />;
    }
    if (moduleId === "audit") {
      return <AuditView locale={locale} routeHref={routeHref} />;
    }
    if (moduleId === "snapshots") {
      return <SnapshotHealthView locale={locale} routeHref={routeHref} />;
    }
    if (moduleId === "knowledge-space") {
      return <KnowledgeSpaceView locale={locale} routeHref={routeHref} />;
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
 */
function buildRouteHref(
  path: string,
  state: { locale: TcrnLocale; theme: "light" | "dark"; collapsed: boolean }
): string {
  const mark = path.indexOf("?");
  const pathname = mark >= 0 ? path.slice(0, mark) : path;
  const params = new URLSearchParams(mark >= 0 ? path.slice(mark + 1) : "");
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
/** Query string for a route, tolerant of both SSR paths and browser URLs. */
function readSearch(path: string): URLSearchParams {
  const mark = path.indexOf("?");
  if (mark >= 0) return new URLSearchParams(path.slice(mark + 1));
  if (typeof window !== "undefined") return new URLSearchParams(window.location.search);
  return new URLSearchParams();
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
function resolveActivePartition(path: string): string | null {
  const scoped = chainPartitions.find((partition) => path.startsWith(`/projects/${partition.id}`));
  if (scoped) return scoped.id;
  const requested = readSearch(path).get("project");
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
.tcrn-aos-searchbar .tcrn-search-input { inline-size: 100%; }
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
/* The DS split view collapses at a 760px viewport, but this page loses another
   ~260px to the shell nav: between those widths the list column is too narrow
   for its rows and their meta bleeds into the preview. Collapse earlier, hide
   the pane when nothing is selected, and surface the selection first when one
   is — row clicks below this width navigate to the full detail instead. */
@media (max-width: 1100px) {
  [data-cockpit-split="work-items"] .tcrn-work-split-view {
    grid-template-columns: minmax(0, 1fr);
  }
  [data-cockpit-split="work-items"][data-has-selection="false"] .tcrn-work-split-view__detail {
    display: none;
  }
  [data-cockpit-split="work-items"][data-has-selection="true"] .tcrn-work-split-view__detail {
    order: -1;
  }
}
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
.tcrn-work-module-sr-only {
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
.tcrn-work-module-detail-stack {
  display: grid;
  gap: var(--tcrn-space-3);
  min-width: 0;
}
.tcrn-work-module-secondary-grid {
  display: grid;
  gap: var(--tcrn-space-3);
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  min-width: 0;
}
[data-work-backlog-groups="shaped-unshaped"] {
  align-items: start;
  grid-template-columns: minmax(0, 1fr);
}
.tcrn-phase3-readback {
  display: grid;
  gap: var(--tcrn-space-4);
  min-width: 0;
}
.tcrn-phase3-readback *,
.tcrn-phase3-readback__layout,
.tcrn-phase3-readback__detail,
.tcrn-phase3-readback__story-summary,
.tcrn-phase3-readback__knowledge,
.tcrn-phase3-readback__knowledge-entry {
  min-width: 0;
}
.tcrn-phase3-readback__filter-band,
.tcrn-phase3-readback__policy,
.tcrn-phase3-readback__section-heading,
.tcrn-phase3-readback__story-card,
.tcrn-phase3-readback__audit-card,
.tcrn-phase3-readback__knowledge-search,
.tcrn-phase3-readback__knowledge-detail,
.tcrn-phase3-readback__knowledge-results,
.tcrn-phase3-readback__knowledge-entry {
  display: grid;
  gap: var(--tcrn-space-3);
}
.tcrn-phase3-readback__tokens,
.tcrn-phase3-readback__pagination,
.tcrn-phase3-readback__status-line,
.tcrn-phase3-readback__empty,
.tcrn-phase3-readback__subtask,
.tcrn-phase3-readback__knowledge-form,
.tcrn-phase3-readback__knowledge-result-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--tcrn-space-2);
}
.tcrn-phase3-readback__layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.95fr) minmax(320px, 1.35fr);
  gap: var(--tcrn-space-4);
  align-items: start;
}
.tcrn-phase3-readback__list,
.tcrn-phase3-readback__detail {
  display: grid;
  gap: var(--tcrn-space-3);
}
.tcrn-phase3-readback__story-summary {
  display: grid;
  gap: var(--tcrn-space-3);
}
.tcrn-phase3-readback__knowledge {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(320px, 1fr);
  gap: var(--tcrn-space-4);
  align-items: start;
}
.tcrn-phase3-readback__knowledge-label {
  font-weight: var(--tcrn-font-weight-semibold);
}
.tcrn-phase3-readback__knowledge-input {
  flex: 1 1 220px;
  max-width: 34rem;
  min-height: 2.25rem;
  border: 1px solid var(--tcrn-color-border-subtle);
  border-radius: var(--tcrn-radius-2);
  padding: 0 var(--tcrn-space-3);
  background: var(--tcrn-color-surface-panel);
  color: var(--tcrn-color-text-primary);
}
.tcrn-phase3-readback__knowledge-result {
  display: grid;
  gap: var(--tcrn-space-2);
  border-block-start: 1px solid var(--tcrn-color-border-subtle);
  padding-block-start: var(--tcrn-space-3);
}
.tcrn-phase3-readback__knowledge-body {
  display: grid;
  gap: var(--tcrn-space-2);
}
.tcrn-phase3-readback__subtasks {
  display: grid;
  gap: var(--tcrn-space-2);
}
.tcrn-phase3-readback__error {
  border-color: var(--tcrn-color-border-warning);
}
@media (max-width: 820px) {
  .tcrn-phase3-readback__layout,
  .tcrn-phase3-readback__knowledge {
    grid-template-columns: minmax(0, 1fr);
  }
}
`;
}
