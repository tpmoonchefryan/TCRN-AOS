import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Pill, STATUS_LABEL, STATUS_TONE, tone } from "../../../../dist/apps/web/src/ui-kit.js";

test("work status mapping is closed, semantic, and fail-closed", () => {
  assert.deepEqual(STATUS_TONE, {
    planned: "neutral",
    ready: "positive",
    active: "neutral",
    blocked: "danger",
    pending_acceptance: "warning",
    done: "positive",
    cancelled: "neutral",
  });
  assert.equal(tone("active"), "neutral");
  assert.equal(tone("pending_acceptance"), "warning");
  assert.equal(tone("unknown"), "neutral");
  assert.deepEqual(STATUS_LABEL, {
    planned: "已计划",
    ready: "就绪",
    active: "进行中",
    blocked: "已阻塞",
    pending_acceptance: "待验收",
    done: "已完成",
    cancelled: "已取消",
  });
});

test("status badges preserve identity while deriving tone", () => {
  const active = renderToStaticMarkup(Pill({ toneName: tone("active"), state: "active", children: STATUS_LABEL.active }));
  assert.match(active, /class="tcrn-badge tcrn-badge--neutral"/);
  assert.match(active, /data-state="active"/);
  assert.match(active, /title="进行中"/);

  const pending = renderToStaticMarkup(Pill({ toneName: tone("pending_acceptance"), state: "pending_acceptance", children: STATUS_LABEL.pending_acceptance }));
  assert.match(pending, /class="tcrn-badge tcrn-badge--warning"/);
  assert.match(pending, /data-state="pending_acceptance"/);

  const legacy = renderToStaticMarkup(Pill({ toneName: "done", children: "已关闭" }));
  assert.match(legacy, /class="tcrn-badge tcrn-badge--positive"/);
});
