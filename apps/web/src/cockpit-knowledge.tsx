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
import { hrefAttr, minutesLink } from "./cockpit-links.js";
import { format, pick, type CopyEntry } from "./copy.js";

/**
 * Knowledge-space copy in all five locales.
 *
 * Three of these are refusals, and they are the reason this view is honest at
 * all: two "not ingested" notices that stop an empty column reading as an empty
 * store, the no-editor note that explains why a text box would be lying, and the
 * search field's "minutes only" scope. Every one of them was English, so on the
 * ja, ko and fr routes the screen showed three columns and a search box with
 * nothing to say what they do and do not cover.
 */
const knowledgeCopy = {
  knowledgeSpace: {
    "zh-CN": "知识空间",
    en: "Knowledge space",
    ja: "ナレッジスペース",
    ko: "지식 공간",
    fr: "Espace de connaissance"
  },
  intro: {
    "zh-CN": "三类持久文本:公约(真值在 git)、知识卡(受治策展目录)、纪要(不可变决策记录)。三者并列呈现但不合并——它们的修改方式各不相同。",
    en: "Three kinds of durable text: conventions (truth in git), curated cards (a governed catalogue), and minutes (immutable decision records). Presented side by side but never merged, because each changes in a different way.",
    ja: "三種類の持続的テキスト：公約（真値は git）、キュレーション・カード（受治された目録）、議事録（変更不能な決定記録）。並置しますが統合はしません。変更の方法がそれぞれ異なるからです。",
    ko: "세 가지 지속 텍스트: 규약(진실은 git에), 큐레이션 카드(관리되는 목록), 회의록(변경 불가한 결정 기록). 나란히 제시하지만 병합하지 않습니다. 각각 바뀌는 방식이 다르기 때문입니다.",
    fr: "Trois sortes de texte durable : les conventions (vérité dans git), les fiches curées (un catalogue gouverné) et les comptes rendus (registres de décision immuables). Présentés côte à côte, jamais fusionnés : chacun se modifie autrement."
  },
  noEditor: {
    "zh-CN": "首期无编辑器,这是刻意的:改公约是改 git 里的文件,改知识卡要走受治动词,纪要根本不可改。一个看起来三者通吃的输入框会对其中两者撒谎。",
    en: "No editor, deliberately: editing a convention means changing a file in git, editing a card means a governed verb, and minutes cannot be edited at all. A text box that appeared to do all three would be lying about two of them.",
    ja: "編集機能は意図的にありません。公約の変更は git のファイルの変更であり、カードの変更は受治された動詞を経由し、議事録はそもそも変更できません。三つすべてを扱えるように見える入力欄は、そのうち二つについて嘘をつきます。",
    ko: "편집기는 의도적으로 없습니다. 규약을 바꾸는 것은 git 파일을 바꾸는 일이고, 카드를 바꾸려면 관리된 동사를 거쳐야 하며, 회의록은 아예 바꿀 수 없습니다. 세 가지를 모두 다루는 듯한 입력창은 그중 둘에 대해 거짓을 말하게 됩니다.",
    fr: "Pas d'éditeur, délibérément : modifier une convention, c'est modifier un fichier dans git ; modifier une fiche passe par un verbe gouverné ; un compte rendu ne se modifie pas du tout. Un champ de saisie qui semblerait faire les trois mentirait sur deux d'entre eux."
  },
  conventions: { "zh-CN": "公约", en: "Conventions", ja: "公約", ko: "규약", fr: "Conventions" },
  conventionsWhere: {
    "zh-CN": "真值在平台 docs 树,此处渲染",
    en: "Truth in the platform docs tree, rendered here",
    ja: "真値はプラットフォームの docs ツリー、ここでは描画のみ",
    ko: "진실은 플랫폼 docs 트리에 있고 여기서는 렌더링만 합니다",
    fr: "Vérité dans l'arbre docs de la plateforme, rendue ici"
  },
  conventionsNotRead: {
    "zh-CN": "未接入:需读取 docs 目录,当前投影只读链。",
    en: "Not ingested: this needs the docs tree, and the projection reads the chain only.",
    ja: "未接続：docs ツリーの読み取りが必要で、現在の投影はチェーンのみを読みます。",
    ko: "미연결: docs 트리를 읽어야 하지만 현재 투영은 체인만 읽습니다.",
    fr: "Non ingéré : il faudrait l'arbre docs, or la projection ne lit que la chaîne."
  },
  cards: { "zh-CN": "知识卡", en: "Curated cards", ja: "キュレーション・カード", ko: "큐레이션 카드", fr: "Fiches curées" },
  cardsWhat: {
    "zh-CN": "受治策展目录,带新鲜度与晋升门",
    en: "A governed catalogue with freshness and a promotion gate",
    ja: "鮮度と昇格ゲートを備えた受治目録",
    ko: "신선도와 승격 게이트를 갖춘 관리 목록",
    fr: "Un catalogue gouverné, avec fraîcheur et porte de promotion"
  },
  cardsNotRead: {
    "zh-CN": "未接入:知识库有独立读面,尚未纳入摄取。",
    en: "Not ingested: the knowledge store has its own read surface, not yet in the pipeline.",
    ja: "未接続：ナレッジストアは独自の読み取り面を持ち、まだ取り込みに入っていません。",
    ko: "미연결: 지식 저장소는 자체 읽기 표면을 가지며 아직 수집에 포함되지 않았습니다.",
    fr: "Non ingéré : le magasin de connaissance a sa propre surface de lecture, pas encore dans le pipeline."
  },
  minutes: { "zh-CN": "纪要", en: "Minutes", ja: "議事録", ko: "회의록", fr: "Comptes rendus" },
  searchMinutes: {
    "zh-CN": "检索纪要",
    en: "Search minutes",
    ja: "議事録を検索",
    ko: "회의록 검색",
    fr: "Rechercher des comptes rendus"
  },
  minutesOnly: {
    "zh-CN": "逐字 · 仅纪要",
    en: "literal · minutes only",
    ja: "逐語・議事録のみ",
    ko: "문자 그대로 · 회의록만",
    fr: "littéral · comptes rendus seuls"
  },
  minutesOnlyNote: {
    "zh-CN": "逐字匹配,只检索纪要:可搜键号与未决项正文。公约与知识卡未接入投影,故不在检索范围内——一个看似三者通吃的检索框会静默漏掉三分之二。",
    en: "Literal match over minutes only: key and open-issue text. Conventions and cards are not in the projection, so they are out of scope — one box that appeared to search all three would silently miss two thirds.",
    ja: "逐語一致、議事録のみを検索します：キーと未解決事項の本文が対象です。公約とカードは投影に含まれないため範囲外です。三つすべてを検索するように見える欄は、三分の二を黙って取り落とします。",
    ko: "문자 그대로 일치하며 회의록만 검색합니다. 키와 미해결 사항 본문이 대상입니다. 규약과 카드는 투영에 없으므로 범위 밖입니다. 세 가지를 모두 검색하는 듯한 입력창은 삼분의 이를 조용히 놓칩니다.",
    fr: "Correspondance littérale sur les comptes rendus seuls : clé et texte des points ouverts. Les conventions et les fiches ne sont pas dans la projection, donc hors périmètre — un champ qui semblerait chercher dans les trois en manquerait deux tiers en silence."
  },
  noneEffective: {
    "zh-CN": "没有仍然有效的未决项。",
    en: "No open issue remains effective.",
    ja: "有効な未解決事項は残っていません。",
    ko: "유효하게 남은 미해결 사항이 없습니다.",
    fr: "Aucun point ouvert ne reste effectif."
  },
  clearSearch: {
    "zh-CN": "清除检索",
    en: "Clear search",
    ja: "検索を解除",
    ko: "검색 지우기",
    fr: "Effacer la recherche"
  }
} satisfies Record<string, CopyEntry>;

