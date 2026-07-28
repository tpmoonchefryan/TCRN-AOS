import { useEffect, useRef, useState } from "react";
import { Badge, MachineTokenCell, SearchableList } from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { partitionDisplayName } from "./cockpit-types.js";
import { format, pick, type CopyEntry } from "./copy.js";

/**
 * A governed partition as the cockpit sees it: one chain, one version, one
 * freshness moment.
 *
 * Every partition carries its own as-of because the cockpit aggregates four
 * independent chains. A single global freshness number would be a claim none of
 * them makes — the Mac may have read one partition a second ago and another an
 * hour ago, and the reader has to be able to tell.
 *
 * `label` is the fallback name only. The display name comes from
 * `partitionDisplayName`, which holds all five locales; the `labelZh` that used to
 * sit beside `label` here could hold exactly two, so this control — the one piece
 * of chrome on every single route — showed "All projects" and "Design System" to
 * ja, ko and fr readers.
 */
export interface ChainPartition {
  id: string;
  label: string;
  chainVersion: number;
  /** When the projection last verified this chain, not when the chain last moved. */
  verifiedAt: string;
  /** True while the projection is known to trail the chain it mirrors. */
  stale?: boolean;
}

const scopeCopy = {
  allProjects: { "zh-CN": "全部项目", en: "All projects", ja: "すべてのプロジェクト", ko: "모든 프로젝트", fr: "Tous les projets" },
  scope: { "zh-CN": "范围", en: "Scope", ja: "範囲", ko: "범위", fr: "Portée" },
  chooseProject: {
    "zh-CN": "选择项目",
    en: "Choose a project",
    ja: "プロジェクトを選択",
    ko: "프로젝트 선택",
    fr: "Choisir un projet"
  },
  singleProjectOnly: {
    "zh-CN": "此页面按单个项目呈现,没有跨项目形态",
    en: "This page renders one project at a time and has no cross-project form",
    ja: "このページは 1 つのプロジェクト単位で表示され、プロジェクト横断の形態はありません",
    ko: "이 페이지는 프로젝트를 하나씩 표시하며 프로젝트 간 형태가 없습니다",
    fr: "Cette page affiche un projet à la fois et n'a pas de forme inter-projets"
  },
  projectionBehind: {
    "zh-CN": "投影落后",
    en: "Projection behind",
    ja: "投影が遅延",
    ko: "투영 지연",
    fr: "Projection en retard"
  },
  verified: { "zh-CN": "已验证", en: "Verified", ja: "検証済み", ko: "검증됨", fr: "Vérifié" }
} satisfies Record<string, CopyEntry>;

const chainCount = {
  "zh-CN": "{0} 条链",
  en: "{0} chains",
  ja: "{0} 本のチェーン",
  ko: "체인 {0}개",
  fr: "{0} chaînes"
} satisfies CopyEntry;

const chainVersionTitle = {
  "zh-CN": "链版本 {0} · 投影于 {1} 验证",
  en: "Chain version {0}, projection verified {1}",
  ja: "チェーンバージョン {0}・投影は {1} に検証",
  ko: "체인 버전 {0} · 투영은 {1}에 검증",
  fr: "Version de chaîne {0}, projection vérifiée le {1}"
} satisfies CopyEntry;


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
    ? partitionDisplayName(active, locale)
    : pick(locale, scopeCopy.allProjects);

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
        <span className="tcrn-aos-scope__key">{pick(locale, scopeCopy.scope)}</span>
        <strong>{scopeLabel}</strong>
        <span className="tcrn-aos-scope__caret" aria-hidden="true">▾</span>
      </button>

      {open ? (
        <div className="tcrn-aos-scope__panel">
          <SearchableList
            label={pick(locale, scopeCopy.chooseProject)}
            locale={locale}
            selectedId={activePartitionId ?? ALL}
            // A threshold rather than an always-on field: a search box over four
            // options is furniture. The component decides from the count.
            searchThreshold={8}
            items={[
              {
                id: ALL,
                label: pick(locale, scopeCopy.allProjects),
                meta: format(locale, chainCount, partitions.length),
                // `project=` with no value, not a bare path: this is the one
                // control whose job is to leave the current scope, and under
                // inheritance a bare path would carry the scope it is offering
                // to drop. Subtraction has to be stated.
                ...(requiresSingleProject ? {} : { href: routeHref("/work-items?project=") }),
                pinned: true,
                disabled: requiresSingleProject,
                disabledReason: pick(locale, scopeCopy.singleProjectOnly)
              },
              ...partitions.map((partition) => ({
                id: partition.id,
                label: partitionDisplayName(partition, locale),
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
  const behind = partitions.filter((entry) => entry.stale);
  const stale = partition ? Boolean(partition.stale) : behind.length > 0;

  const token = partition
    ? `v${partition.chainVersion}`
    : format(locale, chainCount, partitions.length);
  const title = partition
    ? format(locale, chainVersionTitle, partition.chainVersion, partition.verifiedAt)
    : partitions
      .map((entry) => `${partitionDisplayName(entry, locale)} v${entry.chainVersion}`)
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
        {pick(locale, stale ? scopeCopy.projectionBehind : scopeCopy.verified)}
      </Badge>
    </span>
  );
}
