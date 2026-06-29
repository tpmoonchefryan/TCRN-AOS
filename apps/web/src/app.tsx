import { renderToStaticMarkup } from "react-dom/server";
import {
  Badge,
  EnvironmentBanner,
  EvidenceStrip,
  Heading,
  InlineAlert,
  KeyValueList,
  NavGroup,
  NavItem,
  SearchInput,
  SideNav,
  SideNavCollapseButton,
  ShellBrandLockup,
  ShellLocaleMenu,
  ShellThemeToggle,
  SkipLink,
  StatusBadge,
  ReadbackPanel,
  TableShell,
  Text,
  TopBar,
  tcrnComponentCss
} from "@tcrn/ui-react";
import {
  tcrnDefaultLocale,
  tcrnLocaleMetadata,
  tcrnSupportedLocales,
  type TcrnLocale
} from "@tcrn/ui-copy-state";
import { tcrnTokenCss } from "@tcrn/ui-tokens";
import { localeCopy, shellNavItems, workModuleRows } from "./data.js";

const shellSearchRecords = [
  ...shellNavItems.map((item) => ({
    title: item.label,
    meta: "Registered shell entry",
    href: item.path,
    tokens: `${item.label} ${item.description}`
  })),
  ...workModuleRows.map((row) => ({
    title: row.story,
    meta: `${row.project} / ${row.initiative}`,
    href: "/work",
    tokens: `${row.project} ${row.initiative} ${row.story} ${row.gate} ${row.evidence} ${row.assignment}`
  }))
];

export function renderAosShellHtml(): string {
  const appHtml = renderToStaticMarkup(<AosShell />);
  const script = createClientScript();

  return `<!doctype html>
<html lang="en" data-tcrn-theme="light" data-aos-locale="${tcrnDefaultLocale}" data-aos-shell-html="true">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TCRN AOS Rebuild Workspace</title>
    <meta name="tcrn-aOS-frontend-slice" content="shell_dummy_cockpit_work_entry" />
    <meta name="tcrn-design-system-source" content="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state" />
    <meta name="tcrn-aOS-brand-source" content="@tcrn/ui-react ShellBrandLockup with registered tcrn-brand-mark.svg" />
    <link rel="icon" href="/assets/tcrn-brand-mark.svg" type="image/svg+xml" />
    <style data-tcrn-token-source="@tcrn/ui-tokens">${tcrnTokenCss}</style>
    <style data-tcrn-component-style-source="@tcrn/ui-react">${tcrnComponentCss}</style>
    <style data-aos-shell-style="product-local">${createShellCss()}</style>
  </head>
  <body data-aos-shell-body="first-frontend-slice" data-product-acceptance="not-claimed" data-release-readiness="not-claimed" data-live-dispatch="not-enabled">
    <div id="aos-root">${appHtml}</div>
    <script data-aos-shell-client="theme-locale-search-api">${script}</script>
  </body>
</html>`;
}

