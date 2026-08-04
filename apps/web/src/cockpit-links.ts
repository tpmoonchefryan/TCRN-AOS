/**
 * Where a governance reference goes, and what to call it on screen.
 *
 * The chain stores references as opaque record ids — `minutes:4fdc3f1caf4adfb2374090f7`
 * is what a work item's `decidedBy` literally holds — and four views were rendering
 * that string as final output. A reader who wanted the ruling behind a work item got
 * a 24-hex digest and a search box: the defect INC-018 reports.
 *
 * Two separate repairs, and they are worth naming apart because either alone is
 * still broken:
 *
 * 1. **A name.** The projection already knows those minutes are `TCRN-AOS-MIN-003`.
 *    Showing the digest when a key exists is not honesty, it is just untranslated
 *    machine state.
 * 2. **A destination.** Minutes are read inside the deliberation that produced
 *    them, so a minutes reference resolves through `minutesByConference` to that
 *    room's route.
 *
 * Both stay optional, and that is the load-bearing part. Two of the twenty-four
 * distinct `decidedBy` values in the current projection name minutes whose
 * conference was never read — those chains exceed the export ceiling — and fifteen
 * of fifteen gates carry no external key at all. For those, this module returns no
 * href and the caller renders a non-link. The DS `MachineToken` doc comment states
 * the rule this follows: the honest state for an identifier with no page is a
 * non-link, not a link that 404s.
 */
import { cockpitData } from "./cockpit-data.generated.js";

export interface GovernanceLink {
  /** What to show: the human key when the chain recovered one, else the raw id. */
  label: string;
  /** Absent when nothing in this projection can show the referenced record. */
  href?: string;
}

/**
 * minutes id → the conference that closed with them.
 *
 * Built once at module scope rather than per render: `minutesByConference` is
 * keyed the other way round, and a detail page with a dozen references would
 * otherwise walk 128 entries a dozen times.
 */
const conferenceByMinutes = new Map<string, string>(
  Object.entries(cockpitData.minutesByConference).map(([conferenceId, minutes]) => [minutes.id, conferenceId])
);

const minutesKeyById = new Map<string, string | null>(
  Object.values(cockpitData.minutesByConference).map((minutes) => [minutes.id, minutes.externalKey])
);

/**
 * gate id → the work record it is attached to.
 *
 * A gate has no page of its own, which is why this module's header lists gates among
 * the references it cannot route. That is true of the gate as a RECORD and false of
 * the gate as something a reader can look at: the work-item detail view renders every
 * gate whose `workId` is that item, with its outcome class and the deliberations beside
 * it. So the destination exists — it is the item the gate is holding.
 *
 * Built at module scope for the same reason as the two maps above.
 */
const workIdByGate = new Map<string, string | null>(
  cockpitData.gates.map((gate) => [gate.id, gate.workId])
);

const workKeyById = new Map<string, string>(
  cockpitData.work.map((work) => [work.id, work.externalKey ?? work.id])
);

/**
 * A minutes reference as a name and a route.
 *
 * Falls back through three levels of knowledge rather than one: the minutes key
 * if the chain recovered it, the raw id if not, and no href at all if the
 * conference behind it was never read.
 */
export function minutesLink(minutesId: string, routeHref: (path: string) => string): GovernanceLink {
  const label = minutesKeyById.get(minutesId) ?? minutesId;
  const conferenceId = conferenceByMinutes.get(minutesId);
  if (!conferenceId) return { label };
  const conference = cockpitData.conferences.find((entry) => entry.id === conferenceId);
  if (!conference) return { label };
  return { label, href: routeHref(`/deliberations/${conference.externalKey ?? conference.id}`) };
}

/** A deliberation reference. Every conference in the projection has a room. */
export function conferenceLink(
  conference: { id: string; externalKey: string | null; title: string | null },
  routeHref: (path: string) => string
): GovernanceLink {
  return {
    label: conference.title ?? conference.externalKey ?? conference.id,
    href: routeHref(`/deliberations/${conference.externalKey ?? conference.id}`)
  };
}

/** A work record reference, by whichever identifier the detail route accepts. */
export function workItemLink(
  work: { id: string; externalKey: string | null },
  routeHref: (path: string) => string
): GovernanceLink {
  const key = work.externalKey ?? work.id;
  return { label: key, href: routeHref(`/work-items/${key}`) };
}

/**
 * Where an inbox item goes, resolved by the kind of record it names.
 *
 * An inbox item is whatever the chain is waiting on — a conference, an unresolved
 * ruling, a work record — and the destination differs per kind. This lived as a
 * module-private function in cockpit-global.tsx while cockpit-views.tsx wrote its own
 * one-line version, `/work-items/${recordId}` for every kind. Two answers to one
 * question, and the second was wrong for every minutes reference it rendered: it sent
 * twenty-two of them to the work-item detail route, which cannot show a minutes record.
 * The reader arrived somewhere real and still had to go find the ruling — the same
 * "linked, but not to the record" defect INC-018 reports, on two routes that the
 * traversability gate was not probing at the time.
 *
 * Kept here beside the other three resolvers so there is one place to be right.
 */
export function inboxLink(
  item: { kind: string; recordId: string; externalKey: string | null; partitionId: string },
  routeHref: (path: string) => string
): GovernanceLink {
  const label = item.externalKey ?? item.recordId;
  if (item.kind === "conference") {
    return { label, href: routeHref(`/deliberations/${label}`) };
  }
  if (item.kind === "unresolved") {
    const link = minutesLink(item.recordId, routeHref);
    if (link.href) return link;
  }
  // A gate goes to the work item it is holding, which is the one page that renders it.
  // It used to fall through to the list below, and that had two costs. The reader cost:
  // the most important row on this screen — an owner_intent_required gate — landed on a
  // generic list that does not show the gate at all. The correctness cost: the list href
  // carries `project=<the gate's partition>`, which OVERWRITES the reader's current
  // project rather than preserving it, so a cross-partition gate silently moved them to
  // another project's scope. That is what `state-preserved:/inbox:project` reported, and
  // it went unnoticed while the only gate on the page belonged to the selected project —
  // the failure appeared when a second partition's gate arrived, not when it was written.
  if (item.kind === "gate") {
    const workId = workIdByGate.get(item.recordId);
    const key = workId === null || workId === undefined ? undefined : workKeyById.get(workId);
    if (key !== undefined) return { label, href: routeHref(`/work-items/${key}`) };
  }
  // Nothing in this projection can show this record. Per the rule in this module's
  // header, the honest answer is no href — the caller renders a non-link — rather than a
  // route that shows something else. The list fallback that used to live here looked
  // like a destination and was actually a scope change.
  return { label };
}

/**
 * Spread helper for `exactOptionalPropertyTypes`.
 *
 * Under that flag `href={undefined}` is not the same as omitting `href`, and the
 * DS prop is `href?: string`. Every call site here has a genuinely optional
 * destination, so they all need this rather than each writing the ternary.
 */
export function hrefAttr(link: GovernanceLink): { href?: string } {
  return link.href ? { href: link.href } : {};
}
