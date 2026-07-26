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
export function KnowledgeSpaceView({ locale }: { locale: TcrnLocale; routeHref: (path: string) => string }) {
  const isZh = locale === "zh-CN";

  // Minutes are the one kind the projection currently reaches. Conventions live
  // in the platform's docs tree and cards in the knowledge store; both need
  // reads this pipeline does not yet have, and the view says so rather than
  // rendering three empty columns.
  const minutes = cockpitData.effectiveUnresolved;
  const conferencesWithMinutes = cockpitData.conferences.filter(
    (entry) => entry.status !== "open");

  return (
    <div className="tcrn-aos-view" data-cockpit-view="knowledge">
      <Surface className="tcrn-aos-band">
        <Heading level={1} visualLevel={2}>{isZh ? "知识空间" : "Knowledge space"}</Heading>
        <Text>
          {isZh
            ? "三类持久文本:公约(真值在 git)、知识卡(受治策展目录)、纪要(不可变决策记录)。三者并列呈现但不合并——它们的修改方式各不相同。"
            : "Three kinds of durable text: conventions (truth in git), curated cards (a governed catalogue), and minutes (immutable decision records). Presented side by side but never merged, because each changes in a different way."}
        </Text>
      </Surface>

      <InlineAlert tone="neutral" data-cockpit-notice="no-editor">
        {isZh
          ? "首期无编辑器,这是刻意的:改公约是改 git 里的文件,改知识卡要走受治动词,纪要根本不可改。一个看起来三者通吃的输入框会对其中两者撒谎。"
          : "No editor, deliberately: editing a convention means changing a file in git, editing a card means a governed verb, and minutes cannot be edited at all. A text box that appeared to do all three would be lying about two of them."}
      </InlineAlert>

      <div className="tcrn-aos-project-grid">
        <Surface className="tcrn-aos-project-card" data-knowledge-kind="conventions">
          <Heading level={2} visualLevel={3}>{isZh ? "公约" : "Conventions"}</Heading>
          <Text>{isZh ? "真值在平台 docs 树,此处渲染" : "Truth in the platform docs tree, rendered here"}</Text>
          <InlineAlert tone="warning">
            {isZh ? "未接入:需读取 docs 目录,当前投影只读链。" : "Not ingested: this needs the docs tree, and the projection reads the chain only."}
          </InlineAlert>
        </Surface>

        <Surface className="tcrn-aos-project-card" data-knowledge-kind="cards">
          <Heading level={2} visualLevel={3}>{isZh ? "知识卡" : "Curated cards"}</Heading>
          <Text>{isZh ? "受治策展目录,带新鲜度与晋升门" : "A governed catalogue with freshness and a promotion gate"}</Text>
          <InlineAlert tone="warning">
            {isZh ? "未接入:知识库有独立读面,尚未纳入摄取。" : "Not ingested: the knowledge store has its own read surface, not yet in the pipeline."}
          </InlineAlert>
        </Surface>

        <Surface className="tcrn-aos-project-card" data-knowledge-kind="minutes">
          <Heading level={2} visualLevel={3}>{isZh ? "纪要" : "Minutes"}</Heading>
          <Text>
            {isZh
              ? `${conferencesWithMinutes.length} 场已闭会审议 · ${minutes.length} 份仍有有效未决`
              : `${conferencesWithMinutes.length} closed deliberations, ${minutes.length} with effective open issues`}
          </Text>
          {minutes.length === 0 ? (
            <EmptyState title={isZh ? "没有仍然有效的未决项。" : "No open issue remains effective."} />
          ) : (
            <ul className="tcrn-aos-minutes-list">
              {minutes.slice(0, 8).map((entry) => (
                <li key={entry.minutesId}>
                  <MachineTokenCell
                    token={entry.externalKey ?? entry.minutesId}
                    kind="generic"
                    copyable={false}
                  />
                  <Badge tone="warning">
                    {isZh ? `${entry.effective.length} 条未决` : `${entry.effective.length} open`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </div>
  );
}
