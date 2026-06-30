import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, join } from "node:path";
import { findForbiddenPositiveClaimHits, tcrnLocaleMetadata } from "@tcrn/ui-copy-state";
import { frontendShellRoutes, forbiddenHumanAiTopbarMarkers } from "../dist/apps/web/src/data.js";
import { startAosLocalServiceProof } from "../dist/apps/api/src/server.js";

const shellPath = new URL("../apps/web/dist/index.html", import.meta.url);
assert.equal(existsSync(shellPath), true, "apps/web/dist/index.html exists after pnpm build");

const screenshotRoot = "/tmp/tcrn-aos-shell-qa";
rmSync(screenshotRoot, { recursive: true, force: true });
mkdirSync(screenshotRoot, { recursive: true });

const html = readFileSync(shellPath, "utf8");
const appSource = readFileSync(new URL("../apps/web/src/app.tsx", import.meta.url), "utf8");
const requiredMarkers = [
  'data-aos-shell="owner-quality-product-shell"',
  'data-storybook-visual-instance="aos-owner-quality-product-shell"',
  'data-visual-instance-name="AosOwnerQualityProductShell"',
  'data-visual-instance-disposition="ds_oracle_review_required_before_owner_admission"',
  'data-visual-instance-style-source="@tcrn/ui-react/tcrnComponentCss"',
  'data-visual-instance-owner-quality="product-first"',
  'data-visual-instance-primary-ia="operations-cockpit-work-queue"',
  'data-owner-quality-product-shell-oracle="true"',
  'data-design-system-source="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state"',
  'data-storybook-contract-consumed="product-shell-semantic-boundary"',
  'data-storybook-visual-instance-consumed="aos-owner-quality-product-shell"',
  'data-ds-product-shell-boundary-consumed="ProductShell useProductShellController ProductShellSearch"',
  'data-package-backed-product-shell-boundary="side-nav-shell-v1"',
  'data-product-shell-semantic-api="collapse-theme-locale-search"',
  'data-product-shell-effect-boundary="ds-owned-tokens-motion-focus"',
  'data-product-shell-consumer-scope="ia-data-route-labels-content-callbacks"',
  'data-search-semantic-api="onQueryChange-onExpandedChange-onDismiss-onResultActivate"',
  'data-search-dismissal-contract="blur-outside-pointer-tab-escape"',
  'data-local-wrapper-event-delegation="absent"',
  'data-local-shell-effect-clones="removed"',
  'data-tcrn-theme="light"',
  'data-side-nav-toggle="true"',
  'data-side-nav-persisted-key="tcrn-aos-side-nav-collapsed"',
  'data-registered-navigation-only="true"',
  'data-registered-brand-lockup="@tcrn/ui-react/ShellBrandLockup"',
  'data-registered-product-logo="@tcrn/ui-react/ProductLogo"',
  'data-product-id="aos"',
  'data-product-logo-asset-id="tcrn-aos-two-line"',
  'data-product-logo-line-one="TCRN AOS"',
  'data-product-logo-line-two="AI Operation System"',
  'data-tcrn-brand-mark="registered"',
  'data-package-backed-shell-control="locale-menu"',
  'data-package-backed-shell-control="theme-toggle"',
  'data-package-backed-shell-control="side-nav-collapse"',
  'data-package-backed-shell-control="product-shell-search"',
  'data-tcrn-component-style-source="@tcrn/ui-react"',
  'data-product-document-baseline="tcrn-token-inheritance"',
  'data-product-shell-client="ds-product-shell-semantic-boundary"',
  '/assets/aos-client.js',
  'data-owner-quality-primary-heading="true"',
  'data-owner-quality-first-viewport="product-led"',
  'data-owner-quality-work-queue="true"',
  'data-owner-quality-gates="true"',
  'data-owner-quality-actions="true"',
  'data-owner-quality-service-health="true"',
  'data-owner-quality-secondary-disclosure="true"',
  'data-aos-work-module-entry="owner-quality-work-queue"',
  'data-aos-registered-module-boundary="cockpit-work-only"',
  'data-raw-json-disclosure="secondary"',
  'data-cockpit-aggregation="deferred"',
  'data-product-acceptance="not-claimed"',
  'data-release-readiness="not-claimed"',
  'data-live-dispatch="not-enabled"',
  "useProductShellController",
  "ProductShell",
  "ProductLogo"
];

const forbiddenPlannedPrimaryLabels = [
  "Conference",
  "Dependency",
  "Resource",
  "Docs / Search / Release Linkage",
  "Dispatch Readback",
  "Settings / Admin",
  "Module placeholders"
];

const forbiddenScaffoldPrimaryLabels = [
  "AOS frontend shell",
  "Frontend shell slice",
  "Local structural slice only",
  "Dummy Cockpit",
  "structural placeholder",
  "Storybook parity proof",
  "runtime readbacks",
  "Backend readback",
  "Registered slice boundary"
];

const forbiddenAosBrandAssetMarkers = [
  "tcrn-aos-wordmark",
  "aos-favicon.png",
  "favicon.ico",
  "data-admitted-brand-asset"
];

const ownerQualityMobileSearchMaxPx = 320;

const acceptedVisualInstanceOracle = {
  storyId: "aos-owner-quality-product-shell",
  page: "components.html#aos-owner-quality-product-shell",
  selector: '[data-storybook-visual-instance="aos-owner-quality-product-shell"]',
  ownerVisualAdmissionBoundary: "ds_oracle_review_required_before_owner_admission",
  dsBasis: "current local TCRN-DESIGN-SYSTEM package-backed owner-quality oracle",
  variants: [
    {
      id: "desktop-light-operations-cockpit",
      dsSelector: '[data-storybook-visual-instance="aos-owner-quality-product-shell"][data-visual-instance-variant="desktop-light-operations-cockpit"]',
      aosPath: "/cockpit?locale=en&theme=light&collapsed=false",
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
      locale: "en",
      reducedMotion: "no-preference",
      expectedState: {
        theme: "light",
        locale: "en",
        collapsed: "false",
        route: "cockpit",
        selectedRoute: "cockpit",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false",
        viewport: "desktop",
        reducedMotion: "false",
        content: "cockpit"
      }
    },
    {
      id: "desktop-light-operations-cockpit-collapsed",
      dsSelector: '[data-storybook-visual-instance="aos-owner-quality-product-shell"][data-visual-instance-variant="desktop-light-operations-cockpit-collapsed"]',
      aosPath: "/cockpit?locale=en&theme=light&collapsed=true",
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
      locale: "en",
      reducedMotion: "no-preference",
      expectedState: {
        theme: "light",
        locale: "en",
        collapsed: "true",
        route: "cockpit",
        selectedRoute: "cockpit",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false",
        viewport: "desktop",
        reducedMotion: "false",
        content: "cockpit"
      }
    },
    {
      id: "desktop-dark-operations-cockpit",
      dsSelector: '[data-storybook-visual-instance="aos-owner-quality-product-shell"][data-visual-instance-variant="desktop-dark-operations-cockpit"]',
      aosPath: "/cockpit?locale=en&theme=dark&collapsed=false",
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
      locale: "en",
      reducedMotion: "no-preference",
      expectedState: {
        theme: "dark",
        locale: "en",
        collapsed: "false",
        route: "cockpit",
        selectedRoute: "cockpit",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false",
        viewport: "desktop",
        reducedMotion: "false",
        content: "cockpit"
      }
    },
    {
      id: "desktop-dark-operations-cockpit-collapsed",
      dsSelector: '[data-storybook-visual-instance="aos-owner-quality-product-shell"][data-visual-instance-variant="desktop-dark-operations-cockpit-collapsed"]',
      aosPath: "/cockpit?locale=en&theme=dark&collapsed=true",
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
      locale: "en",
      reducedMotion: "no-preference",
      expectedState: {
        theme: "dark",
        locale: "en",
        collapsed: "true",
        route: "cockpit",
        selectedRoute: "cockpit",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false",
        viewport: "desktop",
        reducedMotion: "false",
        content: "cockpit"
      }
    },
    {
      id: "desktop-light-work-queue",
      dsSelector: '[data-storybook-visual-instance="aos-owner-quality-product-shell"][data-visual-instance-variant="desktop-light-work-queue"]',
      aosPath: "/work?locale=en&theme=light&collapsed=false",
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
      locale: "en",
      reducedMotion: "no-preference",
      expectedState: {
        theme: "light",
        locale: "en",
        collapsed: "false",
        route: "work",
        selectedRoute: "work",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false",
        viewport: "desktop",
        reducedMotion: "false",
        content: "work"
      }
    },
    {
      id: "desktop-light-work-queue-collapsed",
      dsSelector: '[data-storybook-visual-instance="aos-owner-quality-product-shell"][data-visual-instance-variant="desktop-light-work-queue-collapsed"]',
      aosPath: "/work?locale=en&theme=light&collapsed=true",
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
      locale: "en",
      reducedMotion: "no-preference",
      expectedState: {
        theme: "light",
        locale: "en",
        collapsed: "true",
        route: "work",
        selectedRoute: "work",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false",
        viewport: "desktop",
        reducedMotion: "false",
        content: "work"
      }
    },
    {
      id: "mobile-dark-zh-cn-work-queue",
      dsSelector: '[data-storybook-visual-instance="aos-owner-quality-product-shell"][data-visual-instance-variant="mobile-dark-zh-cn-work-queue"]',
      aosPath: "/work?locale=zh-CN&theme=dark&collapsed=false",
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
      locale: "zh-CN",
      reducedMotion: "no-preference",
      isMobile: true,
      expectedState: {
        theme: "dark",
        locale: "zh-CN",
        collapsed: "false",
        route: "work",
        selectedRoute: "work",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false",
        viewport: "mobile",
        reducedMotion: "false",
        content: "work"
      },
      requiredText: ["工作项", "状态", "负责人", "需要评审", "已阻止", "未配置", "仅本地证明"],
      forbiddenText: ["Work item", "State", "Unknown", "Blocked", "Not configured", "Local proof only"]
    },
    {
      id: "desktop-light-operations-search-results",
      dsSelector: '[data-storybook-visual-instance="aos-owner-quality-product-shell"][data-visual-instance-variant="desktop-light-operations-search-results"]',
      aosPath: "/cockpit?locale=en&theme=light&collapsed=false&search=gate",
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
      locale: "en",
      reducedMotion: "no-preference",
      expectedState: {
        theme: "light",
        locale: "en",
        collapsed: "false",
        route: "cockpit",
        selectedRoute: "cockpit",
        search: "results",
        searchExpanded: "true",
        searchResultsVisible: "true",
        viewport: "desktop",
        reducedMotion: "false",
        content: "cockpit"
      }
    },
    {
      id: "reduced-motion",
      dsSelector: '[data-storybook-visual-instance="aos-owner-quality-product-shell"][data-visual-instance-variant="reduced-motion"]',
      aosPath: "/cockpit?locale=en&theme=light&collapsed=false",
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
      locale: "en",
      reducedMotion: "reduce",
      expectedState: {
        theme: "light",
        locale: "en",
        collapsed: "false",
        route: "cockpit",
        selectedRoute: "cockpit",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false",
        viewport: "desktop",
        reducedMotion: "true",
        content: "cockpit"
      }
    }
  ],
  ownerQualityPolicy: {
    defaultCockpitVariant: "desktop-light-operations-cockpit",
    coveredOwnerQualityRoutes: [
      "/",
      "/cockpit",
      "/cockpit?locale=en&theme=light",
      "/cockpit?locale=en&theme=light&collapsed=true",
      "/cockpit?locale=en&theme=dark",
      "/cockpit?locale=en&theme=dark&collapsed=true",
      "/work?locale=en&theme=light",
      "/work?locale=en&theme=light&collapsed=false",
      "/work?locale=en&theme=light&collapsed=true",
      "/work?locale=zh-CN&theme=dark&collapsed=false",
      "post-search-dismissal:/cockpit?locale=en&theme=light&collapsed=false&search=gate",
      "side-nav-toggle:/cockpit?locale=en&theme=light"
    ],
    outsideMatrixMarkerForbiddenForOwnerReview: "aos-route-state-outside-owner-quality-oracle",
    collapsedOwnerReviewPolicy: "desktop_actionable_toggle_mobile_hidden_until_mobile_collapsed_variants",
    notAutomaticallyAdmitted: [
      "zh-CN Cockpit rest",
      "dark zh-CN Cockpit rest",
      "mobile Cockpit rest"
    ]
  }
};

