import { useMemo, useState } from "react";
import {
  Badge,
  EmptyState,
  Heading,
  InlineAlert,
  MachineTokenCell,
  SearchInput,
  Surface,
  Text
} from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { cockpitData } from "./cockpit-data.generated.js";
import {
  chainStatusLabel, deliberationContentRead, partitionDisplayName, type CockpitConference
} from "./cockpit-types.js";
import { format, joinNames, pick, type CopyEntry } from "./copy.js";

/**
 * Deliberation-index copy in all five locales.
 *
 * Two strings here are doing more than labelling. The search field's "literal"
 * note tells a reader that position and minutes bodies are *not* in the haystack —
 * without it, a search that returns nothing reads as "no such deliberation" rather
 * than "that text is not indexed". And "provenance unverified" is a refusal to
 * claim multi-agent execution; in English on a French route it is a badge nobody
 * can act on.
 */
const deliberationCopy = {
  deliberations: { "zh-CN": "审议", en: "Deliberations", ja: "審議", ko: "심의", fr: "Délibérations" },
  searchLabel: {
    "zh-CN": "检索审议",
    en: "Search deliberations",
    ja: "審議を検索",
    ko: "심의 검색",
    fr: "Rechercher des délibérations"
  },
  literal: { "zh-CN": "逐字", en: "literal", ja: "逐語", ko: "문자 그대로", fr: "littéral" },
  literalNote: {
    "zh-CN": "逐字匹配:多个词须全部命中。可检索键号、标题、类型与状态;立场与纪要正文不在此构建的投影里。",
    en: "Literal match; every term must hit. Key, title, type, and status are searchable; position and minutes bodies are not in this build's projection.",
    ja: "逐語一致：複数の語はすべて命中する必要があります。キー・標題・種別・ステータスが検索対象です。立場と議事録の本文はこのビルドの投影に含まれません。",
    ko: "문자 그대로 일치: 여러 단어는 모두 적중해야 합니다. 키, 제목, 종류, 상태를 검색할 수 있습니다. 입장과 회의록 본문은 이 빌드의 투영에 없습니다.",
    fr: "Correspondance littérale ; chaque terme doit être trouvé. La clé, le titre, le type et le statut sont recherchables ; les corps des positions et des comptes rendus ne sont pas dans la projection de cette version."
  },
  openEmpty: {
    "zh-CN": "没有进行中的审议。",
    en: "No deliberation is open.",
    ja: "進行中の審議はありません。",
    ko: "진행 중인 심의가 없습니다.",
    fr: "Aucune délibération n'est en cours."
  },
  closedEmpty: {
    "zh-CN": "尚无已闭会审议。",
    en: "No deliberation has closed yet.",
    ja: "閉会した審議はまだありません。",
    ko: "폐회된 심의가 아직 없습니다.",
    fr: "Aucune délibération n'est encore close."
  },
  provenanceUnverified: {
    "zh-CN": "溯源未声明",
    en: "provenance unverified",
    ja: "実行形態は未宣言",
    ko: "실행 형태 미선언",
    fr: "provenance non déclarée"
  },
  threadNotRead: {
    "zh-CN": "立场未取",
    en: "thread not read",
    ja: "立場は未取得",
    ko: "입장 미조회",
    fr: "fil non lu"
  }
} satisfies Record<string, CopyEntry>;

