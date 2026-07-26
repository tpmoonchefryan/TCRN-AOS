import { Badge, MachineTokenCell, NavItem } from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

/**
 * A governed partition as the cockpit sees it: one chain, one version, one
 * freshness moment.
 *
 * Every partition carries its own as-of because the cockpit aggregates four
 * independent chains. A single global freshness number would be a claim none of
 * them makes — the Mac may have read one partition a second ago and another an
 * hour ago, and the reader has to be able to tell.
 */
export interface ChainPartition {
  id: string;
  label: string;
  labelZh: string;
  chainVersion: number;
  /** When the projection last verified this chain, not when the chain last moved. */
  verifiedAt: string;
  /** True while the projection is known to trail the chain it mirrors. */
  stale?: boolean;
}

export interface ShellHeaderActionsProps {
  locale: TcrnLocale;
  partitions: readonly ChainPartition[];
  activePartitionId: string;
  routeHref: (path: string) => string;
}

/**
 * Product-owned controls for the shell utility row: which project the cockpit is
 * scoped to, and how fresh that project's data is.
 *
 * These live in the shell rather than in page content for the same reason Jira
 * keeps its project picker in the chrome — they apply to every route, and a
 * freshness indicator that scrolls away has stopped being an indicator.
 *
 * The switcher is built from NavItem rather than SegmentedNav: the segmented
 * family (SegmentedNav / ProductSwitcher / ModuleTabs / Breadcrumb) accepts only
 * `{id, label, selected}` and renders buttons with no handler, so it can display
 * a selection but never change one. NavItem extends the anchor attributes and
 * carries `aria-current` and `data-selected` for us.
 */
export function ShellHeaderActions({
  locale,
  partitions,
  activePartitionId,
  routeHref
}: ShellHeaderActionsProps) {
  const isZh = locale === "zh-CN";
  const active = partitions.find((partition) => partition.id === activePartitionId) ?? partitions[0];

  return (
    <>
      <nav
        className="tcrn-aos-workspace-switcher"
        aria-label={isZh ? "项目切换" : "Project switcher"}
        data-product-control="workspace-switcher"
      >
        {partitions.map((partition) => (
          <NavItem
            key={partition.id}
            href={routeHref(`/projects/${partition.id}`)}
            selected={partition.id === activePartitionId}
            data-partition-id={partition.id}
            data-chain-version={partition.chainVersion}
          >
            {isZh ? partition.labelZh : partition.label}
          </NavItem>
        ))}
      </nav>
      {active ? <AsOfIndicator locale={locale} partition={active} /> : null}
    </>
  );
}

/**
 * Chain version plus verification time — never a bare timestamp.
 *
 * The version is what makes two readings comparable; wall-clock time alone
 * cannot tell a reader whether the projection advanced or merely re-checked.
 * When the projection trails the chain the badge says so instead of rendering a
 * confident number, because a cockpit that hides its own lag is precisely the
 * failure this indicator exists to prevent.
 */
export function AsOfIndicator({
  locale,
  partition
}: {
  locale: TcrnLocale;
  partition: ChainPartition;
}) {
  const isZh = locale === "zh-CN";
  return (
    <span
      className="tcrn-aos-as-of"
      data-product-control="as-of"
      data-chain-version={partition.chainVersion}
      data-projection-stale={partition.stale ? "true" : "false"}
      title={isZh
        ? `链版本 ${partition.chainVersion} · 投影于 ${partition.verifiedAt} 验证`
        : `Chain version ${partition.chainVersion}, projection verified ${partition.verifiedAt}`}
    >
      <MachineTokenCell token={`v${partition.chainVersion}`} kind="generic" copyable={false} />
      <Badge tone={partition.stale ? "warning" : "neutral"}>
        {partition.stale
          ? (isZh ? "投影落后" : "Projection behind")
          : (isZh ? "已验证" : "Verified")}
      </Badge>
    </span>
  );
}
