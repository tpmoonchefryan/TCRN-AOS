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
import { workTitle, type CockpitWork } from "./cockpit-types.js";

/**
 * The chain's work status machine, in the order it actually flows.
 *
 * These are the engine's own states rather than a board's invented ones: a card
 * moved here becomes a `work-transition`, and the engine refuses a transition its
 * machine does not allow. Showing anything else would let the board promise
 * moves the chain will reject.
 */
const COLUMNS = [
  { id: "planned", label: "Planned", labelZh: "待办" },
  { id: "ready", label: "Ready", labelZh: "就绪" },
  { id: "active", label: "In progress", labelZh: "进行中" },
  { id: "blocked", label: "Blocked", labelZh: "阻塞" },
  { id: "done", label: "Done", labelZh: "已完成" }
] as const;

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
  const isZh = locale === "zh-CN";
  const projectFilter = search?.get("project") ?? "cross-project";
  const partition = cockpitData.partitions.find((entry) => entry.id === projectFilter);
  const rows = cockpitData.work.filter(
    (row) => row.partitionId === projectFilter && row.kind !== "Release");

  return (
    <div className="tcrn-aos-view" data-cockpit-view="board" data-board-project={projectFilter}>
      <Surface className="tcrn-aos-band">
        <Heading level={1} visualLevel={2}>
          {isZh ? "看板" : "Board"} · {partition ? (isZh ? partition.labelZh : partition.label) : projectFilter}
        </Heading>
        <div className="tcrn-aos-detail-head__meta">
          <Text>
            {isZh
              ? `列即链上状态机;移动卡片写入 work-transition,非法流转由引擎拒绝。`
              : "Columns are the chain's own state machine; moving a card writes a work-transition, and the engine refuses an illegal move."}
          </Text>
          {partition ? <MachineTokenCell token={`v${partition.chainVersion}`} kind="generic" copyable={false} /> : null}
        </div>
      </Surface>

      <InlineAlert tone="neutral" data-cockpit-notice="write-surface-pending">
        {isZh
          ? "本视图当前只读:安全写面(拖拽即流转)随 STORY-010 落地,届时 CAS、时间戳与 actor 由客户端自动补齐。"
          : "Read-only for now: the safe write surface lands with STORY-010, which supplies CAS, timestamp, and actor automatically."}
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
              aria-label={isZh ? column.labelZh : column.label}
            >
              <header className="tcrn-aos-board__header">
                <Heading level={2} visualLevel={3}>{isZh ? column.labelZh : column.label}</Heading>
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
                <EmptyState title={isZh ? "此列为空。" : "This column is empty."} />
              )}
              {cards.length > 24 ? (
                <Text>{isZh ? `另有 ${cards.length - 24} 张未显示。` : `${cards.length - 24} more not shown.`}</Text>
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
  const isZh = locale === "zh-CN";
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
          <Badge tone="neutral">{isZh ? "终态" : "terminal"}</Badge>
        ) : null}
      </span>
    </a>
  );
}