const knowledgeCounted = {
  minutesSummary: {
    "zh-CN": "{0} 场已闭会审议 · {1} / {2} 份仍有有效未决",
    en: "{0} closed deliberations, {1} of {2} with effective open issues",
    ja: "閉会した審議 {0} 場・{2} 份のうち {1} 份に実効の未解決あり",
    ko: "폐회된 심의 {0}건 · {2}건 중 {1}건에 실효 미해결 있음",
    fr: "{0} délibérations closes ; {1} sur {2} avec des points ouverts effectifs"
  },
  noMatch: {
    "zh-CN": "没有纪要匹配“{0}”。",
    en: "No minutes match “{0}”.",
    ja: "「{0}」に一致する議事録はありません。",
    ko: "“{0}”에 일치하는 회의록이 없습니다.",
    fr: "Aucun compte rendu ne correspond à « {0} »."
  },
  openCount: { "zh-CN": "{0} 条未决", en: "{0} open", ja: "未解決 {0}", ko: "미해결 {0}건", fr: "{0} ouverts" },
  showingEight: {
    "zh-CN": "此处显示 {0} 份中的前 8 份,用检索缩小范围。",
    en: "Showing 8 of {0}; narrow with search.",
    ja: "全 {0} 份のうち先頭 8 份を表示しています。検索で絞り込んでください。",
    ko: "총 {0}건 중 8건을 표시합니다. 검색으로 범위를 좁히세요.",
    fr: "Affichage de 8 sur {0} ; affinez par la recherche."
  }
} satisfies Record<string, CopyEntry>;

/**
 * Knowledge space — the three kinds of durable text this platform keeps, each
 * rendered where it lives rather than copied into a wiki.
 *
 * Conventions are files in git; curated cards are a governed, bounded catalogue;
 * minutes are immutable decision records. They are presented together because a
 * reader looking for "what did we decide about X" does not care which store
 * holds it — but they are not merged, because each has a different way of being
 * changed, and a single editor over all three would misrepresent all three.
 *
 * There is no editor here on purpose. Editing a convention means changing a file
 * in git; editing a card means a governed verb; minutes cannot be edited at all.
 * A text box that appeared to do any of those would be lying about two of them.
 */
