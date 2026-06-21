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
