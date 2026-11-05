import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Bindings, Snapshot } from "./types";
import {
  equal,
  bearer,
  session,
  cookie,
  logoutCookie,
  sameOrigin,
  fingerprint,
} from "./http/auth";
import { formatHosts, formatYaml } from "./core/snapshot";
import { domainName, errorText } from "./core/validation";
export { HostsCoordinator } from "./coordinator";
const app = new Hono<{ Bindings: Bindings }>();
export function coordinator(env: Bindings, path: string, body: unknown = {}) {
  return env.COORDINATOR.get(env.COORDINATOR.idFromName("primary")).fetch(
    new Request("https://internal" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}
app.use(
  "*",
  bodyLimit({
    maxSize: 131072,
    onError: (c) => c.json({ error: "请求过大" }, 413),
  }),
);
app.use("*", async (c, next) => {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "same-origin");
  c.header("X-Frame-Options", "DENY");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
  );
  if (Number(c.req.header("Content-Length") || 0) > 131072)
    return c.json({ error: "请求过大" }, 413);
  const path = c.req.path,
    read = ["GET", "HEAD"].includes(c.req.method);
  const publicRead =
    read &&
    [
      "/",
      "/hosts",
      "/hosts.json",
      "/clash-hosts.yaml",
      "/health",
      "/index.js",
      "/index.css",
      "/logo.svg",
      "/og.svg",
      "/favicon.ico",
      "/admin/login",
      "/admin.js",
      "/login.js",
    ].includes(path);
  const login = path === "/admin/login" && c.req.method === "POST";
  if (publicRead || login) {
    await next();
    return;
  }
  const isToken = bearer(c, c.env.API_TOKEN),
    isProbe = path.startsWith("/api/probe/") && bearer(c, c.env.PROBE_TOKEN);
  const username = isToken || isProbe ? null : await session(c);
  if (!isToken && !isProbe && !username) {
    if (path.startsWith("/admin") && read)
      return c.redirect("/admin/login", 302);
    return c.json({ error: "请先登录管理后台", code: "AUTH_REQUIRED" }, 401);
  }
  if (!read && !isToken && !isProbe && !sameOrigin(c))
    return c.json({ error: "跨站请求已拒绝" }, 403);
  c.header("Cache-Control", "no-store");
  await next();
});
app.onError((e, c) => c.json({ error: errorText(e) }, 500));
app.get("/admin/login", (c) =>
  c.env.ASSETS.fetch(new Request(new URL("/login.html", c.req.url))),
);
app.post("/admin/login", async (c) => {
  if (!sameOrigin(c)) return c.json({ error: "跨站请求已拒绝" }, 403);
  const { ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_SECRET } = c.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !SESSION_SECRET)
    return c.json({ error: "管理员凭据尚未配置" }, 503);
  const key = await fingerprint(c.req.header("CF-Connecting-IP") || "local");
  const rate = (await (
    await coordinator(c.env, "/login-limit", { key })
  ).json()) as { allowed: boolean; retryAfter: number };
  if (!rate.allowed) {
    c.header("Retry-After", String(rate.retryAfter));
    return c.json({ error: "尝试次数过多，请稍后重试" }, 429);
  }
  const body = await c.req.parseBody();
  if (
    !equal(String(body.username || ""), ADMIN_USERNAME) ||
    !equal(String(body.password || ""), ADMIN_PASSWORD)
  )
    return c.json({ error: "用户名或密码错误" }, 401);
  await coordinator(c.env, "/login-limit", { key, clear: true });
  c.header("Set-Cookie", await cookie(c.env, ADMIN_USERNAME));
  c.header("Cache-Control", "no-store");
  return c.json({ success: true, redirect: "/admin" });
});
app.post("/admin/logout", (c) => {
  c.header("Set-Cookie", logoutCookie());
  return c.redirect("/admin/login", 302);
});
app.get("/admin", (c) =>
  c.env.ASSETS.fetch(new Request(new URL("/admin.html", c.req.url))),
);
app.get("/admin/", (c) => c.redirect("/admin", 302));
app.get("/admin-x7k9m3q2", (c) => c.redirect("/admin", 302));
app.get("/api/status", async (c) => {
  const response = await coordinator(c.env, "/state");
  const state = (await response.json()) as any;
  return c.json({
    worker: {
      name: "custom-hosts-optimizer",
      version: "2.0.0",
      commit: c.env.COMMIT_HASH || "local",
    },
    user: { username: (await session(c)) || "api-token" },
    ...state,
  });
});
app.get("/api/custom-domains", async (c) => {
  const state = (await (await coordinator(c.env, "/state")).json()) as any;
  return c.json(state.custom);
});
for (const path of ["/api/custom-domains", "/api/custom-domains/batch"])
  app.post(path, async (c) => {
    const body = await c.req.json();
    const result = await coordinator(c.env, "/upsert", body);
    if (result.ok) await coordinator(c.env, "/refresh");
    return result;
  });
