import { Children, createElement as reactCreateElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type pg from "pg";
import * as DS from "@tcrn/ui-react";
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

type HProps = Record<string, unknown> | null | undefined;

function componentProps(raw: HProps): Record<string, unknown> {
  return raw ? { ...raw } : {};
}

function buttonProps(raw: HProps): Record<string, unknown> {
  const props = componentProps(raw);
  const variant = props["data-variant"];
  delete props["data-variant"];
  if (variant === "primary" || variant === "secondary" || variant === "quiet" || variant === "danger") {
    props.variant = variant;
  }
  return props;
}

function badgeTone(value: unknown): "neutral" | "positive" | "warning" | "danger" {
  return value === "done"
    ? "positive"
    : value === "active"
    ? "warning"
    : value === "blocked"
    ? "danger"
    : "neutral";
}

function selectOptions(children: readonly ReactNode[]): Array<{ value: string; label: string }> {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child) || child.type !== "option") return [];
    const option = child as ReactElement<{ value?: unknown; children?: ReactNode }>;
    return [{ value: String(option.props.value ?? ""), label: String(option.props.children ?? "") }];
  });
}

/**
 * The pages stay written in the existing `h("...")` shape, while these primitive tags
 * are centrally projected onto the vendored Design System. This keeps the replacement
 * one-to-one at the render boundary and prevents a missed call site from silently
 * reintroducing a hand-styled input or button.
 */
export function h(type: unknown, props?: HProps, ...children: ReactNode[]): ReactNode {
  if (type === "input") {
    const inputProps = componentProps(props);
    const Component = inputProps.type === "checkbox" ? DS.Checkbox : DS.Input;
    return reactCreateElement(Component, inputProps, ...children);
  }
  if (type === "textarea") return reactCreateElement(DS.Textarea, componentProps(props), ...children);
  if (type === "select") {
    return reactCreateElement(DS.Select, {
      ...componentProps(props),
      options: selectOptions(children),
    });
  }
  if (type === "button") return reactCreateElement(DS.Button, buttonProps(props), ...children);
  if (type === "h2") return reactCreateElement(DS.Heading, { ...componentProps(props), level: 2 }, ...children);
  if (type === "span" && props?.className === "pill") {
    return reactCreateElement(DS.Badge, { tone: badgeTone(props["data-tone"]) }, ...children);
  }
  if (type === "div" && props?.className === "panel") {
    const cardProps = componentProps(props);
    delete cardProps.className;
    return reactCreateElement(DS.Card, cardProps, ...children);
  }
  if (type === "p" && props?.className === "empty") {
    return reactCreateElement(DS.EmptyState, { title: children.length === 1 ? children[0] : children });
  }
  return reactCreateElement(type as never, props as never, ...children);
}

export function Field(props: { label: string; hint?: string; children?: ReactNode }): ReactNode {
  return h(DS.Field, { label: props.label, hint: props.hint }, props.children ?? null);
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
  return h(DS.Card, null,
    props.title ? h(DS.Heading, { level: 2 }, props.title) : null,
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
  return h(DS.EmptyState, { title: props.children ?? "" });
}

export function Pill(props: { children?: ReactNode; toneName?: string }): ReactNode {
  const tone = props.toneName === "done"
    ? "positive"
    : props.toneName === "active"
    ? "warning"
    : props.toneName === "blocked"
    ? "danger"
    : "neutral";
  return h(DS.Badge, { tone }, props.children);
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
  return h(DS.Breadcrumb, {
    items: items.map((item, index) => ({ id: `${item.label}-${index}`, label: item.label, href: item.href })),
    label: "当前位置",
  });
}

export function rowsList(
  items: Array<{ key: string; href: string; primary: ReactNode; meta?: ReactNode }>,
): ReactNode {
  return h(DS.TableShell, {
    label: "列表",
    columns: [{ key: "record", label: "" }],
    rows: items.map((item) => ({
      record: h("a", { key: item.key, href: item.href },
        h("span", { className: "row-key" }, item.key),
        h("span", { className: "row-title" }, item.primary),
        h("span", { className: "row-meta" }, item.meta),
      ),
    })),
  });
}

export { buildHref };
export type { ReactNode };