function AosShell() {
  return (
    <div
      className="aos-shell"
      data-aos-shell="first-frontend-slice"
      data-design-system-source="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state"
      data-storybook-contract-consumed="shell-theme-locale-search-state-copy"
      data-cockpit-aggregation="deferred"
      data-side-nav-collapsed="false"
      data-side-nav-storage="session"
      data-responsive-shell-posture="desktop-expanded-mobile-collapsed"
    >
      <SkipLink className="aos-skip-link" href="#content">Skip to shell content</SkipLink>
      <aside className="aos-sidebar" data-shell-region="side-navigation">
        <div className="aos-sidebar-header">
          <a
            className="aos-brand"
            href="/"
            aria-label="TCRN AOS home"
            data-registered-brand-lockup="@tcrn/ui-react/ShellBrandLockup"
            data-brand-asset-path="/assets/tcrn-brand-mark.svg"
            data-forbidden-aos-wordmark-assets="absent"
          >
            <ShellBrandLockup
              suffix="AOS"
              caption="Rebuild workspace"
              suffixClassName="aos-brand-suffix"
              brandMarkSrc="/assets/tcrn-brand-mark.svg"
              brandMarkAlt="TCRN registered brand mark"
              data-visible-registered-brand-lockup="true"
            />
          </a>
          <SideNavCollapseButton
            collapsed={false}
            controls="aos-primary-side-nav"
            className="aos-side-nav-toggle"
            persistedKey="tcrn-aos-side-nav-collapsed"
          />
        </div>
        <SideNav id="aos-primary-side-nav" label="Registered AOS modules" className="aos-nav" data-registered-navigation-only="true">
          <NavGroup label="Registered shell entries" selected>
            {shellNavItems.map((item) => (
              <NavItem key={item.id} href={item.path} iconName={item.icon} data-route-path={item.path}>
                {item.label}
              </NavItem>
            ))}
          </NavGroup>
        </SideNav>
      </aside>

      <div className="aos-workspace">
        <TopBar
          productName="AOS Rebuild Workspace"
          moduleName="Frontend shell slice"
          actions={
            <div className="aos-top-actions" data-shell-region="utility-row">
              <div className="aos-location-readback">
                <span data-i18n="currentLocation">Current location</span>
                <strong data-current-route-label>Cockpit</strong>
              </div>
              <div className="aos-search-wrap">
                <SearchInput
                  aria-label="Search AOS shell"
                  placeholder="Search modules, work items, or proof"
                  shortcut="auto"
                  data-aos-shell-search="true"
                  data-i18n-placeholder="shellSearch"
                />
                <div className="aos-search-results" data-search-results hidden />
              </div>
              <ShellLocaleMenu
                className="aos-locale-control"
                locales={tcrnLocaleMetadata}
                currentLocale={tcrnDefaultLocale}
                label="Language"
              />
              <ShellThemeToggle currentTheme="light" className="aos-theme-button" />
            </div>
          }
        />

        <main id="content" className="aos-main" data-shell-region="content">
          <div className="aos-proof-stack" data-aos-proof-banner-stack="spaced">
            <EnvironmentBanner label="AOS frontend shell slice" state={{ state: "local_only" }} />
            <InlineAlert tone="warning" className="aos-no-overclaim" data-aos-no-overclaim-banner="true">
              <strong data-i18n="localOnly">Local structural slice only</strong>
              <span className="aos-alert-copy" data-i18n="noOverclaim">
                Local fixture data only; no external queue, live dispatch, product acceptance, or release-readiness state is claimed.
              </span>
            </InlineAlert>
          </div>

          <section className="aos-overview" aria-labelledby="aos-overview-heading" data-current-path-overview="true">
            <div>
              <Heading level={1} id="aos-overview-heading">AOS frontend shell</Heading>
              <Text>
                First implementation slice: attached product navigation, DS-backed controls, i18n/theme posture, API readbacks, dummy Cockpit, and the Work entry.
              </Text>
            </div>
            <div className="aos-status-grid" aria-label="Runtime readbacks">
              <MetricCard label="Runtime" value="Fetching" marker="runtime" />
              <MetricCard label="Stories" value="--" marker="stories" />
              <MetricCard label="Gates" value="--" marker="gates" />
              <MetricCard label="Audit events" value="--" marker="auditEvents" />
            </div>
          </section>

          <section id="cockpit" className="aos-section" data-aos-dummy-cockpit="true" aria-labelledby="cockpit-heading">
            <div className="aos-section-heading">
              <Heading level={2} id="cockpit-heading" data-i18n="dummyCockpit">Dummy Cockpit</Heading>
              <Badge tone="warning">structural placeholder</Badge>
            </div>
            <div className="aos-cockpit-grid">
              <ReadbackPanel title="Operational posture">
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
                <p className="aos-api-state" data-api-state>Waiting for /api/health, /api/readback, and /api/policy.</p>
                <KeyValueList
                  items={[
                    { key: "runtime", label: "Runtime", value: <span data-api-runtime>pending</span> },
                    { key: "queue", label: "External queue", value: <span data-api-queue>pending</span> },
                    { key: "policy", label: "Policy", value: <span data-api-policy>pending</span> },
                    { key: "readback", label: "Readback counts", value: <span data-api-counts>pending</span> }
                  ]}
                />
                <EvidenceStrip items={["/api/health", "/api/readback", "/api/policy"]} />
                <details className="aos-debug-disclosure" data-raw-json-disclosure="secondary">
                  <summary>Technical API payload</summary>
                  <pre className="aos-api-json" data-api-summary>{JSON.stringify({ status: "pending" }, null, 2)}</pre>
                </details>
              </ReadbackPanel>
            </div>
          </section>

          <section id="work" className="aos-section" data-aos-work-module-entry="jira-like" aria-labelledby="work-heading">
            <div className="aos-section-heading">
              <Heading level={2} id="work-heading" data-i18n="workModule">Work module entry</Heading>
              <Badge tone="neutral">fixture-safe rows</Badge>
            </div>
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
          </section>

          <section className="aos-section" aria-labelledby="slice-boundary-heading" data-aos-registered-module-boundary="cockpit-work-only">
            <div className="aos-section-heading">
              <Heading level={2} id="slice-boundary-heading">Registered slice boundary</Heading>
              <Badge tone="neutral">Cockpit + Work only</Badge>
            </div>
            <KeyValueList
              items={[
                { key: "visible-nav", label: "Visible primary navigation", value: "Cockpit and Work" },
                { key: "alias-routes", label: "Legacy aliases", value: "served for compatibility, not registered IA" },
                { key: "future-modules", label: "Future modules", value: "require separate owner route" },
                { key: "acceptance", label: "Acceptance", value: "not claimed" }
              ]}
            />
          </section>
        </main>
      </div>
    </div>
  );
}

