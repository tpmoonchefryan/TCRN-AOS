import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Heading,
  MachineTokenCell,
  SearchableList,
  SearchInput,
  Surface,
  Text,
  WorkItemRow,
  WorkManagementSubnav,
  WorkPageHeader,
  WorkSplitView
} from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { cockpitData } from "./cockpit-data.generated.js";
import {
  chainStatusBadge,
  chainStatusLabel,
  partitionDisplayName,
  workTitle,
  type CockpitWork
} from "./cockpit-types.js";
import { conferenceLink, hrefAttr, workItemLink } from "./cockpit-links.js";
import { format, pick, type CopyEntry } from "./copy.js";

/**
 * Work-items copy in all five locales.
 *
 * This is the largest single dictionary in the cockpit because it was the largest
 * single concentration of the defect: fifty-three bilingual ternaries on the one
 * page that indexes all 402 records. Three of them carry more than a label.
 *
 * The search field's "literal" note tells a reader that what runs here is a
 * substring match and not the projection's FTS5 index — without it, a query that
 * returns nothing reads as "no such work item". `bulkBlocked` is the reason a
 * visible action is disabled, which is the only thing standing between a reader
 * and the conclusion that the button is broken. And `noScope` states that the
 * chain genuinely holds no title for a record, rather than that the page failed
 * to read one. All three were English-only, so on the ja, ko and fr routes the
 * screen showed the control without the sentence that makes it honest.
 */
