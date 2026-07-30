import {
  Badge,
  Breadcrumb,
  EmptyState,
  Heading,
  InlineAlert,
  MachineTokenCell,
  Surface,
  Text
} from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { cockpitData } from "./cockpit-data.generated.js";
import {
  chainStatusLabel, deliberationContentRead, outcomeClassLabel, type CockpitPosition
} from "./cockpit-types.js";
import { format, pick, type CopyEntry } from "./copy.js";

/**
 * Deliberation-room copy in all five locales.
 *
 * The two refusals carry the weight here. "Execution mode undeclared" is the room
 * declining to present a legacy conference as multi-agent, and the open-issues note
 * ("reading the field raw overstates what is still open") is the one thing stopping
 * a reader from taking the recorded count as the live one. Both were English-only,
 * which means on three of five routes the screen made the claim it was trying to
 * refuse.
 */
const roomCopy = {
  executionUndeclared: {
    "zh-CN": "执行模式未声明",
    en: "execution mode undeclared",
    ja: "実行形態は未宣言",
    ko: "실행 형태 미선언",
    fr: "mode d'exécution non déclaré"
  },
  threadNotRead: {
    "zh-CN": "该项目的立场未读取（投影的读取尝试被拒），此处只有标题与状态,不是这场审议没有立场。",
    en: "This project's positions were not read (the projection's read of them was refused). Only title and status are shown; that is not the same as the deliberation having no positions.",
    ja: "このプロジェクトの立場は読み取られていません（投影による読み取りが拒否されました）。ここには標題とステータスのみが表示されます。この審議に立場がないことと同じではありません。",
    ko: "이 프로젝트의 입장을 읽지 못했습니다(투영의 읽기 시도가 거부되었습니다). 여기에는 제목과 상태만 표시됩니다. 이 심의에 입장이 없다는 뜻이 아닙니다.",
    fr: "Les positions de ce projet n'ont pas été lues (la lecture par la projection a été refusée). Seuls le titre et le statut sont affichés ; ce n'est pas la même chose que l'absence de positions."
  },
  positionsNotRead: {
    "zh-CN": "立场未取。",
    en: "Positions not read.",
    ja: "立場は未取得です。",
    ko: "입장을 조회하지 못했습니다.",
    fr: "Positions non lues."
  },
  noPositions: {
    "zh-CN": "这场审议尚无立场。",
    en: "No position has been recorded yet.",
    ja: "立場はまだ記録されていません。",
    ko: "아직 기록된 입장이 없습니다.",
    fr: "Aucune position n'a encore été enregistrée."
  },
  minutes: { "zh-CN": "纪要", en: "Minutes", ja: "議事録", ko: "회의록", fr: "Compte rendu" },
  openIssuesNote: {
    "zh-CN": "未决项不可变,消解靠后续纪要;裸读会高估未决量。",
    en: "Open issues are immutable and settled by later minutes, so reading the field raw overstates what is still open.",
    ja: "未解決事項は変更できず、解消は後続の議事録によります。フィールドをそのまま読むと未解決量を過大に見積もります。",
    ko: "미해결 사항은 변경할 수 없고 이후 회의록으로 해소됩니다. 필드를 그대로 읽으면 미해결량을 과대평가합니다.",
    fr: "Les points ouverts sont immuables et se règlent par des comptes rendus ultérieurs ; lire le champ brut surestime ce qui reste ouvert."
  },
  allSettled: {
    "zh-CN": "全部已被后续纪要消解。",
    en: "All settled by later minutes.",
    ja: "すべて後続の議事録で解消されています。",
    ko: "모두 이후 회의록으로 해소되었습니다.",
    fr: "Tous réglés par des comptes rendus ultérieurs."
  },
  stillOpen: {
    "zh-CN": "审议进行中,尚未闭会。",
    en: "Still open; no minutes yet.",
    ja: "進行中で、まだ閉会していません。",
    ko: "진행 중이며 아직 폐회하지 않았습니다.",
    fr: "Toujours en cours ; pas encore de compte rendu."
  },
  minutesNotRead: {
    "zh-CN": "纪要未读取。",
    en: "Minutes not read.",
    ja: "議事録は未取得です。",
    ko: "회의록을 조회하지 못했습니다.",
    fr: "Compte rendu non lu."
  },
  adversarial: {
    "zh-CN": "对抗复核",
    en: "adversarial review",
    ja: "対抗レビュー",
    ko: "대항 검토",
    fr: "revue contradictoire"
  },
  deliberations: { "zh-CN": "审议", en: "Deliberations", ja: "審議", ko: "심의", fr: "Délibérations" },
  breadcrumbLabel: {
    "zh-CN": "面包屑导航",
    en: "Breadcrumb",
    ja: "パンくずリスト",
    ko: "탐색 경로",
    fr: "Fil d'Ariane"
  }
} satisfies Record<string, CopyEntry>;