function MetricCard({ label, value, marker }: { label: string; value: string; marker: string }) {
  return (
    <div className="aos-metric" data-metric={marker}>
      <span>{label}</span>
      <strong data-metric-value={marker}>{value}</strong>
    </div>
  );
}

function createClientScript(): string {
  const payload = JSON.stringify({
    locales: tcrnLocaleMetadata,
    supportedLocales: tcrnSupportedLocales,
    defaultLocale: tcrnDefaultLocale,
    copy: localeCopy,
    searchRecords: shellSearchRecords,
    routes: shellNavItems.map((item) => ({ path: item.path, label: item.label }))
  });

  return `(function(){
  const config = ${payload};
  const root = document.documentElement;
  const body = document.body;
  const storage = window.localStorage;
  const sideNavStorage = window.sessionStorage;
  const params = new URLSearchParams(window.location.search);
  const routeLabel = document.querySelector("[data-current-route-label]");
  const currentPath = window.location.pathname;
  const matchedRoute = config.routes.find((route) => route.path === currentPath) || config.routes.find((route) => currentPath.endsWith(route.path + ".html")) || config.routes[0];
  const mobileNavQuery = window.matchMedia("(max-width: 720px)");

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
  }

  function resolveLocale(value) {
    return config.supportedLocales.includes(value) ? value : config.defaultLocale;
  }

  function applyLocale(locale) {
    const resolved = resolveLocale(locale);
    root.lang = resolved;
    root.dataset.aosLocale = resolved;
    storage.setItem("tcrn-aos-locale", resolved);
    const copy = config.copy[resolved] || config.copy[config.defaultLocale];
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (key && copy[key]) node.textContent = copy[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      const key = node.getAttribute("data-i18n-placeholder");
      if (key && copy[key]) node.setAttribute("placeholder", copy[key]);
    });
    const localeMeta = config.locales.find((entry) => entry.locale === resolved);
    setText("[data-locale-current]", localeMeta ? localeMeta.nativeName : "English");
    document.querySelectorAll("[data-locale-option]").forEach((node) => {
      node.setAttribute("aria-current", node.getAttribute("data-locale-option") === resolved ? "true" : "false");
    });
  }

  function applyTheme(theme) {
    const resolved = theme === "dark" ? "dark" : "light";
    root.dataset.tcrnTheme = resolved;
    storage.setItem("tcrn-aos-theme", resolved);
    const button = document.querySelector("[data-theme-toggle]");
    if (button) {
      button.setAttribute("data-current-theme", resolved);
      button.setAttribute("aria-label", resolved === "dark" ? "Switch to light mode" : "Switch to dark mode");
      button.setAttribute("title", resolved === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
  }

  function applySideNavCollapsed(collapsed, options) {
    const isCollapsed = collapsed === true || collapsed === "true";
    const shell = document.querySelector("[data-aos-shell]");
    const toggle = document.querySelector("[data-side-nav-toggle]");
    shell?.setAttribute("data-side-nav-collapsed", String(isCollapsed));
    if (options?.persist !== false) {
      sideNavStorage.setItem("tcrn-aos-side-nav-collapsed", String(isCollapsed));
    }
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(!isCollapsed));
      toggle.setAttribute("aria-label", isCollapsed ? "Expand side navigation" : "Collapse side navigation");
      toggle.setAttribute("title", isCollapsed ? "Expand side navigation" : "Collapse side navigation");
      toggle.setAttribute("data-side-nav-collapsed", String(isCollapsed));
    }
  }

  function transitionTheme(nextTheme) {
    body.dataset.themeSwitching = "true";
    const update = () => applyTheme(nextTheme);
    if (document.startViewTransition) {
      document.startViewTransition(update).finished.finally(() => { delete body.dataset.themeSwitching; });
      return;
    }
    update();
    window.setTimeout(() => { delete body.dataset.themeSwitching; }, 260);
  }

  function renderSearchResults(query) {
    const layer = document.querySelector("[data-search-results]");
    if (!layer) return;
    const normalized = query.trim().toLowerCase();
    const records = normalized.length === 0 ? [] : config.searchRecords.filter((record) => record.tokens.toLowerCase().includes(normalized)).slice(0, 8);
    layer.innerHTML = records.length === 0 ? '<div class="aos-search-empty">No local fixture results</div>' : records.map((record) => '<a href="' + record.href + '" data-search-result><strong>' + record.title + '</strong><span>' + record.meta + '</span></a>').join("");
    layer.hidden = records.length === 0;
  }

  const initialLocale = resolveLocale(params.get("locale") || storage.getItem("tcrn-aos-locale") || config.defaultLocale);
  const initialTheme = params.get("theme") || storage.getItem("tcrn-aos-theme") || "light";
  const storedSideNav = sideNavStorage.getItem("tcrn-aos-side-nav-collapsed");
  const initialSideNavCollapsed = storedSideNav === null ? mobileNavQuery.matches : storedSideNav === "true";
  applyLocale(initialLocale);
  applyTheme(initialTheme);
  applySideNavCollapsed(initialSideNavCollapsed, { persist: false });

  if (routeLabel && matchedRoute) routeLabel.textContent = matchedRoute.label;
  document.querySelectorAll("[data-route-path]").forEach((node) => {
    const selected = matchedRoute && node.getAttribute("data-route-path") === matchedRoute.path;
    if (selected) node.setAttribute("aria-current", "page");
    node.setAttribute("data-selected", selected ? "true" : "false");
  });

  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    transitionTheme(root.dataset.tcrnTheme === "dark" ? "light" : "dark");
  });

  document.querySelector("[data-side-nav-toggle]")?.addEventListener("click", () => {
    const shell = document.querySelector("[data-aos-shell]");
    applySideNavCollapsed(shell?.getAttribute("data-side-nav-collapsed") !== "true");
  });

  const localeTrigger = document.querySelector("[data-locale-menu-toggle]");
  const localeMenu = document.querySelector("[data-locale-menu]");
  function isLocaleMenuOpen() {
    return Boolean(localeMenu && !localeMenu.hidden);
  }
  function openLocaleMenu() {
    if (!localeMenu || !localeTrigger) return;
    localeMenu.hidden = false;
    localeTrigger.setAttribute("aria-expanded", "true");
  }
  function closeLocaleMenu(options) {
    if (!localeMenu || !localeTrigger) return;
    localeMenu.hidden = true;
    localeTrigger.setAttribute("aria-expanded", "false");
    if (options?.returnFocus) {
      localeTrigger.focus({ preventScroll: true });
    }
  }
  localeTrigger?.addEventListener("click", () => {
    if (isLocaleMenuOpen()) closeLocaleMenu({ returnFocus: false });
    else openLocaleMenu();
  });
  document.querySelectorAll("[data-locale-option]").forEach((option) => {
    option.addEventListener("click", () => {
      applyLocale(option.getAttribute("data-locale-option"));
      closeLocaleMenu({ returnFocus: true });
    });
  });
  document.addEventListener("pointerdown", (event) => {
    if (!isLocaleMenuOpen()) return;
    const target = event.target;
    if (target instanceof Node && (localeMenu?.contains(target) || localeTrigger?.contains(target))) return;
    closeLocaleMenu({ returnFocus: false });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isLocaleMenuOpen()) return;
    const target = event.target;
    const withinLocaleControl = target instanceof Node && (localeMenu?.contains(target) || localeTrigger?.contains(target));
    closeLocaleMenu({ returnFocus: withinLocaleControl });
  });

  const searchInput = document.querySelector("[data-aos-shell-search]");
  const searchWrap = searchInput?.closest(".aos-search-wrap");
  function collapseSearch(options) {
    searchWrap?.classList.remove("is-searching");
    const layer = document.querySelector("[data-search-results]");
    if (layer) layer.hidden = true;
    if (options?.blur && document.activeElement === searchInput && typeof searchInput.blur === "function") {
      searchInput.blur();
    }
  }
  searchInput?.addEventListener("focus", () => searchWrap?.classList.add("is-searching"));
  searchInput?.addEventListener("input", (event) => renderSearchResults(event.target.value || ""));
  searchInput?.addEventListener("blur", () => {
    window.setTimeout(() => collapseSearch({ blur: false }), 140);
  });
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      collapseSearch({ blur: true });
      return;
    }
    if (event.key === "Tab") {
      collapseSearch({ blur: false });
      window.setTimeout(() => {
        if (document.activeElement === searchInput) collapseSearch({ blur: true });
      }, 0);
    }
  });
  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!searchWrap || !(target instanceof Node) || searchWrap.contains(target)) return;
    collapseSearch({ blur: true });
  });
  window.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      searchInput?.focus({ preventScroll: true });
    }
  });

  async function fetchJson(path) {
    const response = await fetch(path, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(path + " returned " + response.status);
    return response.json();
  }

  Promise.all([fetchJson("/api/health"), fetchJson("/api/readback"), fetchJson("/api/policy")]).then(([health, readback, policy]) => {
    setText("[data-metric-value='runtime']", health.ok ? "local fixture" : "unavailable");
    setText("[data-metric-value='stories']", String(readback.operationalRecordCounts?.stories ?? "--"));
    setText("[data-metric-value='gates']", String(readback.operationalRecordCounts?.gates ?? "--"));
    setText("[data-metric-value='auditEvents']", String(readback.operationalRecordCounts?.auditEvents ?? "--"));
    setText("[data-api-state]", "API readbacks available from local proof service.");
    const summary = {
      health: { ok: health.ok, runtimeDatabase: health.runtimeDatabase, externalQueue: health.externalQueue, liveCodexDispatchAuthorized: health.liveCodexDispatchAuthorized },
      readbackCounts: readback.operationalRecordCounts,
      policy: { allowedRuntimeMutation: policy.allowedRuntimeMutation, serviceProofOnly: policy.serviceProofOnly }
    };
    setText("[data-api-runtime]", health.runtimeDatabase || "local fixture");
    setText("[data-api-queue]", health.externalQueue || "none");
    setText("[data-api-policy]", policy.serviceProofOnly ? "service proof only" : "unavailable");
    setText("[data-api-counts]", "stories " + (readback.operationalRecordCounts?.stories ?? "--") + ", gates " + (readback.operationalRecordCounts?.gates ?? "--"));
    setText("[data-api-summary]", JSON.stringify(summary, null, 2));
  }).catch((error) => {
    setText("[data-metric-value='runtime']", "fail-closed");
    setText("[data-api-state]", "API readbacks unavailable: " + error.message);
    setText("[data-api-runtime]", "fail-closed");
    setText("[data-api-queue]", "unavailable");
    setText("[data-api-policy]", "unavailable");
    setText("[data-api-counts]", "unavailable");
    setText("[data-api-summary]", JSON.stringify({ ok: false, error: error.message }, null, 2));
  });
})();`;
}

