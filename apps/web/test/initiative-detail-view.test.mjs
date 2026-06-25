import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitiativeDetailModel,
  forbiddenInitiativeDetailVisibleCopy,
  initiativeDetailDsStandardIds,
  initiativeDetailStorybookIds,
  renderInitiativeDetailHtml,
  requiredInitiativeDetailSelectors
} from "../../../dist/apps/web/src/initiative-detail-view.js";

test("Initiative Detail model advances the ticket drill-through slice without acceptance claims", () => {
  const model = createInitiativeDetailModel();

  assert.equal(model.context.projectId, "TCRN-AOS");
  assert.equal(model.context.sourceSchema, "aos.cockpit.service_read_model.v1");
  assert.equal(model.context.sourceMode, "local_service_preview");
  assert.equal(model.context.runtimeDataCommitted, false);
  assert.equal(model.context.productAcceptance, false);
  assert.equal(model.context.finalMvpAcceptance, false);
  assert.equal(model.context.releasePublication, false);
  assert.equal(model.context.ownerIntentExecution, false);
  assert.equal(model.context.liveDispatch, false);
  assert.equal(model.context.parentGoalCompletion, false);
  assert.equal(model.targetSet.surfaceId, "ticket-drillthrough");
  assert.ok(model.ticket.storyId);
  assert.ok(model.ticket.gateCount >= 0);
  assert.ok(model.links.length > 0);
  assert.deepEqual(initiativeDetailDsStandardIds, ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"]);
  assert.deepEqual(initiativeDetailStorybookIds, [
    "tcrn-design-system-patterns--aos-product-design-target-set-standard",
    "tcrn-design-system-patterns--aos-operations-cockpit-standard"
  ]);
});

test("Initiative Detail static HTML exposes the served ticket drill-through surface", () => {
  const html = renderInitiativeDetailHtml();

  for (const selector of requiredInitiativeDetailSelectors) {
    const region = selector.match(/data-region='([^']+)'/)?.[1];
    const surface = selector.match(/data-surface='([^']+)'/)?.[1];
    if (region) assert.ok(html.includes(`data-region="${region}"`), `production HTML includes ${selector}`);
    if (surface) assert.ok(html.includes(`data-surface="${surface}"`), `production HTML includes ${selector}`);
  }
  assert.match(html, /data-ds-standard-ids="ds-aos-target-set-v1 ds-aos-operations-cockpit-v1"/);
  assert.match(html, /data-product-acceptance="false"/);
  assert.match(html, /data-parent-goal-completion="false"/);
  assert.match(html, />Initiative Detail</);
  assert.match(html, />Ticket Drill-through</);
  assert.match(html, />Selected Ticket</);
  assert.match(html, />Linked Records</);
  assert.match(html, />Activity Notes</);
  assert.doesNotMatch(productVisibleAndA11yText(html), productVisibleInternalTermsPattern);
});

test("Initiative Detail renders package-backed public Design System components", () => {
  const html = renderInitiativeDetailHtml();
  const requiredPackageComponents = [
    "Surface",
    "SideNav",
    "NavGroup",
    "NavItem",
    "LinkButton",
    "TopBar",
    "Select",
    "Button",
    "Badge",
    "StatusBadge",
    "EvidenceStrip",
    "ReadbackPanel",
    "Text",
    "Heading",
    "KeyValueList",
    "TableShell",
    "DetailDrawer"
  ];

  for (const component of requiredPackageComponents) {
    assert.match(html, new RegExp(`data-package-runtime-component="${component}"`), `${component} is package-rendered`);
  }

  const markerOnlyClaims = Array.from(html.matchAll(/<[^>]+data-tcrn-component="([^"]+)"[^>]*>/g))
    .filter((match) => !match[0].includes("data-package-runtime-component=") && !match[0].includes("data-package-runtime-subcomponent="))
    .map((match) => match[1]);
  assert.deepEqual(markerOnlyClaims, []);
});

