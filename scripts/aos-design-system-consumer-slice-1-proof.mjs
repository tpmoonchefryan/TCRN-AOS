import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { startAosLocalServiceProof } from "../dist/apps/api/src/server.js";
import { aosDesignSystemConsumerBridge } from "../dist/apps/web/src/design-system-bridge.js";

const repoRoot = process.cwd();
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const evidenceDir = join(repoRoot, "evidence", "aos-design-system-consumer-slice-1-browser", sourceHead);
const summaryPath = join(evidenceDir, "browser-evidence-summary.json");
const markdownPath = join(repoRoot, "evidence", "aos-design-system-consumer-slice-1-proof.md");
const viewports = [
  { label: "desktop-1440x900", width: 1440, height: 900 },
  { label: "mobile-390x844", width: 390, height: 844 }
];
const rawVisibleForbidden = [
  "external_proof_required",
  "not_claimed",
  "release_proof_required",
  "owner_intent_required",
  "record_participant_position",
  "open_evidence_metadata"
];
const forbiddenPositiveClaims = [
  "product accepted",
  "final mvp accepted",
  "release ready",
  "deployment ready",
  "public ready",
  "dependency clean",
  "legal complete",
  "live dispatch enabled",
  "resource materialized"
];

await mkdir(evidenceDir, { recursive: true });

const designSystemRequire = createRequire(join(repoRoot, "..", "TCRN-Design-System", "package.json"));
let playwrightPath;
try {
  playwrightPath = designSystemRequire.resolve("@playwright/test");
} catch {
  throw new Error("design_system_playwright_tooling_unavailable");
}

const playwright = await import(pathToFileURL(playwrightPath).href);
const { chromium } = playwright.default ?? playwright;
const service = await startAosLocalServiceProof();
let browser;
let closed = false;

