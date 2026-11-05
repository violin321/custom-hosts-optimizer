import { test } from "node:test";
import assert from "node:assert/strict";
import { HostsCoordinator } from "../src/coordinator";
import worker from "../src/index";
import { ipAddress } from "../src/core/validation";
import { importLegacy, formatHosts, snapshotFor } from "../src/core/snapshot";
import { cookie } from "../src/http/auth";
import type { Bindings, StoreState } from "../src/types";
class Storage {
  data = new Map<string, any>();
  alarmTime = 0;
  async get<T>(key: string): Promise<T | undefined> {
    return structuredClone(this.data.get(key));
  }
  async put(key: string, value: any) {
    this.data.set(key, structuredClone(value));
  }
  async delete(key: string) {
    return this.data.delete(key);
  }
  async setAlarm(time: number) {
    this.alarmTime = time;
  }
}
const record = (domain = "example.com") => ({
  domain,
  ip: "1.1.1.1",
  candidates: ["1.1.1.1"],
  mode: "manual" as const,
  isActive: true,
  addedAt: "2020-01-01T00:00:00.000Z",
});
async function fixture(initial?: StoreState) {
  const storage = new Storage(),
    kvdata = new Map<string, any>();
  let failKV = false,
    ready = Promise.resolve();
  const kv = {
    get: async (key: string, type: string) => {
      const v = kvdata.get(key);
      return v === undefined ? null : type === "json" ? JSON.parse(v) : v;
    },
    put: async (key: string, value: string) => {
      if (failKV) throw Error("KV unavailable");
      kvdata.set(key, value);
    },
  };
  const state = initial || { schemaVersion: 2, github: [], custom: [record()] };
  state.snapshot = await snapshotFor(state as StoreState);
  storage.data.set("state", state);
  const ctx = {
    storage,
    blockConcurrencyWhile: (fn: any) => {
      ready = fn();
      return ready;
    },
  };
  const env = {
    custom_hosts: kv,
    ADMIN_USERNAME: "管理员",
    ADMIN_PASSWORD: "test-password",
    SESSION_SECRET: "test-secret-only",
    API_TOKEN: "api-test",
    PROBE_TOKEN: "probe-test",
    ASSETS: { fetch: async () => new Response("asset") },
  } as unknown as Bindings;
  const object = new HostsCoordinator(ctx as any, env);
  await ready;
  env.COORDINATOR = {
    idFromName: () => "",
    get: () => ({ fetch: (req: Request) => object.fetch(req) }),
  } as any;
  const call = (path: string, body: any = {}) =>
    object.fetch(
      new Request("https://internal" + path, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  const http = (path: string, init: RequestInit = {}) =>
    worker.fetch(
      new Request("https://test.local" + path, init),
      env,
      {} as any,
    );
  return {
    storage,
    kvdata,
    env,
    object,
    call,
    http,
    fail: () => {
      failKV = true;
    },
    recover: () => {
      failKV = false;
    },
    state: () => storage.get<StoreState>("state"),
  };
}
test("rejects malformed IP and imports old custom records without losing manual mode", async () => {
  assert.throws(() => ipAddress("999.1.1.1"));
  assert.equal(ipAddress("2001:4860::1"), "2001:4860::1");
  const kv = {
    get: async (key: string) =>
      key === "custom_domains"
        ? [{ ...record(), resolveMethod: "manual", isActive: false }]
        : { domain_data: { "github.com": { ip: "140.82.112.4" } } },
  };
  const state = await importLegacy(kv as any);
  assert.equal(state.custom[0].mode, "manual");
  assert.equal(state.custom[0].isActive, false);
  assert.equal(state.github[0].mode, "probe");
});
test("simultaneous adds survive and manual edits preserve disabled state and original creation time", async () => {
  const f = await fixture({
    schemaVersion: 2,
    github: [],
    custom: [{ ...record(), isActive: false }],
  });
  await Promise.all([
    f.call("/upsert", { domain: "one.example.com", ip: "8.8.8.8" }),
    f.call("/upsert", { domain: "two.example.com", ip: "9.9.9.9" }),
  ]);
  await f.call("/upsert", { domain: "example.com", ip: "8.8.4.4" });
  const state = (await f.state())!;
  assert.equal(state.custom.length, 3);
  assert.equal(state.custom[0].isActive, false);
  assert.equal(state.custom[0].addedAt, record().addedAt);
  assert.equal(
    (await f.call("/upsert", { domain: "example.com", isActive: "false" }))
      .status,
    400,
  );
});
test("all DNS failures preserve snapshot and successful check time; refresh is idempotent", async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error("DNS offline");
  };
  try {
    const f = await fixture(),
      before = (await f.state())!.snapshot!;
    const a = (await (await f.call("/refresh")).json()) as any,
      b = (await (await f.call("/refresh")).json()) as any;
    assert.equal(a.job.id, b.job.id);
    for (let i = 0; i < 30; i++) {
      await f.object.alarm();
      if ((await f.state())!.job!.status === "failed") break;
    }
    const state = (await f.state())!;
    assert.equal(state.job!.status, "failed");
    assert.equal(state.lastSuccessAt, undefined);
    assert.deepEqual(state.snapshot!.entries, before.entries);
    assert.equal(state.custom[0].ip, "1.1.1.1");
  } finally {
    globalThis.fetch = saved;
  }
});
test("scheduled refresh includes custom automatic domains and never overwrites manual IPs", async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    return Response.json({
      Status: 0,
      Answer:
        url.searchParams.get("type") === "A"
          ? [{ type: 1, data: "8.8.8.8" }]
          : [],
    });
  };
  try {
    const f = await fixture({
      schemaVersion: 2,
      github: [],
      custom: [record(), { ...record("auto.example.com"), mode: "dns" }],
    });
    await f.call("/refresh");
    for (let i = 0; i < 30; i++) {
      await f.object.alarm();
      if ((await f.state())!.job!.status === "success") break;
    }
    const state = (await f.state())!;
    assert.equal(state.custom[0].ip, "1.1.1.1");
    assert.equal(state.custom[1].ip, "8.8.8.8");
    assert.ok(state.lastSuccessAt);
  } finally {
    globalThis.fetch = saved;
  }
});
test("KV publication failures are explicit, durable changes survive and alarms retry", async () => {
  const f = await fixture();
  f.fail();
  const response = await f.call("/upsert", {
    domain: "extra.example.com",
    ip: "8.8.8.8",
  });
  assert.equal(response.status, 503);
  assert.equal((await f.state())!.custom.length, 2);
  assert.ok((await f.state())!.publicationError);
  assert.ok(f.storage.alarmTime);
  f.recover();
  await f.object.alarm();
  assert.equal((await f.state())!.publicationError, undefined);
  assert.ok(f.kvdata.has("published_snapshot"));
});
test("probe token cannot manage domains, sessions support Unicode and reject CSRF/changed credentials", async () => {
  const f = await fixture();
  assert.equal((await f.http("/api/status")).status, 401);
  assert.equal(
    (
      await f.http("/api/custom-domains", {
        method: "POST",
        headers: { Authorization: "Bearer probe-test" },
        body: "{}",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.http("/api/probe/manifest", {
        headers: { Authorization: "Bearer probe-test" },
      })
    ).status,
    200,
  );
  const value = await cookie(f.env, "管理员"),
    headers = { Cookie: value.split(";")[0] };
  assert.equal((await f.http("/api/status", { headers })).status, 200);
  assert.equal(
    (
      await f.http("/api/reset", {
        method: "POST",
        headers: { ...headers, Origin: "https://evil.example" },
        body: "{}",
      })
    ).status,
    403,
  );
  f.env.ADMIN_PASSWORD = "changed";
  assert.equal((await f.http("/api/status", { headers })).status, 401);
});
test("login rate limit persists and wrong credentials never set a session", async () => {
  const f = await fixture();
  for (let i = 0; i < 10; i++) {
    const response = await f.http("/admin/login", {
      method: "POST",
      body: new URLSearchParams({ username: "wrong", password: "wrong" }),
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("set-cookie"), null);
  }
  assert.equal(
    (
      await f.http("/admin/login", {
        method: "POST",
        body: new URLSearchParams({}),
      })
    ).status,
    429,
  );
});
test("probe reports respect custom manual overrides and reject expired/foreign candidates", async () => {
  const r = {
    ...record("github.com"),
    mode: "probe" as const,
    lastAttemptAt: new Date().toISOString(),
    candidates: ["8.8.8.8"],
  };
  const f = await fixture({
    schemaVersion: 2,
    github: [r],
    custom: [record("github.com")],
  });
  const result = {
    domain: "github.com",
    ip: "8.8.8.8",
    network: "direct",
    testedAt: new Date().toISOString(),
    samples: [100, 90, 120],
  };
  assert.equal(
    ((await (await f.call("/probe", { results: [result] })).json()) as any)
      .applied,
    0,
  );
  await f.call("/upsert", { domain: "github.com", mode: "probe" });
  assert.equal((await f.call("/probe", { results: [result] })).status, 400);
});
test("download formats are consistent; ETags yield 304, text does not change on check-only refresh", async () => {
  const f = await fixture(),
    a = await f.http("/hosts"),
    tag = a.headers.get("etag")!,
    text = await a.text();
  assert.match(text, /1\.1\.1\.1\s+example.com/);
  assert.equal(
    (await f.http("/hosts", { headers: { "If-None-Match": tag } })).status,
    304,
  );
  const before = (await f.state())!,
    next = structuredClone(before);
  next.lastSuccessAt = new Date().toISOString();
  next.snapshot = await snapshotFor(next);
  assert.equal(formatHosts(before.snapshot!), formatHosts(next.snapshot!));
  const json = (await (await f.http("/hosts.json")).json()) as any;
  assert.equal(json.total, 1);
  assert.deepEqual(json.entries, before.snapshot!.entries);
});
test("backup restoration and import validate before changing state", async () => {
  const f = await fixture();
  await f.call("/upsert", { domain: "second.example.com", ip: "8.8.8.8" });
  const backups = (await (await f.call("/backups")).json()) as any[];
  assert.ok(backups.length);
  assert.equal(
    (await f.call("/import", { domains: [record(), record()] })).status,
    400,
  );
  assert.equal((await f.state())!.custom.length, 2);
  await f.call("/restore", { id: backups[0].id });
  assert.equal((await f.state())!.custom.length, 1);
});
test("valid HTTPS probe chooses candidate and stores real median without changing manual records", async () => {
  const f = await fixture({
    schemaVersion: 2,
    github: [],
    custom: [
      record(),
      {
        ...record("probe.example.com"),
        mode: "probe",
        candidates: ["8.8.8.8"],
        lastAttemptAt: new Date().toISOString(),
      },
    ],
  });
  const result = {
    domain: "probe.example.com",
    ip: "8.8.8.8",
    network: "direct",
    testedAt: new Date().toISOString(),
    samples: [200, 80, 100],
  };
  assert.equal(
    ((await (await f.call("/probe", { results: [result] })).json()) as any)
      .applied,
    1,
  );
  const state = (await f.state())!;
  assert.equal(state.custom[0].ip, "1.1.1.1");
  assert.equal(state.custom[1].probe!.latencyMs, 100);
  assert.equal(state.custom[1].ip, "8.8.8.8");
  assert.equal(
    (await f.call("/probe", { results: [{ ...result, network: "proxy" }] }))
      .status,
    400,
  );
});
test("correct login sets secure cookie and request bodies are bounded", async () => {
  const f = await fixture(),
    response = await f.http("/admin/login", {
      method: "POST",
      body: new URLSearchParams({
        username: "管理员",
        password: "test-password",
      }),
    });
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("set-cookie")!,
    /HttpOnly; Secure; SameSite=Strict/,
  );
  assert.equal(
    (
      await f.http("/api/import", {
        method: "POST",
        headers: { Authorization: "Bearer api-test" },
        body: "x".repeat(131073),
      })
    ).status,
    413,
  );
});

test("compressed weak ETags use weak comparison for conditional GET", async () => {
  const f = await fixture(),
    a = await f.http("/hosts"),
    etag = a.headers.get("etag")!;
  assert.equal(
    (await f.http("/hosts", { headers: { "If-None-Match": "W/" + etag } }))
      .status,
    304,
  );
  assert.equal(
    (await f.http("/hosts", { headers: { "If-None-Match": "*" } })).status,
    304,
  );
});
