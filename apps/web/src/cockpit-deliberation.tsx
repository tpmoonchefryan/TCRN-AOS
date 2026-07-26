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
import type { CockpitConference } from "./cockpit-types.js";

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
  const isZh = locale === "zh-CN";
  const projectFilter = search?.get("project") ?? undefined;
  const conferences = cockpitData.conferences.filter(
    (entry) => !projectFilter || entry.partitionId === projectFilter);
  const open = conferences.filter((entry) => entry.status === "open");
  const closed = conferences.filter((entry) => entry.status !== "open");

  const unread = cockpitData.partitions.filter((entry) => entry.unavailable.length > 0);

  return (
    <div className="tcrn-aos-view" data-cockpit-view="deliberations">
      <Surface className="tcrn-aos-band">
        <Heading level={1} visualLevel={2}>{isZh ? "审议" : "Deliberations"}</Heading>
        <Text>
          {isZh
            ? `${conferences.length} 场审议 · 立场逐字上链、按 persona 署名、闭会产出纪要`
            : `${conferences.length} deliberations; positions are recorded verbatim, signed by persona, and closed with minutes.`}
        </Text>
      </Surface>

      {unread.length > 0 ? (
        <InlineAlert tone="warning" data-cockpit-notice="threads-unread">
          {isZh
            ? `以下项目的立场与纪要未读取,其审议只显示标题:${unread.map((entry) => entry.labelZh).join("、")}。`
            : `Positions and minutes were not read for ${unread.map((entry) => entry.label).join(", ")}, so their deliberations show titles only.`}
        </InlineAlert>
      ) : null}

      <ConferenceBand
        title={isZh ? `进行中（${open.length}）` : `Open (${open.length})`}
        empty={isZh ? "没有进行中的审议。" : "No deliberation is open."}
        conferences={open}
        locale={locale}
        routeHref={routeHref}
      />
      <ConferenceBand
        title={isZh ? `已闭会（${closed.length}）` : `Closed (${closed.length})`}
        empty={isZh ? "尚无已闭会审议。" : "No deliberation has closed yet."}
        conferences={closed.slice(0, 30)}
        locale={locale}
        routeHref={routeHref}
      />
    </div>
  );
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
  const isZh = locale === "zh-CN";
  return (
    <Surface className="tcrn-aos-band">
      <Heading level={2} visualLevel={3}>{title}</Heading>
      {conferences.length === 0 ? <EmptyState title={empty} /> : (
        <ol className="tcrn-aos-conference-list">
          {conferences.map((conference) => {
            const partition = cockpitData.partitions.find((entry) => entry.id === conference.partitionId);
            const threadRead = partition ? !partition.unavailable.includes("positions") : false;
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
                      {conference.status}
                    </Badge>
                    {/* Execution provenance is recorded per conference from v0.6.0.
                        Anything predating that declaration stays unverified and is
                        never presented as multi-agent — the read path fails closed
                        toward "unknown", not toward a claim. */}
                    <Badge tone="neutral">
                      {isZh ? "溯源未声明" : "provenance unverified"}
                    </Badge>
                    {threadRead ? null : (
                      <Badge tone="warning">{isZh ? "立场未取" : "thread not read"}</Badge>
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