test("Initiative Detail visible copy avoids internal workflow vocabulary", () => {
  const html = renderInitiativeDetailHtml();
  const visibleText = productVisibleAndA11yText(html).toLowerCase();
  const hits = forbiddenInitiativeDetailVisibleCopy.filter((phrase) => visibleText.includes(phrase));

  assert.deepEqual(hits, []);
});

test("Initiative Detail disabled controls carry product-facing reasons", () => {
  const html = renderInitiativeDetailHtml();
  const disabledControls = disabledControlReadbacks(html);

  assert.ok(disabledControls.length >= 5);
  for (const control of disabledControls) {
    assert.ok(control.reason, `disabled control has data-disabled-reason: ${control.attributes}`);
    assert.match(control.attributes, /\btitle="[^"]+"/, `disabled control has title: ${control.attributes}`);
    assert.match(control.attributes, /\baria-describedby="[^"]+"/, `disabled control has aria-describedby: ${control.attributes}`);
    assert.equal(control.resolvedReason, control.reason, `disabled reason target matches for ${control.reason}`);
    assert.equal(control.title, control.reason, `disabled title matches for ${control.reason}`);
    assert.deepEqual(
      forbiddenInitiativeDetailVisibleCopy.filter((phrase) =>
        `${control.reason} ${control.title} ${control.resolvedReason}`.toLowerCase().includes(phrase)
      ),
      [],
      `disabled reason avoids internal copy: ${control.attributes}`
    );
  }
});

test("Initiative Detail nav items use DS icons for Storybook-aligned side navigation", () => {
  const html = renderInitiativeDetailHtml();
  const navItems = Array.from(html.matchAll(/<a\b(?=[^>]*data-package-runtime-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g));

  assert.equal(navItems.length, 8);
  for (const [, attributes, body] of navItems) {
    assert.match(body, /\btcrn-icon\b/, "NavItem body includes a DS icon");
    assert.match(body, /class="tcrn-nav-item__label"/, "NavItem body includes label content");
    if (attributes.includes('href="/initiative-detail.html"')) {
      assert.match(attributes, /\baria-current="page"/, "Initiative Detail nav item is selected");
    }
  }
  assert.match(html, /href="\/ai-employee\.html"/);
  assert.match(html, /href="\/gate-queue\.html"/);
  assert.match(html, /href="\/dependency-console\.html"/);
});

function productVisibleAndA11yText(html) {
  const attributeText = Array.from(html.matchAll(/\b(?:aria-label|title|data-disabled-reason)="([^"]*)"/g))
    .map((match) => match[1])
    .join(" ");
  const visibleText = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/\b(?:class|data-[\w:-]+|id|href|src|style)="[^"]*"/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${visibleText} ${attributeText}`.replace(/\s+/g, " ").trim();
}

const productVisibleInternalTermsPattern = /\b(readback|checkpoint|route|slice|implementation|workflow|proof|package-runtime|package runtime|functional contract|held for later|unavailable in this route|not claimed|not_claimed)\b/i;

function disabledControlReadbacks(html) {
  const controls = Array.from(html.matchAll(/<(button|select|input|textarea|a)\b(?=[^>]*(?:\bdisabled\b|\baria-disabled="true"))([^>]*)>([\s\S]*?)<\/\1>/g));
  return controls.map((match) => {
    const attributes = match[2] ?? "";
    const reason = attributes.match(/\bdata-disabled-reason="([^"]+)"/)?.[1] ?? "";
    const title = attributes.match(/\btitle="([^"]+)"/)?.[1] ?? "";
    const describedby = attributes.match(/\baria-describedby="([^"]+)"/)?.[1] ?? "";
    const resolvedReason = describedby
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => {
        const safeId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return html.match(new RegExp(`<span\\b(?=[^>]*\\bid="${safeId}")[^>]*>([\\s\\S]*?)<\\/span>`))?.[1]
          ?.replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();
      })
      .filter(Boolean)
      .join(" ");
    return { attributes, reason, title, resolvedReason };
  });
}
