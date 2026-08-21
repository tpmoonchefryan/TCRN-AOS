/**
 * The kernel's public face.
 *
 * Importing this module is what populates the operation registry: each operations module
 * calls `defineOperation` at import time, so the registry is complete the moment this
 * file has been evaluated and every surface — REST, MCP, the server-rendered UI — is
 * generated from the same list.
 *
 * Nothing outside `packages/kernel` may import `packages/store`. That rule is what makes
 * the other parity gates worth anything: without it, a transport could reach past the one
 * place authorization is checked.
 */

import "./operations/auth.js";
import "./operations/projects.js";
import "./operations/work-items.js";
import "./operations/comments.js";
import "./operations/knowledge.js";
import "./operations/search-inbox.js";
import "./operations/boards-views.js";
import "./operations/governance.js";
import "./operations/admin.js";

export { type Actor, type ProjectRole, ANONYMOUS, actorLabel, isAuthenticated } from "./actor.js";
export {
  actorFromApiToken,
  actorFromSessionToken,
  csrfOk,
  hashPassword,
  issueSession,
  newOpaqueToken,
  revokeSessionById,
  sha256,
} from "./auth.js";
export { bootstrapIfEmpty } from "./bootstrap.js";
export { pruneEphemeralState, type MaintenanceOutcome } from "./maintenance.js";
export { dispatch, type DispatchResult } from "./dispatch.js";
export { AosError, fail, normaliseError, type ReasonCode } from "./errors.js";
export {
  DEFAULT_RESPONSE_BUDGET_BYTES,
  SECURITY_HEADERS,
  assertStatedBindHost,
  hostAllowed,
  parseQuery,
  rejectForbiddenAuthorityKeys,
  rejectUnsupportedQueryKeys,
} from "./read.js";
export {
  allOperations,
  getOperation,
  operationIds,
  type AnyOperation,
  type OperationDefinition,
} from "./registry.js";