const deliberationCounted = {
  description: {
    "zh-CN": "{0} / {1} 场审议 · 立场逐字上链、按 persona 署名、闭会产出纪要",
    en: "{0} of {1} deliberations; positions are recorded verbatim, signed by persona, and closed with minutes.",
    ja: "{1} 場のうち {0} 場の審議。立場は逐語で記録され、persona で署名され、閉会時に議事録が生成されます。",
    ko: "심의 {1}건 중 {0}건. 입장은 그대로 기록되고 persona로 서명되며 폐회 시 회의록이 생성됩니다.",
    fr: "{0} délibérations sur {1} ; les positions sont enregistrées mot pour mot, signées par persona et closes par un compte rendu."
  },
  clearSearch: {
    "zh-CN": "清除检索“{0}”",
    en: "Clear search “{0}”",
    ja: "検索「{0}」を解除",
    ko: "검색 “{0}” 지우기",
    fr: "Effacer la recherche « {0} »"
  },
  threadsUnread: {
    "zh-CN": "以下项目的立场与纪要未读取,其审议只显示标题:{0}。",
    en: "Positions and minutes were not read for {0}, so their deliberations show titles only.",
    ja: "次のプロジェクトの立場と議事録は読み取られていないため、その審議は標題のみ表示します：{0}。",
    ko: "다음 프로젝트의 입장과 회의록을 읽지 못했으므로 해당 심의는 제목만 표시합니다. {0}.",
    fr: "Les positions et les comptes rendus n'ont pas été lus pour {0} ; leurs délibérations n'affichent que les titres."
  },
  openCount: {
    "zh-CN": "进行中（{0}）",
    en: "Open ({0})",
    ja: "進行中（{0}）",
    ko: "진행 중({0})",
    fr: "En cours ({0})"
  },
  closedCount: {
    "zh-CN": "已闭会（{0}）",
    en: "Closed ({0})",
    ja: "閉会（{0}）",
    ko: "폐회({0})",
    fr: "Closes ({0})"
  },
  showingRecent: {
    "zh-CN": "已闭会共 {0} 场,此处显示最近 {1} 场。",
    en: "Showing the most recent {1} of {0} closed deliberations.",
    ja: "閉会は全 {0} 場で、ここには最近の {1} 場を表示しています。",
    ko: "폐회는 총 {0}건이며 여기에는 최근 {1}건을 표시합니다.",
    fr: "Affichage des {1} plus récentes sur {0} délibérations closes."
  }
} satisfies Record<string, CopyEntry>;

/**
 * Deliberations — the position threads and the minutes that closed them.
 *
 * This is the view that pays for the whole projection: a conference is recorded
 * as a flat run of position records with a byte ceiling, and reading it raw
 * gives fragments in isolation. What a person needs is the argument.
 */
export function DeliberationsView({
  locale,
  routeHref,
  search
}: {
  locale: TcrnLocale;
  routeHref: (path: string) => string;
  search?: URLSearchParams;
}) {
  const projectFilter = search?.get("project") ?? undefined;
  // Server-rendered from the URL so a shared link lands on the same result set;
  // the client owns it from there. Same contract as the work items module.
  const [query, setQuery] = useState(search?.get("q") ?? "");
  const scoped = useMemo(() => cockpitData.conferences.filter(
    (entry) => !projectFilter || entry.partitionId === projectFilter), [projectFilter]);
  const conferences = useMemo(
    () => scoped.filter((entry) => matchesQuery(entry, query)), [scoped, query]);
  const open = conferences.filter((entry) => entry.status === "open");
  const closed = conferences.filter((entry) => entry.status !== "open");

  // Named family, not "missing anything": this banner speaks about positions and
  // minutes, and asking the wider question kept it on screen after both became
  // readable (TCRN-AOS-STORY-134).
  const unread = cockpitData.partitions.filter((entry) => !deliberationContentRead(entry));

  const clearSearchQuery = new URLSearchParams({
    q: "",
    ...(projectFilter ? { project: projectFilter } : {})
  }).toString();

  return (
    <div className="tcrn-aos-view" data-cockpit-view="deliberations">
      <Surface className="tcrn-aos-band">
        <Heading level={1} visualLevel={2}>{pick(locale, deliberationCopy.deliberations)}</Heading>
        <Text>{format(locale, deliberationCounted.description, conferences.length, scoped.length)}</Text>
      </Surface>

      {/* A module whose purpose is locating a past deliberation had no way to
          look one up (TCRN-AOS-INC-015): it received a URLSearchParams and used
          it for a single key, and the closed band truncates at 30 of N, so
          anything older than the last thirty was unreachable by any means the
          page offered. The control is DS SearchInput and the query key is `q`,
          matching the work items module rather than inventing a second idiom. */}
      <Surface className="tcrn-aos-filters">
        <div className="tcrn-aos-toolbar">
          <div className="tcrn-aos-searchbar">
            {/* `fill` is the DS prop this container used to fake by styling
                `.tcrn-search-input` from outside — a consumer reaching into the
                component's class names, retired with the admission. */}
            <SearchInput
              fill
              aria-label={pick(locale, deliberationCopy.searchLabel)}
              placeholder={pick(locale, deliberationCopy.searchLabel)}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              data-cockpit-search="deliberations"
            />
            <span className="tcrn-aos-searchbar__note" title={pick(locale, deliberationCopy.literalNote)}>
              {pick(locale, deliberationCopy.literal)}
            </span>
          </div>
          {query ? (
            // `q=` with no value states the removal. A bare `/deliberations`
            // would inherit the query in force and land back on the search it
            // offers to clear — the subtraction rule in `buildRouteHref`. The
            // project rides along: scope is the reader's, not this search's.
            <a
              className="tcrn-aos-chip"
              href={routeHref(`/deliberations?${clearSearchQuery}`)}
              data-cockpit-clear="deliberations"
            >
              {format(locale, deliberationCounted.clearSearch, query)}
            </a>
          ) : null}
        </div>
      </Surface>

      {unread.length > 0 ? (
        <InlineAlert tone="warning" data-cockpit-notice="threads-unread">
          {format(
            locale,
            deliberationCounted.threadsUnread,
            joinNames(unread.map((entry) => partitionDisplayName(entry, locale)), locale)
          )}
        </InlineAlert>
      ) : null}

      <ConferenceBand
        title={format(locale, deliberationCounted.openCount, open.length)}
        empty={pick(locale, deliberationCopy.openEmpty)}
        conferences={open}
        locale={locale}
        routeHref={routeHref}
      />
      <ConferenceBand
        title={format(locale, deliberationCounted.closedCount, closed.length)}
        empty={pick(locale, deliberationCopy.closedEmpty)}
        conferences={closed.slice(0, 30)}
        locale={locale}
        routeHref={routeHref}
      />
      {closed.length > 30 ? (
        <Text>{format(locale, deliberationCounted.showingRecent, closed.length, 30)}</Text>
      ) : null}
    </div>
  );
}