function createShellCss(): string {
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
  transition: background-color var(--tcrn-motion-duration-md) ease, color var(--tcrn-motion-duration-md) ease;
}
body[data-theme-switching="true"]::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: color-mix(in srgb, var(--tcrn-color-brand-primary-bg), transparent 20%);
  animation: aos-theme-wash 260ms ease both;
  z-index: 999;
}
@keyframes aos-theme-wash { from { opacity: 0.22; } to { opacity: 0; } }
a { color: inherit; }
button, input { font: inherit; }
:focus-visible { outline: 3px solid var(--tcrn-color-focus-ring); outline-offset: 2px; }
.aos-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  background:
    radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--tcrn-color-brand-secondary-bg), transparent 18%), transparent 30rem),
    var(--tcrn-color-surface-canvas);
  transition: grid-template-columns var(--tcrn-motion-duration-md) ease;
}
.aos-shell[data-side-nav-collapsed="true"] {
  grid-template-columns: 92px minmax(0, 1fr);
}
.aos-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px 14px;
  border-right: 1px solid var(--tcrn-color-border-subtle);
  background: color-mix(in srgb, var(--tcrn-color-surface-panel), var(--tcrn-color-surface-canvas) 8%);
  box-shadow: 8px 0 32px color-mix(in srgb, var(--tcrn-color-border-subtle), transparent 82%);
}
.aos-sidebar-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 38px;
  align-items: center;
  gap: 8px;
}
.aos-brand {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 52px;
  padding: 4px 8px;
  overflow: hidden;
  border-radius: var(--tcrn-radius-panel);
  text-decoration: none;
}
.aos-brand .tcrn-brand-mark {
  inline-size: 42px;
  block-size: 42px;
}
.aos-brand-suffix {
  color: var(--tcrn-color-brand-secondary);
}
.aos-shell[data-side-nav-collapsed="true"] .aos-sidebar-header { grid-template-columns: 1fr; justify-items: center; }
.aos-shell[data-side-nav-collapsed="true"] .aos-brand {
  inline-size: 42px;
  min-height: 42px;
  padding: 3px;
}
.aos-shell[data-side-nav-collapsed="true"] .tcrn-shell-brand-lockup__copy {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.aos-shell[data-side-nav-collapsed="true"] .tcrn-side-nav { align-items: center; }
.aos-shell[data-side-nav-collapsed="true"] .tcrn-nav-group { width: 48px; }
.aos-shell[data-side-nav-collapsed="true"] .tcrn-nav-group__label,
.aos-shell[data-side-nav-collapsed="true"] .tcrn-nav-item__label {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.aos-shell[data-side-nav-collapsed="true"] .tcrn-nav-item {
  grid-template-columns: 20px;
  justify-content: center;
  inline-size: 44px;
  min-height: 42px;
  padding: 8px;
}
.aos-workspace { min-width: 0; display: grid; grid-template-rows: auto 1fr; }
.aos-workspace > .tcrn-top-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  grid-template-columns: max-content max-content minmax(0, 1fr);
  background: color-mix(in srgb, var(--tcrn-color-surface-panel), transparent 3%);
}
.aos-top-actions {
  display: grid;
  grid-template-columns: max-content minmax(220px, 360px) max-content max-content;
  justify-content: end;
  align-items: center;
  gap: 10px;
}
.aos-location-readback {
  display: grid;
  gap: 1px;
  min-width: 116px;
  font-size: 12px;
  color: var(--tcrn-color-text-secondary);
}
.aos-location-readback strong { color: var(--tcrn-color-text-primary); font-size: 13px; }
.aos-search-wrap { position: relative; justify-self: end; width: min(100%, 260px); transition: width var(--tcrn-motion-duration-md) ease; }
.aos-search-wrap.is-searching { width: min(100%, 420px); }
.aos-search-results {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: min(420px, calc(100vw - 32px));
  padding: 6px;
  border: 1px solid var(--tcrn-color-border-strong);
  border-radius: 8px;
  background: var(--tcrn-color-surface-panel);
  box-shadow: var(--tcrn-elevation-floating);
}
.aos-search-results a, .aos-search-empty {
  display: grid;
  gap: 2px;
  padding: 8px;
  border-radius: 6px;
  text-decoration: none;
}
.aos-search-results a:hover { background: var(--tcrn-color-surface-muted); }
.aos-search-results span, .aos-search-empty { color: var(--tcrn-color-text-secondary); font-size: 12px; }
.aos-locale-control { position: relative; }
.aos-search-results[hidden] {
  display: none;
}
.aos-theme-button {
  border-radius: 999px;
}
.aos-main {
  display: grid;
  gap: 20px;
  width: min(1180px, 100%);
  padding: 24px 28px 44px;
}
.aos-proof-stack {
  display: grid;
  gap: 10px;
}
.aos-proof-stack .tcrn-environment-banner,
.aos-no-overclaim {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  row-gap: 4px;
}
.aos-no-overclaim {
  background: color-mix(in srgb, var(--tcrn-color-state-warning-bg), var(--tcrn-color-surface-panel) 20%);
  border-color: color-mix(in srgb, var(--tcrn-color-state-warning), transparent 55%);
  color: var(--tcrn-color-text-primary);
}
html[data-tcrn-theme="dark"] .aos-no-overclaim {
  background: #2f2411;
  border-color: #ffd27a;
  color: #f2f7ff;
}
.aos-alert-copy { min-width: 0; }
.aos-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
  gap: 24px;
  align-items: start;
  padding: 8px 0 2px;
}
.aos-status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.aos-metric, .aos-section {
  border: 1px solid var(--tcrn-color-border-subtle);
  border-radius: 8px;
  background: var(--tcrn-color-surface-panel);
}
.aos-metric {
  display: grid;
  gap: 6px;
  min-height: 78px;
  padding: 12px;
}
.aos-metric span { color: var(--tcrn-color-text-secondary); font-size: 12px; }
.aos-metric strong { font-size: 20px; overflow-wrap: anywhere; }
.aos-section {
  display: grid;
  gap: 14px;
  padding: 18px;
  box-shadow: 0 18px 44px color-mix(in srgb, var(--tcrn-color-border-subtle), transparent 82%);
}
.aos-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.aos-cockpit-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 12px;
}
.aos-api-json {
  max-height: 235px;
  overflow: auto;
  padding: 10px;
  border-radius: 8px;
  background: var(--tcrn-color-surface-muted);
  font-size: 12px;
  white-space: pre-wrap;
}
.aos-debug-disclosure {
  margin-top: 12px;
  border-top: 1px solid var(--tcrn-color-border-subtle);
  padding-top: 10px;
}
.aos-debug-disclosure summary {
  cursor: pointer;
  color: var(--tcrn-color-text-secondary);
  font-weight: 700;
  font-size: 13px;
}
@media (max-width: 1080px) {
  .aos-shell { grid-template-columns: 240px minmax(0, 1fr); }
  .aos-top-actions { grid-template-columns: minmax(180px, 280px) max-content max-content; }
  .aos-location-readback { grid-column: 1 / -1; display: flex; gap: 8px; align-items: baseline; }
  .aos-overview { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .aos-shell, .aos-shell[data-side-nav-collapsed="true"] { grid-template-columns: 1fr; }
  .aos-sidebar {
    position: sticky;
    top: 0;
    z-index: 40;
    height: auto;
    padding: 12px 14px;
    border-right: 0;
    border-bottom: 1px solid var(--tcrn-color-border-subtle);
    box-shadow: 0 10px 28px color-mix(in srgb, var(--tcrn-color-border-subtle), transparent 78%);
  }
  .aos-shell[data-side-nav-collapsed="true"] .aos-sidebar-header { grid-template-columns: minmax(0, 1fr) 38px; justify-items: stretch; }
  .aos-shell[data-side-nav-collapsed="true"] .aos-brand {
    inline-size: auto;
    min-height: 52px;
    padding: 4px 8px;
  }
  .aos-shell[data-side-nav-collapsed="true"] .tcrn-shell-brand-lockup__copy {
    position: static;
    inline-size: auto;
    block-size: auto;
    overflow: visible;
    clip-path: none;
    white-space: normal;
  }
  .aos-shell[data-side-nav-collapsed="true"] .tcrn-side-nav { align-items: stretch; }
  .aos-shell[data-side-nav-collapsed="true"] .tcrn-nav-group { width: auto; }
  .aos-shell[data-side-nav-collapsed="true"] .tcrn-nav-group__label,
  .aos-shell[data-side-nav-collapsed="true"] .tcrn-nav-item__label {
    position: static;
    inline-size: auto;
    block-size: auto;
    overflow: visible;
    clip-path: none;
    white-space: normal;
  }
  .aos-shell[data-side-nav-collapsed="true"] .tcrn-nav-item {
    grid-template-columns: 20px minmax(0, 1fr);
    inline-size: auto;
    justify-content: stretch;
  }
  .aos-shell[data-side-nav-collapsed="true"] .aos-nav { display: none; }
  .aos-sidebar .tcrn-side-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 4px; }
  .aos-workspace > .tcrn-top-bar { position: static; grid-template-columns: 1fr; align-items: stretch; }
  .aos-top-actions { grid-template-columns: minmax(0, 1fr) max-content max-content; justify-content: stretch; }
  .aos-location-readback { grid-column: 1 / -1; display: flex; gap: 8px; align-items: baseline; min-width: 0; }
  .aos-search-wrap { justify-self: stretch; width: 100%; }
  .aos-search-wrap.is-searching { width: 100%; }
  .aos-overview, .aos-cockpit-grid { grid-template-columns: 1fr; }
  .aos-main { width: 100%; padding: 18px 14px 34px; }
  .aos-section { padding: 14px; }
}
@media (max-width: 620px) {
  .aos-sidebar .tcrn-side-nav { grid-template-columns: 1fr; }
  .aos-top-actions { grid-template-columns: minmax(0, 1fr) max-content; }
  .aos-search-wrap { grid-column: 1 / -1; }
  .aos-locale-control { justify-self: stretch; }
  .aos-theme-button { justify-self: end; }
  .aos-status-grid, .tcrn-key-value-list { grid-template-columns: 1fr; }
  .aos-proof-stack .tcrn-environment-banner,
  .aos-no-overclaim { grid-template-columns: 1fr; align-items: start; }
  .aos-section-heading { align-items: flex-start; flex-direction: column; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; scroll-behavior: auto !important; }
}`;
}
