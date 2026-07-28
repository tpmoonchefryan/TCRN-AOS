import {
  Badge,
  EmptyState,
  Heading,
  InlineAlert,
  MachineTokenCell,
  Surface,
  Text
} from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { cockpitData } from "./cockpit-data.generated.js";
import { partitionDisplayName, workTitle, type CockpitWork } from "./cockpit-types.js";
import { pick, type CopyEntry } from "./copy.js";

/**
 * The chain's work status machine, in the order it actually flows.
 *
 * These are the engine's own states rather than a board's invented ones: a card
 * moved here becomes a `work-transition`, and the engine refuses a transition its
 * machine does not allow. Showing anything else would let the board promise
 * moves the chain will reject.
 *
 * The heading is its own copy rather than `chainStatusLabel`: that function returns
 * the chain's word as the chain says it (lowercase `active`, `done`), which is
 * right in a metadata row and wrong as a column title. Same states, different
 * register — so five locales of column heading, not a reuse that would make the
 * board read like a log.
 */
const COLUMNS: ReadonlyArray<{ id: string; label: CopyEntry }> = [
  { id: "planned", label: { "zh-CN": "待办", en: "Planned", ja: "計画済み", ko: "계획됨", fr: "Planifié" } },
  { id: "ready", label: { "zh-CN": "就绪", en: "Ready", ja: "準備完了", ko: "준비됨", fr: "Prêt" } },
  { id: "active", label: { "zh-CN": "进行中", en: "In progress", ja: "進行中", ko: "진행 중", fr: "En cours" } },
  { id: "blocked", label: { "zh-CN": "阻塞", en: "Blocked", ja: "ブロック中", ko: "차단됨", fr: "Bloqué" } },
  { id: "done", label: { "zh-CN": "已完成", en: "Done", ja: "完了", ko: "완료", fr: "Terminé" } }
];

const boardCopy = {
  board: { "zh-CN": "看板", en: "Board", ja: "ボード", ko: "보드", fr: "Tableau" },
  stateMachine: {
    "zh-CN": "列即链上状态机;移动卡片写入 work-transition,非法流转由引擎拒绝。",
    en: "Columns are the chain's own state machine; moving a card writes a work-transition, and the engine refuses an illegal move.",
    ja: "列はチェーン自身の状態機械です。カードを移動すると work-transition が書き込まれ、不正な遷移はエンジンが拒否します。",
    ko: "열은 체인 자체의 상태 기계입니다. 카드를 이동하면 work-transition이 기록되고 잘못된 전이는 엔진이 거부합니다.",
    fr: "Les colonnes sont la machine à états de la chaîne ; déplacer une carte écrit un work-transition, et le moteur refuse un mouvement illégal."
  },
  readOnly: {
    "zh-CN": "本视图当前只读:安全写面(拖拽即流转)随 STORY-010 落地,届时 CAS、时间戳与 actor 由客户端自动补齐。",
    en: "Read-only for now: the safe write surface lands with STORY-010, which supplies CAS, timestamp, and actor automatically.",
    ja: "現時点では読み取り専用です。安全な書き込み面は STORY-010 で導入され、CAS・タイムスタンプ・actor は自動的に補われます。",
    ko: "현재는 읽기 전용입니다. 안전한 쓰기 표면은 STORY-010에서 도입되며 CAS, 타임스탬프, actor를 자동으로 채웁니다.",
    fr: "Lecture seule pour l'instant : la surface d'écriture sûre arrive avec STORY-010, qui fournit automatiquement le CAS, l'horodatage et l'actor."
  },
  emptyColumn: {
    "zh-CN": "此列为空。",
    en: "This column is empty.",
    ja: "この列は空です。",
    ko: "이 열은 비어 있습니다.",
    fr: "Cette colonne est vide."
  },
  terminal: { "zh-CN": "终态", en: "terminal", ja: "終端", ko: "종료 상태", fr: "terminal" }
} satisfies Record<string, CopyEntry>;