const workCopy = {
  workItems: { "zh-CN": "工作项", en: "Work items", ja: "作業項目", ko: "작업 항목", fr: "Éléments de travail" },
  search: { "zh-CN": "检索", en: "Search", ja: "検索", ko: "검색", fr: "Recherche" },
  kind: { "zh-CN": "类型", en: "Kind", ja: "種別", ko: "종류", fr: "Type" },
  status: { "zh-CN": "状态", en: "Status", ja: "ステータス", ko: "상태", fr: "Statut" },
  project: { "zh-CN": "项目", en: "Project", ja: "プロジェクト", ko: "프로젝트", fr: "Projet" },
  view: { "zh-CN": "视图", en: "View", ja: "ビュー", ko: "보기", fr: "Vue" },
  savedViews: { "zh-CN": "保存视图", en: "Saved views", ja: "保存ビュー", ko: "저장된 보기", fr: "Vues enregistrées" },
  searchWorkItems: {
    "zh-CN": "检索工作项",
    en: "Search work items",
    ja: "作業項目を検索",
    ko: "작업 항목 검색",
    fr: "Rechercher des éléments"
  },
  literal: { "zh-CN": "逐字", en: "literal", ja: "逐語", ko: "문자 그대로", fr: "littéral" },
  literalNote: {
    "zh-CN": "逐字匹配:多个词须全部命中。投影层的 FTS5 索引在摄取进程之后,此构建没有 API 通道,故不称全文搜索。",
    en: "Literal match; every term must hit. The projection's FTS5 index sits behind the ingestion process with no API to reach it, so this is not called full-text search.",
    ja: "逐語一致：複数の語はすべて命中する必要があります。投影層の FTS5 索引は取り込みプロセスの背後にあり、このビルドには到達する API がないため、全文検索とは呼びません。",
    ko: "문자 그대로 일치: 여러 단어는 모두 적중해야 합니다. 투영 계층의 FTS5 색인은 수집 프로세스 뒤에 있고 이 빌드에는 접근할 API가 없으므로 전문 검색이라고 부르지 않습니다.",
    fr: "Correspondance littérale ; chaque terme doit être trouvé. L'index FTS5 de la projection se trouve derrière le processus d'ingestion, sans API pour l'atteindre ; ce n'est donc pas une recherche plein texte."
  },
  allKinds: { "zh-CN": "全部类型", en: "All kinds", ja: "すべての種別", ko: "모든 종류", fr: "Tous les types" },
  allStatuses: { "zh-CN": "全部状态", en: "All statuses", ja: "すべてのステータス", ko: "모든 상태", fr: "Tous les statuts" },
  selectMultiple: { "zh-CN": "批量选择", en: "Select multiple", ja: "複数選択", ko: "여러 개 선택", fr: "Sélection multiple" },
  applied: { "zh-CN": "已应用", en: "Applied", ja: "適用中", ko: "적용됨", fr: "Appliqué" },
  remove: { "zh-CN": "移除", en: "Remove", ja: "解除", ko: "제거", fr: "Retirer" },
  resetView: { "zh-CN": "重置视图", en: "Reset view", ja: "ビューを初期化", ko: "보기 초기화", fr: "Réinitialiser la vue" },
  noMatch: {
    "zh-CN": "当前筛选与检索没有匹配的工作项。",
    en: "No work item matches the current filters and search.",
    ja: "現在の絞り込みと検索に一致する作業項目はありません。",
    ko: "현재 필터와 검색에 일치하는 작업 항목이 없습니다.",
    fr: "Aucun élément de travail ne correspond aux filtres et à la recherche actuels."
  },
  splitLabel: {
    "zh-CN": "工作项列表与详情",
    en: "Work items list and preview",
    ja: "作業項目一覧とプレビュー",
    ko: "작업 항목 목록과 미리보기",
    fr: "Liste des éléments et aperçu"
  },
  pickRow: {
    "zh-CN": "选择左侧任一条以在此预览。",
    en: "Pick a row on the left to preview it here.",
    ja: "左側の行を選ぶと、ここにプレビューが表示されます。",
    ko: "왼쪽에서 행을 선택하면 여기에 미리보기가 표시됩니다.",
    fr: "Sélectionnez une ligne à gauche pour l'aperçu ici."
  },
  noScope: {
    "zh-CN": "该记录没有范围注解——链上确实没有标题。",
    en: "No scope annotation; the chain genuinely holds no title for this record.",
    ja: "スコープ注記がありません。チェーンはこの記録の標題を実際に保持していません。",
    ko: "범위 주석이 없습니다. 체인은 이 기록의 제목을 실제로 보유하지 않습니다.",
    fr: "Aucune annotation de portée ; la chaîne ne détient réellement aucun titre pour cet enregistrement."
  },
  openDetail: {
    "zh-CN": "打开完整详情 →",
    en: "Open full detail →",
    ja: "詳細を開く →",
    ko: "전체 상세 열기 →",
    fr: "Ouvrir le détail complet →"
  },
  openRoom: {
    "zh-CN": "进入审议室 →",
    en: "Open deliberation room →",
    ja: "審議室を開く →",
    ko: "심의실 열기 →",
    fr: "Ouvrir la salle de délibération →"
  },
  selectAllShown: { "zh-CN": "全选本页", en: "Select all shown", ja: "表示分をすべて選択", ko: "표시된 항목 모두 선택", fr: "Tout sélectionner" },
  clearSelection: { "zh-CN": "清空选择", en: "Clear selection", ja: "選択を解除", ko: "선택 해제", fr: "Effacer la sélection" },
  nothingSelected: {
    "zh-CN": "尚未选中任何条目",
    en: "Nothing is selected",
    ja: "何も選択されていません",
    ko: "선택된 항목이 없습니다",
    fr: "Rien n'est sélectionné"
  },
  copyKeys: { "zh-CN": "复制键号", en: "Copy keys", ja: "キーをコピー", ko: "키 복사", fr: "Copier les clés" },
  exportJson: { "zh-CN": "导出 JSON", en: "Export JSON", ja: "JSON を書き出す", ko: "JSON 내보내기", fr: "Exporter en JSON" },
  bulkTransition: { "zh-CN": "批量流转状态", en: "Bulk transition", ja: "一括で状態遷移", ko: "일괄 상태 전이", fr: "Transition groupée" },
  bulkBlocked: {
    "zh-CN": "链写入须经安全写面:operator 供权 + 对链头的 expected-version 比对。此构建为静态投影,没有写通道。",
    en: "Chain writes go through the safe write surface: operator authority plus a compare-and-swap against the chain head. This build is a static projection with no write channel.",
    ja: "チェーンへの書き込みは安全な書き込み面を通ります：operator 権限と、チェーン先頭に対する expected-version の比較です。このビルドは静的投影であり、書き込み経路はありません。",
    ko: "체인 쓰기는 안전한 쓰기 표면을 거칩니다. operator 권한과 체인 헤드에 대한 expected-version 비교가 필요합니다. 이 빌드는 정적 투영이며 쓰기 경로가 없습니다.",
    fr: "Les écritures dans la chaîne passent par la surface d'écriture sûre : autorité opérateur et comparaison de version avec la tête de chaîne. Cette version est une projection statique, sans canal d'écriture."
  },
  viewAll: { "zh-CN": "全部", en: "All", ja: "すべて", ko: "전체", fr: "Tout" },
  viewOwnerIntent: { "zh-CN": "等你决定", en: "Awaiting you", ja: "承認待ち", ko: "결정 대기", fr: "En attente de vous" },
  viewActive: { "zh-CN": "进行中", en: "In progress", ja: "進行中", ko: "진행 중", fr: "En cours" },
  viewBlocked: { "zh-CN": "阻塞", en: "Blocked", ja: "ブロック中", ko: "차단됨", fr: "Bloqué" },
  viewEnrolled: { "zh-CN": "已入列车", en: "On a train", ja: "列車に登録済み", ko: "열차에 등록됨", fr: "Sur un train" },
  viewUntitled: { "zh-CN": "无范围注解", en: "No scope text", ja: "スコープ注記なし", ko: "범위 주석 없음", fr: "Sans texte de portée" }
} satisfies Record<string, CopyEntry>;