const roomCounted = {
  notFound: {
    "zh-CN": "未找到审议 {0}",
    en: "No deliberation {0}",
    ja: "審議 {0} は見つかりません",
    ko: "심의 {0}을(를) 찾을 수 없습니다",
    fr: "Aucune délibération {0}"
  },
  round: { "zh-CN": "回合 {0}", en: "Round {0}", ja: "ラウンド {0}", ko: "라운드 {0}", fr: "Tour {0}" },
  voices: { "zh-CN": " · {0} 方", en: " · {0} voices", ja: "・{0} 者", ko: " · {0}자", fr: " · {0} intervenants" },
  decisions: {
    "zh-CN": "决策（{0}）",
    en: "Decisions ({0})",
    ja: "決定（{0}）",
    ko: "결정({0})",
    fr: "Décisions ({0})"
  },
  openSurfaceToEffective: {
    "zh-CN": "未决 · 表面 {0} → 有效 {1}",
    en: "Open · {0} recorded → {1} effective",
    ja: "未解決・記録 {0} → 実効 {1}",
    ko: "미해결 · 기록 {0} → 실효 {1}",
    fr: "Ouverts · {0} enregistrés → {1} effectifs"
  },
  fragmentsRejoined: {
    "zh-CN": "{0} 片已重组",
    en: "{0} fragments rejoined",
    ja: "{0} 片を再結合",
    ko: "{0}개 조각 재결합",
    fr: "{0} fragments réassemblés"
  }
} satisfies Record<string, CopyEntry>;

/**
 * The deliberation room — the screen this whole projection exists to make possible.
 *
 * A conference is stored as a flat run of position records under a byte ceiling.
 * Read raw, that is fragments in isolation: half an argument, then half of
 * someone else's. What a reader needs is the argument, who made it, what it was
 * answering, and what the room decided. Four read-layer computations turn one
 * into the other, and every one of them is a place where a naive rendering would
 * mislead.
 */
