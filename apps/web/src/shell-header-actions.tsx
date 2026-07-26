import { useEffect, useRef, useState } from "react";
import { Badge, MachineTokenCell, SearchableList } from "@tcrn/ui-react";
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
  /** Null means every project — the honest default for a cross-project route. */
  activePartitionId: string | null;
  routeHref: (path: string) => string;
  /**
   * Routes that can only mean one project — a board has to have columns of
   * something. There the "all projects" option is offered and refused with its
   * reason rather than quietly missing.
   */
  requiresSingleProject?: boolean;
}

const ALL = "__all__";

/**
 * Scope: which project the cockpit is looking at.
 *
 * This is the only project control in the product. It used to be a row of one
 * button per project, which fit four and would not have fit ten — a control
 * whose width grows with the data it selects from stops working exactly when
 * that data gets interesting. The button now shows the current scope and the
 * options live in a panel, so the header costs the same at four projects and at
 * fifty.
 *
 * It lives in the shell rather than in page content for the reason Jira keeps
 * its project picker in the chrome: it applies to every route, and an indicator
 * that scrolls away has stopped being an indicator.
 */
export function ShellHeaderActions({
  locale,
  partitions,
  activePartitionId,
  routeHref,
  requiresSingleProject = false
}: ShellHeaderActionsProps) {
  const isZh = locale === "zh-CN";
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const active = activePartitionId
    ? partitions.find((partition) => partition.id === activePartitionId)
    : undefined;

  // Dismiss on outside click and on Escape. A panel that can only be closed by
  // choosing something is a trap, and choosing here navigates.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const scopeLabel = active
    ? (isZh ? active.labelZh : active.label)
    : (isZh ? "全部项目" : "All projects");

  return (
    <div className="tcrn-aos-scope" ref={wrapperRef} data-product-control="scope">
      <button
        type="button"
        className="tcrn-aos-scope__trigger"
        aria-expanded={open}
        aria-haspopup="true"
        data-selected={open ? "true" : undefined}
        data-scope-id={activePartitionId ?? ALL}
        onClick={() => setOpen(!open)}
      >
        <span className="tcrn-aos-scope__key">{isZh ? "范围" : "Scope"}</span>
        <strong>{scopeLabel}</strong>
        <span className="tcrn-aos-scope__caret" aria-hidden="true">▾</span>
      </button>

      {open ? (
        <div className="tcrn-aos-scope__panel">
          <SearchableList
            label={isZh ? "选择项目" : "Choose a project"}
            locale={locale}
            selectedId={activePartitionId ?? ALL}
            // A threshold rather than an always-on field: a search box over four
            // options is furniture. The component decides from the count.
            searchThreshold={8}
            items={[
              {
                id: ALL,
                label: isZh ? "全部项目" : "All projects",
                meta: isZh ? `${partitions.length} 条链` : `${partitions.length} chains`,
                ...(requiresSingleProject ? {} : { href: routeHref("/work-items") }),
                pinned: true,
                disabled: requiresSingleProject,
                disabledReason: isZh
                  ? "此页面按单个项目呈现,没有跨项目形态"
                  : "This page renders one project at a time and has no cross-project form"
              },
              ...partitions.map((partition) => ({
                id: partition.id,
                label: isZh ? partition.labelZh : partition.label,
                // The chain version travels with the choice: picking a scope and
                // learning how fresh it is are one question, not two.
                meta: `v${partition.chainVersion}${partition.stale ? " ⚠" : " ✓"}`,
                href: routeHref(`/work-items?project=${partition.id}`)
              }))
            ]}
            onSelect={() => setOpen(false)}
          />
        </div>
      ) : null}

      <AsOfIndicator locale={locale} {...(active ? { partition: active } : {})} partitions={partitions} />
    </div>
  );
}

/**
 * Freshness for whatever the cockpit is currently scoped to.
 *
 * Scoped to one project it names that project's chain version. Scoped to all of
 * them it says how many chains are in view and whether any is behind, rather
 * than picking one version to show: the header used to display a single
 * partition's version beside a list holding four, which stated a freshness the
 * page did not have.
 */
export function AsOfIndicator({
  locale,
  partition,
  partitions
}: {
  locale: TcrnLocale;
  partition?: ChainPartition;
  partitions: readonly ChainPartition[];
}) {
  const isZh = locale === "zh-CN";
  const behind = partitions.filter((entry) => entry.stale);
  const stale = partition ? Boolean(partition.stale) : behind.length > 0;

  const token = partition
    ? `v${partition.chainVersion}`
    : (isZh ? `${partitions.length} 条链` : `${partitions.length} chains`);
  const title = partition
    ? (isZh
      ? `链版本 ${partition.chainVersion} · 投影于 ${partition.verifiedAt} 验证`
      : `Chain version ${partition.chainVersion}, projection verified ${partition.verifiedAt}`)
    : partitions
      .map((entry) => `${isZh ? entry.labelZh : entry.label} v${entry.chainVersion}`)
      .join(" · ");

  return (
    <span
      className="tcrn-aos-as-of"
      data-product-control="as-of"
      data-chain-version={partition?.chainVersion}
      data-chain-count={partition ? undefined : partitions.length}
      data-projection-stale={stale ? "true" : "false"}
      title={title}
    >
      <MachineTokenCell token={token} kind="generic" copyable={false} />
      <Badge tone={stale ? "warning" : "neutral"}>
        {stale
          ? (isZh ? "投影落后" : "Projection behind")
          : (isZh ? "已验证" : "Verified")}
      </Badge>
    </span>
  );
}