const missingMarkers = requiredMarkers.filter((marker) => !html.includes(marker));
const missingLocales = tcrnLocaleMetadata.map((entry) => entry.nativeName).filter((name) => !html.includes(name));
const forbiddenAiMarkers = forbiddenHumanAiTopbarMarkers.filter((marker) => html.includes(marker));
const forbiddenPositiveClaimHits = findForbiddenPositiveClaimHits(html);
const forbiddenPlannedStaticHits = forbiddenPlannedPrimaryLabels.filter((label) => html.includes(label));
const forbiddenScaffoldStaticHits = forbiddenScaffoldPrimaryLabels.filter((label) => html.includes(label));
const forbiddenAosBrandHtmlHits = forbiddenAosBrandAssetMarkers.filter((marker) => html.includes(marker));
const concatenatedBannerStaticHits = ["sliceLocal", "onlyLocal", "onlyLocal fixture"].filter((marker) => html.includes(marker));
const forbiddenAosBrandDistHits = listRelativeFiles(new URL("../apps/web/dist", import.meta.url))
  .filter((file) => forbiddenAosBrandAssetMarkers.some((marker) => file.includes(marker.replace(/^\//, ""))));
const forbiddenAosBrandDocHits = [
  "../README.md",
  "../docs/architecture.md",
  "../docs/story-coverage.md",
  "../evidence/aos-frontend-shell-proof.md"
].flatMap((relativePath) => {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  return forbiddenAosBrandAssetMarkers
    .filter((marker) => source.includes(marker))
    .map((marker) => ({ file: relativePath.replace(/^\.\.\//, ""), marker }));
});
const forbiddenLocalShellEffectPatterns = [
  "createClientScript",
  "createShellCss",
  "MetricCard",
  "data-aos-shell-style",
  'className="aos-',
  "className='aos-",
  ".aos-",
  "style={{",
  "document.querySelector",
  "document.querySelector(\"[data-theme-toggle]\")?.addEventListener",
  "document.querySelector(\"[data-side-nav-toggle]\")?.addEventListener",
  "document.addEventListener(\"pointerdown\"",
  "data-aos-shell-search",
  ".aos-search-wrap",
  ".aos-sidebar",
  "aos-theme-wash",
  "transitionTheme("
].filter((marker) => appSource.includes(marker));

const clientBundlePath = new URL("../apps/web/dist/assets/aos-client.js", import.meta.url);
const clientBundle = existsSync(clientBundlePath) ? readFileSync(clientBundlePath, "utf8") : "";
const strictRegisteredSurfaceSourceHits = [
  { label: "MetricCard function", regex: /\b(function|const)\s+MetricCard\b/ },
  { label: "createShellCss helper", regex: /\bcreateShellCss\b/ },
  { label: "AOS visible className", regex: /className\s*=\s*(?:"|'|{\s*(?:"|'|`))[^"'`]*aos-/ },
  { label: "AOS visible CSS selector", regex: /\.(?:aos-[A-Za-z0-9_-]+)/ },
  { label: "AOS shell style tag", regex: /data-aos-shell-style/ },
  { label: "inline primary layout style", regex: /style=\{\{/ },
  { label: "wrapper DOM delegation", regex: /document\.querySelector|document\.addEventListener\("pointerdown"/ },
  { label: "Storybook shell demo class", regex: /tcrn-(?:shell-demo|compact-shell|knowledge-shell)/ },
  { label: "Storybook-only shell demo import", regex: /TmsDenseShellDemo|KnowledgeBaseShellDemo|CompactToolShellDemo/ }
].filter((entry) => entry.regex.test(appSource)).map((entry) => entry.label);
const strictRegisteredSurfaceBuiltHits = [
  { label: "AOS class in built HTML", value: html, regex: /class="[^"]*\baos-/ },
  { label: "AOS CSS selector in built HTML", value: html, regex: /\.(?:aos-[A-Za-z0-9_-]+)/ },
  { label: "AOS shell style in built HTML", value: html, regex: /data-aos-shell-style/ },
  { label: "MetricCard in built HTML/client", value: `${html}\n${clientBundle}`, regex: /MetricCard|tcrn-compact-shell__metric/ },
  { label: "Storybook shell demo in built HTML/client", value: `${html}\n${clientBundle}`, regex: /tcrn-(?:shell-demo|compact-shell|knowledge-shell)/ },
  { label: "AOS class in client bundle", value: clientBundle, regex: /className[=:][^,\n}]*aos-|class="[^"]*\baos-/ },
  { label: "AOS CSS selector in client bundle", value: clientBundle, regex: /\.(?:aos-[A-Za-z0-9_-]+)/ }
].filter((entry) => entry.regex.test(entry.value)).map((entry) => entry.label);

assert.deepEqual(missingMarkers, [], "required shell and DS-consumption markers are present");
assert.deepEqual(missingLocales, [], "locale menu uses native locale names");
assert.deepEqual(forbiddenAiMarkers, [], "AI consumption contract is not exposed as a human top-bar control");
assert.deepEqual(forbiddenPositiveClaimHits, [], "shell HTML has no forbidden positive-claim phrases");
assert.deepEqual(forbiddenPlannedStaticHits, [], "planned/unregistered modules are not visible as primary navigation or module cards");
assert.deepEqual(forbiddenScaffoldStaticHits, [], "owner-quality shell HTML does not expose rejected scaffold-primary labels");
assert.deepEqual(forbiddenAosBrandHtmlHits, [], "forbidden AOS wordmark/favicon markers are absent from shell HTML");
assert.deepEqual(concatenatedBannerStaticHits, [], "banner and alert text are not statically concatenated");
assert.deepEqual(forbiddenAosBrandDistHits, [], "forbidden AOS wordmark/favicon files are absent from built dist assets");
assert.deepEqual(forbiddenAosBrandDocHits, [], "current docs/evidence do not reference forbidden AOS wordmark/favicon assets");
assert.deepEqual(forbiddenLocalShellEffectPatterns, [], "AOS source does not own DS shell/search/locale/theme event delegation or local shell effects");
assert.deepEqual(strictRegisteredSurfaceSourceHits, [], "AOS source has no unregistered local visible UI components/classes/selectors/effects");
assert.deepEqual(strictRegisteredSurfaceBuiltHits, [], "built shell has no unregistered AOS local visible classes/CSS/demo surfaces");

const service = await startAosLocalServiceProof();
let closed = false;
const routeReadbacks = [];

try {
  for (const route of ["/", "/cockpit", "/work", "/conference", "/docs", "/settings"]) {
    const response = await fetch(`${service.url}${route}`);
    const body = await response.text();
    routeReadbacks.push({
      route,
      status: response.status,
      html: response.headers.get("content-type")?.includes("text/html") ?? false,
      shellMarker: body.includes('data-aos-shell="owner-quality-product-shell"'),
      ownerQualityMarker: body.includes('data-owner-quality-product-shell-oracle="true"'),
      productLedMarker: body.includes('data-owner-quality-first-viewport="product-led"'),
      workMarker: body.includes('data-aos-work-module-entry="owner-quality-work-queue"'),
      registeredNavigationOnly: body.includes('data-registered-navigation-only="true"'),
      registeredBrandLockup: body.includes('data-registered-brand-lockup="@tcrn/ui-react/ShellBrandLockup"'),
      productShellBoundary: body.includes('data-ds-product-shell-boundary-consumed="ProductShell useProductShellController ProductShellSearch"')
        && body.includes('data-package-backed-product-shell-boundary="side-nav-shell-v1"')
        && body.includes('data-product-shell-semantic-api="collapse-theme-locale-search"')
        && body.includes('data-local-wrapper-event-delegation="absent"')
        && body.includes('data-local-shell-effect-clones="removed"'),
      packageBackedShellControls: [
        'data-package-backed-shell-control="locale-menu"',
        'data-package-backed-shell-control="theme-toggle"',
        'data-package-backed-shell-control="side-nav-collapse"',
        'data-package-backed-shell-control="product-shell-search"'
      ].every((marker) => body.includes(marker)),
      strictRegisteredSurface: !/class="[^"]*\baos-/.test(body)
        && !/\.(?:aos-[A-Za-z0-9_-]+)/.test(body)
        && !body.includes("MetricCard")
        && !body.includes("data-aos-shell-style")
        && body.includes('data-product-document-baseline="tcrn-token-inheritance"'),
      plannedPrimaryHits: forbiddenPlannedPrimaryLabels.filter((label) => body.includes(label)),
      scaffoldPrimaryHits: forbiddenScaffoldPrimaryLabels.filter((label) => body.includes(label)),
      forbiddenBrandHits: forbiddenAosBrandAssetMarkers.filter((marker) => body.includes(marker))
    });
  }

  const asset = await fetch(`${service.url}/assets/tcrn-brand-mark.svg`);
  const forbiddenAssetReadbacks = [];
  for (const forbiddenAsset of [
    "/assets/tcrn-aos-wordmark-geometric-dark.png",
    "/assets/tcrn-aos-wordmark.png",
    "/assets/aos-favicon.png",
    "/assets/favicon.ico"
  ]) {
    const assetResponse = await fetch(`${service.url}${forbiddenAsset}`);
    forbiddenAssetReadbacks.push({ asset: forbiddenAsset, status: assetResponse.status });
  }
  const health = await fetch(`${service.url}/api/health`).then((response) => response.json());
  const readback = await fetch(`${service.url}/api/readback`).then((response) => response.json());
  const policy = await fetch(`${service.url}/api/policy`).then((response) => response.json());
  const cockpitApi = await fetch(`${service.url}/api/cockpit`);
  const cockpitApiPayload = await cockpitApi.json();
  const browserProof = await runBrowserProof(service.url);

  const stopped = await service.close();
  closed = stopped.stopped && stopped.runtimeReset;

  const ok = routeReadbacks.every((entry) => entry.status === 200 && entry.html && entry.shellMarker && entry.ownerQualityMarker && entry.productLedMarker && entry.workMarker && entry.registeredNavigationOnly && entry.registeredBrandLockup && entry.productShellBoundary && entry.packageBackedShellControls && entry.strictRegisteredSurface && entry.plannedPrimaryHits.length === 0 && entry.scaffoldPrimaryHits.length === 0 && entry.forbiddenBrandHits.length === 0)
    && asset.status === 200
    && (asset.headers.get("content-type") ?? "").includes("image/svg+xml")
    && forbiddenAssetReadbacks.every((entry) => entry.status === 404)
    && health.ok === true
    && health.externalQueue === "none"
    && health.liveCodexDispatchAuthorized === false
    && readback.ok === true
    && readback.runtimeDataCommitted === false
    && readback.operationalRecordCounts.stories === 2
    && policy.ok === true
    && policy.serviceProofOnly === true
    && cockpitApi.status === 410
    && cockpitApiPayload.error === "aos_cockpit_api_deferred"
    && cockpitApiPayload.dummyCockpitOnly === true
    && cockpitApiPayload.finalCockpitAggregationAvailable === false
    && cockpitApiPayload.liveDispatch === false
    && browserProof.ok === true
    && closed;

  const result = {
    ok,
    proof: "aos_frontend_shell_ds_contract_reconciliation",
    builtShell: "apps/web/dist/index.html",
    frontendShellRouteCount: frontendShellRoutes.length,
    visibleRegisteredNavigation: ["Operations Cockpit", "Work queue"],
    routeReadbacks,
    assetReadback: {
      status: asset.status,
      contentType: asset.headers.get("content-type")
    },
    forbiddenAssetReadbacks,
    dsContractConsumption: {
      packages: ["@tcrn/ui-react", "@tcrn/ui-tokens", "@tcrn/ui-copy-state"],
      componentStylesheet: "tcrnComponentCss",
      productShellBoundary: "ProductShell/useProductShellController/ProductShellSearch",
      localWrapperEventDelegation: false,
      localShellEffectClones: false,
      visibleClassNamespace: "DS-owned tcrn-* only under product shell content",
      storybookComparator: "components.html#aos-owner-quality-product-shell accepted AOS owner-quality oracle from the current local DS package basis",
      designSystemVisualInstanceParityDisposition: "aos_routes_mapped_to_accepted_owner_quality_storybook_visual_instance_oracle",
      themeControl: "compact_icon_only_explicit_toggle",
      themeTransition: "ds_product_shell_controller",
      localeSelector: "globe_trigger_native_names_with_escape_outside_selection_close",
      sideNavigation: "ProductShell package boundary with persisted collapse callback",
      search: "ProductShellSearch controlled by useProductShellController with dismissal/result callbacks",
      readbackUx: "owner_quality_product_surfaces_with_secondary_developer_disclosure",
      brandAsset: "/assets/tcrn-brand-mark.svg",
      brandLockup: "@tcrn/ui-react/ShellBrandLockup",
      aiContractHumanTopbarLink: false
    },
    browserProof,
    screenshotReadback: browserProof.screenshots,
    apiReadbacks: {
      health: {
        ok: health.ok,
        runtimeDatabase: health.runtimeDatabase,
        externalQueue: health.externalQueue,
        liveCodexDispatchAuthorized: health.liveCodexDispatchAuthorized
      },
      readbackCounts: readback.operationalRecordCounts,
      policy: {
        allowedRuntimeMutation: policy.allowedRuntimeMutation,
        serviceProofOnly: policy.serviceProofOnly
      },
      cockpitApi: {
        status: cockpitApi.status,
        error: cockpitApiPayload.error,
        dummyCockpitOnly: cockpitApiPayload.dummyCockpitOnly,
        finalCockpitAggregationAvailable: cockpitApiPayload.finalCockpitAggregationAvailable
      }
    },
    noOverclaim: {
      productAcceptance: false,
      releaseReadiness: false,
      liveDispatch: false,
      externalQueue: "none",
      finalCockpitAggregation: false,
      forbiddenPositiveClaimHits,
      forbiddenAiMarkers,
      forbiddenPlannedStaticHits,
      forbiddenScaffoldStaticHits,
      forbiddenAosBrandHtmlHits,
      concatenatedBannerStaticHits,
      forbiddenAosBrandDistHits,
      forbiddenAosBrandDocHits
    },
    serviceLifecycle: {
      loopbackOnly: true,
      ephemeralPort: true,
      stopped: closed
    }
  };

  console.log(JSON.stringify(result, null, 2));
  if (!ok) {
    process.exit(1);
  }
} finally {
  if (!closed) {
    await service.close().catch(() => undefined);
  }
}

async function runBrowserProof(baseUrl) {
  const { chromium, source } = loadPlaywrightChromium();
  const executablePath = findLocalChromeExecutable();
  const dsComparatorServer = await startDesignSystemComparatorServer();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {})
  });
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];

  try {
    const visualInstanceParityProof = await runVisualInstanceParityProof(browser, baseUrl, dsComparatorServer.url);
    const visualComparatorProof = visualInstanceParityProof.productShellComparatorReadback;
    const ownerReachableRouteMatrixReadback = await runOwnerReachableRouteMatrixProof(browser, baseUrl, consoleMessages, pageErrors, requestFailures);

    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
      locale: "en",
      timezoneId: "UTC",
      reducedMotion: "no-preference",
      deviceScaleFactor: 1
    });
    const desktopPage = await desktopContext.newPage();
    capturePageHealth(desktopPage, consoleMessages, pageErrors, requestFailures);
    await desktopPage.goto(`${baseUrl}/cockpit`, { waitUntil: "networkidle" });
    await desktopPage.waitForSelector('[data-aos-shell="owner-quality-product-shell"]');
    await desktopPage.waitForFunction(() => document.querySelector("[data-api-state]")?.textContent?.includes("available"));

    assert.equal(await desktopPage.title(), "TCRN AOS Rebuild Workspace", "desktop page identity is correct");
    assert.equal(await desktopPage.locator("html").getAttribute("data-tcrn-theme"), "light", "default theme is light");
    assert.equal(await desktopPage.locator("html").getAttribute("lang"), "en", "default locale is en");

    const desktopContentReadback = await inspectContentRegion(desktopPage);
    assert.deepEqual(desktopContentReadback.aosClassHits, [], "desktop content region has no AOS-local visible class namespace");
    assert.deepEqual(desktopContentReadback.storybookDemoClassHits, [], "desktop content region has no Storybook-only shell demo classes");
    assert.equal(desktopContentReadback.environmentBannerVisible, true, "environment banner is rendered by DS");
    assert.equal(desktopContentReadback.productLedFirstViewport, true, "first viewport is product-led owner-quality content");
    assert.equal(desktopContentReadback.primaryH1Count, 1, "desktop owner-quality route has exactly one semantic H1");
    assert.equal(desktopContentReadback.scaffoldPrimaryHits.length, 0, "desktop first viewport avoids rejected scaffold copy");
    assert.equal(desktopContentReadback.text.includes("sliceLocal"), false, "environment banner text is not concatenated");
    assert.equal(desktopContentReadback.text.includes("onlyLocal"), false, "boundary text is not concatenated");
    assert.equal(desktopContentReadback.dsOwnedClassCount > 0, true, "primary UX uses DS-owned tcrn-* classes");

    await desktopPage.screenshot({ path: `${screenshotRoot}/01-desktop-cockpit-default.png`, fullPage: false });

    const brandReadback = await desktopPage.locator('.tcrn-product-logo[data-product-logo-asset-id="tcrn-aos-two-line"]').evaluate((logo) => {
      const image = logo.querySelector('[data-tcrn-brand-mark="registered"]');
      const rect = logo.getBoundingClientRect();
      const imageRect = image?.getBoundingClientRect();
      return {
        productId: logo.getAttribute("data-product-id"),
        assetId: logo.getAttribute("data-product-logo-asset-id"),
        lineOne: logo.querySelector(".tcrn-product-logo__line-one")?.textContent?.trim() ?? null,
        lineTwo: logo.querySelector(".tcrn-product-logo__line-two")?.textContent?.trim() ?? null,
        src: image?.getAttribute("src") ?? null,
        alt: image?.getAttribute("alt") ?? null,
        naturalWidth: image instanceof HTMLImageElement ? image.naturalWidth : 0,
        naturalHeight: image instanceof HTMLImageElement ? image.naturalHeight : 0,
        width: rect.width,
        height: rect.height,
        markWidth: imageRect?.width ?? 0,
        markHeight: imageRect?.height ?? 0,
        captionPresent: Boolean(logo.querySelector(".tcrn-shell-brand-lockup__caption"))
      };
    });
    assert.equal(brandReadback.productId, "aos", "registered AOS product logo id is used");
    assert.equal(brandReadback.assetId, "tcrn-aos-two-line", "registered AOS product logo asset id is used");
    assert.equal(brandReadback.lineOne, "TCRN AOS", "registered AOS product logo line one is rendered");
    assert.equal(brandReadback.lineTwo, "AI Operation System", "registered AOS product logo line two is rendered");
    assert.equal(brandReadback.src, "/assets/tcrn-brand-mark.svg");
    assert.equal(brandReadback.alt, "TCRN AOS AI Operation System");
    assert.equal(brandReadback.naturalWidth > 0, true, "brand asset loads");
    assert.equal(brandReadback.markWidth >= 34, true, "registered brand mark is visibly sized inside ProductLogo");
    assert.equal(brandReadback.markHeight >= 30, true, "registered brand mark has visible height inside ProductLogo");
    assert.equal(brandReadback.height >= 30, true, "expanded brand has visible height");
    assert.equal(brandReadback.captionPresent, false, "ProductLogo does not render the old Rebuild workspace brand caption");
    assert.equal(await desktopPage.locator('[data-registered-product-logo="@tcrn/ui-react/ProductLogo"]').first().isVisible(), true, "package-backed ProductLogo is visible");

    const localeTrigger = desktopPage.locator("[data-locale-menu-toggle]");
    const localeMenu = desktopPage.locator("[data-locale-menu]");
    await localeTrigger.click();
    assert.equal(await localeTrigger.getAttribute("aria-expanded"), "true", "locale opens with aria-expanded true");
    assert.equal(await localeMenu.isVisible(), true, "locale menu visible after click");
    await clickStableContentPoint(desktopPage);
    assert.equal(await localeTrigger.getAttribute("aria-expanded"), "false", "outside click closes locale menu");
    assert.equal(await localeMenu.isVisible(), false, "locale menu hidden after outside click");

    await localeTrigger.click();
    await desktopPage.keyboard.press("Escape");
    assert.equal(await localeTrigger.getAttribute("aria-expanded"), "false", "Escape closes locale menu");
    assert.equal(await desktopPage.evaluate(() => document.activeElement?.matches("[data-locale-menu-toggle]")), true, "Escape returns focus to locale trigger");

    await localeTrigger.click();
    await desktopPage.locator('[data-locale-option="zh-CN"]').click();
    assert.equal(await localeTrigger.getAttribute("aria-expanded"), "false", "selection closes locale menu");
    assert.equal(await desktopPage.locator("html").getAttribute("lang"), "zh-CN", "selection updates locale");
    assert.equal(await desktopPage.evaluate(() => document.activeElement?.matches("[data-locale-menu-toggle]")), true, "selection returns focus to locale trigger");

    await desktopPage.goto(`${baseUrl}/cockpit?locale=en&theme=light`, { waitUntil: "networkidle" });
    await desktopPage.waitForSelector('[data-aos-shell="owner-quality-product-shell"]');
    const sideNavToggle = desktopPage.locator("[data-side-nav-toggle]");
    assert.equal(await sideNavToggle.getAttribute("aria-expanded"), "true", "side nav starts expanded");
    assert.equal(await sideNavToggle.getAttribute("disabled"), null, "desktop owner-quality Cockpit exposes actionable side-nav collapse");
    assert.equal(await sideNavToggle.getAttribute("aria-disabled"), null, "desktop side-nav collapse is not aria-disabled");
    assert.equal(await sideNavToggle.getAttribute("data-side-nav-action"), "toggle", "side-nav collapse action is an actionable toggle");
    assert.equal(await desktopPage.locator('[data-product-shell-route="cockpit"]').getAttribute("aria-current"), "page", "active cockpit route is marked");
    const expandedSideNavWidth = await desktopPage.locator(".tcrn-product-shell__sidebar").evaluate((node) => node.getBoundingClientRect().width);
    assert.equal(Math.abs(expandedSideNavWidth - 280) <= 2, true, "desktop expanded rail matches DS 280px rail");
    const iconCenterReadback = await measureSideNavIconCenterDelta(desktopPage);
    assert.equal(iconCenterReadback.centerDelta <= 1, true, "side-nav collapse icon is centered within the 38px control");
    assert.equal(await sideNavToggle.isDisabled(), false, "browser exposes side-nav collapse affordance as enabled");
    await sideNavToggle.click();
    await desktopPage.waitForFunction(() => document.querySelector("[data-aos-shell]")?.getAttribute("data-side-nav-collapsed") === "true");
    await desktopPage.waitForTimeout(260);
    assert.equal(await sideNavToggle.getAttribute("aria-expanded"), "false", "click collapse updates aria-expanded");
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-visual-instance-variant"), "desktop-light-operations-cockpit-collapsed", "click collapse maps to admitted collapsed Cockpit owner-quality variant");
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "true", "shell data state reflects collapsed rail");
    assert.equal(await desktopPage.locator('[data-product-shell-route="cockpit"]').getAttribute("aria-current"), "page", "active cockpit route preserved while collapsed");
    const collapsedSideNavWidth = await desktopPage.locator(".tcrn-product-shell__sidebar").evaluate((node) => node.getBoundingClientRect().width);
    assert.equal(Math.abs(collapsedSideNavWidth - 92) <= 2, true, "desktop collapsed rail matches DS 92px rail");
    await desktopPage.screenshot({ path: `${screenshotRoot}/02-desktop-cockpit-side-nav-collapsed.png`, fullPage: false });
    await sideNavToggle.focus();
    await desktopPage.keyboard.press("Enter");
    await desktopPage.waitForFunction(() => document.querySelector("[data-aos-shell]")?.getAttribute("data-side-nav-collapsed") === "false");
    await desktopPage.waitForTimeout(260);
    assert.equal(await sideNavToggle.getAttribute("aria-expanded"), "true", "keyboard expand restores aria-expanded");
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-visual-instance-variant"), "desktop-light-operations-cockpit", "keyboard expand maps back to admitted expanded Cockpit variant");
    await desktopPage.goto(`${baseUrl}/work?locale=en&theme=light&collapsed=false`, { waitUntil: "networkidle" });
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "false", "owner-quality Work route uses explicit expanded side nav state");
    assert.equal(await desktopPage.locator("[data-side-nav-toggle]").getAttribute("aria-expanded"), "true", "side nav toggle reflects explicit expanded Work route");
    assert.equal(await desktopPage.locator("[data-side-nav-toggle]").getAttribute("disabled"), null, "owner-quality Work route exposes actionable desktop collapse");
    assert.equal(await desktopPage.locator("[data-side-nav-toggle]").getAttribute("data-side-nav-action"), "toggle", "owner-quality Work route uses toggle side-nav action");
    assert.equal(await desktopPage.locator('[data-product-shell-route="work"]').getAttribute("aria-current"), "page", "active work route is preserved while expanded");
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-visual-instance-variant"), "desktop-light-work-queue", "owner-quality Work route remains inside accepted expanded Work variant with actionable collapse affordance");
    await desktopPage.goto(`${baseUrl}/work?locale=en&theme=light&collapsed=true`, { waitUntil: "networkidle" });
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "true", "explicit collapsed Work query remains collapsed under admitted DS variant");
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-visual-instance-variant"), "desktop-light-work-queue-collapsed", "explicit collapsed Work query maps to admitted collapsed Work variant");
    assert.equal(await desktopPage.locator("[data-side-nav-toggle]").getAttribute("disabled"), null, "collapsed Work route keeps actionable collapse affordance");
    await desktopPage.goto(`${baseUrl}/cockpit?locale=en&theme=light&collapsed=true`, { waitUntil: "networkidle" });
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "true", "explicit collapsed Cockpit rest route stays collapsed");
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-visual-instance-variant"), "desktop-light-operations-cockpit-collapsed", "explicit collapsed Cockpit rest maps to admitted collapsed Cockpit variant");
    await desktopPage.locator("[data-side-nav-toggle]").click();
    await desktopPage.waitForFunction(() => document.querySelector("[data-aos-shell]")?.getAttribute("data-side-nav-collapsed") === "false");

    const searchWrap = desktopPage.locator('[data-shell-control="product-shell-search"]');
    const searchInput = desktopPage.locator('.tcrn-product-shell-search input[type="search"]');
    const searchWidthAtRest = await searchWrap.evaluate((node) => node.getBoundingClientRect().width);
    await searchInput.focus();
    await desktopPage.waitForFunction(() => document.querySelector('[data-shell-control="product-shell-search"]')?.getAttribute("data-search-expanded") === "true");
    const searchWidthFocused = await searchWrap.evaluate((node) => node.getBoundingClientRect().width);
    assert.equal(searchWidthFocused >= searchWidthAtRest, true, "search expands or preserves full width on focus");
    await searchInput.fill("gate");
    await desktopPage.waitForFunction(() => {
      const layer = document.querySelector("[data-product-shell-search-results]");
      return layer && !layer.hidden && layer.querySelector("[data-search-result]");
    });
    assert.equal(await desktopPage.locator("[data-search-result]").count() > 0, true, "search shows local results while focused");
    await clickStableContentPoint(desktopPage);
    await desktopPage.waitForFunction(() => document.querySelector('[data-shell-control="product-shell-search"]')?.getAttribute("data-search-expanded") === "false");
    assert.equal(await desktopPage.locator("[data-product-shell-search-results]").isVisible(), false, "search collapses and hides results on blur");
    assert.equal(await desktopPage.evaluate(() => document.activeElement?.matches('.tcrn-product-shell-search input[type="search"]')), false, "real outside click moves focus away from shell search");

    await searchInput.focus();
    await searchInput.fill("gate");
    await desktopPage.waitForFunction(() => {
      const layer = document.querySelector("[data-product-shell-search-results]");
      return layer && !layer.hidden && layer.querySelector("[data-search-result]");
    });
    await clickStableContentPoint(desktopPage);
    await desktopPage.waitForFunction(() => {
      const input = document.querySelector('.tcrn-product-shell-search input[type="search"]');
      const layer = document.querySelector("[data-product-shell-search-results]");
      return document.activeElement !== input
        && document.querySelector('[data-shell-control="product-shell-search"]')?.getAttribute("data-search-expanded") === "false"
        && layer?.hasAttribute("hidden") === true;
    });
    const outsidePointerSearchReadback = await desktopPage.evaluate(() => ({
      searchExpanded: document.querySelector('[data-shell-control="product-shell-search"]')?.getAttribute("data-search-expanded") === "true",
      resultsHidden: document.querySelector("[data-product-shell-search-results]")?.hasAttribute("hidden") ?? false
    }));
    assert.equal(outsidePointerSearchReadback.searchExpanded, false, "outside pointer dismissal returns search to compact rest state");
    assert.equal(outsidePointerSearchReadback.resultsHidden, true, "outside pointer dismissal hides search results");

    await searchInput.focus();
    await searchInput.fill("gate");
    await desktopPage.waitForFunction(() => {
      const layer = document.querySelector("[data-product-shell-search-results]");
      return layer && !layer.hidden && layer.querySelector("[data-search-result]");
    });
    await desktopPage.keyboard.press("Tab");
    await desktopPage.waitForFunction(() => {
      const input = document.querySelector('.tcrn-product-shell-search input[type="search"]');
      const layer = document.querySelector("[data-product-shell-search-results]");
      return document.activeElement !== input
        && document.querySelector('[data-shell-control="product-shell-search"]')?.getAttribute("data-search-expanded") === "false"
        && layer?.hasAttribute("hidden") === true;
    });
    await searchInput.focus();
    await searchInput.fill("Cockpit");
    await desktopPage.waitForSelector("[data-search-result]");
    await desktopPage.locator("[data-search-result]").first().click();
    assert.equal(await desktopPage.evaluate(() => sessionStorage.getItem("tcrn-aos-last-search-result") ?? localStorage.getItem("tcrn-aos-last-search-result")), "route-cockpit", "search result activation flows through DS semantic callback");

    const visibleText = await desktopPage.locator("body").innerText();
    for (const label of forbiddenPlannedPrimaryLabels) {
      assert.equal(visibleText.includes(label), false, `${label} is not visible in product IA`);
    }
    for (const label of forbiddenScaffoldPrimaryLabels) {
      assert.equal(visibleText.includes(label), false, `${label} is not visible in owner-quality viewport`);
    }
    assert.equal(visibleText.includes("ai-consumption-contract.json"), false, "AI contract JSON is not a human top-bar link");
    for (const marker of forbiddenAosBrandAssetMarkers) {
      assert.equal(await desktopPage.locator("body").evaluate((body, value) => body.innerHTML.includes(value), marker), false, `${marker} is not present in rendered browser DOM`);
    }
    assert.equal(await desktopPage.locator("[data-api-summary]").isVisible(), false, "raw JSON is not primary visible Cockpit UX");
    assert.equal(await desktopPage.locator('[data-raw-json-disclosure="secondary"]').isVisible(), true, "raw payload is available only through secondary disclosure");

    const desktopOverflow = await desktopPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    assert.equal(desktopOverflow, true, "desktop shell has no horizontal overflow");

    await desktopPage.goto(`${baseUrl}/work?locale=zh-CN&theme=dark`, { waitUntil: "networkidle" });
    await desktopPage.waitForSelector('[data-aos-work-module-entry="owner-quality-work-queue"]');
    await desktopPage.waitForFunction(() => document.querySelector("[data-api-state]")?.textContent?.includes("available"));
    assert.equal(await desktopPage.locator("html").getAttribute("data-tcrn-theme"), "dark", "dark theme query applies");
    assert.equal(await desktopPage.locator("html").getAttribute("lang"), "zh-CN", "zh-CN locale query applies");
    assert.equal(await desktopPage.locator('[data-product-shell-route="work"]').getAttribute("aria-current"), "page", "active work route is marked in dark proof");
    const darkContentReadback = await inspectContentRegion(desktopPage);
    assert.deepEqual(darkContentReadback.aosClassHits, [], "dark work content region has no AOS-local visible classes");
    const darkSurfaceContrast = await desktopPage.locator("[data-owner-quality-work-queue]").evaluate((node) => {
      function parseRgb(value) {
        const match = value.match(/rgba?\(([^)]+)\)/);
        if (!match) return [0, 0, 0];
        return match[1].split(",").slice(0, 3).map((part) => Number.parseFloat(part.trim()));
      }
      function channel(value) {
        const normalized = value / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      }
      function luminance(rgb) {
        return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
      }
      const style = getComputedStyle(node);
      const fg = luminance(parseRgb(style.color));
      const bg = luminance(parseRgb(style.backgroundColor));
      const lighter = Math.max(fg, bg);
      const darker = Math.min(fg, bg);
      return (lighter + 0.05) / (darker + 0.05);
    });
    assert.equal(darkSurfaceContrast >= 4.5, true, "dark Work owner-quality surface keeps readable contrast");
    await desktopPage.screenshot({ path: `${screenshotRoot}/03-desktop-work-dark.png`, fullPage: false });

    await desktopContext.close();

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
      locale: "zh-CN",
      timezoneId: "UTC",
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
      isMobile: true
    });
    const mobilePage = await mobileContext.newPage();
    capturePageHealth(mobilePage, consoleMessages, pageErrors, requestFailures);
    await mobilePage.goto(`${baseUrl}/work?locale=zh-CN&theme=dark`, { waitUntil: "networkidle" });
    await mobilePage.waitForSelector('[data-aos-work-module-entry="owner-quality-work-queue"]');
    assert.equal(await mobilePage.locator("html").getAttribute("data-tcrn-theme"), "dark", "mobile dark theme query applies");
    assert.equal(await mobilePage.locator("html").getAttribute("lang"), "zh-CN", "mobile zh-CN locale query applies");
    assert.equal(await mobilePage.locator('[data-product-shell-route="work"]').getAttribute("aria-current"), "page", "mobile active work route is preserved");
    assert.equal(await mobilePage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "false", "mobile accepted visual-instance state starts with navigation expanded");
    assert.equal(await mobilePage.locator("[data-aos-shell]").getAttribute("data-product-shell-responsive"), "desktop-attached-mobile-stacked", "mobile uses DS product shell responsive posture");
    const mobileContentReadback = await inspectContentRegion(mobilePage);
    assert.deepEqual(mobileContentReadback.aosClassHits, [], "mobile content region has no AOS-local visible classes");
    assert.deepEqual(mobileContentReadback.storybookDemoClassHits, [], "mobile content region has no Storybook-only shell demo classes");
    const mobileWorkHeadingTop = await mobilePage.locator("#work-heading").evaluate((node) => node.getBoundingClientRect().top);
    assert.equal(mobileWorkHeadingTop < 760, true, "mobile first viewport reaches the Work heading within the DS stacked shell posture");
    const mobileSearchReadback = await mobilePage.evaluate(() => {
      const wrapper = document.querySelector(".tcrn-product-shell-search");
      const input = document.querySelector(".tcrn-search-input");
      const control = document.querySelector(".tcrn-search-input__control");
      return {
        wrapperWidth: wrapper ? Number(wrapper.getBoundingClientRect().width.toFixed(3)) : null,
        inputWidth: input ? Number(input.getBoundingClientRect().width.toFixed(3)) : null,
        placeholder: control?.getAttribute("placeholder") ?? null
      };
    });
    assert.equal(
      typeof mobileSearchReadback.wrapperWidth === "number" && mobileSearchReadback.wrapperWidth <= ownerQualityMobileSearchMaxPx + 1,
      true,
      `mobile search wrapper respects owner-quality max width ${ownerQualityMobileSearchMaxPx}px`
    );
    assert.equal(
      typeof mobileSearchReadback.inputWidth === "number" && mobileSearchReadback.inputWidth <= ownerQualityMobileSearchMaxPx + 1,
      true,
      `mobile search input respects owner-quality max width ${ownerQualityMobileSearchMaxPx}px`
    );
    assert.equal(mobileSearchReadback.placeholder, "搜索运营", "mobile zh-CN search uses localized owner-quality placeholder");
    await mobilePage.screenshot({ path: `${screenshotRoot}/04-mobile-work-dark.png`, fullPage: false });
    assert.equal(await mobilePage.locator("[data-side-nav-toggle]").isVisible(), false, "mobile Work hides side-nav collapse affordance until mobile collapsed variants are admitted");
    assert.equal(await mobilePage.locator("[data-aos-shell]").getAttribute("data-owner-quality-collapse-policy"), "mobile-hidden-collapse-affordance", "mobile Work records accepted hidden collapse policy");
    assert.equal(await mobilePage.locator("[data-aos-shell]").getAttribute("data-visual-instance-variant"), "mobile-dark-zh-cn-work-queue", "mobile Work remains inside accepted owner-quality variant with hidden collapse affordance");
    assert.equal(await mobilePage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "false", "mobile owner-quality side nav remains expanded");
    const mobileOverflowReadback = await mobilePage.evaluate(() => {
      const readElement = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          selector,
          width: Number(rect.width.toFixed(3)),
          right: Number(rect.right.toFixed(3)),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          overflowX: style.overflowX,
          gridTemplateColumns: style.gridTemplateColumns
        };
      };
      const html = document.documentElement;
      const body = document.body;
      const viewportWidth = window.innerWidth;
      const contentStack = readElement(".tcrn-product-shell-content-stack");
      const sectionGrid = readElement(".tcrn-product-shell-section-grid");
      const workSurface = readElement('[data-owner-quality-work-queue="true"]');
      const gatesSurface = readElement('[data-owner-quality-gates="true"]');
      const tableShells = Array.from(document.querySelectorAll(".tcrn-table-shell")).map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          width: Number(rect.width.toFixed(3)),
          right: Number(rect.right.toFixed(3)),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          overflowX: style.overflowX
        };
      });
      return {
        viewportWidth,
        htmlClientWidth: html.clientWidth,
        htmlScrollWidth: html.scrollWidth,
        bodyClientWidth: body.clientWidth,
        bodyScrollWidth: body.scrollWidth,
        pageHasHorizontalOverflow: html.scrollWidth > viewportWidth + 1 || body.scrollWidth > viewportWidth + 1,
        contentStack,
        sectionGrid,
        workSurface,
        gatesSurface,
        tableShells,
        tableInternalScrollAllowed: tableShells.every((table) => table.overflowX === "auto" && table.right <= viewportWidth + 1)
      };
    });
    assert.equal(mobileOverflowReadback.pageHasHorizontalOverflow, false, "mobile shell has no horizontal page overflow");
    assert.equal(mobileOverflowReadback.contentStack.scrollWidth <= mobileOverflowReadback.contentStack.clientWidth + 1, true, "mobile content stack contains its grid track within the viewport column");
    assert.equal(mobileOverflowReadback.sectionGrid.scrollWidth <= mobileOverflowReadback.sectionGrid.clientWidth + 1, true, "mobile section grid contains its package rhythm track within the viewport column");
    assert.equal(mobileOverflowReadback.workSurface.right <= mobileOverflowReadback.viewportWidth + 1, true, "mobile Work surface stays within the viewport");
    assert.equal(mobileOverflowReadback.gatesSurface.right <= mobileOverflowReadback.viewportWidth + 1, true, "mobile Gates surface stays within the viewport");
    assert.equal(mobileOverflowReadback.tableInternalScrollAllowed, true, "mobile table overflow remains contained to table scrollers, not page-level overflow");
    assert.equal(await mobilePage.locator('[data-tcrn-brand-mark="registered"]').isVisible(), true, "mobile registered brand mark remains visible");
    await mobileContext.close();

    const relevantConsoleMessages = consoleMessages.filter((message) => !/favicon|DevTools/.test(message.text));
    assert.deepEqual(pageErrors, [], "browser page errors are absent");
    assert.deepEqual(requestFailures, [], "browser request failures are absent");
    assert.deepEqual(relevantConsoleMessages, [], "browser console warnings/errors are absent");

    return {
      ok: visualInstanceParityProof.ok && ownerReachableRouteMatrixReadback.ok,
      runner: source,
      browserExecutable: executablePath ? "local_chrome" : "playwright_default",
      dsStorybookComparatorProof: visualComparatorProof,
      designSystemVisualInstanceParityDisposition: "aos_routes_mapped_to_accepted_owner_quality_storybook_visual_instance_oracle",
      designSystemVisualInstanceParityReadback: visualInstanceParityProof,
      ownerReachableRouteMatrixReadback,
      viewports: ["desktop-1440x900", "mobile-390x844"],
      checks: {
        renderedMetricParityAgainstDsStorybook: visualInstanceParityProof.ok,
        motionParityAgainstDsStorybook: visualInstanceParityProof.motionParityOk,
        ownerReachableRoutesInsideAcceptedMatrix: ownerReachableRouteMatrixReadback.ok,
        mobilePageLevelOverflowGuard: !mobileOverflowReadback.pageHasHorizontalOverflow,
        mobileTableOverflowContainedToInternalScroller: mobileOverflowReadback.tableInternalScrollAllowed,
        bannerSpacingNoConcatenation: true,
        localeOutsideDismissal: true,
        localeEscapeDismissalFocusReturn: true,
        localeSelectionFocusReturn: true,
        searchFocusExpansionBlurCollapse: true,
        searchOutsidePointerCollapse: true,
        searchTabCollapse: true,
        sideNavDesktopActionableToggle: true,
        sideNavMobileHiddenAffordance: true,
        brandAssetVisible: true,
        plannedModuleNavigationAbsent: true,
        rawJsonNotPrimary: true,
        strictRegisteredSurfaceContentClasses: true,
        lightDarkThemeReadabilityChecked: true,
        mobileNavigationCompactFirstViewport: true,
        desktopMobileOverflowChecked: true
      },
      mobileOverflowReadback,
      screenshots: [
        `${screenshotRoot}/01-desktop-cockpit-default.png`,
        `${screenshotRoot}/02-desktop-cockpit-side-nav-collapsed.png`,
        `${screenshotRoot}/03-desktop-work-dark.png`,
        `${screenshotRoot}/04-mobile-work-dark.png`
      ]
    };
  } finally {
    await browser.close();
    await dsComparatorServer.close();
  }
}

async function runOwnerReachableRouteMatrixProof(browser, baseUrl, consoleMessages, pageErrors, requestFailures) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    locale: "en",
    timezoneId: "UTC",
    reducedMotion: "no-preference",
    deviceScaleFactor: 1
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("tcrn-aos-side-nav-collapsed", "true");
    window.localStorage.setItem("tcrn-aos-theme", "dark");
    window.localStorage.setItem("tcrn-aos-locale", "zh-CN");
  });

  const reviewedRoutes = [
    {
      id: "root",
      path: "/",
      expectedVariant: "desktop-light-operations-cockpit-collapsed",
      expectedState: {
        theme: "light",
        locale: "en",
        collapsed: "true",
        route: "cockpit",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false"
      }
    },
    {
      id: "cockpit",
      path: "/cockpit",
      expectedVariant: "desktop-light-operations-cockpit-collapsed",
      expectedState: {
        theme: "light",
        locale: "en",
        collapsed: "true",
        route: "cockpit",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false"
      }
    },
    {
      id: "cockpit-light-query",
      path: "/cockpit?locale=en&theme=light",
      expectedVariant: "desktop-light-operations-cockpit-collapsed",
      expectedState: {
        theme: "light",
        locale: "en",
        collapsed: "true",
        route: "cockpit",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false"
      }
    },
    {
      id: "cockpit-dark-query",
      path: "/cockpit?locale=en&theme=dark",
      expectedVariant: "desktop-dark-operations-cockpit-collapsed",
      expectedState: {
        theme: "dark",
        locale: "en",
        collapsed: "true",
        route: "cockpit",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false"
      }
    },
    {
      id: "work-light-query",
      path: "/work?locale=en&theme=light",
      expectedVariant: "desktop-light-work-queue-collapsed",
      expectedState: {
        theme: "light",
        locale: "en",
        collapsed: "true",
        route: "work",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false"
      }
    },
    {
      id: "work-light-collapsed-query",
      path: "/work?locale=en&theme=light&collapsed=true",
      expectedVariant: "desktop-light-work-queue-collapsed",
      expectedState: {
        theme: "light",
        locale: "en",
        collapsed: "true",
        route: "work",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false"
      }
    },
    {
      id: "post-search-dismissal",
      path: "/cockpit?locale=en&theme=light&collapsed=false&search=gate",
      expectedVariant: acceptedVisualInstanceOracle.ownerQualityPolicy.defaultCockpitVariant,
      expectedState: {
        theme: "light",
        locale: "en",
        collapsed: "false",
        route: "cockpit",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false"
      },
      dismissSearch: true
    },
    {
      id: "side-nav-toggle-from-cockpit",
      path: "/cockpit?locale=en&theme=light&collapsed=false",
      expectedVariant: acceptedVisualInstanceOracle.ownerQualityPolicy.defaultCockpitVariant,
      expectedState: {
        theme: "light",
        locale: "en",
        collapsed: "false",
        route: "cockpit",
        search: "rest",
        searchExpanded: "false",
        searchResultsVisible: "false"
      },
      verifySideNavToggle: true
    }
  ];
  const readbacks = [];
  try {
    const page = await context.newPage();
    capturePageHealth(page, consoleMessages, pageErrors, requestFailures);
    for (const route of reviewedRoutes) {
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: "networkidle" });
      await page.waitForSelector('[data-aos-shell="owner-quality-product-shell"]');
      await page.waitForFunction(() => document.querySelector("[data-api-state]")?.textContent?.includes("available"));
      if (route.dismissSearch) {
        await page.waitForFunction(() => {
          const layer = document.querySelector("[data-product-shell-search-results]");
          return layer && !layer.hasAttribute("hidden") && layer.querySelector("[data-search-result]");
        });
        await clickStableContentPoint(page);
        await page.waitForFunction(() => {
          const layer = document.querySelector("[data-product-shell-search-results]");
          return document.querySelector('[data-shell-control="product-shell-search"]')?.getAttribute("data-search-expanded") === "false"
            && layer?.hasAttribute("hidden") === true;
        });
      }
      if (route.verifySideNavToggle) {
        const sideNavToggle = page.locator("[data-side-nav-toggle]");
        assert.equal(await sideNavToggle.getAttribute("disabled"), null, `${route.id} renders an enabled side-nav collapse affordance`);
        assert.equal(await sideNavToggle.getAttribute("aria-disabled"), null, `${route.id} does not expose aria-disabled on actionable side-nav collapse affordance`);
        assert.equal(await sideNavToggle.getAttribute("data-side-nav-action"), "toggle", `${route.id} records toggle side-nav action`);
      }
      const readback = await page.locator('[data-aos-shell="owner-quality-product-shell"]').evaluate((root) => {
        const searchWrapper = root.querySelector(".tcrn-product-shell-search");
        const searchResults = root.querySelector("[data-product-shell-search-results]");
        const selectedNavItem = root.querySelector(".tcrn-nav-item[aria-current=\"page\"], .tcrn-nav-item[data-selected=\"true\"]");
        const sideNavToggle = root.querySelector("[data-side-nav-toggle]");
        return {
          variant: root.getAttribute("data-visual-instance-variant"),
          theme: root.getAttribute("data-visual-instance-theme"),
          locale: root.getAttribute("data-visual-instance-locale"),
          collapsed: root.getAttribute("data-visual-instance-collapsed"),
          route: root.getAttribute("data-visual-instance-route"),
          selectedRoute: selectedNavItem?.getAttribute("data-product-shell-route") ?? null,
          search: root.getAttribute("data-visual-instance-search"),
          searchExpanded: searchWrapper?.getAttribute("data-search-expanded") ?? null,
          searchResultsVisible: searchResults ? String(!searchResults.hasAttribute("hidden")) : "false",
          sideNavToggleDisabled: sideNavToggle?.hasAttribute("disabled") ? "true" : "false",
          sideNavAction: sideNavToggle?.getAttribute("data-side-nav-action") ?? null,
          viewport: root.getAttribute("data-visual-instance-viewport"),
          reducedMotion: root.getAttribute("data-visual-instance-reduced-motion"),
          content: root.getAttribute("data-visual-instance-content")
        };
      });
      readbacks.push({
        ...route,
        readback
      });
      assert.notEqual(
        readback.variant,
        acceptedVisualInstanceOracle.ownerQualityPolicy.outsideMatrixMarkerForbiddenForOwnerReview,
        `${route.id} must not render outside accepted owner-quality visual-instance matrix`
      );
      assert.equal(readback.variant, route.expectedVariant, `${route.id} maps to accepted owner-quality variant`);
      assert.equal(readback.theme, route.expectedState.theme, `${route.id} maps to expected owner-quality theme`);
      assert.equal(readback.locale, route.expectedState.locale, `${route.id} maps to expected owner-quality locale`);
      assert.equal(readback.collapsed, route.expectedState.collapsed, `${route.id} maps to expected side-nav collapsed state`);
      assert.equal(readback.route, route.expectedState.route, `${route.id} maps to expected owner-quality route`);
      assert.equal(readback.search, route.expectedState.search, `${route.id} lands in expected search state`);
      assert.equal(readback.searchExpanded, route.expectedState.searchExpanded, `${route.id} search expanded state matches expected owner-quality state`);
      assert.equal(readback.searchResultsVisible, route.expectedState.searchResultsVisible, `${route.id} search result visibility matches expected owner-quality state`);
      if (route.verifySideNavToggle) {
        assert.equal(readback.sideNavToggleDisabled, "false", `${route.id} keeps side-nav collapse enabled in rendered state`);
        assert.equal(readback.sideNavAction, "toggle", `${route.id} keeps side-nav collapse action actionable in rendered state`);
        await page.locator("[data-side-nav-toggle]").click();
        await page.waitForFunction(() => document.querySelector("[data-aos-shell]")?.getAttribute("data-side-nav-collapsed") === "true");
        assert.equal(await page.locator("[data-aos-shell]").getAttribute("data-visual-instance-variant"), "desktop-light-operations-cockpit-collapsed", `${route.id} click maps to admitted collapsed Cockpit variant`);
        assert.equal(await page.locator('[data-product-shell-route="cockpit"]').getAttribute("aria-current"), "page", `${route.id} preserves active route after collapse`);
      }
    }
    return {
      ok: true,
      poisonedPersistedState: {
        collapsed: "true",
        theme: "dark",
        locale: "zh-CN"
      },
      defaultCockpitVariant: acceptedVisualInstanceOracle.ownerQualityPolicy.defaultCockpitVariant,
      outsideMatrixMarkerForbiddenForOwnerReview: acceptedVisualInstanceOracle.ownerQualityPolicy.outsideMatrixMarkerForbiddenForOwnerReview,
      collapsedOwnerReviewPolicy: acceptedVisualInstanceOracle.ownerQualityPolicy.collapsedOwnerReviewPolicy,
      reviewedRoutes: readbacks,
      notAutomaticallyAdmitted: acceptedVisualInstanceOracle.ownerQualityPolicy.notAutomaticallyAdmitted
    };
  } finally {
    await context.close();
  }
}

async function runVisualInstanceParityProof(browser, aosBaseUrl, dsBaseUrl) {
  const productShellComparatorReadback = await runVisualComparatorProof(browser, aosBaseUrl, dsBaseUrl);
  const failures = [];
  const variantReadbacks = {};

  for (const variant of acceptedVisualInstanceOracle.variants) {
    const context = await browser.newContext({
      viewport: variant.viewport,
      colorScheme: variant.colorScheme,
      locale: variant.locale,
      timezoneId: "UTC",
      reducedMotion: variant.reducedMotion,
      deviceScaleFactor: 1,
      ...(variant.isMobile ? { isMobile: true } : {})
    });
    try {
      const dsPage = await context.newPage();
      const aosPage = await context.newPage();
      await dsPage.goto(`${dsBaseUrl}/${acceptedVisualInstanceOracle.page}`, { waitUntil: "networkidle" });
      await aosPage.goto(`${aosBaseUrl}${variant.aosPath}`, { waitUntil: "networkidle" });
      await dsPage.waitForSelector(variant.dsSelector);
      const aosSelector = `${acceptedVisualInstanceOracle.selector}[data-visual-instance-variant="${variant.id}"]`;
      await aosPage.waitForSelector(aosSelector);
      await aosPage.waitForFunction(() => document.querySelector("[data-api-state]")?.textContent?.includes("available"));
      if (variant.expectedState.searchResultsVisible === "true") {
        await aosPage.waitForFunction((selector) => {
          const root = document.querySelector(selector);
          const results = root?.querySelector("[data-product-shell-search-results]");
          return results && !results.hasAttribute("hidden") && results.querySelector("[data-search-result]");
        }, aosSelector);
      }

      const dsMetrics = await collectProductShellComparatorMetrics(dsPage, variant.dsSelector);
      const aosMetrics = await collectProductShellComparatorMetrics(aosPage, aosSelector);
      const renderedParity = variant.expectedState.viewport === "mobile"
        ? compareMobileOwnerQualitySearchWidth(dsMetrics, aosMetrics)
        : compareProductShellMetrics(dsMetrics, aosMetrics);
      const stateParity = compareVisualInstanceState(variant, dsMetrics, aosMetrics);
      const motionParity = variant.reducedMotion === "reduce"
        ? compareReducedMotionMetrics(dsMetrics, aosMetrics)
        : { checks: renderedParity.checks.filter((check) => /transition|themeWash/.test(check.name)), failures: [] };

      failures.push(
        ...renderedParity.failures.map((failure) => ({ variant: variant.id, type: "renderedMetric", ...failure })),
        ...stateParity.failures.map((failure) => ({ variant: variant.id, type: "stateOrContent", ...failure })),
        ...motionParity.failures.map((failure) => ({ variant: variant.id, type: "motion", ...failure }))
      );
      variantReadbacks[variant.id] = {
        dsSelector: variant.dsSelector,
        aosPath: variant.aosPath,
        dsState: dsMetrics.state,
        aosState: aosMetrics.state,
        dsContent: dsMetrics.content,
        aosContent: aosMetrics.content,
        renderedMetricChecks: renderedParity.checks,
        renderedMetricFailures: renderedParity.failures,
        motionChecks: motionParity.checks,
        motionFailures: motionParity.failures,
        stateChecks: stateParity.checks,
        stateFailures: stateParity.failures
      };
    } finally {
      await context.close();
    }
  }

  return {
    ok: failures.length === 0 && productShellComparatorReadback.ok === true,
    acceptedOracle: {
      storyId: acceptedVisualInstanceOracle.storyId,
      page: acceptedVisualInstanceOracle.page,
      selector: acceptedVisualInstanceOracle.selector,
      dsBasis: acceptedVisualInstanceOracle.dsBasis,
      ownerVisualAdmissionBoundary: "internal_ds_oracle_review_required_before_owner_visual_admission"
    },
    variants: variantReadbacks,
    failures,
    motionParityOk: failures.filter((failure) => failure.type === "motion").length === 0,
    productShellComparatorReadback,
    delegatedInteractionProofs: [
      "Locale menu dismissal/focus-return is exercised through ShellLocaleMenu/ProductShell browser checks.",
      "Search blur/outside-pointer/tab/result activation is exercised through ProductShellSearch browser checks.",
      "This AOS proof maps rendered routes/states to the accepted DS visual-instance oracle; it is not owner-visible readiness."
    ],
    negativeCriteria: {
      noLocalVisibleClasses: true,
      noDeprecatedAosBrandAssets: true,
      noPlannedPrimaryIa: true,
      rawPayloadSecondaryOnly: true,
      noOwnerProductReleaseLiveDispatchClaim: true
    }
  };
}

function compareVisualInstanceState(variant, dsMetrics, aosMetrics) {
  const checks = [];
  const failures = [];
  const add = (name, passed, readback) => {
    checks.push({ name, passed, ...readback });
    if (!passed) failures.push({ name, ...readback });
  };
  for (const [stateName, expected] of Object.entries(variant.expectedState)) {
    const dsActual = stateName === "selectedRoute" ? dsMetrics.state.selectedRoute : dsMetrics.state[stateName];
    const aosActual = aosMetrics.state[stateName];
    add(`state.${stateName}`, dsActual === expected && aosActual === expected, {
      expected,
      ds: dsActual,
      aos: aosActual
    });
  }
  add("state.variant", dsMetrics.state.variant === variant.id && aosMetrics.state.variant === variant.id, {
    expected: variant.id,
    ds: dsMetrics.state.variant,
    aos: aosMetrics.state.variant
  });
  add("state.productShellTheme", dsMetrics.state.productShellTheme === variant.expectedState.theme && aosMetrics.state.productShellTheme === variant.expectedState.theme, {
    expected: variant.expectedState.theme,
    ds: dsMetrics.state.productShellTheme,
    aos: aosMetrics.state.productShellTheme
  });
  add("state.sideNavCollapsed", dsMetrics.state.sideNavCollapsed === variant.expectedState.collapsed && aosMetrics.state.sideNavCollapsed === variant.expectedState.collapsed, {
    expected: variant.expectedState.collapsed,
    ds: dsMetrics.state.sideNavCollapsed,
    aos: aosMetrics.state.sideNavCollapsed
  });
  add("ownerVisualAdmissionBoundary", dsMetrics.state.ownerVisualAdmissionBoundary === acceptedVisualInstanceOracle.ownerVisualAdmissionBoundary && aosMetrics.state.ownerVisualAdmissionBoundary === acceptedVisualInstanceOracle.ownerVisualAdmissionBoundary, {
    expected: acceptedVisualInstanceOracle.ownerVisualAdmissionBoundary,
    ds: dsMetrics.state.ownerVisualAdmissionBoundary,
    aos: aosMetrics.state.ownerVisualAdmissionBoundary
  });
  add("brand.registeredProductLogoAsset", dsMetrics.productLogo.assetId === "tcrn-aos-two-line" && aosMetrics.productLogo.assetId === "tcrn-aos-two-line", {
    expected: "tcrn-aos-two-line",
    ds: dsMetrics.productLogo,
    aos: aosMetrics.productLogo
  });
  add("brand.registeredProductLogoText", dsMetrics.productLogo.lineOne === "TCRN AOS" && dsMetrics.productLogo.lineTwo === "AI Operation System" && aosMetrics.productLogo.lineOne === "TCRN AOS" && aosMetrics.productLogo.lineTwo === "AI Operation System", {
    expected: { lineOne: "TCRN AOS", lineTwo: "AI Operation System" },
    ds: dsMetrics.productLogo,
    aos: aosMetrics.productLogo
  });
  add("brand.noTextComposedCaption", dsMetrics.productLogo.captionPresent === false && aosMetrics.productLogo.captionPresent === false, {
    dsCaptionPresent: dsMetrics.productLogo.captionPresent,
    aosCaptionPresent: aosMetrics.productLogo.captionPresent
  });
  add("content.requiredSurfaces", aosMetrics.content.hasOperationsCockpit && aosMetrics.content.hasWork, {
    hasOperationsCockpit: aosMetrics.content.hasOperationsCockpit,
    hasWork: aosMetrics.content.hasWork
  });
  add("content.productLedFirstViewport", aosMetrics.content.productLedFirstViewport === true, {
    productLedFirstViewport: aosMetrics.content.productLedFirstViewport
  });
  add("content.packageOwnedSpacingRhythm", dsMetrics.content.hasPackageContentStack === true && dsMetrics.content.hasPackageSectionGrid === true && aosMetrics.content.hasPackageContentStack === true && aosMetrics.content.hasPackageSectionGrid === true, {
    ds: {
      contentStack: dsMetrics.content.hasPackageContentStack,
      sectionGrid: dsMetrics.content.hasPackageSectionGrid
    },
    aos: {
      contentStack: aosMetrics.content.hasPackageContentStack,
      sectionGrid: aosMetrics.content.hasPackageSectionGrid
    }
  });
  add("content.singlePrimaryH1", aosMetrics.content.primaryH1Count === 1, {
    primaryH1Count: aosMetrics.content.primaryH1Count,
    primaryH1Text: aosMetrics.content.primaryH1Text
  });
  add("content.noScaffoldPrimaryCopy", aosMetrics.content.scaffoldPrimaryHits.length === 0, {
    hits: aosMetrics.content.scaffoldPrimaryHits
  });
  add("content.rawJsonSecondary", aosMetrics.content.rawJsonVisible === false, {
    rawJsonVisible: aosMetrics.content.rawJsonVisible
  });
  add("content.noPlannedPrimaryIa", aosMetrics.content.plannedPrimaryHits.length === 0, {
    hits: aosMetrics.content.plannedPrimaryHits
  });
  add("content.noDeprecatedBrand", aosMetrics.content.forbiddenBrandHits.length === 0, {
    hits: aosMetrics.content.forbiddenBrandHits
  });
  add("content.noOwnerReadinessClaim", aosMetrics.content.ownerReadinessHits.length === 0, {
    hits: aosMetrics.content.ownerReadinessHits
  });
  add("viewport.noHorizontalOverflow", aosMetrics.viewport.hasHorizontalOverflow === false, {
    aosHasHorizontalOverflow: aosMetrics.viewport.hasHorizontalOverflow,
    viewport: aosMetrics.viewport
  });
  if (variant.expectedState.content === "work") {
    add("content.workLedFirstViewport", /Work queue|工作队列/.test(aosMetrics.content.primaryH1Text), {
      primaryH1Text: aosMetrics.content.primaryH1Text
    });
  }
  if (variant.expectedState.content === "cockpit") {
    add("content.cockpitLedFirstViewport", /AOS Operations Cockpit|AOS 运营驾驶舱/.test(aosMetrics.content.primaryH1Text), {
      primaryH1Text: aosMetrics.content.primaryH1Text
    });
  }
  if (Array.isArray(variant.requiredText)) {
    for (const text of variant.requiredText) {
      add(`content.requiredText.${text}`, dsMetrics.content.visibleText.includes(text) && aosMetrics.content.visibleText.includes(text), {
        text,
        dsPresent: dsMetrics.content.visibleText.includes(text),
        aosPresent: aosMetrics.content.visibleText.includes(text)
      });
    }
  }
  if (Array.isArray(variant.forbiddenText)) {
    const dsHits = variant.forbiddenText.filter((text) => dsMetrics.content.visibleText.includes(text));
    const aosHits = variant.forbiddenText.filter((text) => aosMetrics.content.visibleText.includes(text));
    add("content.noForbiddenLocaleText", dsHits.length === 0 && aosHits.length === 0, {
      forbiddenText: variant.forbiddenText,
      dsHits,
      aosHits
    });
  }
  return { checks, failures };
}

async function runVisualComparatorProof(browser, aosBaseUrl, dsBaseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    locale: "en",
    timezoneId: "UTC",
    reducedMotion: "no-preference",
    deviceScaleFactor: 1
  });
  const reducedMotionContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    locale: "en",
    timezoneId: "UTC",
    reducedMotion: "reduce",
    deviceScaleFactor: 1
  });

  try {
    const dsPage = await context.newPage();
    const aosPage = await context.newPage();
    const defaultDsSelector = '[data-storybook-visual-instance="aos-owner-quality-product-shell"][data-visual-instance-variant="desktop-light-operations-cockpit"]';
    const reducedDsSelector = '[data-storybook-visual-instance="aos-owner-quality-product-shell"][data-visual-instance-variant="reduced-motion"]';
    await dsPage.goto(`${dsBaseUrl}/${acceptedVisualInstanceOracle.page}`, { waitUntil: "networkidle" });
    await aosPage.goto(`${aosBaseUrl}/cockpit?locale=en&theme=light&collapsed=false`, { waitUntil: "networkidle" });
    await dsPage.waitForSelector(defaultDsSelector);
    await aosPage.waitForSelector('[data-aos-shell="owner-quality-product-shell"]');
    const dsMetrics = await collectProductShellComparatorMetrics(dsPage, defaultDsSelector);
    const aosMetrics = await collectProductShellComparatorMetrics(aosPage, '[data-aos-shell="owner-quality-product-shell"]');

    const reducedDsPage = await reducedMotionContext.newPage();
    const reducedAosPage = await reducedMotionContext.newPage();
    await reducedDsPage.goto(`${dsBaseUrl}/${acceptedVisualInstanceOracle.page}`, { waitUntil: "networkidle" });
    await reducedAosPage.goto(`${aosBaseUrl}/cockpit?locale=en&theme=light&collapsed=false`, { waitUntil: "networkidle" });
    await reducedDsPage.waitForSelector(reducedDsSelector);
    await reducedAosPage.waitForSelector('[data-aos-shell="owner-quality-product-shell"]');
    const reducedDsMetrics = await collectProductShellComparatorMetrics(reducedDsPage, reducedDsSelector);
    const reducedAosMetrics = await collectProductShellComparatorMetrics(reducedAosPage, '[data-aos-shell="owner-quality-product-shell"]');

    const parity = compareProductShellMetrics(dsMetrics, aosMetrics);
    const reducedParity = compareReducedMotionMetrics(reducedDsMetrics, reducedAosMetrics);
    assert.deepEqual(parity.failures, [], "AOS rendered ProductShell controls match the DS Storybook package-backed comparator");
    assert.deepEqual(reducedParity.failures, [], "AOS reduced-motion ProductShell behavior matches the DS Storybook package-backed comparator");
    return {
      ok: true,
      comparator: "DS Storybook components.html#aos-owner-quality-product-shell",
      comparatorStyleSource: "@tcrn/ui-react/tcrnComponentCss",
      aosRoute: "/cockpit?locale=en&theme=light",
      dsMetrics,
      aosMetrics,
      parityChecks: parity.checks,
      parityFailures: parity.failures,
      reducedMotionChecks: reducedParity.checks,
      reducedMotionFailures: reducedParity.failures,
      motionParityOk: true
    };
  } finally {
    await context.close();
    await reducedMotionContext.close();
  }
}

async function collectProductShellComparatorMetrics(page, rootSelector) {
  return page.evaluate(async ({ selector, plannedPrimaryLabels, forbiddenScaffoldPrimaryLabels, brandAssetMarkers }) => {
    const root = document.querySelector(selector);
    if (!root) return { missing: true, selector };
    const waitForFocusTransition = () => new Promise((resolve) => window.setTimeout(resolve, 190));
    const readMetric = async (name, childSelector) => {
      const element = root.querySelector(childSelector);
      if (!element) return { missing: true, selector: childSelector };
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const focusTarget = element.matches("button, input, a, select, textarea, [tabindex]")
        ? element
        : element.querySelector("button, input, a, select, textarea, [tabindex]");
      const previousActive = document.activeElement;
      let focus = null;
      if (focusTarget instanceof HTMLElement) {
        focusTarget.focus({ preventScroll: true });
        await waitForFocusTransition();
        const focusStyle = getComputedStyle(focusTarget);
        focus = {
          outlineWidth: focusStyle.outlineWidth,
          outlineStyle: focusStyle.outlineStyle,
          outlineColor: focusStyle.outlineColor,
          outlineOffset: focusStyle.outlineOffset,
          boxShadow: focusStyle.boxShadow
        };
        focusTarget.blur();
        if (previousActive instanceof HTMLElement && previousActive !== focusTarget) {
          previousActive.focus({ preventScroll: true });
        }
      }
      return {
        name,
        selector: childSelector,
        width: Number(rect.width.toFixed(3)),
        height: Number(rect.height.toFixed(3)),
        disabled: element instanceof HTMLButtonElement ? element.disabled : element.getAttribute("disabled") !== null,
        title: element.getAttribute("title"),
        placeholder: element instanceof HTMLInputElement ? element.placeholder : element.getAttribute("placeholder"),
        ariaDisabled: element.getAttribute("aria-disabled"),
        sideNavAction: element.getAttribute("data-side-nav-action"),
        sideNavDisabledReason: element.getAttribute("data-side-nav-disabled-reason"),
        left: Number(rect.left.toFixed(3)),
        right: Number(rect.right.toFixed(3)),
        top: Number(rect.top.toFixed(3)),
        bottom: Number(rect.bottom.toFixed(3)),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        display: style.display,
        position: style.position,
        gridTemplateColumns: style.gridTemplateColumns,
        gap: style.gap,
        columnGap: style.columnGap,
        rowGap: style.rowGap,
        justifyContent: style.justifyContent,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        borderRadius: style.borderRadius,
        borderStyle: style.borderStyle,
        borderWidth: style.borderWidth,
        backgroundColor: style.backgroundColor,
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        boxShadow: style.boxShadow,
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        outlineColor: style.outlineColor,
        outlineOffset: style.outlineOffset,
        transitionProperty: style.transitionProperty,
        transitionDuration: style.transitionDuration,
        transitionTimingFunction: style.transitionTimingFunction,
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        animationTimingFunction: style.animationTimingFunction,
        focus
      };
    };
    const shellStyle = getComputedStyle(root);
    const shellAfterStyle = getComputedStyle(root, "::after");
    const selectedNavItem = root.querySelector(".tcrn-nav-item[aria-current=\"page\"], .tcrn-nav-item[data-selected=\"true\"]");
    const searchWrapper = root.querySelector(".tcrn-product-shell-search");
    const searchResults = root.querySelector("[data-product-shell-search-results]");
    const utilityRow = root.querySelector(".tcrn-product-shell__utility-row");
    const productLogo = root.querySelector('[data-product-logo-asset-id]');
    const controlOrder = utilityRow
      ? Array.from(utilityRow.children).map((child) => {
          if (child.matches(".tcrn-product-shell__current-location")) return "currentLocation";
          if (child.matches(".tcrn-product-shell-search")) return "searchWrapper";
          if (child.matches(".tcrn-shell-theme-toggle")) return "themeToggle";
          if (child.matches(".tcrn-shell-locale-menu")) return "localeTrigger";
          return child.className || child.tagName.toLowerCase();
        })
      : [];
    const primaryHeading = root.querySelector("[data-owner-quality-primary-heading=\"true\"] h1, [data-owner-quality-primary-heading=\"true\"] .tcrn-heading");
    const h1Elements = Array.from(root.querySelectorAll("h1"));
    const contentText = root.textContent ?? "";
    const stateReadback = {
      variant: root.getAttribute("data-visual-instance-variant"),
      theme: root.getAttribute("data-visual-instance-theme"),
      productShellTheme: root.getAttribute("data-product-shell-theme"),
      tcrnTheme: root.getAttribute("data-tcrn-theme"),
      locale: root.getAttribute("data-visual-instance-locale"),
      collapsed: root.getAttribute("data-visual-instance-collapsed"),
      productShellCollapsed: root.getAttribute("data-product-shell-collapsed"),
      sideNavCollapsed: root.getAttribute("data-side-nav-collapsed"),
      route: root.getAttribute("data-visual-instance-route"),
      selectedRoute: selectedNavItem?.getAttribute("data-product-shell-route") ?? null,
      search: root.getAttribute("data-visual-instance-search"),
      searchExpanded: searchWrapper?.getAttribute("data-search-expanded") ?? null,
      searchResultsVisible: searchResults ? String(!searchResults.hasAttribute("hidden")) : "false",
      viewport: root.getAttribute("data-visual-instance-viewport"),
      reducedMotion: root.getAttribute("data-visual-instance-reduced-motion"),
      content: root.getAttribute("data-visual-instance-content"),
      productLogoAssetId: root.getAttribute("data-visual-instance-product-logo") ?? productLogo?.getAttribute("data-product-logo-asset-id") ?? null,
      ownerVisualAdmissionBoundary: root.getAttribute("data-visual-instance-disposition")
    };
    const contentReadback = {
      visibleText: contentText,
      primaryH1Text: primaryHeading?.textContent?.trim() ?? "",
      primaryH1Count: h1Elements.length,
      productLedFirstViewport: Boolean(root.querySelector("[data-owner-quality-first-viewport=\"product-led\"]")),
      hasPackageContentStack: Boolean(root.querySelector(".tcrn-product-shell-content-stack[data-package-owned-spacing-rhythm=\"product-shell-content-stack\"]")),
      hasPackageSectionGrid: Boolean(root.querySelector(".tcrn-product-shell-section-grid[data-package-owned-section-rhythm=\"work-gates\"]")),
      hasEnvironmentBanner: Boolean(root.querySelector(".tcrn-environment-banner")),
      hasInlineAlert: Boolean(root.querySelector(".tcrn-inline-alert")),
      hasOperationsCockpit: Boolean(root.querySelector("[data-owner-quality-primary-heading=\"true\"]")),
      hasWork: Boolean(root.querySelector("[data-aos-work-module-entry=\"owner-quality-work-queue\"]")),
      hasGates: Boolean(root.querySelector("[data-owner-quality-gates=\"true\"]")),
      hasOwnerActions: Boolean(root.querySelector("[data-owner-quality-actions=\"true\"]")),
      hasServiceHealth: Boolean(root.querySelector("[data-owner-quality-service-health=\"true\"]")),
      rawJsonVisible: Boolean(root.querySelector("[data-api-summary]") && getComputedStyle(root.querySelector("[data-api-summary]")).display !== "none"),
      containsPlannedPrimaryLabels: plannedPrimaryLabels.filter((label) => contentText.includes(label)),
      containsForbiddenScaffoldPrimaryLabels: forbiddenScaffoldPrimaryLabels.filter((label) => contentText.includes(label)),
      containsBrandAssetMarkers: brandAssetMarkers.filter((label) => contentText.includes(label)),
      containsLocalProofOnly: contentText.includes("Local proof only"),
      containsZhLocalProofOnly: contentText.includes("仅本地证明"),
      plannedPrimaryHits: plannedPrimaryLabels.filter((label) => contentText.includes(label)),
      scaffoldPrimaryHits: forbiddenScaffoldPrimaryLabels.filter((label) => contentText.includes(label)),
      forbiddenBrandHits: brandAssetMarkers.filter((marker) => contentText.includes(marker)),
      ownerReadinessHits: ["owner ready", "owner-ready", "release ready", "release-readiness achieved", "product accepted"].filter((marker) => contentText.toLowerCase().includes(marker))
    };
    const rootRect = root.getBoundingClientRect();
    const topBar = root.querySelector(".tcrn-top-bar");
    const topBarRect = topBar?.getBoundingClientRect();
    const controlBounds = [".tcrn-shell-theme-toggle", ".tcrn-shell-locale-menu__trigger", ".tcrn-product-shell-search"]
      .map((selector) => {
        const element = root.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        return {
          selector,
          missing: !element || !rect,
          left: rect ? Number(rect.left.toFixed(3)) : null,
          right: rect ? Number(rect.right.toFixed(3)) : null,
          top: rect ? Number(rect.top.toFixed(3)) : null,
          bottom: rect ? Number(rect.bottom.toFixed(3)) : null,
          withinRoot: Boolean(rect && rect.left >= rootRect.left - 1 && rect.right <= rootRect.right + 1),
          withinViewport: Boolean(rect && rect.left >= -1 && rect.right <= window.innerWidth + 1)
        };
      });
    const sideNavToggle = root.querySelector("[data-side-nav-toggle]");
    const visibleSideNavIcon = sideNavToggle
      ? Array.from(sideNavToggle.querySelectorAll("[data-side-nav-icon]")).find((icon) => getComputedStyle(icon).display !== "none")
      : null;
    const sideNavToggleRect = sideNavToggle?.getBoundingClientRect();
    const visibleSideNavIconRect = visibleSideNavIcon?.getBoundingClientRect();
    const sideNavIconCenterDelta = sideNavToggleRect && visibleSideNavIconRect
      ? Math.abs((visibleSideNavIconRect.left + visibleSideNavIconRect.width / 2) - (sideNavToggleRect.left + sideNavToggleRect.width / 2))
      : Number.POSITIVE_INFINITY;
    return {
      missing: false,
      selector,
      sourceMarkers: {
        packageBoundary: root.getAttribute("data-package-backed-product-shell-boundary"),
        effectBoundary: root.getAttribute("data-product-shell-effect-boundary"),
        semanticApi: root.getAttribute("data-product-shell-semantic-api"),
        responsive: root.getAttribute("data-product-shell-responsive")
      },
      shell: {
        width: Number(root.getBoundingClientRect().width.toFixed(3)),
        height: Number(root.getBoundingClientRect().height.toFixed(3)),
        gridTemplateColumns: shellStyle.gridTemplateColumns,
        transitionProperty: shellStyle.transitionProperty,
        transitionDuration: shellStyle.transitionDuration,
        transitionTimingFunction: shellStyle.transitionTimingFunction,
        backgroundColor: shellStyle.backgroundColor,
        color: shellStyle.color,
        themeWashAnimationName: shellAfterStyle.animationName,
        themeWashAnimationDuration: shellAfterStyle.animationDuration,
        themeWashAnimationTimingFunction: shellAfterStyle.animationTimingFunction
      },
      measured: {
        themeToggle: await readMetric("themeToggle", ".tcrn-shell-theme-toggle"),
        localeTrigger: await readMetric("localeTrigger", ".tcrn-shell-locale-menu__trigger"),
        sideNavToggle: await readMetric("sideNavToggle", ".tcrn-shell-side-nav-toggle"),
        searchWrapper: await readMetric("searchWrapper", ".tcrn-product-shell-search"),
        searchInput: await readMetric("searchInput", ".tcrn-search-input"),
        searchControl: await readMetric("searchControl", ".tcrn-search-input__control"),
        searchShortcut: await readMetric("searchShortcut", ".tcrn-search-input__shortcut"),
        currentLocation: await readMetric("currentLocation", ".tcrn-product-shell__current-location"),
        localeChevron: await readMetric("localeChevron", ".tcrn-shell-locale-menu__chevron"),
        topBar: await readMetric("topBar", ".tcrn-top-bar"),
        utilityRow: await readMetric("utilityRow", ".tcrn-product-shell__utility-row"),
        selectedNavItem: await readMetric("selectedNavItem", ".tcrn-nav-item[data-selected=\"true\"], .tcrn-nav-item[aria-current=\"page\"]")
      },
      controlOrder,
      productLogo: {
        productId: productLogo?.getAttribute("data-product-id") ?? null,
        assetId: productLogo?.getAttribute("data-product-logo-asset-id") ?? null,
        lineOne: productLogo?.querySelector(".tcrn-product-logo__line-one")?.textContent?.trim() ?? null,
        lineTwo: productLogo?.querySelector(".tcrn-product-logo__line-two")?.textContent?.trim() ?? null,
        captionPresent: Boolean(productLogo?.querySelector(".tcrn-shell-brand-lockup__caption"))
      },
      sideNavIconCenter: {
        buttonWidth: sideNavToggleRect ? Number(sideNavToggleRect.width.toFixed(3)) : null,
        buttonHeight: sideNavToggleRect ? Number(sideNavToggleRect.height.toFixed(3)) : null,
        iconWidth: visibleSideNavIconRect ? Number(visibleSideNavIconRect.width.toFixed(3)) : null,
        iconHeight: visibleSideNavIconRect ? Number(visibleSideNavIconRect.height.toFixed(3)) : null,
        centerDelta: Number(sideNavIconCenterDelta.toFixed(3))
      },
      state: stateReadback,
      content: contentReadback,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        rootWidth: Number(rootRect.width.toFixed(3)),
        rootRight: Number(rootRect.right.toFixed(3)),
        topBarClientWidth: topBar ? Number(topBar.clientWidth) : null,
        topBarScrollWidth: topBar ? Number(topBar.scrollWidth) : null,
        topBarHasHorizontalOverflow: topBar ? topBar.scrollWidth > topBar.clientWidth + 1 : true,
        controlsOutOfRoot: controlBounds.filter((control) => !control.withinRoot),
        controlsOutOfViewport: controlBounds.filter((control) => !control.withinViewport)
      }
    };
  }, {
    selector: rootSelector,
    plannedPrimaryLabels: forbiddenPlannedPrimaryLabels,
    forbiddenScaffoldPrimaryLabels,
    brandAssetMarkers: forbiddenAosBrandAssetMarkers
  });
}

function compareProductShellMetrics(dsMetrics, aosMetrics) {
  const failures = [];
  const checks = [];
  const isReducedMotion = dsMetrics.state?.reducedMotion === "true" || aosMetrics.state?.reducedMotion === "true";
  const expectSearchResults = dsMetrics.state?.searchResultsVisible === "true" || aosMetrics.state?.searchResultsVisible === "true";
  const add = (name, passed, readback) => {
    checks.push({ name, passed, ...readback });
    if (!passed) failures.push({ name, ...readback });
  };
  add("shell-present", dsMetrics.missing === false && aosMetrics.missing === false, { dsMissing: dsMetrics.missing, aosMissing: aosMetrics.missing });
  for (const key of ["packageBoundary", "effectBoundary", "semanticApi", "responsive"]) {
    add(`source-marker-${key}`, dsMetrics.sourceMarkers?.[key] === aosMetrics.sourceMarkers?.[key], {
      ds: dsMetrics.sourceMarkers?.[key],
      aos: aosMetrics.sourceMarkers?.[key]
    });
  }
  add("controlOrder.currentLocation-search-theme-locale", (dsMetrics.controlOrder ?? []).join(">") === (aosMetrics.controlOrder ?? []).join(">"), {
    ds: dsMetrics.controlOrder,
    aos: aosMetrics.controlOrder
  });
  for (const control of ["themeToggle", "sideNavToggle"]) {
    compareNumber(add, `${control}.width`, dsMetrics.measured[control].width, aosMetrics.measured[control].width, 0.5);
    compareNumber(add, `${control}.height`, dsMetrics.measured[control].height, aosMetrics.measured[control].height, 0.5);
    compareString(add, `${control}.borderRadius`, dsMetrics.measured[control].borderRadius, aosMetrics.measured[control].borderRadius);
    compareString(add, `${control}.display`, dsMetrics.measured[control].display, aosMetrics.measured[control].display);
  }
  for (const control of ["themeToggle", "sideNavToggle", "localeTrigger", "searchInput", "searchControl", "searchShortcut", "currentLocation", "selectedNavItem", "topBar"]) {
    for (const property of ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing"]) {
      compareString(add, `${control}.${property}`, dsMetrics.measured[control][property], aosMetrics.measured[control][property]);
    }
  }
  for (const control of ["themeToggle", "sideNavToggle", "localeTrigger", "searchInput", "searchShortcut", "selectedNavItem", "topBar"]) {
    for (const property of ["backgroundColor", "borderStyle", "borderWidth", "boxShadow"]) {
      compareString(add, `${control}.${property}`, dsMetrics.measured[control][property], aosMetrics.measured[control][property]);
    }
  }
  for (const control of ["themeToggle", "sideNavToggle", "localeTrigger", "searchControl", "searchInput"]) {
    for (const property of ["outlineWidth", "outlineStyle", "outlineColor", "outlineOffset", "boxShadow"]) {
      compareString(add, `${control}.focus.${property}`, dsMetrics.measured[control].focus?.[property], aosMetrics.measured[control].focus?.[property]);
    }
  }
  compareNumber(add, "localeTrigger.height", dsMetrics.measured.localeTrigger.height, aosMetrics.measured.localeTrigger.height, 0.5);
  compareString(add, "localeTrigger.borderRadius", dsMetrics.measured.localeTrigger.borderRadius, aosMetrics.measured.localeTrigger.borderRadius);
  compareString(add, "localeTrigger.display", dsMetrics.measured.localeTrigger.display, aosMetrics.measured.localeTrigger.display);
  compareString(add, "localeTrigger.gap", dsMetrics.measured.localeTrigger.gap, aosMetrics.measured.localeTrigger.gap);
  compareString(add, "localeTrigger.paddingLeft", dsMetrics.measured.localeTrigger.paddingLeft, aosMetrics.measured.localeTrigger.paddingLeft);
  compareString(add, "localeTrigger.paddingRight", dsMetrics.measured.localeTrigger.paddingRight, aosMetrics.measured.localeTrigger.paddingRight);
  add("sideNavToggle.desktopActionableToggle", dsMetrics.measured.sideNavToggle.disabled === false && aosMetrics.measured.sideNavToggle.disabled === false && dsMetrics.measured.sideNavToggle.sideNavAction === "toggle" && aosMetrics.measured.sideNavToggle.sideNavAction === "toggle", {
    dsDisabled: dsMetrics.measured.sideNavToggle.disabled,
    aosDisabled: aosMetrics.measured.sideNavToggle.disabled,
    dsAction: dsMetrics.measured.sideNavToggle.sideNavAction,
    aosAction: aosMetrics.measured.sideNavToggle.sideNavAction
  });
  add("sideNavToggle.noDisabledReason", !dsMetrics.measured.sideNavToggle.sideNavDisabledReason && !aosMetrics.measured.sideNavToggle.sideNavDisabledReason, {
    dsReason: dsMetrics.measured.sideNavToggle.sideNavDisabledReason,
    aosReason: aosMetrics.measured.sideNavToggle.sideNavDisabledReason,
    dsTitle: dsMetrics.measured.sideNavToggle.title,
    aosTitle: aosMetrics.measured.sideNavToggle.title
  });
  add("sideNavToggle.iconCenterDelta.max1px", dsMetrics.sideNavIconCenter.centerDelta <= 1 && aosMetrics.sideNavIconCenter.centerDelta <= 1, {
    ds: dsMetrics.sideNavIconCenter,
    aos: aosMetrics.sideNavIconCenter,
    maxPx: 1
  });
  compareResponsiveSearchWidth(add, "searchWrapper.width", dsMetrics.measured.searchWrapper.width, aosMetrics.measured.searchWrapper.width, expectSearchResults);
  compareNumber(add, "searchWrapper.height", dsMetrics.measured.searchWrapper.height, aosMetrics.measured.searchWrapper.height, 0.5);
  compareString(add, "searchWrapper.transitionProperty", dsMetrics.measured.searchWrapper.transitionProperty, aosMetrics.measured.searchWrapper.transitionProperty);
  compareMotionDuration(add, "searchWrapper.transitionDuration", dsMetrics.measured.searchWrapper.transitionDuration, aosMetrics.measured.searchWrapper.transitionDuration, isReducedMotion);
  compareString(add, "searchWrapper.transitionTimingFunction", dsMetrics.measured.searchWrapper.transitionTimingFunction, aosMetrics.measured.searchWrapper.transitionTimingFunction);
  compareResponsiveSearchWidth(add, "searchInput.width", dsMetrics.measured.searchInput.width, aosMetrics.measured.searchInput.width, expectSearchResults);
  compareNumber(add, "searchInput.height", dsMetrics.measured.searchInput.height, aosMetrics.measured.searchInput.height, 0.5);
  compareString(add, "searchInput.borderRadius", dsMetrics.measured.searchInput.borderRadius, aosMetrics.measured.searchInput.borderRadius);
  compareString(add, "searchInput.display", dsMetrics.measured.searchInput.display, aosMetrics.measured.searchInput.display);
  compareString(add, "searchInput.gap", dsMetrics.measured.searchInput.gap, aosMetrics.measured.searchInput.gap);
  compareString(add, "searchInput.paddingLeft", dsMetrics.measured.searchInput.paddingLeft, aosMetrics.measured.searchInput.paddingLeft);
  compareString(add, "searchInput.paddingRight", dsMetrics.measured.searchInput.paddingRight, aosMetrics.measured.searchInput.paddingRight);
  compareSearchGrid(add, "searchInput.gridTemplateColumns", dsMetrics.measured.searchInput.gridTemplateColumns, aosMetrics.measured.searchInput.gridTemplateColumns);
  compareString(add, "searchControl.placeholder", dsMetrics.measured.searchControl.placeholder, aosMetrics.measured.searchControl.placeholder);
  compareString(add, "searchShortcut.paddingLeft", dsMetrics.measured.searchShortcut.paddingLeft, aosMetrics.measured.searchShortcut.paddingLeft);
  compareString(add, "searchShortcut.paddingRight", dsMetrics.measured.searchShortcut.paddingRight, aosMetrics.measured.searchShortcut.paddingRight);
  compareString(add, "searchShortcut.position", dsMetrics.measured.searchShortcut.position, aosMetrics.measured.searchShortcut.position);
  compareTopBarHeight(add, "topBar.height", dsMetrics.measured.topBar.height, aosMetrics.measured.topBar.height, dsMetrics.viewport, aosMetrics.viewport);
  compareString(add, "topBar.display", dsMetrics.measured.topBar.display, aosMetrics.measured.topBar.display);
  compareString(add, "topBar.position", dsMetrics.measured.topBar.position, aosMetrics.measured.topBar.position);
  compareString(add, "topBar.gap", dsMetrics.measured.topBar.gap, aosMetrics.measured.topBar.gap);
  compareString(add, "topBar.justifyContent", dsMetrics.measured.topBar.justifyContent, aosMetrics.measured.topBar.justifyContent);
  compareString(add, "topBar.paddingLeft", dsMetrics.measured.topBar.paddingLeft, aosMetrics.measured.topBar.paddingLeft);
  compareString(add, "topBar.paddingRight", dsMetrics.measured.topBar.paddingRight, aosMetrics.measured.topBar.paddingRight);
  compareString(add, "topBar.borderRadius", dsMetrics.measured.topBar.borderRadius, aosMetrics.measured.topBar.borderRadius);
  compareString(add, "topBar.borderStyle", dsMetrics.measured.topBar.borderStyle, aosMetrics.measured.topBar.borderStyle);
  compareString(add, "topBar.borderWidth", dsMetrics.measured.topBar.borderWidth, aosMetrics.measured.topBar.borderWidth);
  compareString(add, "topBar.backgroundColor", dsMetrics.measured.topBar.backgroundColor, aosMetrics.measured.topBar.backgroundColor);
  compareTopBarGrid(add, "topBar.gridTemplateColumns", dsMetrics.measured.topBar.gridTemplateColumns, aosMetrics.measured.topBar.gridTemplateColumns);
  add("topBar.noHorizontalOverflow", dsMetrics.viewport.topBarHasHorizontalOverflow === false && aosMetrics.viewport.topBarHasHorizontalOverflow === false, {
    ds: {
      clientWidth: dsMetrics.viewport.topBarClientWidth,
      scrollWidth: dsMetrics.viewport.topBarScrollWidth,
      hasHorizontalOverflow: dsMetrics.viewport.topBarHasHorizontalOverflow
    },
    aos: {
      clientWidth: aosMetrics.viewport.topBarClientWidth,
      scrollWidth: aosMetrics.viewport.topBarScrollWidth,
      hasHorizontalOverflow: aosMetrics.viewport.topBarHasHorizontalOverflow
    }
  });
  add("topBar.controlsWithinRootAndViewport", dsMetrics.viewport.controlsOutOfRoot.length === 0 && dsMetrics.viewport.controlsOutOfViewport.length === 0 && aosMetrics.viewport.controlsOutOfRoot.length === 0 && aosMetrics.viewport.controlsOutOfViewport.length === 0, {
    dsControlsOutOfRoot: dsMetrics.viewport.controlsOutOfRoot,
    dsControlsOutOfViewport: dsMetrics.viewport.controlsOutOfViewport,
    aosControlsOutOfRoot: aosMetrics.viewport.controlsOutOfRoot,
    aosControlsOutOfViewport: aosMetrics.viewport.controlsOutOfViewport
  });
  compareString(add, "shell.transitionProperty", dsMetrics.shell.transitionProperty, aosMetrics.shell.transitionProperty);
  compareMotionDuration(add, "shell.transitionDuration", dsMetrics.shell.transitionDuration, aosMetrics.shell.transitionDuration, isReducedMotion);
  compareString(add, "shell.transitionTimingFunction", dsMetrics.shell.transitionTimingFunction, aosMetrics.shell.transitionTimingFunction);
  compareString(add, "shell.themeWashAnimationName", dsMetrics.shell.themeWashAnimationName, aosMetrics.shell.themeWashAnimationName);
  compareMotionDuration(add, "shell.themeWashAnimationDuration", dsMetrics.shell.themeWashAnimationDuration, aosMetrics.shell.themeWashAnimationDuration, isReducedMotion);
  compareString(add, "shell.themeWashAnimationTimingFunction", dsMetrics.shell.themeWashAnimationTimingFunction, aosMetrics.shell.themeWashAnimationTimingFunction);
  for (const control of ["themeToggle", "sideNavToggle", "localeTrigger", "localeChevron"]) {
    compareString(add, `${control}.transitionProperty`, dsMetrics.measured[control].transitionProperty, aosMetrics.measured[control].transitionProperty);
    compareMotionDuration(add, `${control}.transitionDuration`, dsMetrics.measured[control].transitionDuration, aosMetrics.measured[control].transitionDuration, isReducedMotion);
    compareString(add, `${control}.transitionTimingFunction`, dsMetrics.measured[control].transitionTimingFunction, aosMetrics.measured[control].transitionTimingFunction);
  }
  compareString(add, "utilityRow.gap", dsMetrics.measured.utilityRow.gap, aosMetrics.measured.utilityRow.gap);
  compareString(add, "utilityRow.justifyContent", dsMetrics.measured.utilityRow.justifyContent, aosMetrics.measured.utilityRow.justifyContent);
  add("aos-no-horizontal-overflow", aosMetrics.viewport.hasHorizontalOverflow === false, { aosHasHorizontalOverflow: aosMetrics.viewport.hasHorizontalOverflow });
  return { checks, failures };
}

function compareReducedMotionMetrics(dsMetrics, aosMetrics) {
  const failures = [];
  const checks = [];
  const add = (name, passed, readback) => {
    checks.push({ name, passed, ...readback });
    if (!passed) failures.push({ name, ...readback });
  };
  compareString(add, "reduced.shell.transitionProperty", dsMetrics.shell.transitionProperty, aosMetrics.shell.transitionProperty);
  compareString(add, "reduced.shell.themeWashAnimationName", dsMetrics.shell.themeWashAnimationName, aosMetrics.shell.themeWashAnimationName);
  compareString(add, "reduced.themeToggle.transitionProperty", dsMetrics.measured.themeToggle.transitionProperty, aosMetrics.measured.themeToggle.transitionProperty);
  compareString(add, "reduced.localeTrigger.transitionProperty", dsMetrics.measured.localeTrigger.transitionProperty, aosMetrics.measured.localeTrigger.transitionProperty);
  compareString(add, "reduced.sideNavToggle.transitionProperty", dsMetrics.measured.sideNavToggle.transitionProperty, aosMetrics.measured.sideNavToggle.transitionProperty);
  compareString(add, "reduced.searchWrapper.transitionProperty", dsMetrics.measured.searchWrapper.transitionProperty, aosMetrics.measured.searchWrapper.transitionProperty);
  compareString(add, "reduced.localeChevron.transitionProperty", dsMetrics.measured.localeChevron.transitionProperty, aosMetrics.measured.localeChevron.transitionProperty);
  for (const control of ["themeToggle", "localeTrigger", "sideNavToggle", "searchWrapper", "localeChevron"]) {
    compareReducedDuration(add, `reduced.${control}.transitionDuration`, dsMetrics.measured[control].transitionDuration, aosMetrics.measured[control].transitionDuration);
    compareString(add, `reduced.${control}.transitionTimingFunction`, dsMetrics.measured[control].transitionTimingFunction, aosMetrics.measured[control].transitionTimingFunction);
  }
  compareReducedDuration(add, "reduced.shell.transitionDuration", dsMetrics.shell.transitionDuration, aosMetrics.shell.transitionDuration);
  compareString(add, "reduced.shell.transitionTimingFunction", dsMetrics.shell.transitionTimingFunction, aosMetrics.shell.transitionTimingFunction);
  compareReducedDuration(add, "reduced.shell.themeWashAnimationDuration", dsMetrics.shell.themeWashAnimationDuration, aosMetrics.shell.themeWashAnimationDuration);
  compareString(add, "reduced.shell.themeWashAnimationTimingFunction", dsMetrics.shell.themeWashAnimationTimingFunction, aosMetrics.shell.themeWashAnimationTimingFunction);
  return { checks, failures };
}

function compareTopBarHeight(add, name, ds, aos, dsViewport, aosViewport) {
  const minAllowed = 60;
  const maxAllowed = 180;
  const dsNumber = Number(ds);
  const aosNumber = Number(aos);
  const passed = dsNumber >= minAllowed
    && dsNumber <= maxAllowed
    && aosNumber >= minAllowed
    && aosNumber <= maxAllowed
    && dsViewport.topBarHasHorizontalOverflow === false
    && aosViewport.topBarHasHorizontalOverflow === false
    && dsViewport.controlsOutOfRoot.length === 0
    && dsViewport.controlsOutOfViewport.length === 0
    && aosViewport.controlsOutOfRoot.length === 0
    && aosViewport.controlsOutOfViewport.length === 0;
  add(name, passed, {
    ds,
    aos,
    allowedRange: `${minAllowed}-${maxAllowed}`,
    disposition: "same DS ProductShell topbar may wrap to a taller row in the Storybook fixture than in the product viewport; proof fails on clipping, overflow, or out-of-bounds controls."
  });
}

function compareNumber(add, name, ds, aos, tolerance) {
  const delta = Math.abs(Number(ds) - Number(aos));
  add(name, delta <= tolerance, { ds, aos, tolerance, delta: Number(delta.toFixed(3)) });
}

function compareString(add, name, ds, aos) {
  add(name, ds === aos, { ds, aos });
}

function compareMotionDuration(add, name, ds, aos, isReducedMotion) {
  if (isReducedMotion) {
    compareReducedDuration(add, name, ds, aos);
    return;
  }
  compareString(add, name, ds, aos);
}

function compareReducedDuration(add, name, ds, aos) {
  const dsMaxMs = maxCssDurationMs(ds);
  const aosMaxMs = maxCssDurationMs(aos);
  const maxAllowedMs = 0.02;
  add(name, dsMaxMs <= maxAllowedMs && aosMaxMs <= maxAllowedMs, {
    ds,
    aos,
    dsMaxMs,
    aosMaxMs,
    allowedMaxMs: maxAllowedMs,
    disposition: "reduced-motion zero-duration fallback accepts browser-normalized 0s or 1e-05s forms"
  });
}

function maxCssDurationMs(value) {
  return Math.max(0, ...String(value).split(",").map((part) => {
    const trimmed = part.trim();
    if (trimmed.endsWith("ms")) return Number(trimmed.slice(0, -2));
    if (trimmed.endsWith("s")) return Number(trimmed.slice(0, -1)) * 1000;
    return Number(trimmed) || 0;
  }));
}

function compareResponsiveSearchWidth(add, name, ds, aos, expectSearchResults = false) {
  const dsNumber = Number(ds);
  const aosNumber = Number(aos);
  const minAllowed = 180;
  const maxAllowed = expectSearchResults ? 420 : 260;
  const passed = dsNumber >= minAllowed && dsNumber <= maxAllowed && aosNumber >= minAllowed && aosNumber <= maxAllowed;
  add(name, passed, {
    ds,
    aos,
    allowedRange: `${minAllowed}-${maxAllowed}`,
    disposition: "same DS ProductShellSearch compact rest-width rule; focused/results states may widen separately"
  });
}

function compareMobileOwnerQualitySearchWidth(dsMetrics, aosMetrics) {
  const failures = [];
  const checks = [];
  const add = (name, passed, readback) => {
    checks.push({ name, passed, ...readback });
    if (!passed) failures.push({ name, ...readback });
  };
  const dsWrapperWidth = Number(dsMetrics.measured.searchWrapper?.width);
  const aosWrapperWidth = Number(aosMetrics.measured.searchWrapper?.width);
  const dsInputWidth = Number(dsMetrics.measured.searchInput?.width);
  const aosInputWidth = Number(aosMetrics.measured.searchInput?.width);
  add("mobile.searchWrapper.width.max320", dsWrapperWidth <= ownerQualityMobileSearchMaxPx + 1 && aosWrapperWidth <= ownerQualityMobileSearchMaxPx + 1, {
    ds: dsMetrics.measured.searchWrapper?.width,
    aos: aosMetrics.measured.searchWrapper?.width,
    maxPx: ownerQualityMobileSearchMaxPx,
    disposition: "mobile owner-quality search wrapper must respect accepted DS AI contract mobileMaxPx"
  });
  add("mobile.searchInput.width.max320", dsInputWidth <= ownerQualityMobileSearchMaxPx + 1 && aosInputWidth <= ownerQualityMobileSearchMaxPx + 1, {
    ds: dsMetrics.measured.searchInput?.width,
    aos: aosMetrics.measured.searchInput?.width,
    maxPx: ownerQualityMobileSearchMaxPx,
    disposition: "mobile owner-quality search input must respect accepted DS AI contract mobileMaxPx"
  });
  add("mobile.searchControl.placeholder.zhCN", aosMetrics.measured.searchControl?.placeholder === "搜索运营", {
    ds: dsMetrics.measured.searchControl?.placeholder,
    aos: aosMetrics.measured.searchControl?.placeholder
  });
  add("mobile.rendered-state-proof", true, {
    disposition: "mobile visual-instance parity also asserts state markers, responsive posture, no-overflow, and required localized content"
  });
  return { checks, failures };
}

function compareSearchGrid(add, name, ds, aos) {
  const parse = (value) => String(value).split(/\s+/).filter(Boolean);
  const dsColumns = parse(ds);
  const aosColumns = parse(aos);
  const passed = dsColumns.length === 3
    && aosColumns.length === 3
    && dsColumns[0] === aosColumns[0]
    && dsColumns[0] === "22px";
  add(name, passed, {
    ds,
    aos,
    disposition: "same DS three-column SearchInput grid; middle/shortcut tracks respond to available width"
  });
}

function compareTopBarGrid(add, name, ds, aos) {
  const parse = (value) => String(value).split(/\s+/).filter(Boolean);
  const dsColumns = parse(ds);
  const aosColumns = parse(aos);
  const passed = dsColumns.length === 3 && aosColumns.length === 3;
  add(name, passed, {
    ds,
    aos,
    disposition: "same DS ProductShell topbar three-column grid; column widths vary by shell workspace width"
  });
}

async function startDesignSystemComparatorServer() {
  return startStaticFileServer(findDesignSystemStaticRoot());
}

function findDesignSystemStaticRoot() {
  const candidates = [
    new URL("../../TCRN-DESIGN-SYSTEM/apps/storybook/storybook-static/", import.meta.url),
    new URL("../../TCRN-Design-System/apps/storybook/storybook-static/", import.meta.url)
  ];
  const found = candidates.find((candidate) => existsSync(fileURLToPath(new URL("components.html", candidate))));
  assert.ok(found, "local DS Storybook static comparator exists at apps/storybook/storybook-static/components.html");
  return found;
}

async function startStaticFileServer(rootUrl) {
  const rootPath = fileURLToPath(rootUrl);
  const server = createServer((request, response) => {
    const rawPath = decodeURIComponent((request.url ?? "/").split("?")[0].split("#")[0]);
    const relativePath = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "");
    const filePath = join(rootPath, relativePath);
    if (!filePath.startsWith(rootPath) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }
    response.writeHead(200, { "content-type": contentTypeForPath(filePath) });
    response.end(readFileSync(filePath));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object", "static comparator server has a port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function contentTypeForPath(filePath) {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".json":
      return "application/json; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function inspectContentRegion(page) {
  return page.locator('[data-product-shell-region="content"]').evaluate((content, scaffoldLabels) => {
    const classedNodes = Array.from(content.querySelectorAll("[class]"));
    const aosClassHits = [];
    const storybookDemoClassHits = [];
    let dsOwnedClassCount = 0;
    for (const node of classedNodes) {
      for (const className of Array.from(node.classList)) {
        if (className.startsWith("aos-")) {
          aosClassHits.push({ tagName: node.tagName.toLowerCase(), className });
        }
        if (/^tcrn-(shell-demo|compact-shell|knowledge-shell)/.test(className)) {
          storybookDemoClassHits.push({ tagName: node.tagName.toLowerCase(), className });
        }
        if (className.startsWith("tcrn-")) {
          dsOwnedClassCount += 1;
        }
      }
    }
    const environmentBanner = content.querySelector(".tcrn-environment-banner");
    const inlineAlert = content.querySelector(".tcrn-inline-alert--warning");
    const environmentRect = environmentBanner?.getBoundingClientRect();
    const alertRect = inlineAlert?.getBoundingClientRect();
    const h1Elements = Array.from(content.querySelectorAll("h1"));
    const text = content.innerText ?? "";
    return {
      text,
      aosClassHits,
      storybookDemoClassHits,
      dsOwnedClassCount,
      productLedFirstViewport: Boolean(content.querySelector("[data-owner-quality-first-viewport=\"product-led\"]")),
      primaryH1Count: h1Elements.length,
      primaryH1Text: h1Elements[0]?.textContent?.trim() ?? "",
      scaffoldPrimaryHits: scaffoldLabels.filter((label) => text.includes(label)),
      environmentBannerVisible: Boolean(environmentRect && environmentRect.width > 0 && environmentRect.height > 0),
      inlineAlertVisible: Boolean(alertRect && alertRect.width > 0 && alertRect.height > 0),
      bannerOverlap: Boolean(environmentRect && alertRect && alertRect.top < environmentRect.bottom && alertRect.bottom > environmentRect.top)
    };
  }, forbiddenScaffoldPrimaryLabels);
}

async function measureSideNavIconCenterDelta(page) {
  return page.locator("[data-side-nav-toggle]").evaluate((button) => {
    const icon = button.querySelector('[data-side-nav-icon="collapse"]')?.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const centerDelta = icon
      ? Math.abs((icon.left + icon.width / 2) - (buttonRect.left + buttonRect.width / 2))
      : Number.POSITIVE_INFINITY;
    return {
      buttonWidth: Number(buttonRect.width.toFixed(3)),
      buttonHeight: Number(buttonRect.height.toFixed(3)),
      iconWidth: icon ? Number(icon.width.toFixed(3)) : null,
      iconHeight: icon ? Number(icon.height.toFixed(3)) : null,
      centerDelta: Number(centerDelta.toFixed(3))
    };
  });
}

async function clickStableContentPoint(page) {
  const point = await page.evaluate(() => {
    const content = document.querySelector('[data-product-shell-region="content"]');
    const topBar = document.querySelector(".tcrn-top-bar");
    const contentRect = content?.getBoundingClientRect();
    const topBarRect = topBar?.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 24, Math.max(24, (contentRect?.left ?? 0) + 48));
    const yFloor = (topBarRect?.bottom ?? 0) + 96;
    const contentY = (contentRect?.top ?? 0) + 96;
    const y = Math.min(window.innerHeight - 24, Math.max(96, yFloor, contentY));
    return { x, y };
  });
  await page.mouse.click(point.x, point.y);
}

function loadPlaywrightChromium() {
  try {
    const require = createRequire(import.meta.url);
    const playwright = require("@playwright/test");
    return { chromium: playwright.chromium, source: "aos_dev_dependency" };
  } catch {
    const requireFromDesignSystem = createRequire(new URL("../../TCRN-Design-System/package.json", import.meta.url));
    const playwright = requireFromDesignSystem("@playwright/test");
    return { chromium: playwright.chromium, source: "sibling_design_system_dev_dependency" };
  }
}

function findLocalChromeExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? undefined;
}

function listRelativeFiles(rootUrl) {
  const rootPath = fileURLToPath(rootUrl);
  if (!existsSync(rootPath)) return [];
  const files = [];
  const visit = (dir, prefix = "") => {
    for (const entry of readdirSync(dir)) {
      const fullPath = `${dir}/${entry}`;
      const relative = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(fullPath).isDirectory()) {
        visit(fullPath, relative);
      } else {
        files.push(relative);
      }
    }
  };
  visit(rootPath);
  return files;
}

function capturePageHealth(page, consoleMessages, pageErrors, requestFailures) {
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) {
      consoleMessages.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    requestFailures.push({ url: request.url(), failure: request.failure()?.errorText ?? "unknown" });
  });
}