try {
  browser = await chromium.launch();
  const pageErrors = [];
  const consoleErrors = [];
  const viewportReadbacks = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(`${viewport.label}: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(`${viewport.label}: ${message.text()}`);
      }
    });
    await page.goto(`${service.url}/operations-cockpit.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const status = document.querySelector("[data-service-status]");
      return status?.textContent?.includes("service API read") || status?.textContent?.includes("service API read failed");
    }, { timeout: 5000 });
    const screenshotPath = join(evidenceDir, `${viewport.label}-operations-cockpit.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const screenshotBody = await readFile(screenshotPath);
    const readback = await page.evaluate(({ rawVisibleForbidden, forbiddenPositiveClaims }) => {
      const shell = document.querySelector("[data-surface='operations-cockpit']");
      const text = document.body.innerText;
      const lower = text.toLowerCase();
      const rootStyles = getComputedStyle(document.documentElement);
      const disabledButtons = Array.from(document.querySelectorAll("button:disabled")).map((button) => ({
        text: button.textContent?.trim() ?? "",
        title: button.getAttribute("title") ?? ""
      }));
      return {
        title: document.title,
        serviceBacked: shell?.getAttribute("data-service-backed"),
        designSystemConsumer: shell?.getAttribute("data-design-system-consumer"),
        tokenPackage: shell?.getAttribute("data-design-system-tokens"),
        copyStatePackage: shell?.getAttribute("data-design-system-copy-state"),
        designSystemSourceHead: shell?.getAttribute("data-design-system-source-head"),
        brandPrimaryToken: rootStyles.getPropertyValue("--tcrn-color-brand-primary").trim(),
        stateWarningToken: rootStyles.getPropertyValue("--tcrn-color-state-warning").trim(),
        serviceStatus: document.querySelector("[data-service-status]")?.textContent?.trim() ?? "",
        localCheckpoint: document.querySelector("[data-local-checkpoint]")?.textContent?.trim() ?? "",
        readbackFreshness: document.querySelector("[data-readback-freshness]")?.textContent?.trim() ?? "",
        workRows: document.querySelectorAll("[data-work-row]").length,
        detailTitle: document.querySelector("[data-drawer-title]")?.textContent?.trim() ?? "",
        rawVisibleCopyHits: rawVisibleForbidden.filter((phrase) => text.includes(phrase)),
        forbiddenPositiveClaimHits: forbiddenPositiveClaims.filter((phrase) => lower.includes(phrase)),
        disabledButtons,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        bodyLevelHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth,
        hasOwnerIntentReason: disabledButtons.some((button) => /owner-intent|owner intent/i.test(button.title)),
        hasUnavailableCopy: text.includes("Unavailable: live dispatch"),
        hasExternalProofCopy: text.includes("External proof required"),
        hasTokenCss: rootStyles.getPropertyValue("--tcrn-color-text-primary").trim().length > 0
      };
    }, { rawVisibleForbidden, forbiddenPositiveClaims });
    viewportReadbacks.push({
      ...viewport,
      ...readback,
      screenshot: {
        path: relative(repoRoot, screenshotPath),
        sha256: createHash("sha256").update(screenshotBody).digest("hex"),
        bytes: screenshotBody.byteLength
      }
    });
    await context.close();
  }

  const closeResult = await service.close();
  closed = closeResult.stopped && closeResult.runtimeReset;
  const ok = closed
    && viewportReadbacks.every((readback) => readback.serviceBacked === "true")
    && viewportReadbacks.every((readback) => readback.designSystemConsumer === aosDesignSystemConsumerBridge.adoptionPosture)
    && viewportReadbacks.every((readback) => readback.tokenPackage === aosDesignSystemConsumerBridge.tokenPackage)
    && viewportReadbacks.every((readback) => readback.copyStatePackage === aosDesignSystemConsumerBridge.copyStatePackage)
    && viewportReadbacks.every((readback) => readback.designSystemSourceHead === aosDesignSystemConsumerBridge.designSystemSourceHead)
    && viewportReadbacks.every((readback) => readback.workRows > 0)
    && viewportReadbacks.every((readback) => readback.rawVisibleCopyHits.length === 0)
    && viewportReadbacks.every((readback) => readback.forbiddenPositiveClaimHits.length === 0)
    && viewportReadbacks.every((readback) => readback.hasTokenCss)
    && viewportReadbacks.every((readback) => readback.hasUnavailableCopy)
    && viewportReadbacks.every((readback) => readback.hasExternalProofCopy)
    && pageErrors.length === 0
    && consoleErrors.length === 0;

  const summary = {
    ok,
    route: aosDesignSystemConsumerBridge.route,
    sourceHead,
    designSystemSourceHead: aosDesignSystemConsumerBridge.designSystemSourceHead,
    serviceLifecycle: {
      loopbackOnly: true,
      ephemeralPort: true,
      stopped: closed
    },
    designSystemConsumption: {
      adoptionPosture: aosDesignSystemConsumerBridge.adoptionPosture,
      tokenPackage: aosDesignSystemConsumerBridge.tokenPackage,
      copyStatePackage: aosDesignSystemConsumerBridge.copyStatePackage,
      uiReactPackage: aosDesignSystemConsumerBridge.uiReactPackage
    },
    viewportReadbacks,
    browserHealth: {
      pageErrors,
      consoleErrors
    },
    noOverclaim: {
      productAcceptanceReady: false,
      finalMvpAcceptanceReady: false,
      releasePublicationReady: false,
      packagePublication: false,
      designSystemMutation: false,
      liveDispatch: false,
      ownerIntentExecution: false
    }
  };

  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(markdownPath, markdownReceipt(summary));
  console.log(JSON.stringify({
    ok,
    route: summary.route,
    sourceHead,
    designSystemSourceHead: summary.designSystemSourceHead,
    serviceLifecycle: summary.serviceLifecycle,
    designSystemConsumption: summary.designSystemConsumption,
    viewportCount: viewportReadbacks.length,
    screenshots: viewportReadbacks.map((readback) => readback.screenshot),
    rawVisibleCopyHits: viewportReadbacks.flatMap((readback) => readback.rawVisibleCopyHits),
    forbiddenPositiveClaimHits: viewportReadbacks.flatMap((readback) => readback.forbiddenPositiveClaimHits),
    pageErrorCount: pageErrors.length,
    consoleErrorCount: consoleErrors.length,
    summaryPath: relative(repoRoot, summaryPath),
    markdownPath: relative(repoRoot, markdownPath)
  }, null, 2));

  if (!ok) {
    process.exit(1);
  }
} finally {
  if (browser) {
    await browser.close().catch(() => undefined);
  }
  if (!closed) {
    await service.close().catch(() => undefined);
  }
}

function markdownReceipt(summary) {
  const screenshotRows = summary.viewportReadbacks
    .map((readback) => `| ${readback.label} | \`${readback.screenshot.path}\` | \`${readback.screenshot.sha256}\` | ${readback.rawVisibleCopyHits.length} | ${readback.forbiddenPositiveClaimHits.length} |`)
    .join("\n");
  return `# AOS Design System Consumer Slice 1 Proof

Status: ${summary.ok ? "passed" : "failed"}.

Route: \`${summary.route}\`
AOS source head: \`${summary.sourceHead}\`
Design System source basis: \`${summary.designSystemSourceHead}\`

## Consumption Readback

- token package: \`${summary.designSystemConsumption.tokenPackage}\`
- copy-state package: \`${summary.designSystemConsumption.copyStatePackage}\`
- adoption posture: \`${summary.designSystemConsumption.adoptionPosture}\`
- ui-react posture: \`${summary.designSystemConsumption.uiReactPackage}\`
- service lifecycle: loopback-only, ephemeral, stopped=${summary.serviceLifecycle.stopped}

## Browser Evidence

| Viewport | Screenshot | SHA-256 | Raw visible copy hits | Forbidden claim hits |
| --- | --- | --- | ---: | ---: |
${screenshotRows}

## No-Overclaim Boundaries

No Design System source mutation, Storybook mutation, package publication, AOS/TMS product acceptance, final MVP acceptance, release/publication, Batch Push Gate, live dispatch, Owner Intent execution, registry/generated bridge mutation, or terminal-return ingestion is claimed by this receipt.
`;
}
