/**
 * Who is performing an act.
 *
 * The previous system took the actor as a parameter the caller supplied and nothing
 * verified, and its user directory held only AI personas — so "assign this to a person"
 * was not expressible and "this agent did it" was a claim, not a fact. Here an Actor is
 * only ever constructed by the authentication layer from a session cookie or a bearer
 * token, never from request content.
 */

export type PrincipalKind = "human" | "agent" | "service";
export type ProjectRole = "viewer" | "contributor" | "maintainer" | "admin";

export interface Actor {
  readonly principalId: string;
  readonly handle: string;
  readonly displayName: string;
  /** A label, for display and audit. It grants nothing. */
  readonly kind: PrincipalKind;
  readonly isInstanceAdmin: boolean;
  /** How this actor proved who they are on this request. */
  readonly credential: "session" | "api_token" | "bootstrap";
  /**
   * The session this request arrived on, when it arrived on one.
   *
   * Sign-out needs it, and taking it from the request body instead is how the logout
   * control came to post a placeholder string that revoked nothing at all.
   */
  readonly sessionId?: string;
  readonly roles: ReadonlyMap<string, ProjectRole>;
}

export const ANONYMOUS: Actor = {
  principalId: "",
  handle: "anonymous",
  displayName: "Anonymous",
  kind: "human",
  isInstanceAdmin: false,
  credential: "session",
  roles: new Map(),
};

export function isAuthenticated(actor: Actor): boolean {
  return actor.principalId !== "";
}

/** The string written into activity rows. Readable without a join, stable after deletion. */
export function actorLabel(actor: Actor): string {
  if (!isAuthenticated(actor)) return "anonymous";
  return `${actor.kind}:${actor.handle}`;
}

const ROLE_RANK: Record<ProjectRole, number> = {
  viewer: 1,
  contributor: 2,
  maintainer: 3,
  admin: 4,
};

export function roleAtLeast(held: ProjectRole | undefined, required: ProjectRole): boolean {
  if (held === undefined) return false;
  return ROLE_RANK[held] >= ROLE_RANK[required];
}
