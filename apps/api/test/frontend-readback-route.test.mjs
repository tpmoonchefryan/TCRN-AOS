import test from "node:test";
import assert from "node:assert/strict";
import { startAosLocalServiceProof } from "../../../dist/apps/api/src/server.js";

test("work readback frontend route is bounded to the scoped browser facade", async () => {
  const service = await startAosLocalServiceProof();
  try {
    const response = await fetch(`${service.url}/work/readback?locale=en&theme=light&collapsed=false`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /data-phase3-readback-surface="work-readback"/);
    assert.match(html, /data-readback-api-tickets="\/api\/work\/readback\/tickets"/);
    assert.match(html, /data-readback-api-audit="\/api\/work\/readback\/audit"/);
    assert.match(html, /data-readback-api-knowledge-search="\/api\/work\/readback\/knowledge\/search"/);
    assert.match(html, /data-readback-api-knowledge-entry="\/api\/work\/readback\/knowledge\/entry"/);
    assert.match(html, /data-kr03-readonly-knowledge-view="true"/);
    assert.match(html, /data-kr03-edit-affordances="absent"/);
    assert.match(html, /data-kr03-propose-affordance="absent"/);
    assert.match(html, /data-kr03-canonical-promotion-affordance="absent"/);
    assert.match(html, /data-kr03-search-form="read-only"/);
    assert.match(html, /data-kr03-knowledge-search-ui="true"/);
    assert.match(html, /data-kr03-entry-detail-body="explicit-read-only-fetch"/);
    assert.match(html, /data-generic-mcp-facade="unused"/);
    assert.match(html, /data-method-dispatch-facade="absent"/);
    assert.doesNotMatch(html, /data-work-management-static-fixture="true"/);
    assert.doesNotMatch(html, /aos\.knowledge\.entry\.propose/);
    assert.doesNotMatch(html, /canonical promotion/i);

    const post = await fetch(`${service.url}/work/readback`, { method: "POST" });
    assert.equal(post.status, 405);
  } finally {
    await service.close();
  }
});
