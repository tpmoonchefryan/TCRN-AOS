import { createElement as h, type ReactNode } from "react";
import type pg from "pg";
import { dispatch, type Actor } from "../../../packages/kernel/src/index.js";
import { buildHref } from "./url.js";

/**
 * The shared pieces every screen is built from.
 *
 * A screen never talks to the database. It calls `ctx.call`, which goes through the same
 * `dispatch` an API client reaches — so a page can only ever show what the API would
 * return, and cannot show what the API would refuse.
 */

export interface PageContext {
  readonly pool: pg.Pool;
  readonly actor: Actor;
  readonly csrf: string;
  readonly pathname: string;
  readonly search: URLSearchParams;
  readonly projects: ProjectSummary[];
  readonly call: <T>(operationId: string, input: Record<string, unknown>) => Promise<T>;
}

export interface ProjectSummary {
  id: string;
  key: string;
  name: string;
  openCount: number;
  totalCount: number;
  role?: string | null;
  governanceEnabled?: boolean;
}

export const STATUSES = [
  "planned", "ready", "active", "blocked", "pending_acceptance", "done", "cancelled",
] as const;

export const KINDS = [
  "initiative", "epic", "story", "subtask", "review", "incident", "release",
] as const;

/** The seven words this product uses for state. Never another vocabulary's words. */
export const STATUS_LABEL: Record<string, string> = {
  planned: "planned",
  ready: "ready",
  active: "active",
  blocked: "blocked",
  pending_acceptance: "pending acceptance",
  done: "done",
  cancelled: "cancelled",
};

export function tone(status: string): string | undefined {
  if (status === "done") return "done";
  if (status === "active") return "active";
  if (status === "blocked") return "blocked";
  return undefined;
}

export function makeCall(pool: pg.Pool, actor: Actor) {
  return async <T,>(operationId: string, input: Record<string, unknown>): Promise<T> => {
    const result = await dispatch<T>(pool, operationId, input, actor);
    return result.output;
  };
}

export function Field(props: { label: string; hint?: string; children?: ReactNode }): ReactNode {
  return h("div", { className: "field" },
    h("label", null, props.label),
    props.children,
    props.hint ? h("p", { className: "reason" }, props.hint) : null,
  );
}

/**
 * Every mutating control is a real form post.
 *
 * There is no other way to change anything in this product — which is what makes "a
 * person can do by hand everything an agent can do" a property the build can check by
 * replaying these forms, rather than a claim someone has to keep.
 */
export function Form(props: {
  op: string;
  redirect: string;
  csrf: string;
  className?: string;
  children?: ReactNode;
}): ReactNode {
  return h("form", { method: "POST", action: `/api/v1/commands/${props.op}`, className: props.className },
    h("input", { type: "hidden", name: "_csrf", value: props.csrf }),
    h("input", { type: "hidden", name: "_redirect", value: props.redirect }),
    props.children,
  );
}

export function Panel(props: { title?: string; children?: ReactNode }): ReactNode {
  return h("div", { className: "panel" },
    props.title ? h("h2", null, props.title) : null,
    props.children,
  );
}

/** A list that says when it is showing fewer rows than exist. Never a silent ceiling. */
export function Truncation(props: { shown: number; total: number; nextHref?: string | null }): ReactNode {
  if (props.shown >= props.total) return null;
  return h("p", { className: "truncation" },
    `显示 ${props.shown} 条，共 ${props.total} 条。`,
    props.nextHref ? h("a", { href: props.nextHref }, " 下一页") : null,
  );
}

export function Empty(props: { children?: ReactNode }): ReactNode {
  return h("p", { className: "empty" }, props.children);
}

export function Pill(props: { children?: ReactNode; toneName?: string }): ReactNode {
  return h("span", { className: "pill", "data-tone": props.toneName }, props.children);
}

/**
 * Render an actor in one of three states, and never as a blank.
 *
 * "We have not read it" is a different answer from "there is nobody", and rendering the
 * first as the second is a defect this product has already produced once.
 */
export function Attribution(props: { label?: string | null; read?: boolean }): ReactNode {
  if (props.read === false) return h("span", { className: "unread" }, "执行者归属未读取");
  if (!props.label) return h("span", { className: "unread" }, "未记执行者");
  return h("span", null, props.label);
}

export function breadcrumb(items: Array<{ href?: string; label: string }>): ReactNode {
  return h("div", { className: "breadcrumb" },
    ...items.flatMap((item, index) => [
      index > 0 ? h("span", { key: `sep${index}` }, " › ") : null,
      item.href
        ? h("a", { key: item.label + index, href: item.href }, item.label)
        : h("span", { key: item.label + index }, item.label),
    ]),
  );
}

export function rowsList(
  items: Array<{ key: string; href: string; primary: ReactNode; meta?: ReactNode }>,
): ReactNode {
  return h("div", { className: "rows" },
    ...items.map((item) =>
      // The row's href is always the record's own page, so middle-click and open-in-new-tab
      // do the obvious thing at every width.
      h("a", { key: item.key, className: "row", href: item.href },
        h("span", { className: "row-key" }, item.key),
        h("span", { className: "row-title" }, item.primary),
        h("span", { className: "row-meta" }, item.meta),
      ),
    ),
  );
}

export { h, buildHref };
export type { ReactNode };
