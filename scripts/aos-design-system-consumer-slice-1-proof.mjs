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
      const readDisabledReason = (element) => {
        const ariaDescription = (element.getAttribute("aria-describedby") ?? "")
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
          .filter(Boolean)
          .join(" ");
        const title = element.getAttribute("title")?.trim() ?? "";
        const dataDisabledReason = element.getAttribute("data-disabled-reason")?.trim() ?? "";
        const reason = [title, ariaDescription, dataDisabledReason].filter(Boolean).join(" | ");
        return { ariaDescription, dataDisabledReason, reason, title };
      };
      const inspectFullDocumentAccessibility = () => {
        const idElements = Array.from(document.querySelectorAll("[id]"));
        const idCounts = new Map();
        for (const element of idElements) {
          idCounts.set(element.id, (idCounts.get(element.id) ?? 0) + 1);
        }
        const duplicateIds = Array.from(idCounts.entries())
          .filter(([, count]) => count > 1)
          .map(([id, count]) => ({ id, count }));
        const ariaReferenceFailures = [];
        for (const element of Array.from(document.querySelectorAll("[aria-describedby], [aria-labelledby]"))) {
          for (const attribute of ["aria-describedby", "aria-labelledby"]) {
            const ids = (element.getAttribute(attribute) ?? "").split(/\s+/).filter(Boolean);
            for (const id of ids) {
              const targetCount = idCounts.get(id) ?? 0;
              if (targetCount !== 1) {
                ariaReferenceFailures.push({ tag: element.tagName.toLowerCase(), attribute, id, targetCount });
              }
            }
          }
        }
        const normalizeText = (value) => value.replace(/\s+/g, " ").trim();
        const disabledControlDescriptionFailures = [];
        const disabledControls = Array.from(document.querySelectorAll("button:disabled, [aria-disabled='true']"));
        for (const element of disabledControls) {
          const dataDisabledReason = element.getAttribute("data-disabled-reason")?.trim() ?? "";
          const title = element.getAttribute("title")?.trim() ?? "";
          const describedbyIds = (element.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
          const targetCounts = describedbyIds.map((id) => ({ id, targetCount: idCounts.get(id) ?? 0 }));
          const resolvedText = normalizeText(describedbyIds
            .map((id) => idElements.find((candidate) => candidate.id === id)?.textContent?.trim() ?? "")
            .filter(Boolean)
            .join(" "));
          const failures = [];
          if (!dataDisabledReason) failures.push("disabled_control_missing_data_disabled_reason");
          if (!title) failures.push("disabled_control_missing_title_reason");
          if (describedbyIds.length === 0) failures.push("disabled_control_missing_aria_describedby");
          if (targetCounts.some(({ targetCount }) => targetCount !== 1)) failures.push("disabled_control_aria_target_count_not_one");
          if (!resolvedText) failures.push("disabled_control_description_unresolved");
          if (resolvedText && dataDisabledReason && normalizeText(resolvedText) !== normalizeText(dataDisabledReason)) failures.push("disabled_control_description_mismatch");
          if (failures.length > 0) {
            disabledControlDescriptionFailures.push({
              tag: element.tagName.toLowerCase(),
              label: normalizeText(element.textContent ?? ""),
              dataDisabledReason,
              titleReason: title,
              ariaDescribedBy: describedbyIds,
              targetCounts,
              resolvedText,
              failures
            });
          }
        }
        return {
          ok: duplicateIds.length === 0
            && ariaReferenceFailures.length === 0
            && disabledControlDescriptionFailures.length === 0,
          idCount: idElements.length,
          duplicateIds,
          ariaReferenceFailures,
          disabledControlDescriptionFailures,
          disabledControlsCount: disabledControls.length,
          disabledControlsWithReasonCount: disabledControls.filter((element) => element.getAttribute("data-disabled-reason")?.trim()).length
        };
      };
      const fullDocumentAccessibilityReadback = inspectFullDocumentAccessibility();
      const disabledButtons = Array.from(document.querySelectorAll("button:disabled")).map((button) => {
        const disabledReason = readDisabledReason(button);
        return {
          text: button.textContent?.trim() ?? "",
          className: button.className,
          ...disabledReason
        };
      });
      const disabledNavItems = Array.from(document.querySelectorAll('[data-tcrn-component="NavItem"][aria-disabled="true"]')).map((item) => {
        const disabledReason = readDisabledReason(item);
        return {
          text: item.textContent?.trim() ?? "",
          className: item.className,
          describedbyResolved: Boolean(disabledReason.ariaDescription),
          href: item.getAttribute("href") ?? "",
          tabIndex: item.getAttribute("tabindex") ?? "",
          ...disabledReason
        };
      });
      const disabledButtonsMissingReason = disabledButtons.filter((button) => !button.dataDisabledReason || !button.ariaDescription || !button.title);
      const disabledNavItemsMissingReason = disabledNavItems.filter((item) => !item.reason || !item.describedbyResolved);
      const disabledNavButtons = disabledButtons.filter((button) => String(button.className).includes("nav-row"));
      const srOnlyHiddenReadbacks = Array.from(document.querySelectorAll("button:disabled .tcrn-sr-only")).map((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const hidden = style.position === "absolute"
          && style.overflow === "hidden"
          && rect.width <= 1
          && rect.height <= 1
          && style.whiteSpace === "nowrap";
        return {
          text: element.textContent?.trim() ?? "",
          hidden,
          position: style.position,
          overflow: style.overflow,
          width: rect.width,
          height: rect.height,
          whiteSpace: style.whiteSpace
        };
      });
      const disabledReasonSrOnlyLeakage = srOnlyHiddenReadbacks.filter((readback) => !readback.hidden);
      const columnsHeldButton = Array.from(document.querySelectorAll("button:disabled"))
        .find((button) => button.textContent?.includes("Columns held"));
      const columnsHeldVisibleText = columnsHeldButton
        ? Array.from(columnsHeldButton.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
        : "";
      const columnsHeldReasonVisibleLeak = /Column customization is not implemented/i.test(columnsHeldVisibleText);
      const workIndexRow = document.querySelector("[data-work-row]");
      const workIndexHead = document.querySelector("[data-work-table] .tcrn-table-shell__head");
      const workIndexCells = Array.from(document.querySelectorAll("[data-work-row] .tcrn-table-shell__cell"));
      const mobileApplies = window.innerWidth <= 520;
      const workIndexMobileReadability = {
        applies: mobileApplies,
        ok: !mobileApplies || (
          workIndexRow !== null
          && getComputedStyle(workIndexRow).gridTemplateColumns.split(" ").length === 1
          && getComputedStyle(workIndexRow).minWidth === "0px"
          && (!workIndexHead || getComputedStyle(workIndexHead).display === "none")
          && workIndexCells.length >= 3
          && workIndexCells.every((cell) => getComputedStyle(cell).whiteSpace === "normal")
          && workIndexCells.every((cell) => getComputedStyle(cell, "::before").content !== "none")
        ),
        rowGridTemplateColumns: workIndexRow ? getComputedStyle(workIndexRow).gridTemplateColumns : "",
        rowMinWidth: workIndexRow ? getComputedStyle(workIndexRow).minWidth : "",
        headDisplay: workIndexHead ? getComputedStyle(workIndexHead).display : "",
        cellCount: workIndexCells.length,
        cellWhiteSpace: workIndexCells.map((cell) => getComputedStyle(cell).whiteSpace),
        cellBeforeContent: workIndexCells.map((cell) => getComputedStyle(cell, "::before").content)
      };
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
        disabledButtonsMissingReason,
        disabledReasonSrOnlyLeakage,
        columnsHeldVisibleText,
        columnsHeldReasonVisibleLeak,
        workIndexMobileReadability,
        fullDocumentAccessibilityReadback,
        disabledNavItems,
        disabledNavItemsMissingReason,
        disabledNavButtonCount: disabledNavButtons.length,
        disabledNavItemCount: disabledNavItems.length,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        bodyLevelHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth,
        hasOwnerIntentReason: disabledButtons.some((button) => /owner-intent|owner intent/i.test(button.reason)),
        hasSidebarUnavailableReasons: disabledNavItems.length >= 9
          && disabledNavItemsMissingReason.length === 0
          && disabledNavItems.every((item) => item.href === "" && item.tabIndex === "-1" && item.reason.includes("later routed AOS slice") && item.text.includes("package-runtime pilot keeps Cockpit available only")),
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
    && viewportReadbacks.every((readback) => readback.disabledButtonsMissingReason.length === 0)
    && viewportReadbacks.every((readback) => readback.disabledReasonSrOnlyLeakage.length === 0)
    && viewportReadbacks.every((readback) => readback.columnsHeldReasonVisibleLeak === false)
    && viewportReadbacks.every((readback) => !readback.workIndexMobileReadability.applies || readback.workIndexMobileReadability.ok)
    && viewportReadbacks.every((readback) => readback.fullDocumentAccessibilityReadback.ok)
    && viewportReadbacks.every((readback) => readback.hasSidebarUnavailableReasons)
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
    disabledButtonsMissingReason: viewportReadbacks.flatMap((readback) => readback.disabledButtonsMissingReason),
    disabledReasonSrOnlyLeakage: viewportReadbacks.flatMap((readback) => readback.disabledReasonSrOnlyLeakage),
    fullDocumentAccessibilityFailures: viewportReadbacks.flatMap((readback) => [
      ...readback.fullDocumentAccessibilityReadback.duplicateIds,
      ...readback.fullDocumentAccessibilityReadback.ariaReferenceFailures,
      ...readback.fullDocumentAccessibilityReadback.disabledControlDescriptionFailures
    ]),
    columnsHeldReasonVisibleLeakCount: viewportReadbacks.filter((readback) => readback.columnsHeldReasonVisibleLeak).length,
    mobileWorkIndexReadabilityFailures: viewportReadbacks.filter((readback) => readback.workIndexMobileReadability.applies && !readback.workIndexMobileReadability.ok).length,
    hasSidebarUnavailableReasons: viewportReadbacks.every((readback) => readback.hasSidebarUnavailableReasons),
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
    .map((readback) => `| ${readback.label} | \`${readback.screenshot.path}\` | \`${readback.screenshot.sha256}\` | ${readback.rawVisibleCopyHits.length} | ${readback.forbiddenPositiveClaimHits.length} | ${readback.disabledButtonsMissingReason.length} |`)
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

| Viewport | Screenshot | SHA-256 | Raw visible copy hits | Forbidden claim hits | Disabled controls missing reason |
| --- | --- | --- | ---: | ---: | ---: |
${screenshotRows}

## No-Overclaim Boundaries

No Design System source mutation, Storybook mutation, package publication, AOS/TMS product acceptance, final MVP acceptance, release/publication, Batch Push Gate, live dispatch, Owner Intent execution, registry/generated bridge mutation, or terminal-return ingestion is claimed by this receipt.
`;
}