const workCounted = {
  description: {
    "zh-CN": "{0} / {1} 条 · 类型只是字段,不是另一个系统",
    en: "{0} of {1}; kind is a field, not a separate system.",
    ja: "{1} 件のうち {0} 件。種別はフィールドであり、別のシステムではありません。",
    ko: "{1}건 중 {0}건. 종류는 필드이며 별도의 시스템이 아닙니다.",
    fr: "{0} sur {1} ; le type est un champ, pas un système distinct."
  },
  selectKey: { "zh-CN": "选择 {0}", en: "Select {0}", ja: "{0} を選択", ko: "{0} 선택", fr: "Sélectionner {0}" },
  showingFirst: {
    "zh-CN": "显示前 {0} 条,共 {1} 条,请继续收窄筛选。",
    en: "Showing the first {0} of {1}; narrow the filters to see the rest.",
    ja: "全 {1} 件のうち先頭 {0} 件を表示しています。残りを見るには絞り込んでください。",
    ko: "총 {1}건 중 처음 {0}건을 표시합니다. 나머지를 보려면 필터를 좁히세요.",
    fr: "Affichage des {0} premiers sur {1} ; affinez les filtres pour voir le reste."
  },
  children: { "zh-CN": "子项 {0}", en: "{0} children", ja: "子項目 {0}", ko: "하위 {0}개", fr: "{0} enfants" },
  gates: { "zh-CN": "门 {0}", en: "{0} gates", ja: "ゲート {0}", ko: "게이트 {0}개", fr: "{0} portes" },
  deliberations: { "zh-CN": "审议 {0}", en: "{0} deliberations", ja: "審議 {0}", ko: "심의 {0}건", fr: "{0} délibérations" },
  selectedCount: { "zh-CN": "已选 {0} 条", en: "{0} selected", ja: "{0} 件を選択中", ko: "{0}건 선택됨", fr: "{0} sélectionnés" }
} satisfies Record<string, CopyEntry>;

/**
 * Work items — one searchable, filterable, selectable index over every ticket
 * on the platform.
 *
 * The chain stores Initiative, Epic, Story, Subtask, Incident and Release in one
 * record shape, so this is one page with `kind` as a facet rather than six
 * pages. Four things make it usable at 402 records: saved views, search,
 * a split pane, and batch selection.
 *
 * Saved views live in the URL rather than in local storage. A view a person
 * cannot bookmark, share, or send to the Owner in a message is not a saved view,
 * it is a preference — and the whole point of this page is that two people can
 * look at the same list.
 */
