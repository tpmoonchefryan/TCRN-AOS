import { useEffect, useState } from "react";
import { EnvironmentBanner } from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { cockpitData } from "./cockpit-data.generated.js";
import { format, type CopyEntry } from "./copy.js";

/**
 * The banner's three statements, in all five locales.
 *
 * This band renders above every route, so an English string here was the first
 * thing a ja, ko or fr reader saw on every screen — and what it says is the frame
 * the rest of the page is read inside ("this is a copy, taken then"). A reader who
 * cannot read it reads every number on the page as current.
 */
const bannerCopy = {
  local: {
    "zh-CN": "本机驾驶舱 · 数据截至 {0} · {1}",
    en: "Local cockpit — data as of {0} · {1}",
    ja: "ローカル・コックピット・データ基準 {0}・{1}",
    ko: "로컬 코크핏 · 데이터 기준 {0} · {1}",
    fr: "Cockpit local — données au {0} · {1}"
  },
  mirror: {
    "zh-CN": "只读镜像 · 数据截至 {0} · 写面在本机 · {1}",
    en: "Read-only mirror — data as of {0}; writes happen on the operator's machine · {1}",
    ja: "読み取り専用ミラー・データ基準 {0}・書き込みは操作者のマシンで行われます・{1}",
    ko: "읽기 전용 미러 · 데이터 기준 {0} · 쓰기는 운영자 머신에서 수행됩니다 · {1}",
    fr: "Miroir en lecture seule — données au {0} ; les écritures ont lieu sur la machine de l'opérateur · {1}"
  },
  unknown: {
    "zh-CN": "数据截至 {0} · {1}",
    en: "Data as of {0} · {1}",
    ja: "データ基準 {0}・{1}",
    ko: "데이터 기준 {0} · {1}",
    fr: "Données au {0} · {1}"
  }
} satisfies Record<string, CopyEntry>;

/**
 * A standing statement, on every screen, of which copy of the cockpit this is
 * and how old its data is.
 *
 * The detail page's domain panel already says "read-only mirror" once a reader
 * opens one. That is not enough: someone can look at the board, the inbox and
 * the audit view for a whole session without touching a detail page, and every
 * number they read is as of the last projection rather than as of now. On a
 * screen full of governance state, "this is a copy, taken then" is not a footnote
 * — it is the frame everything else has to be read inside.
 *
 * Which copy it is comes from asking, not from a build flag. The same bundle is
 * served by the local service and by the mirror on the VM, and a runtime probe
 * cannot drift from that fact the way a compiled-in constant can.
 */
export function CockpitEnvironmentBanner({
  locale,
  initialSurface
}: {
  locale: TcrnLocale;
  /**
   * What the renderer already knew. The mirror build passes "mirror" because it
   * is building the mirror, which is how a reader without scripting still learns
   * this is a copy. The probe below still runs and still wins: a build-time
   * stamp is a claim, and the service answering is the fact.
   */
  initialSurface?: "local" | "mirror";
}) {
  const [surface, setSurface] = useState<"unknown" | "local" | "mirror">(initialSurface ?? "unknown");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/health");
        if (!response.ok) throw new Error("no service");
        const body = await response.json() as { service?: string };
        if (!cancelled) setSurface(body.service === "tcrn-aos-cockpit" ? "local" : "mirror");
      } catch {
        if (!cancelled) setSurface("mirror");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Versions, not a single "as of" time: this aggregates four independent chains
  // and any one timestamp would be wrong for three of them.
  const asOf = cockpitData.partitions
    .map((partition) => `${partition.id} v${partition.chainVersion}`)
    .join(" · ");

  const label = format(
    locale,
    // Before the probe answers, the honest statement is the one that does not
    // depend on it: the data's own age, with no claim about which copy this is.
    surface === "local" ? bannerCopy.local : surface === "mirror" ? bannerCopy.mirror : bannerCopy.unknown,
    cockpitData.generatedAt,
    asOf
  );

  return (
    <div className="tcrn-aos-environment" data-cockpit-surface={surface}>
      <EnvironmentBanner
        label={label}
        // The mirror is a copy and says so; the local cockpit is the real thing
        // and does not need a warning tone to state its own freshness.
        state={{ state: surface === "mirror" ? "local_only" : "ready" }}
        locale={locale}
      />
    </div>
  );
}
