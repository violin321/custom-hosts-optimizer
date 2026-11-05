import assert from "node:assert/strict";
import { checkPages } from "./check-pages.mjs";
const base =
  process.env.BASE_URL ||
  "https://custom-hosts-optimizer.violinproxy.workers.dev";
const request = (path, init = {}) =>
  fetch(base + path, { ...init, signal: AbortSignal.timeout(15000) });
const token = process.env.API_TOKEN;
await checkPages(request);
if (token) {
  const headers = { Authorization: `Bearer ${token}` };
  const expectedCommit = process.env.GITHUB_SHA;
  if (expectedCommit) {
    let ready = false;
    for (let i = 0; i < 36; i++) {
      const response = await request("/api/status", { headers });
      assert.ok(response.ok);
      const data = await response.json();
      if (
        data.worker.commit === expectedCommit &&
        data.coordinatorCommit === expectedCommit
      ) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    assert.ok(
      ready,
      "Request worker and coordinator must execute the deployed commit",
    );
    console.log(
      `Verified request worker and coordinator commit ${expectedCommit.slice(0, 12)}`,
    );
  }
  assert.equal(
    (await request("/api/optimize-all", { method: "POST", headers })).status,
    202,
  );
  let done = false;
  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const response = await request("/api/status", { headers });
    assert.ok(response.ok);
    const data = await response.json();
    if (data.job && ["success", "partial"].includes(data.job.status)) {
      assert.ok(data.lastSuccessAt);
      assert.equal(data.publicationError, undefined);
      console.log(
        `Refresh completed: ${data.job.succeeded} succeeded, ${data.job.failed} retained old data`,
      );
      done = true;
      break;
    }
    if (data.job?.status === "failed")
      throw Error("All DNS checks failed; previous snapshot was retained");
  }
  assert.ok(done, "Refresh did not complete before deadline");
  // KV propagation can lag durable commits; public health must also become fresh.
  for (let i = 0; i < 15; i++) {
    const health = await request("/health");
    if (health.ok) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
}
const hosts = await request("/hosts");
assert.ok(hosts.ok);
const text = await hosts.text(),
  etag = hosts.headers.get("etag");
assert.match(text, /\s+mikanani\.me(?:\n|$)/);
const lines = text
  .split("\n")
  .filter((s) => s.trim() && !s.startsWith("#"))
  .map((s) => s.trim().split(/\s+/));
assert.ok(lines.length > 40);
assert.equal(
  (await request("/hosts", { headers: { "If-None-Match": etag } })).status,
  304,
);
const json = await request("/hosts.json");
assert.ok(json.ok);
const data = await json.json();
assert.equal(data.total, lines.length);
assert.deepEqual(data.entries, lines);
const yaml = await (await request("/clash-hosts.yaml")).text();
for (const [ip, domain] of lines)
  assert.ok(yaml.includes(`${JSON.stringify(domain)}: ${JSON.stringify(ip)}`));
assert.equal((await request("/api/status")).status, 401);
assert.equal(
  (await request("/api/optimize-all", { method: "POST" })).status,
  401,
);
assert.equal((await request("/admin", { redirect: "manual" })).status, 302);
assert.equal((await request("/admin/login")).status, 200);
assert.equal((await request("/health")).status, 200);
console.log(
  `Verified ${lines.length} records, consistent formats, ETag 304, authentication and health`,
);