export function WorkItemsView({
  locale,
  routeHref,
  search
}: {
  locale: TcrnLocale;
  routeHref: (path: string) => string;
  search?: URLSearchParams;
}) {
  const projectFilter = search?.get("project") ?? undefined;
  const kindFilter = search?.get("kind") ?? undefined;
  const statusFilter = search?.get("status") ?? undefined;
  const viewFilter = search?.get("view") ?? undefined;

  // Server-rendered state comes from the URL so a link lands on the same screen
  // its author was looking at; from there the client owns it.
  const [query, setQuery] = useState(search?.get("q") ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(search?.get("selected") ?? null);
  const [batchMode, setBatchMode] = useState(false);
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());

  const faceted = useMemo(() => cockpitData.work.filter((row) =>
    (!projectFilter || row.partitionId === projectFilter)
    && (!kindFilter || row.kind === kindFilter)
    && (!statusFilter || row.status === statusFilter)
    && matchesView(row, viewFilter)), [projectFilter, kindFilter, statusFilter, viewFilter]);

  const rows = useMemo(() => faceted.filter((row) => matchesQuery(row, query)), [faceted, query]);
  const selected = rows.find((row) => (row.externalKey ?? row.id) === selectedId)
    ?? cockpitData.work.find((row) => (row.externalKey ?? row.id) === selectedId);

  // Every facet link states the whole filter state, project included.
  //
  // Naming `project` here is the fix for the Owner's report that changing a
  // filter resets the project scope. The INC-014 repair made `routeHref` inherit
  // the query in force, which carries scope through any link that does not speak
  // about it — but this builder does speak about it: it enumerates the keys and
  // hands the result to a helper that drops empty values, so before this line
  // `project` was the one facet no link mentioned, and every kind, status and
  // view chip rebuilt the URL without it. Inheritance could not save it, because
  // an explicitly-written key wins over the inherited one.
  const facetHref = (name: string, value: string | undefined) =>
    routeHref(`/work-items${buildQuery({
      project: projectFilter, kind: kindFilter, status: statusFilter, view: viewFilter,
      q: query || undefined, [name]: value
    })}`);
  // What is currently narrowing the list, each removable on its own. The screen
  // previously offered only a global reset, so taking one condition off meant
  // rebuilding the rest by hand.
  //
  // `clearHref` rather than a bare `/work-items`: under query inheritance a link
  // that names no keys keeps every key, so the plain route reset nothing — see
  // `clearHref` below.
  const applied = [
    query ? {
      id: "q",
      label: pick(locale, workCopy.search),
      value: `“${query}”`,
      removeHref: facetHref("q", undefined)
    } : null,
    kindFilter ? {
      id: "kind",
      label: pick(locale, workCopy.kind),
      value: kindFilter,
      removeHref: facetHref("kind", undefined)
    } : null,
    statusFilter ? {
      id: "status",
      label: pick(locale, workCopy.status),
      // The chain's word in the reader's language, matching the menu it came
      // from. `kind` stays verbatim above: a record kind is a name, not prose.
      value: chainStatusLabel(statusFilter, locale),
      removeHref: facetHref("status", undefined)
    } : null,
    viewFilter ? {
      id: "view",
      label: pick(locale, workCopy.view),
      value: viewFilter,
      removeHref: facetHref("view", undefined)
    } : null
    // Project is absent by design: it is the shell's scope, not this page's
    // filter, and stating it here would say the same thing in two places.
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  // Reset clears this page's filters and keeps the scope the reader is working
  // in. `routeHref("/work-items")` cannot do that: query inheritance means a
  // link naming no keys keeps all of them, so the reset chip led back to the
  // page it was resetting — the same INC-014 mechanism as the facet links, in
  // the opposite direction. Subtraction has to be stated to happen.
  const clearHref = routeHref(`/work-items${buildQuery({ project: projectFilter })}`);

  const shown = rows.slice(0, 120);
  const checkedRows = rows.filter((row) => checked.has(row.id));

  return (
    <div className="tcrn-aos-view" data-cockpit-view="work-items">
      <WorkPageHeader
        title={pick(locale, workCopy.workItems)}
        description={format(locale, workCounted.description, rows.length, cockpitData.work.length)}
      />

      {/* Three layers, in the order a person uses them: which named view, then
          which conditions, then what is currently applied. The screen used to
          lay every option of every dimension out at once — six rows and about
          340px of chrome above a list of 400 records — which is an enumeration
          rather than a filter, and it grew by one more chip for every project or
          kind the platform gained. Project is deliberately absent: it is the
          shell's scope control, and one idea gets one control. */}
      <Surface className="tcrn-aos-filters">
        <WorkManagementSubnav
          label={pick(locale, workCopy.savedViews)}
          items={savedViews(locale, routeHref, viewFilter, statusFilter, projectFilter)}
        />

        <div className="tcrn-aos-toolbar">
          <div className="tcrn-aos-searchbar">
            <SearchInput
              aria-label={pick(locale, workCopy.searchWorkItems)}
              placeholder={pick(locale, workCopy.searchWorkItems)}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              data-cockpit-search="work-items"
            />
            {/* Named for what it does. The projection store carries an FTS5 index
                with stemming and snippets, but it lives behind the ingestion
                process and this build has no API to reach it, so what runs here
                is a literal match over the projected text. Calling it "full-text
                search" would promise a query language it does not implement. */}
            <span className="tcrn-aos-searchbar__note" title={pick(locale, workCopy.literalNote)}>
              {pick(locale, workCopy.literal)}
            </span>
          </div>

          <FilterMenu
            label={pick(locale, workCopy.kind)}
            allLabel={pick(locale, workCopy.allKinds)}
            value={kindFilter}
            options={["Initiative", "Epic", "Story", "Subtask", "Incident", "Release"]
              .map((kind) => ({
                id: kind,
                label: kind,
                count: faceted.filter((row) => row.kind === kind).length
              }))}
            hrefFor={(value) => facetHref("kind", value)}
            locale={locale}
          />
          <FilterMenu
            label={pick(locale, workCopy.status)}
            allLabel={pick(locale, workCopy.allStatuses)}
            value={statusFilter}
            // Status options say the chain's word in the reader's language; the
            // id stays the chain's own token because that is what the URL and
            // the filter compare on. `kind` above is deliberately not translated:
            // Initiative, Epic and Story are the chain's record kinds, not prose.
            options={["planned", "ready", "active", "blocked", "done"].map((status) => ({
              id: status,
              label: chainStatusLabel(status, locale),
              count: faceted.filter((row) => row.status === status).length
            }))}
            hrefFor={(value) => facetHref("status", value)}
            locale={locale}
          />

          <span className="tcrn-aos-toolbar__rule" aria-hidden="true" />
          <span className="tcrn-aos-count">
            <strong>{rows.length}</strong> / {cockpitData.work.length}
          </span>

          <span className="tcrn-aos-toolbar__spacer" />
          <Button
            type="button"
            variant={batchMode ? "primary" : "secondary"}
            size="sm"
            aria-pressed={batchMode}
            onClick={() => {
              setBatchMode(!batchMode);
              if (batchMode) setChecked(new Set());
            }}
            data-cockpit-batch-toggle="true"
          >
            {pick(locale, workCopy.selectMultiple)}
          </Button>
        </div>

        {/* Only when something is applied. A default view owes no chrome, and a
            reset link with nothing to reset is noise that trains people to
            ignore the row it sits in. */}
        {applied.length > 0 ? (
          <div className="tcrn-aos-applied" data-cockpit-applied="true">
            <span className="tcrn-aos-applied__label">{pick(locale, workCopy.applied)}</span>
            {applied.map((entry) => (
              <a key={entry.id} className="tcrn-aos-chip" href={entry.removeHref}
                data-applied-filter={entry.id}>
                {entry.label} <b>{entry.value}</b>
                <span className="tcrn-aos-chip__x" aria-hidden="true">✕</span>
                <span className="tcrn-sr-only">{pick(locale, workCopy.remove)}</span>
              </a>
            ))}
            <a className="tcrn-aos-reset" href={clearHref}>
              {pick(locale, workCopy.resetView)}
            </a>
          </div>
        ) : null}
      </Surface>

      {batchMode ? (
        <BatchBar
          locale={locale}
          rows={checkedRows}
          onClear={() => setChecked(new Set())}
          onSelectAllShown={() => setChecked(new Set(shown.map((row) => row.id)))}
        />
      ) : null}

      {rows.length === 0 ? (
        <EmptyState title={pick(locale, workCopy.noMatch)} />
      ) : (
        <div data-cockpit-split="work-items" data-has-selection={selected ? "true" : "false"}>
        <WorkSplitView
          label={pick(locale, workCopy.splitLabel)}
          list={
            <section
              className="tcrn-aos-picker"
              aria-label={pick(locale, workCopy.workItems)}
              data-work-management-pattern="work-list"
            >
              {shown.map((row) => {
                const key = row.externalKey ?? row.id;
                return (
                  <div
                    key={row.id}
                    className="tcrn-aos-picker-row"
                    data-select-key={key}
                    data-selected={key === selectedId ? "true" : undefined}
                  >
                    {batchMode ? (
                      <Checkbox
                        aria-label={format(locale, workCounted.selectKey, key)}
                        checked={checked.has(row.id)}
                        onChange={(event) => {
                          const next = new Set(checked);
                          if (event.currentTarget.checked) next.add(row.id);
                          else next.delete(row.id);
                          setChecked(next);
                        }}
                      />
                    ) : null}
                    {/* The row stays a real link to this same page with the item
                        selected, so it works with scripting off and can be
                        copied out of the address bar. With scripting on the
                        click is intercepted and only the pane changes, which is
                        the same destination reached without the reload. */}
                    <a
                      className="tcrn-aos-picker-row__link"
                      href={routeHref(`/work-items/${key}`)}
                      aria-current={key === selectedId ? "true" : undefined}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                        // Only hijack the click while the preview pane is on
                        // screen; below that width the pane is hidden and the
                        // honest behaviour is the link's own: open the detail.
                        if (typeof window !== "undefined"
                          && !window.matchMedia("(min-width: 1101px)").matches) return;
                        event.preventDefault();
                        setSelectedId(key);
                      }}
                    >
                      <WorkItemRow
                        id={key}
                        title={workTitle(row) ?? key}
                        state={chainStatusBadge(row.status, locale) as never}
                        owner={row.kind}
                        selected={key === selectedId}
                        fields={[
                          {
                            key: "status",
                            label: pick(locale, workCopy.status),
                            value: chainStatusLabel(row.status, locale)
                          },
                          {
                            key: "project",
                            label: pick(locale, workCopy.project),
                            value: partitionDisplayName(findPartition(row.partitionId), locale)
                          }
                        ]}
                      />
                    </a>
                  </div>
                );
              })}
              {rows.length > shown.length ? (
                <Text>{format(locale, workCounted.showingFirst, shown.length, rows.length)}</Text>
              ) : null}
            </section>
          }
          detail={<PreviewPane item={selected} locale={locale} routeHref={routeHref} />}
        />
        </div>
      )}
    </div>
  );
}

