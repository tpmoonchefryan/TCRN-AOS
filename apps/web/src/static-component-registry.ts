export const aosDesignSystemRegisteredComponentNames = [
  "Button",
  "Icon",
  "IconButton",
  "LinkButton",
  "Field",
  "Input",
  "SearchInput",
  "Select",
  "Checkbox",
  "Badge",
  "StatusBadge",
  "StateView",
  "InlineAlert",
  "LiveRegion",
  "Skeleton",
  "EnvironmentBanner",
  "GateReadinessPanel",
  "EvidenceStrip",
  "ReadbackPanel",
  "Text",
  "Heading",
  "Surface",
  "Divider",
  "KeyValueList",
  "FilterBar",
  "TableShell",
  "WorkIndex",
  "DetailInspector",
  "Breadcrumb",
  "ModuleTabs",
  "SectionTabs",
  "SegmentedNav",
  "Pagination",
  "TopBar",
  "SideNav",
  "NavGroup",
  "NavItem",
  "ProductLauncher",
  "ProductSwitcher",
  "SkipLink",
  "DetailDrawer",
  "ActionDrawer",
  "Popover",
  "Dialog",
  "ConfirmActionDialog"
] as const;

export type AosDesignSystemRegisteredComponentName = (typeof aosDesignSystemRegisteredComponentNames)[number];

export const aosRequiredStaticSurfaceComponents = [
  "Button",
  "Field",
  "SearchInput",
  "Select",
  "Badge",
  "StatusBadge",
  "EvidenceStrip",
  "ReadbackPanel",
  "Text",
  "Heading",
  "Surface",
  "KeyValueList",
  "FilterBar",
  "TableShell",
  "WorkIndex",
  "TopBar",
  "SideNav",
  "NavGroup",
  "NavItem",
  "DetailDrawer"
] as const satisfies readonly AosDesignSystemRegisteredComponentName[];

const registeredComponentSet = new Set<string>(aosDesignSystemRegisteredComponentNames);

export function isAosRegisteredComponentName(value: string): value is AosDesignSystemRegisteredComponentName {
  return registeredComponentSet.has(value);
}

export function tcrnComponentAttr(name: AosDesignSystemRegisteredComponentName): string {
  return `data-tcrn-component="${name}"`;
}

export interface AosStaticNavItemOptions {
  activeHref: string;
  active?: boolean;
  disabledReason?: string;
  label: string;
  reasonId?: string;
  extraAttributes?: string;
}

export function tcrnStaticNavItem({
  active = false,
  activeHref,
  disabledReason,
  extraAttributes = "",
  label,
  reasonId
}: AosStaticNavItemOptions): string {
  const labelMarkup = `<span class="nav-label">${escapeAttribute(label)}</span>`;
  const extra = extraAttributes.trim() ? ` ${extraAttributes.trim()}` : "";

  if (active) {
    return `<a class="nav-row tcrn-nav-item active" ${tcrnComponentAttr("NavItem")} data-navigation-primitive="nav-item" href="${escapeAttribute(activeHref)}" aria-current="page" data-selected="true"${extra}>${labelMarkup}</a>`;
  }

  const reason = normalizedDisabledReason(disabledReason);
  const resolvedReasonId = reasonId ?? `nav-reason-${slugify(label)}`;
  return `<a class="nav-row tcrn-nav-item" ${tcrnComponentAttr("NavItem")} data-navigation-primitive="nav-item" aria-disabled="true" tabindex="-1" aria-describedby="${escapeAttribute(resolvedReasonId)}" title="${escapeAttribute(reason)}" data-disabled-reason="${escapeAttribute(reason)}"${extra}>${labelMarkup}<span class="nav-unavailable-reason" id="${escapeAttribute(resolvedReasonId)}">Held for later route</span></a>`;
}

function normalizedDisabledReason(reason: string | undefined): string {
  const trimmed = reason?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Navigation item unavailable in this route.";
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "item";
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