app.delete("/api/custom-domains/:domain", (c) =>
  coordinator(c.env, "/delete", { domain: c.req.param("domain") }),
);
app.delete("/api/custom-domains", (c) =>
  coordinator(c.env, "/delete", { all: true }),
);
app.get("/api/custom-domains/export", async (c) => {
  const response = await coordinator(c.env, "/export");
  c.header("Content-Disposition", 'attachment; filename="hosts-backup.json"');
  return c.json(await response.json());
});
app.post("/api/import", async (c) =>
  coordinator(c.env, "/import", await c.req.json()),
);
app.get("/api/backups", (c) => coordinator(c.env, "/backups"));
app.post("/api/backups/restore", async (c) =>
  coordinator(c.env, "/restore", await c.req.json()),
);
for (const path of [
  "/api/optimize-all",
  "/api/cache/refresh",
  "/api/reset",
  "/api/optimize/:domain",
])
  app.post(path, (c) => coordinator(c.env, "/refresh"));
app.delete("/api/cache", (c) =>
  c.json(
    { error: "为保护可用数据，已取消直接清空；请使用刷新或备份恢复" },
    409,
  ),
);
app.get("/api/cache/status", (c) => coordinator(c.env, "/state"));
app.get("/api/probe/manifest", (c) => coordinator(c.env, "/manifest"));
app.post("/api/probe/report", async (c) =>
  coordinator(c.env, "/probe", await c.req.json()),
);
app.get("/api/custom-domains/test", async (c) => {
  const { resolveCandidates } = await import("./core/dns");
  try {
    return c.json(await resolveCandidates(domainName(c.req.query("domain"))));
  } catch (e) {
    return c.json({ error: errorText(e) }, 400);
  }
});
async function getSnapshot(env: Bindings): Promise<Snapshot | null> {
  let cached: Snapshot | null = null;
  try {
    cached = await env.custom_hosts.get<Snapshot>("published_snapshot", "json");
  } catch {
    /* Durable state remains available when KV fails. */
  }
  if (cached) return cached;
  return (await (
    await coordinator(env, "/snapshot")
  ).json()) as Snapshot | null;
}
for (const path of ["/hosts", "/hosts.json", "/clash-hosts.yaml"])
  app.get(path, async (c) => {
    const snapshot = await getSnapshot(c.env);
    if (!snapshot?.entries.length) {
      c.header("Retry-After", "60");
      return c.json({ error: "暂无可用快照，请管理员启动刷新" }, 503);
    }
    const custom = c.req.query("custom") !== "false",
      etag = `"${snapshot.version}-${custom ? "all" : "github"}-${path === "/hosts.json" ? snapshot.publishedAt : "text"}"`;
    c.header("ETag", etag);
    c.header("Cache-Control", "public, max-age=60, must-revalidate");
    c.header("X-Data-Version", snapshot.version);
    c.header("Last-Modified", new Date(snapshot.changedAt).toUTCString());
    if (
      c.req
        .header("If-None-Match")
        ?.split(",")
        .map((s) => s.trim())
        .some((tag) => tag === "*" || tag.replace(/^W\//, "") === etag)
    )
      return c.body(null, 304);
    if (path === "/hosts") return c.text(formatHosts(snapshot, custom));
    if (path === "/clash-hosts.yaml")
      return c.body(formatYaml(snapshot, custom), 200, {
        "Content-Type": "text/yaml; charset=utf-8",
      });
    return c.json({
      entries: custom ? snapshot.entries : snapshot.github,
      total: (custom ? snapshot.entries : snapshot.github).length,
      github: snapshot.github,
      custom: custom ? snapshot.custom : [],
      version: snapshot.version,
      changedAt: snapshot.changedAt,
      lastSuccessAt: snapshot.lastSuccessAt,
    });
  });
app.get("/health", async (c) => {
  const snapshot = await getSnapshot(c.env),
    age = snapshot?.lastSuccessAt
      ? Date.now() - Date.parse(snapshot.lastSuccessAt)
      : Infinity;
  return c.json(
    {
      ok: !!snapshot?.entries.length && age < 86400000,
      entries: snapshot?.entries.length || 0,
      lastSuccessAt: snapshot?.lastSuccessAt || null,
    },
    snapshot?.entries.length && age < 86400000 ? 200 : 503,
  );
});
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));
export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledController,
    env: Bindings,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(
      coordinator(env, "/refresh").then((r) => {
        if (!r.ok) throw Error("定时刷新未能启动");
      }),
    );
  },
} satisfies ExportedHandler<Bindings>;