const moreNotShown = {
  "zh-CN": "另有 {0} 张未显示。",
  en: "{0} more not shown.",
  ja: "他に {0} 件は表示されていません。",
  ko: "추가 {0}건은 표시되지 않았습니다.",
  fr: "{0} de plus non affichés."
} satisfies CopyEntry;

/**
 * Which transitions the engine permits, mirrored so the board can say what a
 * card can do before anyone tries it.
 *
 * Mirrored, not owned: the engine remains the authority and will refuse anything
 * this gets wrong. Its value is telling a reader why a move is unavailable
 * instead of letting them discover it through a rejection.
 */
const PERMITTED: Record<string, readonly string[]> = {
  planned: ["ready", "cancelled"],
  ready: ["active", "blocked", "cancelled"],
  active: ["blocked", "done", "cancelled"],
  blocked: ["ready", "active", "cancelled"],
  done: [],
  cancelled: []
};

export function BoardView({
  locale,
  routeHref,
  search
}: {
  locale: TcrnLocale;
  routeHref: (path: string) => string;
  search?: URLSearchParams;
}) {
  const projectFilter = search?.get("project") ?? "cross-project";
  const partition = cockpitData.partitions.find((entry) => entry.id === projectFilter);
  const rows = cockpitData.work.filter(
    (row) => row.partitionId === projectFilter && row.kind !== "Release");

  return (
    <div className="tcrn-aos-view" data-cockpit-view="board" data-board-project={projectFilter}>
      <Surface className="tcrn-aos-band">
        <Heading level={1} visualLevel={2}>
          {pick(locale, boardCopy.board)} · {partition ? partitionDisplayName(partition, locale) : projectFilter}
        </Heading>
        <div className="tcrn-aos-detail-head__meta">
          <Text>{pick(locale, boardCopy.stateMachine)}</Text>
          {partition ? <MachineTokenCell token={`v${partition.chainVersion}`} kind="generic" copyable={false} /> : null}
        </div>
      </Surface>

      <InlineAlert tone="neutral" data-cockpit-notice="write-surface-pending">
        {pick(locale, boardCopy.readOnly)}
      </InlineAlert>

      <div className="tcrn-aos-board">
        {COLUMNS.map((column) => {
          const cards = rows.filter((row) => row.status === column.id);
          return (
            <section
              key={column.id}
              className="tcrn-aos-board__column"
              data-board-column={column.id}
              data-permitted-targets={PERMITTED[column.id]?.join(" ") ?? ""}
              aria-label={pick(locale, column.label)}
            >
              <header className="tcrn-aos-board__header">
                <Heading level={2} visualLevel={3}>{pick(locale, column.label)}</Heading>
                <Badge tone="neutral">{cards.length}</Badge>
              </header>
              {cards.length > 0 ? (
                <ol className="tcrn-aos-board__cards">
                  {cards.slice(0, 24).map((card) => (
                    <li key={card.id}>
                      <BoardCard card={card} locale={locale} routeHref={routeHref} />
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState title={pick(locale, boardCopy.emptyColumn)} />
              )}
              {cards.length > 24 ? (
                <Text>{pick(locale, moreNotShown).replaceAll("{0}", String(cards.length - 24))}</Text>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({
  card,
  locale,
  routeHref
}: {
  card: CockpitWork;
  locale: TcrnLocale;
  routeHref: (path: string) => string;
}) {
  const targets = PERMITTED[card.status] ?? [];
  return (
    <a
      className="tcrn-aos-board__card"
      href={routeHref(`/work-items/${card.externalKey ?? card.id}`)}
      data-work-item-key={card.externalKey ?? card.id}
      data-work-kind={card.kind}
    >
      <MachineTokenCell token={card.externalKey ?? card.id} kind="work-item" copyable={false} />
      <span className="tcrn-aos-board__card-title">
        {workTitle(card) ?? (card.externalKey ?? card.id)}
      </span>
      <span className="tcrn-aos-board__card-meta">
        <Badge tone="neutral">{card.kind}</Badge>
        {targets.length === 0 ? (
          <Badge tone="neutral">{pick(locale, boardCopy.terminal)}</Badge>
        ) : null}
      </span>
    </a>
  );
}