/**
 * Literal match over the fields this build actually projects.
 *
 * AND across terms, like the work items module: the words a person types narrow,
 * so "TMS closed" means both. Position and minutes bodies are deliberately not
 * in the haystack — they are not in the projection, and searching a field the
 * page cannot read would return nothing and look like an absence of records.
 */
function matchesQuery(conference: CockpitConference, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [
    conference.externalKey ?? conference.id,
    conference.title ?? "",
    conference.type ?? "",
    conference.status
  ].join("\n").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function ConferenceBand({
  title,
  empty,
  conferences,
  locale,
  routeHref
}: {
  title: string;
  empty: string;
  conferences: readonly CockpitConference[];
  locale: TcrnLocale;
  routeHref: (path: string) => string;
}) {
  return (
    <Surface className="tcrn-aos-band">
      <Heading level={2} visualLevel={3}>{title}</Heading>
      {conferences.length === 0 ? <EmptyState title={empty} /> : (
        <ol className="tcrn-aos-conference-list">
          {conferences.map((conference) => {
            const partition = cockpitData.partitions.find((entry) => entry.id === conference.partitionId);
            const threadRead = deliberationContentRead(partition);
            return (
              <li key={conference.id}>
                <a
                  className="tcrn-aos-conference-row"
                  href={routeHref(`/deliberations/${conference.externalKey ?? conference.id}`)}
                  data-conference-key={conference.externalKey ?? conference.id}
                >
                  <MachineTokenCell
                    token={conference.externalKey ?? conference.id}
                    kind="generic"
                    copyable={false}
                  />
                  <span className="tcrn-aos-conference-row__title">
                    {conference.title ?? conference.externalKey ?? conference.id}
                  </span>
                  <span className="tcrn-aos-conference-row__meta">
                    {conference.type ? <Badge tone="neutral">{conference.type}</Badge> : null}
                    <Badge tone={conference.status === "open" ? "warning" : "neutral"}>
                      {chainStatusLabel(conference.status, locale)}
                    </Badge>
                    {/* Execution provenance is recorded per conference from v0.6.0.
                        Anything predating that declaration stays unverified and is
                        never presented as multi-agent — the read path fails closed
                        toward "unknown", not toward a claim. */}
                    <Badge tone="neutral">
                      {pick(locale, deliberationCopy.provenanceUnverified)}
                    </Badge>
                    {threadRead ? null : (
                      <Badge tone="warning">{pick(locale, deliberationCopy.threadNotRead)}</Badge>
                    )}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </Surface>
  );
}