export function KnowledgeSpaceView({
  locale,
  routeHref,
  search
}: {
  locale: TcrnLocale;
  routeHref: (path: string) => string;
  search?: URLSearchParams;
}) {
  // Minutes are the one kind the projection currently reaches. Conventions live
  // in the platform's docs tree and cards in the knowledge store; both need
  // reads this pipeline does not yet have, and the view says so rather than
  // rendering three empty columns.
  const allMinutes = cockpitData.effectiveUnresolved;
  // 97 minutes carry an effective open issue and the card showed eight, with
  // nothing offering the other 89 (TCRN-AOS-INC-015). The search is scoped to
  // minutes and says so: the other two kinds are not ingested, and one box that
  // appeared to search all three would miss two thirds of the space silently —
  // the same failure mode as the absent editor this view already explains.
  const [query, setQuery] = useState(search?.get("knowledgeQuery") ?? "");
  const minutes = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
    if (terms.length === 0) return allMinutes;
    return allMinutes.filter((entry) => {
      const haystack = [
        entry.externalKey ?? "",
        entry.minutesId,
        ...entry.effective
      ].join("\n").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [allMinutes, query]);
  const conferencesWithMinutes = cockpitData.conferences.filter(
    (entry) => entry.status !== "open");

  return (
    <div className="tcrn-aos-view" data-cockpit-view="knowledge">
      <Surface className="tcrn-aos-band">
        <Heading level={1} visualLevel={2}>{pick(locale, knowledgeCopy.knowledgeSpace)}</Heading>
        <Text>{pick(locale, knowledgeCopy.intro)}</Text>
      </Surface>

      <InlineAlert tone="neutral" data-cockpit-notice="no-editor">
        {pick(locale, knowledgeCopy.noEditor)}
      </InlineAlert>

      <div className="tcrn-aos-project-grid">
        <Surface className="tcrn-aos-project-card" data-knowledge-kind="conventions">
          <Heading level={2} visualLevel={3}>{pick(locale, knowledgeCopy.conventions)}</Heading>
          <Text>{pick(locale, knowledgeCopy.conventionsWhere)}</Text>
          <InlineAlert tone="warning">{pick(locale, knowledgeCopy.conventionsNotRead)}</InlineAlert>
        </Surface>

        <Surface className="tcrn-aos-project-card" data-knowledge-kind="cards">
          <Heading level={2} visualLevel={3}>{pick(locale, knowledgeCopy.cards)}</Heading>
          <Text>{pick(locale, knowledgeCopy.cardsWhat)}</Text>
          <InlineAlert tone="warning">{pick(locale, knowledgeCopy.cardsNotRead)}</InlineAlert>
        </Surface>

        <Surface className="tcrn-aos-project-card" data-knowledge-kind="minutes">
          <Heading level={2} visualLevel={3}>{pick(locale, knowledgeCopy.minutes)}</Heading>
          <Text>
            {format(
              locale,
              knowledgeCounted.minutesSummary,
              conferencesWithMinutes.length,
              minutes.length,
              allMinutes.length
            )}
          </Text>
          <div className="tcrn-aos-searchbar">
            <SearchInput
              aria-label={pick(locale, knowledgeCopy.searchMinutes)}
              placeholder={pick(locale, knowledgeCopy.searchMinutes)}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              data-cockpit-search="knowledge-minutes"
            />
            <span className="tcrn-aos-searchbar__note" title={pick(locale, knowledgeCopy.minutesOnlyNote)}>
              {pick(locale, knowledgeCopy.minutesOnly)}
            </span>
            {query ? (
              // `knowledgeQuery=` states the removal; a bare `/knowledge` would
              // inherit the query in force and clear nothing.
              <a
                className="tcrn-aos-chip"
                href={routeHref("/knowledge?knowledgeQuery=")}
                data-cockpit-clear="knowledge"
              >
                {pick(locale, knowledgeCopy.clearSearch)}
              </a>
            ) : null}
          </div>
          {minutes.length === 0 ? (
            <EmptyState
              title={query
                ? format(locale, knowledgeCounted.noMatch, query)
                : pick(locale, knowledgeCopy.noneEffective)}
            />
          ) : (
            <ul className="tcrn-aos-minutes-list">
              {minutes.slice(0, 8).map((entry) => {
                // Minutes are read inside the deliberation that closed with them,
                // so the key is a link there (INC-018). All 97 in this projection
                // resolve; the resolver still returns no href when one does not,
                // and the token then stays text rather than 404ing.
                const link = minutesLink(entry.minutesId, routeHref);
                return (
                  <li key={entry.minutesId}>
                    <MachineTokenCell
                      token={entry.externalKey ?? link.label}
                      kind="generic"
                      copyable={false}
                      {...hrefAttr(link)}
                    />
                    <Badge tone="warning">
                      {format(locale, knowledgeCounted.openCount, entry.effective.length)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
          {minutes.length > 8 ? (
            <Text>{format(locale, knowledgeCounted.showingEight, minutes.length)}</Text>
          ) : null}
        </Surface>
      </div>
    </div>
  );
}