/**
 * The right half of the split: enough to decide whether to open the item.
 *
 * Deliberately a preview and not a second detail page. Duplicating the full
 * detail view here would mean two places to keep honest about which fields the
 * chain holds, and the one that gets forgotten is the one that starts lying.
 */
function PreviewPane({
  item,
  locale,
  routeHref
}: {
  item: CockpitWork | undefined;
  locale: TcrnLocale;
  routeHref: (path: string) => string;
}) {
  if (!item) {
    return <EmptyState title={pick(locale, workCopy.pickRow)} />;
  }
  const key = item.externalKey ?? item.id;
  const partition = findPartition(item.partitionId);
  const children = cockpitData.work.filter(
    (row) => row.partitionId === item.partitionId && row.parentId === item.id);
  const gates = cockpitData.gates.filter(
    (gate) => gate.partitionId === item.partitionId && gate.workId === item.id);
  const conferences = cockpitData.conferences.filter(
    (conference) => conference.partitionId === item.partitionId
      && conference.workIds.includes(item.id));
  const firstConference = conferences[0];

  return (
    <div className="tcrn-aos-preview" data-preview-key={key}>
      <div className="tcrn-aos-detail-head__meta">
        {/* The key is the reference to the item's own page, so it is the link to
            it — the same INC-018 rule the detail page follows: an identifier that
            has a page is a link, and one that does not stays text. */}
        <MachineTokenCell
          token={key}
          kind="work-item"
          copyable={false}
          {...hrefAttr(workItemLink(item, routeHref))}
        />
        <Badge tone="neutral">{item.kind}</Badge>
        <Badge tone={item.status === "blocked" ? "warning" : "neutral"}>
          {chainStatusLabel(item.status, locale)}
        </Badge>
        {partition ? (
          <MachineTokenCell token={`v${partition.chainVersion}`} kind="generic" copyable={false} />
        ) : null}
      </div>
      <Heading level={2} visualLevel={3}>{workTitle(item) ?? key}</Heading>
      {item.scope
        ? <Text className="tcrn-aos-prose">{item.scope.length > 700 ? `${item.scope.slice(0, 700)}…` : item.scope}</Text>
        : <Text>{pick(locale, workCopy.noScope)}</Text>}
      <div className="tcrn-aos-preview__counts">
        <Badge tone="neutral">{format(locale, workCounted.children, children.length)}</Badge>
        <Badge tone={gates.some((gate) => gate.status === "pending") ? "warning" : "neutral"}>
          {format(locale, workCounted.gates, gates.length)}
        </Badge>
        <Badge tone="neutral">
          {format(locale, workCounted.deliberations, conferences.length)}
        </Badge>
      </div>
      <div className="tcrn-aos-preview__actions">
        <a className="tcrn-aos-preview__open" href={workItemLink(item, routeHref).href}>
          {pick(locale, workCopy.openDetail)}
        </a>
        {firstConference ? (
          <a className="tcrn-aos-preview__open" href={conferenceLink(firstConference, routeHref).href}>
            {pick(locale, workCopy.openRoom)}
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * What batch selection can honestly do from a statically built cockpit.
 *
 * Copy and export are real because they are client-side. Bulk transition is
 * shown and disabled with its reason, because every chain write goes through the
 * governed write surface with operator authority and a compare-and-swap on the
 * head version — there is no write channel from this build at all. Hiding the
 * action would leave a person hunting for it; offering it and failing at the
 * click would be worse.
 */
function BatchBar({
  locale,
  rows,
  onClear,
  onSelectAllShown
}: {
  locale: TcrnLocale;
  rows: readonly CockpitWork[];
  onClear: () => void;
  onSelectAllShown: () => void;
}) {
  const keys = rows.map((row) => row.externalKey ?? row.id);
  const nothingSelected = pick(locale, workCopy.nothingSelected);

  return (
    <Surface className="tcrn-aos-batchbar" data-cockpit-batch-bar="true">
      <Text>{format(locale, workCounted.selectedCount, rows.length)}</Text>
      <Button type="button" variant="quiet" size="sm" onClick={onSelectAllShown}>
        {pick(locale, workCopy.selectAllShown)}
      </Button>
      <Button type="button" variant="quiet" size="sm" onClick={onClear} disabled={rows.length === 0}
        disabledReason={nothingSelected}>
        {pick(locale, workCopy.clearSelection)}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={rows.length === 0}
        disabledReason={nothingSelected}
        onClick={() => { void copyToClipboard(keys.join("\n")); }}
      >
        {pick(locale, workCopy.copyKeys)}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={rows.length === 0}
        disabledReason={nothingSelected}
        onClick={() => downloadJson(rows)}
      >
        {pick(locale, workCopy.exportJson)}
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled
        disabledReason={pick(locale, workCopy.bulkBlocked)}
      >
        {pick(locale, workCopy.bulkTransition)}
      </Button>
    </Surface>
  );
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  await navigator.clipboard.writeText(text);
}

function downloadJson(rows: readonly CockpitWork[]): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const payload = JSON.stringify({
    // Stamped so an exported file can be told apart from a later one, and so a
    // reader knows which chain versions it reflects rather than assuming "now".
    generatedAt: cockpitData.generatedAt,
    partitions: cockpitData.partitions.map((entry) => ({
      id: entry.id, chainVersion: entry.chainVersion
    })),
    items: rows
  }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "tcrn-work-items.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * The saved views, with live counts.
 *
 * Each one answers a question somebody actually asks. "Awaiting you" is the
 * operator inbox narrowed to work items; "no scope annotation" surfaces records
 * the chain holds no title for, which is the thing that makes a list of keys
 * unreadable and is otherwise invisible.
 */
function savedViews(
  locale: TcrnLocale,
  routeHref: (path: string) => string,
  viewFilter: string | undefined,
  statusFilter: string | undefined,
  projectFilter: string | undefined
) {
  const count = (predicate: (row: CockpitWork) => boolean) =>
    cockpitData.work.filter(predicate).length;
  // Each view is a complete statement of the two keys it owns, so switching views
  // replaces the previous one instead of stacking on it — picking "In progress"
  // after "Awaiting you" must not leave `view=owner-intent` in the URL. Project
  // rides along because it is the reader's scope, not one of this page's facets:
  // a saved view narrows what kind of work is listed, never which chain.
  //
  // The counts are deliberately unscoped. They answer "how much of this exists on
  // the platform", which is the question a saved view's badge is asked, and
  // scoping them would make the same view report different numbers depending on
  // where the reader happened to be standing.
  const viewHref = (view: string | undefined, status: string | undefined) =>
    routeHref(`/work-items${buildQuery({ project: projectFilter, view, status })}`);
  return [
    {
      id: "all",
      label: pick(locale, workCopy.viewAll),
      href: viewHref(undefined, undefined),
      current: !viewFilter && !statusFilter,
      count: cockpitData.work.length
    },
    {
      id: "owner-intent",
      label: pick(locale, workCopy.viewOwnerIntent),
      href: viewHref("owner-intent", undefined),
      current: viewFilter === "owner-intent",
      count: count((row) => matchesView(row, "owner-intent"))
    },
    {
      id: "active",
      label: pick(locale, workCopy.viewActive),
      href: viewHref(undefined, "active"),
      current: statusFilter === "active",
      count: count((row) => row.status === "active")
    },
    {
      id: "blocked",
      label: pick(locale, workCopy.viewBlocked),
      href: viewHref(undefined, "blocked"),
      current: statusFilter === "blocked",
      count: count((row) => row.status === "blocked")
    },
    {
      id: "enrolled",
      label: pick(locale, workCopy.viewEnrolled),
      href: viewHref("enrolled", undefined),
      current: viewFilter === "enrolled",
      count: count((row) => matchesView(row, "enrolled"))
    },
    {
      id: "untitled",
      label: pick(locale, workCopy.viewUntitled),
      href: viewHref("untitled", undefined),
      current: viewFilter === "untitled",
      count: count((row) => matchesView(row, "untitled"))
    }
  ];
}

function matchesView(row: CockpitWork, view: string | undefined): boolean {
  switch (view) {
    case undefined:
      return true;
    case "owner-intent":
      return cockpitData.gates.some((gate) =>
        gate.workId === row.id
        && gate.status === "pending"
        && gate.outcomeClass === "owner_intent_required");
    case "enrolled":
      return row.sprintWorkId !== null;
    case "untitled":
      return workTitle(row) === null;
    default:
      // An unknown view name filters nothing rather than everything: a stale
      // bookmark should show the full list, not an empty page that reads as
      // "there is no work here".
      return true;
  }
}

/**
 * Every whitespace-separated term must appear somewhere in the record's text.
 *
 * AND rather than OR because the terms a person types are a narrowing: "TMS
 * blocked" means both, and an OR would answer with every TMS record plus every
 * blocked record — a longer list than they started with.
 */
function matchesQuery(row: CockpitWork, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [
    row.externalKey ?? row.id, row.kind, row.status, row.scope ?? ""
  ].join("\n").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function findPartition(id: string) {
  return cockpitData.partitions.find((entry) => entry.id === id);
}

/**
 * A full statement of this page's filter state, including what is *not* set.
 *
 * Every key named in `params` appears in the result: with its value when it has
 * one, and empty when it does not. The empty form is what `buildRouteHref` reads
 * as "remove this key", and saying it explicitly is the whole point — this
 * builder's output is merged over the query in force, where an omitted key means
 * "keep whatever is there". Dropping the empties, as this function used to,
 * turned every "clear one facet" link into a link that changed nothing, and left
 * `project` — the one key the enumeration below never sets — as the only facet
 * that survived, which is the asymmetry the Owner saw from the other side.
 */
function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, value ?? "");
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/**
 * One filter dimension as a compact control: the current value on the button,
 * the options behind a disclosure.
 *
 * Every option of every dimension used to be on screen at once, which is an
 * enumeration rather than a filter — it cost about 340px of chrome above the
 * list, and it grew by one more chip each time the platform gained a kind or a
 * project. A control that shows its value and hides its options costs the same
 * at six options and at sixty.
 *
 * Options are real links, so the whole screen still works with scripting off:
 * the disclosure is native `details`, and each option is a URL that reproduces
 * the same page. Counts come from the already-faceted set, so a reader can see
 * what a choice will cost before making it.
 */
function FilterMenu({
  label,
  allLabel,
  value,
  options,
  hrefFor,
  locale
}: {
  label: string;
  allLabel: string;
  value: string | undefined;
  options: ReadonlyArray<{ id: string; label: string; count: number }>;
  hrefFor: (value: string | undefined) => string;
  locale: TcrnLocale;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  // Close on outside click and Escape. Native details has neither, and a panel
  // that only closes by choosing forces a choice to get rid of it.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const close = (event: Event) => {
      const node = ref.current;
      if (!node?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") node.open = false;
        return;
      }
      if (!node.contains(event.target as Node)) node.open = false;
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details className="tcrn-aos-menu" ref={ref} data-filter-menu={label} data-set={value ? "true" : undefined}>
      <summary className="tcrn-aos-menu__trigger" data-selected={value ? "true" : undefined}>
        <span className="tcrn-aos-menu__key">{label}</span>
        {value ? <b>{value}</b> : <span>{allLabel}</span>}
        <span className="tcrn-aos-menu__caret" aria-hidden="true">▾</span>
      </summary>
      <div className="tcrn-aos-menu__panel">
        <SearchableList
          label={label}
          locale={locale}
          selectedId={value ?? "__all__"}
          searchThreshold={12}
          items={[
            { id: "__all__", label: allLabel, href: hrefFor(undefined), pinned: true },
            ...options.map((option) => ({
              id: option.id,
              label: option.label,
              meta: String(option.count),
              href: hrefFor(option.id)
            }))
          ]}
        />
      </div>
    </details>
  );
}
