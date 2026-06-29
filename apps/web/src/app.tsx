import { useEffect, useMemo, useState } from "react";
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
  const [currentPath] = useState(initialShellState.currentPath);
  const [lastSearchResult, setLastSearchResult] = useState(initialShellState.lastSearchResult);
  const [apiReadback, setApiReadback] = useState<ApiReadbackState>(initialApiReadback);

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
    applyRootTheme(controller.theme);
  }, [controller.theme]);

  useEffect(() => {
    applyRootLocale(resolveLocale(controller.locale));
  }, [controller.locale]);

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
  const shellSearchPlaceholder = currentCopy.shellSearch ?? localeCopy.en.shellSearch ?? "Search modules, work items, or proof";
  const dummyCockpitLabel = currentCopy.dummyCockpit ?? localeCopy.en.dummyCockpit ?? "Dummy Cockpit";
  const workModuleLabel = currentCopy.workModule ?? localeCopy.en.workModule ?? "Work module entry";
  const navGroups: ProductShellNavGroup[] = [
    {
      id: "registered-shell-entries",
      label: "Registered shell entries",
      selected: true,
      items: shellNavItems.map((item) => ({
        id: item.id,
        label: item.label,
        href: item.path,
        iconName: item.icon,
        selected: item.path === currentRoute.path
      }))
    }
  ];

  return (
    <ProductShell
      {...controller.productShellControlProps}
      productName="AOS Rebuild Workspace"
      moduleName="Frontend shell slice"
      brandSuffix="AOS"
      brandCaption="Rebuild workspace"
      brandMarkSrc="/assets/tcrn-brand-mark.svg"
      brandMarkAlt="TCRN registered brand mark"
      currentRouteLabel={currentRoute.label}
      navLabel="Registered AOS modules"
      navGroups={navGroups}
      locales={tcrnLocaleMetadata}
      collapsedStorageKey={sideNavStorageKey}
      contentId="content"
      contentRole="main"
      contentLabel="AOS shell content"
      skipLinkLabel="Skip to shell content"
      search={{
        ...controller.productShellSearchProps,
        label: "Search AOS shell",
        placeholder: shellSearchPlaceholder,
        shortcut: "auto",
        resultsLabel: "AOS shell search results",
        emptyLabel: "No local fixture results"
      }}
      data-aos-shell="first-frontend-slice"
      data-design-system-source="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state"
      data-storybook-contract-consumed="product-shell-semantic-boundary"
      data-ds-product-shell-boundary-consumed="ProductShell useProductShellController ProductShellSearch"
      data-local-wrapper-event-delegation="absent"
      data-local-shell-effect-clones="removed"
      data-cockpit-aggregation="deferred"
      data-aos-registered-module-boundary="cockpit-work-only"
      data-search-activation-readback={lastSearchResult}
      data-current-path={currentPath}
    >
      <EnvironmentBanner label="AOS frontend shell slice" state={{ state: "local_only" }} />
      <InlineAlert tone="warning">
        <strong>{currentCopy.localOnly}</strong>
        <span>{currentCopy.noOverclaim}</span>
      </InlineAlert>

      <ReadbackPanel title="AOS frontend shell">
        <Heading level={1} id="shell-overview-heading">AOS frontend shell</Heading>
        <Text>
          First implementation slice: DS ProductShell navigation, package-owned shell controls, i18n/theme posture, API readbacks, dummy Cockpit, and the Work entry.
        </Text>
        <KeyValueList
          items={[
            { key: "runtime", label: "Runtime", value: <span data-metric-value="runtime">{apiReadback.metrics.runtime}</span> },
            { key: "stories", label: "Stories", value: <span data-metric-value="stories">{apiReadback.metrics.stories}</span> },
            { key: "gates", label: "Gates", value: <span data-metric-value="gates">{apiReadback.metrics.gates}</span> },
            { key: "auditEvents", label: "Audit events", value: <span data-metric-value="auditEvents">{apiReadback.metrics.auditEvents}</span> }
          ]}
        />
        <EvidenceStrip items={["registered DS surfaces", "ProductShell boundary", "Cockpit + Work only"]} />
      </ReadbackPanel>

      <section id="cockpit" data-aos-dummy-cockpit="true" aria-labelledby="cockpit-heading">
        <ReadbackPanel title={dummyCockpitLabel}>
          <Heading level={2} id="cockpit-heading">{dummyCockpitLabel}</Heading>
          <Badge tone="warning">structural placeholder</Badge>
          <KeyValueList
            items={[
              { key: "queue", label: "External queue", value: "none" },
              { key: "dispatch", label: "Live dispatch", value: "not enabled" },
              { key: "acceptance", label: "Product acceptance", value: "not claimed" },
              { key: "release", label: "Release readiness", value: "not claimed" }
            ]}
          />
          <EvidenceStrip items={["local fixture", "dummy Cockpit only", "no live dispatch"]} />
        </ReadbackPanel>
        <ReadbackPanel title="Backend readback">
          <Text data-api-state>{apiReadback.statusText}</Text>
          <KeyValueList
            items={[
              { key: "runtime", label: "Runtime", value: <span data-api-runtime>{apiReadback.runtime}</span> },
              { key: "queue", label: "External queue", value: <span data-api-queue>{apiReadback.queue}</span> },
              { key: "policy", label: "Policy", value: <span data-api-policy>{apiReadback.policy}</span> },
              { key: "readback", label: "Readback counts", value: <span data-api-counts>{apiReadback.counts}</span> }
            ]}
          />
          <EvidenceStrip items={["/api/health", "/api/readback", "/api/policy"]} />
          <DisclosurePanel expanded={false} title="Technical API payload" data-raw-json-disclosure="secondary">
            <pre hidden data-api-summary>{JSON.stringify(apiReadback.summary, null, 2)}</pre>
          </DisclosurePanel>
        </ReadbackPanel>
      </section>

      <section id="work" data-aos-work-module-entry="jira-like" aria-labelledby="work-heading">
        <ReadbackPanel title={workModuleLabel}>
          <Heading level={2} id="work-heading">{workModuleLabel}</Heading>
          <Badge tone="neutral">fixture-safe rows</Badge>
          <TableShell
            label="AOS work module entry"
            columns={[
              { key: "project", label: "Project" },
              { key: "initiative", label: "Initiative" },
              { key: "story", label: "Story" },
              { key: "gate", label: "Gate" },
              { key: "evidence", label: "Evidence" },
              { key: "assignment", label: "Assignment" },
              { key: "state", label: "State" }
            ]}
            rows={workModuleRows.map((row) => ({
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
      </section>

      <section aria-labelledby="slice-boundary-heading" data-aos-registered-module-boundary="cockpit-work-only">
        <ReadbackPanel title="Registered slice boundary">
          <Heading level={2} id="slice-boundary-heading">Registered slice boundary</Heading>
          <Badge tone="neutral">Cockpit + Work only</Badge>
          <KeyValueList
            items={[
              { key: "visible-nav", label: "Visible primary navigation", value: "Cockpit and Work" },
              { key: "alias-routes", label: "Legacy aliases", value: "served for compatibility, not registered IA" },
              { key: "future-modules", label: "Future modules", value: "require separate owner route" },
              { key: "acceptance", label: "Acceptance", value: "not claimed" }
            ]}
          />
        </ReadbackPanel>
      </section>
    </ProductShell>
  );
}

function readInitialShellState(): InitialShellState {
  const params = typeof window === "undefined" ? undefined : new URLSearchParams(window.location.search);
  const currentPath = typeof window === "undefined" ? "/cockpit" : window.location.pathname;
  const mobileDefault = typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;
  return {
    collapsed: readStoredBoolean(sideNavStorageKey, mobileDefault),
    theme: resolveTheme(params?.get("theme") ?? readBrowserStorage(themeStorageKey)),
    locale: resolveLocale(params?.get("locale") ?? readBrowserStorage(localeStorageKey)),
    currentPath,
    lastSearchResult: readBrowserStorage(lastSearchResultStorageKey) ?? "none"
  };
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
