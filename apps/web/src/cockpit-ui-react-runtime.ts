import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NavItem } from "@tcrn/ui-react";
import { aosDesignSystemConsumerBridge } from "./design-system-bridge.js";

export const aosCockpitUiReactRuntime = {
  packageName: "@tcrn/ui-react",
  packageSpecifier: aosDesignSystemConsumerBridge.uiReactPackageSpecifier,
  designSystemSourceHead: aosDesignSystemConsumerBridge.designSystemSourceHead,
  implementationKind: "operations_cockpit_navitem_package_runtime_pilot",
  componentScope: ["NavItem"],
  packageBackedReactRuntimeRendering: true,
  broadUiReactMigration: false,
  productAcceptanceReady: false,
  finalMvpAcceptanceReady: false
} as const;

export interface CockpitRuntimeNavItem {
  active: boolean;
  disabledReason: string;
  href: string;
  label: string;
}

type RuntimeNavItemProps = ComponentProps<typeof NavItem> & {
  "data-tcrn-component": "NavItem";
  "data-package-runtime-component": "NavItem";
  "data-package-runtime-source": "@tcrn/ui-react";
  "data-package-runtime-surface": "operations-cockpit-sidebar";
};

export function renderCockpitRuntimeNavItems(items: readonly CockpitRuntimeNavItem[]): string {
  return items.map((item) => renderCockpitRuntimeNavItem(item)).join("\n          ");
}

export function renderCockpitRuntimeNavItem(item: CockpitRuntimeNavItem): string {
  const props: RuntimeNavItemProps = {
    children: item.label,
    className: `nav-row${item.active ? " active" : ""}`,
    selected: item.active,
    href: item.href,
    "data-tcrn-component": "NavItem",
    "data-package-runtime-component": "NavItem",
    "data-package-runtime-source": "@tcrn/ui-react",
    "data-package-runtime-surface": "operations-cockpit-sidebar"
  };

  if (!item.active) {
    props.disabled = true;
    props.disabledReason = item.disabledReason;
  }

  return renderToStaticMarkup(createElement(NavItem, props));
}
