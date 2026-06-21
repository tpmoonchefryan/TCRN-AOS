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
const route = "route_tcrn_aos_design_system_frontend_rebuild_slice_2_service_read_model_stabilization_implementation";
const evidenceDir = join(repoRoot, "evidence", "aos-design-system-consumer-slice-2-browser", sourceHead);
const summaryPath = join(evidenceDir, "browser-service-read-model-summary.json");
const markdownPath = join(repoRoot, "evidence", "aos-design-system-consumer-slice-2-proof.md");
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
const staleDisabledReasonPatterns = [
  "slice 1 checkpoint",
  "slice 1-only",
  "slice one checkpoint"
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
  const apiPayload = await fetch(`${service.url}/api/cockpit`).then((response) => response.json());
  const selectedStoryId = apiPayload.serviceReadModel?.surfaces?.workIndex?.selectedStoryId;
  const selectedPayload = await fetch(`${service.url}/api/cockpit?selectedType=story&selectedId=${encodeURIComponent(selectedStoryId ?? "")}`).then((response) => response.json());
  const apiContract = summarizeApiContract(apiPayload, selectedPayload);

  browser = await chromium.launch();
  const pageErrors = [];
  const consoleErrors = [];
  const requestFailures = [];
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
    page.on("requestfailed", (request) => {
      requestFailures.push(`${viewport.label}: ${request.url()} ${request.failure()?.errorText ?? "request_failed"}`);
    });
    await page.goto(`${service.url}/operations-cockpit.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction((expectedSchema) => {
      const shell = document.querySelector("[data-surface='operations-cockpit']");
      const status = document.querySelector("[data-service-status]");
      return shell?.getAttribute("data-service-model-schema") === expectedSchema
        && shell?.getAttribute("data-service-read-model-source") === "service_api_read"
        && status?.textContent?.includes("service API read");
    }, apiPayload.serviceReadModel.schemaVersion, { timeout: 5000 });
    await page.click("[data-work-row]");
    await page.waitForFunction((expectedDom) => {
      const drawer = document.querySelector("[data-region='detail-drawer']");
      return drawer?.getAttribute("data-service-detail-id") === expectedDom.selectedStoryId
        && drawer?.getAttribute("data-service-detail-type") === expectedDom.detailType
        && !drawer?.classList.contains("closed");
    }, apiContract.expectedDom, { timeout: 5000 });
    const screenshotPath = join(evidenceDir, `${viewport.label}-service-read-model.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const screenshotBody = await readFile(screenshotPath);
    const readback = await page.evaluate(({ rawVisibleForbidden, forbiddenPositiveClaims, staleDisabledReasonPatterns, expected }) => {
      const shell = document.querySelector("[data-surface='operations-cockpit']");
      const text = document.body.innerText;
      const lower = text.toLowerCase();
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
        const ariaDescription = (button.getAttribute("aria-describedby") ?? "")
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
          .filter(Boolean)
          .join(" ");
        const title = button.getAttribute("title")?.trim() ?? "";
        const dataDisabledReason = button.getAttribute("data-disabled-reason")?.trim() ?? "";
        const reason = [title, ariaDescription, dataDisabledReason].filter(Boolean).join(" | ");
        return {
          text: button.textContent?.trim() ?? "",
          className: button.className,
          title,
          ariaDescription,
          dataDisabledReason,
          reason
        };
      });
      const disabledButtonsMissingReason = disabledButtons.filter((button) => !button.dataDisabledReason || !button.ariaDescription || !button.title);
      const disabledButtonsWithStaleReason = disabledButtons.filter((button) => {
        const reason = `${button.reason} ${button.text}`.toLowerCase();
        return staleDisabledReasonPatterns.some((phrase) => reason.includes(phrase));
      });
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
      const attrs = {
        schema: shell?.getAttribute("data-service-model-schema") ?? "",
        source: shell?.getAttribute("data-service-read-model-source") ?? "",
        workRowCount: Number(shell?.getAttribute("data-service-work-row-count") ?? "0"),
        selectedStoryId: shell?.getAttribute("data-service-selected-story-id") ?? "",
        detailId: shell?.getAttribute("data-service-detail-id") ?? "",
        detailType: shell?.getAttribute("data-service-detail-type") ?? "",
        gateCount: Number(shell?.getAttribute("data-service-gate-count") ?? "0"),
        evidenceReadbackCount: Number(shell?.getAttribute("data-service-evidence-readback-count") ?? "0"),
        runtimeDataCommitted: shell?.getAttribute("data-service-runtime-data-committed") ?? ""
      };
      const detailDrawer = document.querySelector("[data-region='detail-drawer']");
      const detailDrawerHtml = detailDrawer?.outerHTML ?? "";
      const detailPackageComponents = Array.from(new Set(
        Array.from(detailDrawer?.querySelectorAll("[data-package-runtime-component]") ?? [])
          .map((node) => node.getAttribute("data-package-runtime-component"))
          .filter(Boolean)
      )).sort();
      const detailRequiredComponents = [
        "Button",
        "DetailDrawer",
        "Heading",
        "KeyValueList",
        "StatusBadge",
        "Surface",
        "Text"
      ];
      if (detailDrawer?.getAttribute("data-package-runtime-component")) {
        detailPackageComponents.push(detailDrawer.getAttribute("data-package-runtime-component"));
      }
      const normalizedDetailComponents = Array.from(new Set(detailPackageComponents)).sort();
      const detailFailures = [];
      const missingDetailComponents = detailRequiredComponents.filter((component) => !normalizedDetailComponents.includes(component));
      if (!detailDrawer) detailFailures.push("detail_drawer_missing");
      if (detailDrawer?.getAttribute("data-package-runtime-component") !== "DetailDrawer") detailFailures.push("detail_drawer_missing_runtime_marker");
      if (detailDrawer?.getAttribute("data-package-runtime-source") !== "@tcrn/ui-react") detailFailures.push("detail_drawer_missing_package_source");
      if (detailDrawer?.getAttribute("data-package-runtime-surface") !== "operations-cockpit-detail-drawer") detailFailures.push("detail_drawer_missing_runtime_surface");
      if (detailDrawer?.getAttribute("data-service-detail-id") !== expected.selectedStoryId) detailFailures.push("detail_drawer_selected_story_mismatch");
      if (detailDrawer?.getAttribute("data-service-detail-type") !== expected.detailType) detailFailures.push("detail_drawer_detail_type_mismatch");
      if (missingDetailComponents.length > 0) detailFailures.push("detail_drawer_required_package_components_missing");
      if (!detailDrawer?.querySelector("[data-detail-list]")) detailFailures.push("detail_drawer_key_value_list_missing");
      if (!detailDrawer?.querySelector("[data-drawer-title]")) detailFailures.push("detail_drawer_title_missing");
      if ((detailDrawer?.querySelectorAll("dt").length ?? 0) < 8) detailFailures.push("detail_drawer_key_value_rows_missing");
      if (!detailDrawerHtml.includes("Functional contract readback only; no visual, release, product, dependency-clean, or live-dispatch acceptance.")) {
        detailFailures.push("detail_drawer_no_overclaim_copy_missing");
      }
      const closeButton = detailDrawer?.querySelector("[data-close-detail]");
      const detailClosedBeforeClose = detailDrawer?.classList.contains("closed") ?? true;
      closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const detailClosedAfterClose = detailDrawer?.classList.contains("closed") ?? false;
      if (!closeButton) detailFailures.push("detail_drawer_close_button_missing");
      if (detailClosedBeforeClose) detailFailures.push("detail_drawer_unexpectedly_closed_after_row_click");
      if (!detailClosedAfterClose) detailFailures.push("detail_drawer_close_button_did_not_close");
      const detailDrawerRuntimeReadback = {
        ok: detailFailures.length === 0,
        packageRuntimeComponents: normalizedDetailComponents,
        requiredComponents: detailRequiredComponents,
        missingComponents: missingDetailComponents,
        selectedDetailId: detailDrawer?.getAttribute("data-service-detail-id") ?? "",
        selectedDetailType: detailDrawer?.getAttribute("data-service-detail-type") ?? "",
        selectedStoryId: detailDrawer?.getAttribute("data-selected-story-id") ?? "",
        keyValueRowCount: detailDrawer?.querySelectorAll("dt").length ?? 0,
        closeButtonPresent: closeButton !== null,
        closedBeforeClose: detailClosedBeforeClose,
        closedAfterClose: detailClosedAfterClose,
        failures: detailFailures
      };
      const inspectRuntimeRegion = (region, expectedRootComponent, requiredComponents) => {
        const node = document.querySelector(`[data-region='${region}']`);
        const components = Array.from(new Set(
          Array.from(node?.querySelectorAll("[data-package-runtime-component]") ?? [])
            .map((componentNode) => componentNode.getAttribute("data-package-runtime-component"))
            .filter(Boolean)
        )).sort();
        if (node?.getAttribute("data-package-runtime-component")) {
          components.push(node.getAttribute("data-package-runtime-component"));
        }
        const normalizedComponents = Array.from(new Set(components)).sort();
        const missingComponents = requiredComponents.filter((component) => !normalizedComponents.includes(component));
        const failures = [];
        if (!node) failures.push(`${region}_missing`);
        if (node?.getAttribute("data-package-runtime-component") !== expectedRootComponent) failures.push(`${region}_missing_runtime_marker`);
        if (node?.getAttribute("data-package-runtime-source") !== "@tcrn/ui-react") failures.push(`${region}_missing_package_source`);
        if (node?.getAttribute("data-package-runtime-surface") !== "operations-cockpit-gate-readback-cards") failures.push(`${region}_missing_runtime_surface`);
        if (missingComponents.length > 0) failures.push(`${region}_required_package_components_missing`);
        const disabledButtons = Array.from(node?.querySelectorAll("button:disabled") ?? []);
        if (disabledButtons.length === 0) failures.push(`${region}_disabled_action_missing`);
        for (const button of disabledButtons) {
          if (!button.getAttribute("title")?.trim()) failures.push(`${region}_disabled_button_missing_title`);
          if (!button.getAttribute("data-disabled-reason")?.trim()) failures.push(`${region}_disabled_button_missing_data_disabled_reason`);
          if (!button.getAttribute("aria-describedby")?.trim()) failures.push(`${region}_disabled_button_missing_aria_describedby`);
        }
        return {
          ok: failures.length === 0,
          present: node !== null,
          rootComponent: node?.getAttribute("data-package-runtime-component") ?? "",
          packageRuntimeComponents: normalizedComponents,
          requiredComponents,
          missingComponents,
          disabledButtonCount: disabledButtons.length,
          failures
        };
      };
      const gateCardRuntimeReadback = inspectRuntimeRegion("blocker-gate-card", "GateReadinessPanel", [
        "Badge",
        "Button",
        "GateReadinessPanel",
        "Heading",
        "StateView",
        "StatusBadge",
        "Text"
      ]);
      const readbackCardRuntimeReadback = inspectRuntimeRegion("readback-posture-card", "ReadbackPanel", [
        "Button",
        "Heading",
        "KeyValueList",
        "ReadbackPanel"
      ]);
      const gateReadbackCardsRuntimeReadback = {
        ok: gateCardRuntimeReadback.ok && readbackCardRuntimeReadback.ok,
        surface: "operations-cockpit-gate-readback-cards",
        gateCardRuntimeReadback,
        readbackCardRuntimeReadback,
        failures: [
          ...gateCardRuntimeReadback.failures,
          ...readbackCardRuntimeReadback.failures
        ]
      };
      const renderedRowCount = document.querySelectorAll("[data-work-row]").length;
      const domMatchesApi = attrs.schema === expected.schemaVersion
        && attrs.source === "service_api_read"
        && attrs.workRowCount === expected.workRowCount
        && renderedRowCount === expected.workRowCount
        && attrs.selectedStoryId === expected.selectedStoryId
        && attrs.detailId === expected.detailId
        && attrs.detailType === expected.detailType
        && attrs.gateCount === expected.gateCount
        && attrs.evidenceReadbackCount === expected.evidenceReadbackCount
        && attrs.runtimeDataCommitted === "false";
      return {
        title: document.title,
        serviceBacked: shell?.getAttribute("data-service-backed"),
        designSystemConsumer: shell?.getAttribute("data-design-system-consumer"),
        tokenPackage: shell?.getAttribute("data-design-system-tokens"),
        copyStatePackage: shell?.getAttribute("data-design-system-copy-state"),
        serviceStatus: document.querySelector("[data-service-status]")?.textContent?.trim() ?? "",
        serviceModelBadge: document.querySelector("[data-service-model-readback]")?.textContent?.trim() ?? "",
        attrs,
        renderedRowCount,
        domMatchesApi,
        rawVisibleCopyHits: rawVisibleForbidden.filter((phrase) => text.includes(phrase)),
        forbiddenPositiveClaimHits: forbiddenPositiveClaims.filter((phrase) => lower.includes(phrase)),
        disabledButtonsMissingReason,
        disabledButtonsWithStaleReason,
        disabledReasonSrOnlyLeakage,
        columnsHeldVisibleText,
        columnsHeldReasonVisibleLeak,
        workIndexMobileReadability,
        fullDocumentAccessibilityReadback,
        detailDrawerRuntimeReadback,
        gateReadbackCardsRuntimeReadback,
        bodyLevelHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth,
        viewportWidth: window.innerWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        hasUnavailableCopy: text.includes("Unavailable: live dispatch"),
        hasHeldRouteCopy: text.includes("Held for later route")
          || text.includes("package-runtime pilot keeps Cockpit available only")
          || text.includes("held for a later routed AOS slice")
      };
    }, { rawVisibleForbidden, forbiddenPositiveClaims, staleDisabledReasonPatterns, expected: apiContract.expectedDom });
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
    && apiContract.ok
    && viewportReadbacks.every((readback) => readback.serviceBacked === "true")
    && viewportReadbacks.every((readback) => readback.designSystemConsumer === aosDesignSystemConsumerBridge.adoptionPosture)
    && viewportReadbacks.every((readback) => readback.tokenPackage === aosDesignSystemConsumerBridge.tokenPackage)
    && viewportReadbacks.every((readback) => readback.copyStatePackage === aosDesignSystemConsumerBridge.copyStatePackage)
    && viewportReadbacks.every((readback) => readback.domMatchesApi)
    && viewportReadbacks.every((readback) => readback.rawVisibleCopyHits.length === 0)
    && viewportReadbacks.every((readback) => readback.forbiddenPositiveClaimHits.length === 0)
    && viewportReadbacks.every((readback) => readback.disabledButtonsMissingReason.length === 0)
    && viewportReadbacks.every((readback) => readback.disabledButtonsWithStaleReason.length === 0)
    && viewportReadbacks.every((readback) => readback.disabledReasonSrOnlyLeakage.length === 0)
    && viewportReadbacks.every((readback) => readback.columnsHeldReasonVisibleLeak === false)
    && viewportReadbacks.every((readback) => !readback.workIndexMobileReadability.applies || readback.workIndexMobileReadability.ok)
    && viewportReadbacks.every((readback) => readback.fullDocumentAccessibilityReadback.ok)
    && viewportReadbacks.every((readback) => readback.detailDrawerRuntimeReadback.ok)
    && viewportReadbacks.every((readback) => readback.gateReadbackCardsRuntimeReadback.ok)
    && viewportReadbacks.every((readback) => readback.bodyLevelHorizontalOverflow === false)
    && viewportReadbacks.every((readback) => readback.hasUnavailableCopy)
    && viewportReadbacks.every((readback) => readback.hasHeldRouteCopy)
    && pageErrors.length === 0
    && consoleErrors.length === 0
    && requestFailures.length === 0;

  const summary = {
    ok,
    route,
    sourceHead,
    designSystemSourceHead: aosDesignSystemConsumerBridge.designSystemSourceHead,
    serviceLifecycle: {
      loopbackOnly: true,
      ephemeralPort: true,
      stopped: closed
    },
    apiContract,
    designSystemConsumption: {
      adoptionPosture: aosDesignSystemConsumerBridge.adoptionPosture,
      tokenPackage: aosDesignSystemConsumerBridge.tokenPackage,
      copyStatePackage: aosDesignSystemConsumerBridge.copyStatePackage,
      uiReactPackage: aosDesignSystemConsumerBridge.uiReactPackage
    },
    viewportReadbacks,
    browserHealth: {
      pageErrors,
      consoleErrors,
      requestFailures
    },
    noOverclaim: {
      productAcceptanceReady: false,
      finalMvpAcceptanceReady: false,
      releasePublicationReady: false,
      batchPushGate: false,
      packagePublication: false,
      designSystemMutation: false,
      broadUiReactMigration: false,
      liveDispatch: false,
      ownerIntentExecution: false
    }
  };

  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(markdownPath, markdownReceipt(summary));
  console.log(JSON.stringify({
    ok,
    route,
    sourceHead,
    designSystemSourceHead: summary.designSystemSourceHead,
    serviceLifecycle: summary.serviceLifecycle,
    apiContract: {
      ok: apiContract.ok,
      schemaVersion: apiContract.schemaVersion,
      workRowCount: apiContract.expectedDom.workRowCount,
      selectedStoryId: apiContract.expectedDom.selectedStoryId,
      gateCount: apiContract.expectedDom.gateCount,
      productAcceptance: apiContract.productAcceptance,
      finalMvpAcceptance: apiContract.finalMvpAcceptance
    },
    viewportCount: viewportReadbacks.length,
    screenshots: viewportReadbacks.map((readback) => readback.screenshot),
    domMismatchCount: viewportReadbacks.filter((readback) => !readback.domMatchesApi).length,
    rawVisibleCopyHits: viewportReadbacks.flatMap((readback) => readback.rawVisibleCopyHits),
    forbiddenPositiveClaimHits: viewportReadbacks.flatMap((readback) => readback.forbiddenPositiveClaimHits),
    disabledButtonsMissingReason: viewportReadbacks.flatMap((readback) => readback.disabledButtonsMissingReason),
    disabledButtonsWithStaleReason: viewportReadbacks.flatMap((readback) => readback.disabledButtonsWithStaleReason),
    disabledReasonSrOnlyLeakage: viewportReadbacks.flatMap((readback) => readback.disabledReasonSrOnlyLeakage),
    fullDocumentAccessibilityFailures: viewportReadbacks.flatMap((readback) => [
      ...readback.fullDocumentAccessibilityReadback.duplicateIds,
      ...readback.fullDocumentAccessibilityReadback.ariaReferenceFailures,
      ...readback.fullDocumentAccessibilityReadback.disabledControlDescriptionFailures
    ]),
    columnsHeldReasonVisibleLeakCount: viewportReadbacks.filter((readback) => readback.columnsHeldReasonVisibleLeak).length,
    mobileWorkIndexReadabilityFailures: viewportReadbacks.filter((readback) => readback.workIndexMobileReadability.applies && !readback.workIndexMobileReadability.ok).length,
    detailDrawerRuntimeFailures: viewportReadbacks.flatMap((readback) => readback.detailDrawerRuntimeReadback.failures),
    gateReadbackCardsRuntimeFailures: viewportReadbacks.flatMap((readback) => readback.gateReadbackCardsRuntimeReadback.failures),
    bodyLevelHorizontalOverflowCount: viewportReadbacks.filter((readback) => readback.bodyLevelHorizontalOverflow).length,
    pageErrorCount: pageErrors.length,
    consoleErrorCount: consoleErrors.length,
    requestFailureCount: requestFailures.length,
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

function summarizeApiContract(apiPayload, selectedPayload) {
  const serviceReadModel = apiPayload.serviceReadModel;
  const selectedReadModel = selectedPayload.serviceReadModel;
  const expectedDom = {
    schemaVersion: serviceReadModel?.schemaVersion ?? "",
    workRowCount: serviceReadModel?.surfaces?.workIndex?.rowCount ?? 0,
    selectedStoryId: serviceReadModel?.surfaces?.workIndex?.selectedStoryId ?? "",
    detailId: serviceReadModel?.surfaces?.detail?.selectedId ?? "",
    detailType: serviceReadModel?.surfaces?.detail?.selectedType ?? "",
    gateCount: (serviceReadModel?.surfaces?.gate?.roleGateCount ?? 0) + (serviceReadModel?.surfaces?.gate?.ownerIntentGateCount ?? 0),
    evidenceReadbackCount: serviceReadModel?.surfaces?.readback?.evidenceReadbackCount ?? 0
  };
  const ok = apiPayload.ok === true
    && apiPayload.serviceBacked === true
    && serviceReadModel?.schemaVersion === "aos.cockpit.service_read_model.v1"
    && serviceReadModel?.slice === "slice_2_service_read_model_stabilization"
    && serviceReadModel?.source === "service_api_read"
    && expectedDom.workRowCount === apiPayload.model?.workstreams?.flatMap((group) => group.rows)?.length
    && expectedDom.selectedStoryId === apiPayload.model?.detailPanel?.selectedId
    && selectedReadModel?.surfaces?.detail?.selectedId === expectedDom.selectedStoryId
    && serviceReadModel?.surfaces?.gate?.autoExecutableCount === 0
    && serviceReadModel?.surfaces?.readback?.productAcceptance === false
    && serviceReadModel?.surfaces?.readback?.finalMvpAcceptance === false
    && serviceReadModel?.noClaims?.broadUiReactMigration === false
    && apiPayload.boundaries?.productAcceptance === false
    && apiPayload.boundaries?.finalMvpAcceptance === false;
  return {
    ok,
    schemaVersion: serviceReadModel?.schemaVersion ?? "",
    expectedDom,
    selectedDetailRoundTrip: selectedReadModel?.surfaces?.detail?.selectedId === expectedDom.selectedStoryId,
    productAcceptance: serviceReadModel?.surfaces?.readback?.productAcceptance,
    finalMvpAcceptance: serviceReadModel?.surfaces?.readback?.finalMvpAcceptance,
    broadUiReactMigration: serviceReadModel?.noClaims?.broadUiReactMigration,
    runtimeDataCommittedToGit: serviceReadModel?.surfaces?.readback?.runtimeDataCommittedToGit
  };
}

function markdownReceipt(summary) {
  const screenshotRows = summary.viewportReadbacks
    .map((readback) => `| ${readback.label} | \`${readback.screenshot.path}\` | \`${readback.screenshot.sha256}\` | ${readback.domMatchesApi ? "yes" : "no"} | ${readback.detailDrawerRuntimeReadback.ok ? "yes" : "no"} | ${readback.gateReadbackCardsRuntimeReadback.ok ? "yes" : "no"} | ${readback.rawVisibleCopyHits.length} | ${readback.forbiddenPositiveClaimHits.length} | ${readback.disabledButtonsMissingReason.length} | ${readback.disabledButtonsWithStaleReason.length} | ${readback.bodyLevelHorizontalOverflow ? "yes" : "no"} |`)
    .join("\n");
  return `# AOS Design System Consumer Slice 2 Service Read-Model Proof

Status: ${summary.ok ? "passed" : "failed"}.

Route: \`${summary.route}\`
AOS source head: \`${summary.sourceHead}\`
Design System source basis: \`${summary.designSystemSourceHead}\`

## Service Contract Readback

- schema: \`${summary.apiContract.schemaVersion}\`
- work rows: ${summary.apiContract.expectedDom.workRowCount}
- selected story: \`${summary.apiContract.expectedDom.selectedStoryId}\`
- gate count: ${summary.apiContract.expectedDom.gateCount}
- selected detail round trip: ${summary.apiContract.selectedDetailRoundTrip}
- product acceptance: ${summary.apiContract.productAcceptance}
- final MVP acceptance: ${summary.apiContract.finalMvpAcceptance}
- broad ui-react migration: ${summary.apiContract.broadUiReactMigration}
- runtime data committed to Git: ${summary.apiContract.runtimeDataCommittedToGit}

## Consumption Readback

- token package: \`${summary.designSystemConsumption.tokenPackage}\`
- copy-state package: \`${summary.designSystemConsumption.copyStatePackage}\`
- adoption posture: \`${summary.designSystemConsumption.adoptionPosture}\`
- ui-react posture: \`${summary.designSystemConsumption.uiReactPackage}\`
- service lifecycle: loopback-only, ephemeral, stopped=${summary.serviceLifecycle.stopped}

## Browser Evidence

| Viewport | Screenshot | SHA-256 | DOM matches API | Detail drawer runtime ok | Gate/readback card runtime ok | Raw visible copy hits | Forbidden claim hits | Disabled controls missing reason | Stale disabled reason hits | Body overflow |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
${screenshotRows}

## No-Overclaim Boundaries

No Design System source mutation, Storybook mutation, package publication, AOS/TMS product acceptance, final MVP acceptance, release/publication, Batch Push Gate, broad ui-react migration, live dispatch, Owner Intent execution, registry/generated bridge mutation, or terminal-return ingestion is claimed by this receipt.
`;
}
