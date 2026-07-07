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
    assert.match(html, /data-generic-mcp-facade="unused"/);
    assert.match(html, /data-method-dispatch-facade="absent"/);
    assert.doesNotMatch(html, /data-work-management-static-fixture="true"/);

    const post = await fetch(`${service.url}/work/readback`, { method: "POST" });
    assert.equal(post.status, 405);
  } finally {
    await service.close();
  }
});
