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
import type { CockpitPosition } from "./cockpit-types.js";

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
  conferenceKey
}: {
  locale: TcrnLocale;
  routeHref: (path: string) => string;
  conferenceKey: string;
}) {
  const isZh = locale === "zh-CN";
  const conference = cockpitData.conferences.find(
    (entry) => entry.externalKey === conferenceKey || entry.id === conferenceKey);

  if (!conference) {
    return (
      <div className="tcrn-aos-view" data-cockpit-view="deliberation-room">
        <EmptyState title={isZh ? `未找到审议 ${conferenceKey}` : `No deliberation ${conferenceKey}`} />
      </div>
    );
  }

  const partition = cockpitData.partitions.find((entry) => entry.id === conference.partitionId);
  const thread = cockpitData.threads[conference.id] ?? [];
  const minutes = cockpitData.minutesByConference[conference.id];
  const rounds = groupIntoRounds(thread);
  const threadUnread = Boolean(partition?.unavailable.includes("positions"));

  return (
    <div
      className="tcrn-aos-view"
      data-cockpit-view="deliberation-room"
      data-conference-key={conference.externalKey ?? conference.id}
    >
      <Surface className="tcrn-aos-band">
        <div className="tcrn-aos-detail-head__meta">
          <MachineTokenCell
            token={conference.externalKey ?? conference.id}
            kind="generic"
            copyable={false}
          />
          {conference.type ? <Badge tone="neutral">{conference.type}</Badge> : null}
          <Badge tone={conference.status === "open" ? "warning" : "neutral"}>{conference.status}</Badge>
          {/* Execution provenance is declared per conference from engine v0.6.0.
              Anything predating that stays unverified and is never shown as
              multi-agent: the read path fails closed toward unknown, not toward
              a claim about how the argument was produced. */}
          <Badge tone="neutral" data-provenance="legacy-unverified">
            {isZh ? "执行模式未声明" : "execution mode undeclared"}
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
          {isZh
            ? "该项目的立场未读取（链体量超出读面上限），此处只有标题与状态,不是这场审议没有立场。"
            : "This project's positions were not read (its chain exceeds the read surface ceiling). Only title and status are shown; that is not the same as the deliberation having no positions."}
        </InlineAlert>
      ) : null}

      <div className="tcrn-aos-room">
        <div className="tcrn-aos-room__thread">
          {rounds.length === 0 ? (
            <EmptyState
              title={threadUnread
                ? (isZh ? "立场未取。" : "Positions not read.")
                : (isZh ? "这场审议尚无立场。" : "No position has been recorded yet.")}
            />
          ) : (
            rounds.map((round, index) => (
              <section key={index} className="tcrn-aos-round" data-round={index + 1}>
                <div className="tcrn-aos-round__label">
                  <Text>
                    {isZh ? `回合 ${index + 1}` : `Round ${index + 1}`}
                    {round.length > 1
                      ? (isZh ? ` · ${round.length} 方` : ` · ${round.length} voices`)
                      : ""}
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
                  {minutes.outcomeClass}
                </Badge>
              </div>
              <Heading level={2} visualLevel={3}>{isZh ? "纪要" : "Minutes"}</Heading>
              {minutes.summary ? <Text>{minutes.summary}</Text> : null}

              <Heading level={3} visualLevel={3}>
                {isZh ? `决策（${minutes.decisions.length}）` : `Decisions (${minutes.decisions.length})`}
              </Heading>
              <ol className="tcrn-aos-decisions">
                {minutes.decisions.map((decision, index) => <li key={index}>{decision}</li>)}
              </ol>

              <Heading level={3} visualLevel={3}>
                {isZh
                  ? `未决 · 表面 ${minutes.unresolvedIssues.length} → 有效 ${minutes.effective.length}`
                  : `Open · ${minutes.unresolvedIssues.length} recorded → ${minutes.effective.length} effective`}
              </Heading>
              <Text>
                {isZh
                  ? "未决项不可变,消解靠后续纪要;裸读会高估未决量。"
                  : "Open issues are immutable and settled by later minutes, so reading the field raw overstates what is still open."}
              </Text>
              {minutes.effective.length === 0 ? (
                <EmptyState title={isZh ? "全部已被后续纪要消解。" : "All settled by later minutes."} />
              ) : (
                <ul className="tcrn-aos-decisions">
                  {minutes.effective.map((issue, index) => <li key={index}>{issue}</li>)}
                </ul>
              )}
            </Surface>
          ) : (
            <Surface className="tcrn-aos-band">
              <Heading level={2} visualLevel={3}>{isZh ? "纪要" : "Minutes"}</Heading>
              <EmptyState
                title={conference.status === "open"
                  ? (isZh ? "审议进行中,尚未闭会。" : "Still open; no minutes yet.")
                  : (isZh ? "纪要未读取。" : "Minutes not read.")}
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
  const isZh = locale === "zh-CN";
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
              {isZh ? `${position.fragmentCount} 片已重组` : `${position.fragmentCount} fragments rejoined`}
            </Badge>
          ) : null}
          {persona.adversarial ? (
            <Badge tone="warning">{isZh ? "对抗复核" : "adversarial review"}</Badge>
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
