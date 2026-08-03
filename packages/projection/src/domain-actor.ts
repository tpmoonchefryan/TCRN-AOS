/**
 * Actor identity for domain writes (EPIC-041).
 *
 * The domain store's commentary — annotations, comments, relations — records
 * WHO wrote it in `updatedBy` / `author` / `createdBy`. Before EPIC-041 those
 * were a single opaque string (always `agent:fable`); the collaboration model
 * (MIN-013 A2) requires distinguishing a person from an agent. The actor on a
 * domain write must therefore be one of exactly two classes:
 *
 *   - `agent:<model>` — an AI agent (e.g. `agent:fable`);
 *   - `person:<id>` — a human (e.g. `person:owner:governance`).
 *
 * An anonymous write — an empty string, a bare name with no class, an
 * unknown prefix — is refused at the store, so "no author" is structurally
 * impossible to record. This is the same claim the write face makes about
 * chain writes (STORY-112: attribution is a claim, and a fallback records it
 * without anyone having made it); the domain store now makes it for its own
 * commentary.
 */

export type DomainActor = `agent:${string}` | `person:${string}`;

const AGENT_PREFIX = "agent:";
const PERSON_PREFIX = "person:";

/** True when `value` is a non-empty `agent:<model>` or `person:<id>`. */
export function isDomainActor(value: string): value is DomainActor {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.startsWith(AGENT_PREFIX)) return value.length > AGENT_PREFIX.length;
  if (value.startsWith(PERSON_PREFIX)) return value.length > PERSON_PREFIX.length;
  return false;
}

/** Whether the actor is an agent (`agent:*`) rather than a person. */
export function isAgentActor(value: string): boolean {
  return value.startsWith(AGENT_PREFIX);
}

/** Whether the actor is a person (`person:*`) rather than an agent. */
export function isPersonActor(value: string): boolean {
  return value.startsWith(PERSON_PREFIX);
}

/** Throws unless `value` is a legal domain actor; returns it for chaining. */
export function requireDomainActor(value: string, field: string): DomainActor {
  if (!isDomainActor(value)) {
    throw new Error(
      `${field} must be an attributed actor (agent:<model> or person:<id>); got ${JSON.stringify(value)}. `
      + "An anonymous domain write is refused — every annotation, comment and relation carries who wrote it."
    );
  }
  return value;
}
