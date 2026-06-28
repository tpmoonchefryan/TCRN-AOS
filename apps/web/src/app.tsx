import { renderToStaticMarkup } from "react-dom/server";
import {
  Badge,
  EnvironmentBanner,
  Heading,
  Icon,
  IconButton,
  InlineAlert,
  KeyValueList,
  NavGroup,
  NavItem,
  SearchInput,
  SideNav,
  StatusBadge,
  Surface,
  TableShell,
  Text,
  TopBar
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
    meta: item.status === "active" ? "Active shell entry" : "Placeholder module",
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
    <link rel="icon" href="/assets/favicon.ico" />
    <style data-tcrn-token-source="@tcrn/ui-tokens">${tcrnTokenCss}</style>
    <style data-aos-shell-style="product-local">${createShellCss()}</style>
  </head>
  <body data-aos-shell-body="first-frontend-slice" data-product-acceptance="not-claimed" data-release-readiness="not-claimed" data-live-dispatch="not-enabled">
    <div id="aos-root">${appHtml}</div>
    <script data-aos-shell-client="theme-locale-search-api">${script}</script>
  </body>
</html>`;
}

function AosShell() {
  const nativeLocaleName = tcrnLocaleMetadata.find((entry) => entry.locale === tcrnDefaultLocale)?.nativeName ?? "English";
  return (
    <div
      className="aos-shell"
      data-aos-shell="first-frontend-slice"
      data-design-system-source="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state"
      data-storybook-contract-consumed="shell-theme-locale-search-state-copy"
      data-cockpit-aggregation="deferred"
    >
      <a className="tcrn-skip-link aos-skip-link" href="#content">Skip to shell content</a>
      <aside className="aos-sidebar" data-shell-region="side-navigation">
        <a className="aos-brand" href="/" aria-label="TCRN AOS home">
          <img src="/assets/tcrn-aos-wordmark-geometric-dark.png" alt="TCRN AOS" />
        </a>
        <SideNav label="AOS modules" className="aos-nav">
          <NavGroup label="Active workspace" selected>
            {shellNavItems.filter((item) => item.status === "active").map((item) => (
              <NavItem key={item.id} href={item.path} iconName={item.icon} data-route-path={item.path}>
                {item.label}
              </NavItem>
            ))}
          </NavGroup>
          <NavGroup label="Planned module placeholders">
            {shellNavItems.filter((item) => item.status === "placeholder").map((item) => (
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
              <div className="aos-locale-control" data-locale-control="native-name-menu">
                <button className="aos-locale-trigger" type="button" data-locale-menu-toggle aria-haspopup="menu" aria-expanded="false">
                  <Icon name="globe-2" />
                  <span data-locale-current>{nativeLocaleName}</span>
                </button>
                <div className="aos-locale-menu" role="menu" data-locale-menu hidden>
                  {tcrnLocaleMetadata.map((entry) => (
                    <button key={entry.locale} type="button" role="menuitem" data-locale-option={entry.locale}>
                      {entry.nativeName}
                    </button>
                  ))}
                </div>
              </div>
              <IconButton
                ariaLabel="Switch theme"
                className="aos-theme-button"
                data-theme-toggle="true"
                data-current-theme="light"
                title="Switch theme"
                icon={
                  <>
                    <span data-theme-icon="light"><Icon name="sun" /></span>
                    <span data-theme-icon="dark"><Icon name="moon" /></span>
                  </>
                }
              />
            </div>
          }
        />

        <main id="content" className="aos-main" data-shell-region="content">
          <EnvironmentBanner label="AOS frontend shell slice" state={{ state: "local_only" }} />
          <InlineAlert tone="warning" className="aos-no-overclaim" data-aos-no-overclaim-banner="true">
            <strong data-i18n="localOnly">Local structural slice only</strong>
            <span data-i18n="noOverclaim">
              Local fixture data only; no external queue, live dispatch, product acceptance, or release-readiness state is claimed.
            </span>
          </InlineAlert>

          <section className="aos-overview" aria-labelledby="aos-overview-heading" data-current-path-overview="true">
            <div>
              <Heading level={1} id="aos-overview-heading">AOS frontend shell</Heading>
              <Text>
                First implementation slice: attached product navigation, DS-backed controls, i18n/theme posture, API readbacks, and module placeholders.
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
              <Surface className="aos-panel">
                <Heading level={3}>Operational posture</Heading>
                <KeyValueList
                  items={[
                    { key: "queue", label: "External queue", value: "none" },
                    { key: "dispatch", label: "Live dispatch", value: "not enabled" },
                    { key: "acceptance", label: "Product acceptance", value: "not claimed" },
                    { key: "release", label: "Release readiness", value: "not claimed" }
                  ]}
                />
              </Surface>
              <Surface className="aos-panel" data-api-readback-panel="true">
                <Heading level={3}>Backend readback</Heading>
                <p className="aos-api-state" data-api-state>Waiting for /api/health, /api/readback, and /api/policy.</p>
                <pre className="aos-api-json" data-api-summary>{JSON.stringify({ status: "pending" }, null, 2)}</pre>
              </Surface>
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

          <section className="aos-section" aria-labelledby="modules-heading" data-aos-placeholder-modules="true">
            <div className="aos-section-heading">
              <Heading level={2} id="modules-heading">Module placeholders</Heading>
              <Badge tone="neutral">ready for later slices</Badge>
            </div>
            <div className="aos-module-grid">
              {shellNavItems.filter((item) => item.status === "placeholder").map((item) => (
                <article key={item.id} className="aos-module-tile" id={item.id}>
                  <div className="aos-module-tile__icon"><Icon name={item.icon} /></div>
                  <Heading level={3}>{item.label}</Heading>
                  <Text>{item.description}</Text>
                  <StatusBadge state={{ state: "not_claimed" }} />
                </article>
              ))}
            </div>
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
  const params = new URLSearchParams(window.location.search);
  const routeLabel = document.querySelector("[data-current-route-label]");
  const currentPath = window.location.pathname;
  const matchedRoute = config.routes.find((route) => route.path === currentPath) || config.routes.find((route) => currentPath.endsWith(route.path + ".html")) || config.routes[0];

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
  applyLocale(initialLocale);
  applyTheme(initialTheme);

  if (routeLabel && matchedRoute) routeLabel.textContent = matchedRoute.label;
  document.querySelectorAll("[data-route-path]").forEach((node) => {
    const selected = matchedRoute && node.getAttribute("data-route-path") === matchedRoute.path;
    if (selected) node.setAttribute("aria-current", "page");
    node.setAttribute("data-selected", selected ? "true" : "false");
  });

  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    transitionTheme(root.dataset.tcrnTheme === "dark" ? "light" : "dark");
  });

  const localeTrigger = document.querySelector("[data-locale-menu-toggle]");
  const localeMenu = document.querySelector("[data-locale-menu]");
  localeTrigger?.addEventListener("click", () => {
    const nextOpen = localeMenu?.hidden ?? true;
    if (localeMenu) localeMenu.hidden = !nextOpen;
    localeTrigger.setAttribute("aria-expanded", String(nextOpen));
  });
  document.querySelectorAll("[data-locale-option]").forEach((option) => {
    option.addEventListener("click", () => {
      applyLocale(option.getAttribute("data-locale-option"));
      if (localeMenu) localeMenu.hidden = true;
      localeTrigger?.setAttribute("aria-expanded", "false");
    });
  });

  const searchInput = document.querySelector("[data-aos-shell-search]");
  const searchWrap = searchInput?.closest(".aos-search-wrap");
  searchInput?.addEventListener("focus", () => searchWrap?.classList.add("is-searching"));
  searchInput?.addEventListener("input", (event) => renderSearchResults(event.target.value || ""));
  searchInput?.addEventListener("blur", () => {
    window.setTimeout(() => {
      searchWrap?.classList.remove("is-searching");
      const layer = document.querySelector("[data-search-results]");
      if (layer) layer.hidden = true;
    }, 140);
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
    setText("[data-api-summary]", JSON.stringify(summary, null, 2));
  }).catch((error) => {
    setText("[data-metric-value='runtime']", "fail-closed");
    setText("[data-api-state]", "API readbacks unavailable: " + error.message);
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
  grid-template-columns: 272px minmax(0, 1fr);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--tcrn-color-brand-secondary-bg), transparent 22%), transparent 34rem),
    var(--tcrn-color-surface-canvas);
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
  background: color-mix(in srgb, var(--tcrn-color-surface-panel), var(--tcrn-color-surface-canvas) 12%);
}
.aos-brand {
  display: flex;
  align-items: center;
  height: 42px;
  padding: 4px 8px;
}
.aos-brand img {
  display: block;
  max-width: 178px;
  max-height: 42px;
  object-fit: contain;
  filter: var(--aos-brand-filter, none);
}
html[data-tcrn-theme="dark"] .aos-brand img { --aos-brand-filter: invert(1) saturate(0.7) brightness(1.2); }
.tcrn-side-nav { display: flex; flex-direction: column; gap: 18px; }
.tcrn-nav-group { display: grid; gap: 8px; }
.tcrn-nav-group__label {
  color: var(--tcrn-color-text-secondary);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0;
  padding: 0 9px;
}
.tcrn-nav-group__items { display: grid; gap: 4px; }
.tcrn-nav-item {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  min-height: 38px;
  padding: 8px 9px;
  border-radius: 8px;
  color: var(--tcrn-color-text-secondary);
  text-decoration: none;
  border: 1px solid transparent;
}
.tcrn-nav-item[data-selected="true"] {
  color: var(--tcrn-color-text-primary);
  background: var(--tcrn-color-brand-primary-bg);
  border-color: color-mix(in srgb, var(--tcrn-color-brand-primary), transparent 64%);
}
.tcrn-nav-item:hover { background: var(--tcrn-color-surface-muted); color: var(--tcrn-color-text-primary); }
.tcrn-nav-item__label { overflow-wrap: anywhere; }
.aos-workspace { min-width: 0; display: grid; grid-template-rows: auto 1fr; }
.tcrn-top-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: max-content max-content minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  min-height: 68px;
  padding: 12px 22px;
  border-bottom: 1px solid var(--tcrn-color-border-subtle);
  background: color-mix(in srgb, var(--tcrn-color-surface-panel), transparent 5%);
  backdrop-filter: blur(16px);
}
.tcrn-top-bar__brand { font-weight: 800; }
.tcrn-top-bar__module { color: var(--tcrn-color-text-secondary); font-size: var(--tcrn-type-size-ui); }
.tcrn-top-bar__actions { min-width: 0; }
.aos-top-actions {
  display: grid;
  grid-template-columns: max-content minmax(190px, 420px) max-content max-content;
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
.tcrn-search-input {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) max-content;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--tcrn-color-border-strong);
  border-radius: 8px;
  background: var(--tcrn-color-surface-panel);
}
.tcrn-search-input__control {
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--tcrn-color-text-primary);
}
.tcrn-search-input__shortcut {
  color: var(--tcrn-color-text-muted);
  border: 1px solid var(--tcrn-color-border-subtle);
  border-radius: 5px;
  padding: 1px 5px;
  font-size: 11px;
}
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
.aos-locale-trigger, .aos-theme-button {
  min-height: 38px;
  border: 1px solid var(--tcrn-color-border-strong);
  background: var(--tcrn-color-surface-panel);
  color: var(--tcrn-color-text-primary);
}
.aos-locale-trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 138px;
  padding: 0 10px;
  border-radius: 8px;
}
.aos-locale-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aos-locale-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  display: grid;
  gap: 2px;
  min-width: 144px;
  padding: 6px;
  border: 1px solid var(--tcrn-color-border-strong);
  border-radius: 8px;
  background: var(--tcrn-color-surface-panel);
  box-shadow: var(--tcrn-elevation-floating);
}
.aos-locale-menu button {
  border: 0;
  border-radius: 6px;
  padding: 8px;
  text-align: left;
  background: transparent;
  color: var(--tcrn-color-text-primary);
}
.aos-locale-menu button[aria-current="true"], .aos-locale-menu button:hover { background: var(--tcrn-color-surface-muted); }
.aos-theme-button {
  inline-size: 38px;
  block-size: 38px;
  padding: 0;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
}
[data-theme-icon="dark"] { display: none; }
html[data-tcrn-theme="dark"] [data-theme-icon="light"] { display: none; }
html[data-tcrn-theme="dark"] [data-theme-icon="dark"] { display: inline-flex; }
.aos-main {
  display: grid;
  gap: 18px;
  width: min(1280px, 100%);
  padding: 22px;
}
.tcrn-environment-banner, .aos-no-overclaim {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 42px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--tcrn-color-border-subtle);
  background: var(--tcrn-color-brand-neutral-bg);
}
.aos-no-overclaim { background: var(--tcrn-color-state-warning-bg); color: var(--tcrn-color-text-primary); }
.aos-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
  gap: 18px;
  align-items: start;
}
.tcrn-heading { margin: 0; letter-spacing: 0; }
.tcrn-heading--1 { font-size: clamp(28px, 3vw, 44px); line-height: 1.04; }
.tcrn-heading--2 { font-size: 22px; }
.tcrn-heading--3 { font-size: 16px; }
.tcrn-text { margin: 7px 0 0; color: var(--tcrn-color-text-secondary); }
.aos-status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.aos-metric, .aos-panel, .aos-module-tile, .aos-section {
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
  padding: 16px;
}
.aos-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.tcrn-badge {
  display: inline-flex;
  align-items: center;
  width: max-content;
  min-height: 24px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: var(--tcrn-color-surface-muted);
  color: var(--tcrn-color-text-secondary);
}
.tcrn-badge--warning { background: var(--tcrn-color-state-warning-bg); color: var(--tcrn-color-text-primary); }
.tcrn-badge--positive { background: var(--tcrn-color-state-ready-bg); color: var(--tcrn-color-state-ready); }
.aos-cockpit-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 12px;
}
.aos-panel { padding: 14px; overflow: hidden; }
.tcrn-key-value-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 12px 0 0;
}
.tcrn-key-value-list div {
  display: grid;
  gap: 3px;
  padding: 9px;
  border-radius: 8px;
  background: var(--tcrn-color-surface-muted);
}
.tcrn-key-value-list dt { color: var(--tcrn-color-text-secondary); font-size: 12px; }
.tcrn-key-value-list dd { margin: 0; font-weight: 700; }
.aos-api-json {
  max-height: 235px;
  overflow: auto;
  padding: 10px;
  border-radius: 8px;
  background: var(--tcrn-color-surface-muted);
  font-size: 12px;
  white-space: pre-wrap;
}
.tcrn-table-shell {
  display: grid;
  overflow: auto;
  border: 1px solid var(--tcrn-color-border-subtle);
  border-radius: 8px;
}
.tcrn-table-shell__head,
.tcrn-table-shell__row {
  display: grid;
  grid-template-columns: minmax(92px, .7fr) minmax(120px, 1fr) minmax(150px, 1.2fr) minmax(120px, 1fr) minmax(130px, 1fr) minmax(110px, .8fr) minmax(110px, .7fr);
  min-width: 920px;
}
.tcrn-table-shell__head {
  position: sticky;
  top: 0;
  background: var(--tcrn-color-surface-muted);
  color: var(--tcrn-color-text-secondary);
  font-size: 12px;
  font-weight: 800;
}
.tcrn-table-shell__head span,
.tcrn-table-shell__cell {
  padding: 10px;
  border-bottom: 1px solid var(--tcrn-color-border-subtle);
}
.tcrn-table-shell__row:last-child .tcrn-table-shell__cell { border-bottom: 0; }
.aos-module-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.aos-module-tile {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 164px;
  padding: 14px;
}
.aos-module-tile__icon {
  inline-size: 34px;
  block-size: 34px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--tcrn-color-brand-secondary-bg);
  color: var(--tcrn-color-brand-secondary);
}
.tcrn-skip-link {
  position: fixed;
  z-index: 1000;
  top: 10px;
  left: 10px;
  transform: translateY(-150%);
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--tcrn-color-surface-panel);
  border: 1px solid var(--tcrn-color-border-strong);
}
.tcrn-skip-link:focus { transform: translateY(0); }
@media (max-width: 980px) {
  .aos-shell { grid-template-columns: 1fr; }
  .aos-sidebar { position: static; height: auto; padding: 12px; border-right: 0; border-bottom: 1px solid var(--tcrn-color-border-subtle); }
  .tcrn-side-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .tcrn-top-bar { position: static; grid-template-columns: 1fr; align-items: stretch; }
  .aos-top-actions { grid-template-columns: 1fr max-content max-content; justify-content: stretch; }
  .aos-location-readback { grid-column: 1 / -1; }
  .aos-search-wrap { justify-self: stretch; width: 100%; }
  .aos-search-wrap.is-searching { width: 100%; }
  .aos-overview, .aos-cockpit-grid { grid-template-columns: 1fr; }
  .aos-module-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 620px) {
  .tcrn-side-nav { grid-template-columns: 1fr; }
  .aos-main { padding: 14px; }
  .aos-top-actions { grid-template-columns: 1fr max-content; }
  .aos-locale-control { justify-self: end; }
  .aos-theme-button { justify-self: end; }
  .aos-status-grid, .aos-module-grid, .tcrn-key-value-list { grid-template-columns: 1fr; }
  .aos-no-overclaim, .tcrn-environment-banner { align-items: flex-start; flex-direction: column; gap: 4px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; scroll-behavior: auto !important; }
}`;
}