export function DeliberationRoomView({
  locale,
  routeHref,
  conferenceKey
}: {
  locale: TcrnLocale;
  routeHref: (path: string) => string;
  conferenceKey: string;
}) {
  const conference = cockpitData.conferences.find(
    (entry) => entry.externalKey === conferenceKey || entry.id === conferenceKey);

  if (!conference) {
    return (
      <div className="tcrn-aos-view" data-cockpit-view="deliberation-room">
        <EmptyState title={format(locale, roomCounted.notFound, conferenceKey)} />
      </div>
    );
  }

  const partition = cockpitData.partitions.find((entry) => entry.id === conference.partitionId);
  const thread = cockpitData.threads[conference.id] ?? [];
  const minutes = cockpitData.minutesByConference[conference.id];
  const rounds = groupIntoRounds(thread);
  const threadUnread = !deliberationContentRead(partition);

  return (
    <div
      className="tcrn-aos-view"
      data-cockpit-view="deliberation-room"
      data-conference-key={conference.externalKey ?? conference.id}
    >
      {/* The room was reachable and not leavable: a reader who followed a ruling
          into it had the browser's back button and nothing else — INC-016 again,
          on the one route people arrive at from four different places. The project
          crumb keeps the scope they came in with. */}
      <Breadcrumb
        label={pick(locale, roomCopy.breadcrumbLabel)}
        items={[
          {
            id: "deliberations",
            label: pick(locale, roomCopy.deliberations),
            href: routeHref(`/deliberations?project=${conference.partitionId}`)
          },
          {
            id: conference.id,
            label: conference.externalKey ?? conference.id,
            selected: true
          }
        ]}
      />
      <Surface className="tcrn-aos-band">
        <div className="tcrn-aos-detail-head__meta">
          <MachineTokenCell
            token={conference.externalKey ?? conference.id}
            kind="generic"
            copyable={false}
          />
          {conference.type ? <Badge tone="neutral">{conference.type}</Badge> : null}
          <Badge tone={conference.status === "open" ? "warning" : "neutral"}>
            {chainStatusLabel(conference.status, locale)}
          </Badge>
          {/* Execution provenance is declared per conference from engine v0.6.0.
              Anything predating that stays unverified and is never shown as
              multi-agent: the read path fails closed toward unknown, not toward
              a claim about how the argument was produced. */}
          <Badge tone="neutral" data-provenance="legacy-unverified">
            {pick(locale, roomCopy.executionUndeclared)}
          </Badge>
          {partition ? (
            <MachineTokenCell token={`v${partition.chainVersion}`} kind="generic" copyable={false} />
          ) : null}
        </div>
        <Heading level={1} visualLevel={2}>
          {conference.title ?? conference.externalKey ?? conference.id}
        </Heading>
      </Surface>

      {threadUnread ? (
        <InlineAlert tone="warning" data-cockpit-notice="thread-not-read">
          {pick(locale, roomCopy.threadNotRead)}
        </InlineAlert>
      ) : null}

      <div className="tcrn-aos-room">
        <div className="tcrn-aos-room__thread">
          {rounds.length === 0 ? (
            <EmptyState
              title={pick(locale, threadUnread ? roomCopy.positionsNotRead : roomCopy.noPositions)}
            />
          ) : (
            rounds.map((round, index) => (
              <section key={index} className="tcrn-aos-round" data-round={index + 1}>
                <div className="tcrn-aos-round__label">
                  <Text>
                    {format(locale, roomCounted.round, index + 1)}
                    {round.length > 1 ? format(locale, roomCounted.voices, round.length) : ""}
                  </Text>
                </div>
                {round.map((position) => (
                  <PositionBubble
                    key={position.fragmentIds.join("+")}
                    position={position}
                    locale={locale}
                  />
                ))}
              </section>
            ))
          )}
        </div>

        <aside className="tcrn-aos-room__minutes">
          {minutes ? (
            <Surface className="tcrn-aos-band" data-minutes-key={minutes.externalKey ?? minutes.id}>
              <div className="tcrn-aos-detail-head__meta">
                <MachineTokenCell
                  token={minutes.externalKey ?? minutes.id}
                  kind="generic"
                  copyable={false}
                />
                <Badge tone={minutes.outcomeClass === "owner_intent_required" ? "warning" : "neutral"}>
                  {outcomeClassLabel(minutes.outcomeClass, locale)}
                </Badge>
              </div>
              <Heading level={2} visualLevel={3}>{pick(locale, roomCopy.minutes)}</Heading>
              {minutes.summary ? <Text>{minutes.summary}</Text> : null}

              <Heading level={3} visualLevel={3}>
                {format(locale, roomCounted.decisions, minutes.decisions.length)}
              </Heading>
              <ol className="tcrn-aos-decisions">
                {minutes.decisions.map((decision, index) => <li key={index}>{decision}</li>)}
              </ol>

              <Heading level={3} visualLevel={3}>
                {format(
                  locale,
                  roomCounted.openSurfaceToEffective,
                  minutes.unresolvedIssues.length,
                  minutes.effective.length
                )}
              </Heading>
              <Text>{pick(locale, roomCopy.openIssuesNote)}</Text>
              {minutes.effective.length === 0 ? (
                <EmptyState title={pick(locale, roomCopy.allSettled)} />
              ) : (
                <ul className="tcrn-aos-decisions">
                  {minutes.effective.map((issue, index) => <li key={index}>{issue}</li>)}
                </ul>
              )}
            </Surface>
          ) : (
            <Surface className="tcrn-aos-band">
              <Heading level={2} visualLevel={3}>{pick(locale, roomCopy.minutes)}</Heading>
              <EmptyState
                title={pick(locale, conference.status === "open" ? roomCopy.stillOpen : roomCopy.minutesNotRead)}
              />
            </Surface>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * One argument, with who made it and how many records it took.
 *
 * A position that took several records is marked as reassembled rather than
 * silently joined: a reader who wants the underlying records should be able to
 * tell there are several, and how many.
 */
function PositionBubble({ position, locale }: { position: CockpitPosition; locale: TcrnLocale }) {
  const persona = personaOf(position.actorId);
  return (
    <article
      className="tcrn-aos-bubble"
      data-persona={persona.id}
      data-adversarial={persona.adversarial ? "true" : "false"}
      data-fragments={position.fragmentCount}
    >
      <div className="tcrn-aos-bubble__avatar" aria-hidden="true">{persona.initial}</div>
      <div className="tcrn-aos-bubble__body">
        <div className="tcrn-aos-bubble__who">
          <strong>{persona.label}</strong>
          {position.actorId ? (
            <MachineTokenCell token={position.actorId} kind="generic" copyable={false} />
          ) : null}
          {position.fragmentCount > 1 ? (
            <Badge tone="neutral">
              {format(locale, roomCounted.fragmentsRejoined, position.fragmentCount)}
            </Badge>
          ) : null}
          {persona.adversarial ? (
            <Badge tone="warning">{pick(locale, roomCopy.adversarial)}</Badge>
          ) : null}
        </div>
        <p className="tcrn-aos-bubble__text">{position.body}</p>
      </div>
    </article>
  );
}

/**
 * Persona presentation from the actor id.
 *
 * The actor field is an attribution claim the chain records, not proof of who
 * wrote anything, so this only styles what is already claimed — it never asserts
 * identity the record does not carry.
 */
function personaOf(actorId: string | null): {
  id: string;
  label: string;
  initial: string;
  adversarial: boolean;
} {
  if (!actorId) return { id: "unknown", label: "—", initial: "?", adversarial: false };
  if (actorId.startsWith("owner:")) {
    return { id: "owner", label: "Owner", initial: "O", adversarial: false };
  }
  const match = /^profile:tcrn-([a-z]+)-/u.exec(actorId);
  const name = match?.[1] ?? actorId.replace(/^[a-z]+:/u, "");
  // Verity is the evidence-boundary role: its positions are the ones that try to
  // refute. Marking that is what makes an adversarial round legible as one.
  const adversarial = name === "verity";
  return {
    id: name,
    label: name.charAt(0).toUpperCase() + name.slice(1),
    initial: name.charAt(0).toUpperCase(),
    adversarial
  };
}

/**
 * Split a thread into rounds.
 *
 * The chain has no reply-to field, so a round is inferred from turn-taking: a
 * new round begins when a persona speaks again after others have. That is a
 * presentation aid and nothing more — it never claims one position answered
 * another, only that the room changed speakers.
 */
function groupIntoRounds(thread: readonly CockpitPosition[]): CockpitPosition[][] {
  const rounds: CockpitPosition[][] = [];
  let current: CockpitPosition[] = [];
  const seen = new Set<string>();
  for (const position of thread) {
    const persona = position.actorId ?? "unknown";
    if (seen.has(persona) && current.length > 0) {
      rounds.push(current);
      current = [];
      seen.clear();
    }
    seen.add(persona);
    current.push(position);
  }
  if (current.length > 0) rounds.push(current);
  return rounds;
}
