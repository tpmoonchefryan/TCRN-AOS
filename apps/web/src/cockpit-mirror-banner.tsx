import { useEffect, useState } from "react";
import { EnvironmentBanner } from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { cockpitData } from "./cockpit-data.generated.js";

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
  const isZh = locale === "zh-CN";
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

  const label = surface === "local"
    ? (isZh
      ? `本机驾驶舱 · 数据截至 ${cockpitData.generatedAt} · ${asOf}`
      : `Local cockpit — data as of ${cockpitData.generatedAt} · ${asOf}`)
    : surface === "mirror"
      ? (isZh
        ? `只读镜像 · 数据截至 ${cockpitData.generatedAt} · 写面在本机 · ${asOf}`
        : `Read-only mirror — data as of ${cockpitData.generatedAt}; writes happen on the operator's machine · ${asOf}`)
      // Before the probe answers, the honest statement is the one that does not
      // depend on it: the data's own age, with no claim about which copy this is.
      : (isZh
        ? `数据截至 ${cockpitData.generatedAt} · ${asOf}`
        : `Data as of ${cockpitData.generatedAt} · ${asOf}`);

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
