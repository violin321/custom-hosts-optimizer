import { Hono } from "hono"
import {
  formatHostsFile,
  getDomainData,
  getCachedCompleteHostsData,
  getCachedHostsData,
  getCompleteHostsData,
  getHostsData,
  resetHostsData,
  getCustomDomains,
  addCustomDomain,
  removeCustomDomain,
  fetchCustomDomainsData,
  fetchLatestHostsData,
  fetchIPFromMultipleDNS,
  storeData,
  type HostEntry,
} from "./services/hosts"
import { handleSchedule } from "./scheduled"
import { Bindings } from "./types"

const app = new Hono<{ Bindings: Bindings }>()

const APP_VERSION = "1.3.0"
const DOMAIN_PATTERN = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const STATUS_KV_CHECK_KEY = "status_check"

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;")

const normalizeDomain = (domain: string) => domain.trim().toLowerCase()

const getCommitHash = (env: Bindings) =>
  env.COMMIT_HASH || env.CF_PAGES_COMMIT_SHA || env.SOURCE_COMMIT || env.GITHUB_SHA || "unknown"

const getCacheStatusSnapshot = async (env: Bindings) => {
  const kvData = (await env.custom_hosts.get("domain_data", { type: "json" })) as any
  if (!kvData) {
    return {
      cached: false,
      message: "No cache data found",
      lastUpdated: null,
      ageMinutes: null,
      isValid: false,
      validUntilMinutes: 0,
      domainCount: 0,
      updateCount: 0,
      version: "unknown"
    }
  }

  const lastUpdated = new Date(kvData.lastUpdated)
  const now = new Date()
  const ageMinutes = Number.isNaN(lastUpdated.getTime())
    ? null
    : Math.round((now.getTime() - lastUpdated.getTime()) / 60000)
  const cacheValidTime = 6 * 60
  const isValid = ageMinutes !== null && ageMinutes < cacheValidTime

  return {
    cached: true,
    lastUpdated: kvData.lastUpdated || null,
    ageMinutes,
    isValid,
    validUntilMinutes: ageMinutes === null ? 0 : Math.max(0, cacheValidTime - ageMinutes),
    domainCount: Object.keys(kvData.domain_data || {}).length,
    updateCount: kvData.updateCount || 0,
    version: kvData.version || "unknown"
  }
}

const checkKvReadWrite = async (env: Bindings) => {
  const startedAt = Date.now()
  const payload = JSON.stringify({ checkedAt: new Date().toISOString() })
  try {
    await env.custom_hosts.put(STATUS_KV_CHECK_KEY, payload, { expirationTtl: 120 })
    const readBack = await env.custom_hosts.get(STATUS_KV_CHECK_KEY)
    return {
      ok: readBack === payload,
      readable: Boolean(readBack),
      writable: true,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString()
    }
  } catch (error) {
    return {
      ok: false,
      readable: false,
      writable: false,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

const buildAdminStatus = async (c: any) => {
  const [cache, customDomains, kv] = await Promise.all([
    getCacheStatusSnapshot(c.env),
    getCustomDomains(c.env),
    checkKvReadWrite(c.env)
  ])
  const session = await getSessionPayload(c)

  return {
    worker: {
      name: "custom-hosts-optimizer",
      version: APP_VERSION,
      commit: getCommitHash(c.env),
      timestamp: new Date().toISOString()
    },
    user: {
      username: session?.username || "api-token",
      authenticatedBy: session ? "session" : "api-token"
    },
    kv,
    hosts: {
      count: cache.domainCount,
      customDomainCount: customDomains.length
    },
    cache,
    customDomains: {
      count: customDomains.length
    }
  }
}

type AuthPayload = { username: string; exp: number; iat: number }
type AuthState = AuthPayload | null

const SESSION_COOKIE_NAME = "cho_session"
const SESSION_MAX_AGE_SECONDS = 86400
const encoder = new TextEncoder()

const base64UrlEncode = (input: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof input === "string"
    ? encoder.encode(input)
    : input instanceof Uint8Array
      ? input
      : new Uint8Array(input)
  let binary = ""
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

const base64UrlDecode = (input: string) => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=")
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const timingSafeEqual = (a: string, b: string) => {
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)
  if (aBytes.length !== bBytes.length) return false
  let result = 0
  for (let i = 0; i < aBytes.length; i++) result |= aBytes[i] ^ bBytes[i]
  return result === 0
}

const getSessionSecret = (env: Bindings) => env.SESSION_SECRET || ""

const signValue = async (value: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value))
  return base64UrlEncode(signature)
}

const createSessionCookie = async (env: Bindings, username: string) => {
  const secret = getSessionSecret(env)
  if (!secret) throw new Error("SESSION_SECRET is not configured")

  const now = Math.floor(Date.now() / 1000)
  const payload: AuthPayload = { username, iat: now, exp: now + SESSION_MAX_AGE_SECONDS }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = await signValue(encodedPayload, secret)

  return `${SESSION_COOKIE_NAME}=${encodedPayload}.${signature}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`
}

const clearSessionCookie = () => `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`

const getCookieValue = (cookieHeader: string | undefined, name: string) => {
  if (!cookieHeader) return undefined
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

const getSessionPayload = async (c: any): Promise<AuthState> => {
  const token = getCookieValue(c.req.header("cookie"), SESSION_COOKIE_NAME)
  const secret = getSessionSecret(c.env)
  if (!token || !secret || !token.includes(".")) return null

  const [encodedPayload, signature] = token.split(".")
  const expectedSignature = await signValue(encodedPayload, secret)
  if (!timingSafeEqual(signature, expectedSignature)) return null

  try {
    const payloadText = new TextDecoder().decode(base64UrlDecode(encodedPayload))
    const payload = JSON.parse(payloadText) as AuthPayload
    if (typeof payload.username === "string" && payload.exp > Math.floor(Date.now() / 1000)) {
      return payload
    }
  } catch {
    // Ignore malformed cookies and treat them as unauthenticated.
  }

  return null
}

const verifySessionCookie = async (c: any) => Boolean(await getSessionPayload(c))

const verifyApiToken = (c: any) => {
  const apiToken = c.env.API_TOKEN
  if (!apiToken) return false

  const authHeader = c.req.header("authorization") || c.req.header("Authorization") || ""
  const bearerToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]
  const headerToken = c.req.header("x-api-key")

  return (bearerToken && timingSafeEqual(bearerToken, apiToken)) ||
    (headerToken && timingSafeEqual(headerToken, apiToken))
}

const hasValidAuth = async (c: any) => verifyApiToken(c) || await verifySessionCookie(c)

const allowRefreshForRequest = async (c: any) => {
  if (c.req.query('refresh') !== 'true') return false
  return await hasValidAuth(c)
}

const isPublicPath = (path: string, method: string) => {
  if (method !== "GET" && method !== "HEAD") return false
  if (["/", "/hosts", "/hosts.json", "/clash-hosts.yaml", "/index.js", "/index.css", "/logo.svg", "/og.svg", "/favicon.ico"].includes(path)) return true
  return path.startsWith("/assets/") || path.startsWith("/static/")
}

const authMiddleware = async (c: any, next: any) => {
  const path = c.req.path
  const method = c.req.method

  if (isPublicPath(path, method) || path === "/admin/login" || path === "/admin-x7k9m3q2") {
    return await next()
  }

  if (await hasValidAuth(c)) return await next()

  if (path.startsWith("/admin")) {
    const redirectTo = encodeURIComponent(path)
    return c.redirect(`/admin/login?redirect=${redirectTo}`, 302)
  }

  return c.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, 401)
}

// 管理后台路由组
const admin = new Hono<{ Bindings: Bindings }>()

// 应用真实认证中间件到所有非公开路由
app.use("*", authMiddleware)

// 首页路由
app.get("/", async (c) => {
  try {
    const html = await c.env.ASSETS.get("index.html")
    if (!html) {
      return c.text("Template not found", 404)
    }
    return c.html(html)
  } catch (error) {
    console.error("Error loading index.html:", error)
    return c.html(`
<!DOCTYPE html>
<html>
<head><title>Custom Hosts</title></head>
<body>
<h1>Custom Hosts Service</h1>
<p>Service is running. Visit /admin for management.</p>
<p>Error loading assets: ${error instanceof Error ? error.message : String(error)}</p>
</body>
</html>
    `)
  }
})

// 静态资源路由
app.get("/index.js", async (c) => {
  try {
    const js = await c.env.ASSETS.get("index.js")
    if (!js) {
      return c.text("JavaScript file not found", 404)
    }
    c.header('Content-Type', 'application/javascript')
    c.header('Cache-Control', 'no-cache, must-revalidate')
    c.header('Pragma', 'no-cache')
    c.header('Expires', '0')
    return c.text(js)
  } catch (error) {
    console.error("Error loading index.js:", error)
    return c.text("Error loading JavaScript", 500)
  }
})

app.get("/index.css", async (c) => {
  try {
    const css = await c.env.ASSETS.get("index.css")
    if (!css) {
      return c.text("CSS file not found", 404)
    }
    c.header('Content-Type', 'text/css')
    c.header('Cache-Control', 'no-cache, must-revalidate')
    c.header('Pragma', 'no-cache')
    c.header('Expires', '0')
    return c.text(css)
  } catch (error) {
    console.error("Error loading index.css:", error)
    return c.text("Error loading CSS", 500)
  }
})

app.get("/logo.svg", async (c) => {
  try {
    const svg = await c.env.ASSETS.get("logo.svg")
    if (!svg) {
      return c.text("Logo not found", 404)
    }
    c.header('Content-Type', 'image/svg+xml')
    return c.text(svg)
  } catch (error) {
    console.error("Error loading logo.svg:", error)
    return c.text("Error loading logo", 500)
  }
})

app.get("/og.svg", async (c) => {
  try {
    const svg = await c.env.ASSETS.get("og.svg")
    if (!svg) {
      return c.text("OG image not found", 404)
    }
    c.header('Content-Type', 'image/svg+xml')
    return c.text(svg)
  } catch (error) {
    console.error("Error loading og.svg:", error)
    return c.text("Error loading OG image", 500)
  }
})

app.get("/favicon.ico", async (c) => {
  try {
    const favicon = await c.env.ASSETS.get("favicon.ico")
    if (!favicon) {
      return c.text("Favicon not found", 404)
    }
    c.header('Content-Type', 'image/x-icon')
    return c.text(favicon)
  } catch (error) {
    console.error("Error loading favicon.ico:", error)
    return c.text("Error loading favicon", 500)
  }
})

const getSafeRedirect = (value: string | undefined) => {
  if (!value || !value.startsWith("/admin")) return "/admin"
  if (value.startsWith("//")) return "/admin"
  return value
}

const renderLoginPage = (errorMessage = "", redirectTo = "/admin") => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登录管理后台</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #2d3748; }
    .card { width: min(92vw, 420px); background: rgba(255,255,255,.96); padding: 32px; border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,.18); }
    h1 { margin: 0 0 8px; font-size: 1.6rem; }
    p { margin: 0 0 24px; color: #718096; }
    label { display: block; margin: 14px 0 6px; font-weight: 600; }
    input { width: 100%; padding: 12px 14px; border: 1px solid #cbd5e0; border-radius: 10px; font-size: 1rem; }
    button { width: 100%; margin-top: 22px; padding: 12px 16px; border: 0; border-radius: 10px; background: #667eea; color: white; font-size: 1rem; font-weight: 700; cursor: pointer; }
    .error { margin-bottom: 16px; padding: 10px 12px; border-radius: 8px; background: #fed7d7; color: #9b2c2c; }
  </style>
</head>
<body>
  <form class="card" method="POST" action="/admin/login">
    <h1>管理后台登录</h1>
    <p>请输入管理员凭据。旧后台路径不再作为认证凭据。</p>
    ${errorMessage ? `<div class="error">${errorMessage}</div>` : ""}
    <input type="hidden" name="redirect" value="${redirectTo.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">
    <label for="username">用户名</label>
    <input id="username" name="username" autocomplete="username" required autofocus>
    <label for="password">密码</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">登录</button>
  </form>
</body>
</html>`

app.get("/admin/login", (c) => {
  return c.html(renderLoginPage("", getSafeRedirect(c.req.query("redirect"))))
})

app.post("/admin/login", async (c) => {
  const configuredUsername = c.env.ADMIN_USERNAME
  const configuredPassword = c.env.ADMIN_PASSWORD
  const sessionSecret = c.env.SESSION_SECRET

  if (!configuredUsername || !configuredPassword || !sessionSecret) {
    return c.html(renderLoginPage("管理员凭据或 SESSION_SECRET 尚未配置。", "/admin"), 500)
  }

  const body = await c.req.parseBody()
  const username = String(body.username || "")
  const password = String(body.password || "")
  const redirectTo = getSafeRedirect(String(body.redirect || "/admin"))

  if (!timingSafeEqual(username, configuredUsername) || !timingSafeEqual(password, configuredPassword)) {
    return c.html(renderLoginPage("用户名或密码错误。", redirectTo), 401)
  }

  c.header("Set-Cookie", await createSessionCookie(c.env, username))
  return c.redirect(redirectTo, 302)
})

app.post("/admin/logout", (c) => {
  c.header("Set-Cookie", clearSessionCookie())
  return c.redirect("/admin/login", 302)
})

app.get("/admin-x7k9m3q2", (c) => c.redirect("/admin", 302))

// 管理后台主页
admin.get("/", async (c) => {
  const session = await getSessionPayload(c)
  const username = escapeHtml(session?.username || "api-token")
  const adminHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>自定义域名管理后台</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; color: #333; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: rgba(255,255,255,0.95); padding: 28px; border-radius: 16px; margin-bottom: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); backdrop-filter: blur(10px); }
        .header-top { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
        .header h1 { color: #2d3748; margin-bottom: 8px; font-size: 2.1rem; font-weight: 700; }
        .header p, .muted { color: #718096; font-size: .95rem; }
        .user-pill { background: #edf2f7; border-radius: 999px; padding: 8px 12px; color: #2d3748; font-weight: 700; }
        .logout-form { margin-top: 10px; text-align: right; }
        .logout-form button { padding: 8px 14px; border: 0; border-radius: 8px; background: #e53e3e; color: #fff; font-weight: 700; cursor: pointer; }
        .card { background: rgba(255,255,255,0.95); padding: 24px; border-radius: 16px; margin-bottom: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); }
        .card h3 { color: #2d3748; margin-bottom: 18px; font-size: 1.25rem; font-weight: 600; display: flex; align-items: center; gap: 8px; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; margin-bottom: 6px; font-weight: 600; color: #4a5568; font-size: 0.95rem; }
        input, textarea { width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; transition: all 0.2s ease; }
        textarea { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; resize: vertical; line-height: 1.5; }
        input:focus, textarea:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
        .btn { padding: 12px 20px; border: none; border-radius: 12px; cursor: pointer; font-size: 14px; font-weight: 600; margin-right: 10px; margin-bottom: 8px; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 8px; }
        .btn:hover { transform: translateY(-2px); }
        .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); }
        .btn-danger { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4); }
        .btn-success { background: linear-gradient(135deg, #51cf66 0%, #40c057 100%); color: white; box-shadow: 0 4px 15px rgba(81, 207, 102, 0.4); }
        .btn-info { background: linear-gradient(135deg, #339af0 0%, #228be6 100%); color: white; box-shadow: 0 4px 15px rgba(51, 154, 240, 0.4); }
        .btn-small { padding: 8px 12px; font-size: 12px; }
        .domain-list { max-height: 500px; overflow-y: auto; background: #f8fafc; border-radius: 12px; padding: 16px; }
        .domain-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px; background: white; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .domain-info { flex: 1; overflow-wrap: anywhere; }
        .domain-info strong { color: #2d3748; font-size: 1.08rem; }
        .domain-info small { color: #718096; font-size: 0.85rem; }
        .domain-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .stats, .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 20px; margin-bottom: 24px; }
        .stat-card, .status-card { background: rgba(255,255,255,0.95); padding: 20px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); }
        .stat-card { text-align: center; }
        .stat-number { font-size: 2.2em; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .stat-label, .status-label { color: #718096; margin-top: 6px; font-weight: 500; }
        .status-value { color: #2d3748; font-size: 1.1rem; font-weight: 700; overflow-wrap: anywhere; }
        .alert { padding: 14px 18px; margin-bottom: 16px; border-radius: 12px; font-weight: 500; display: flex; align-items: center; gap: 12px; }
        .alert-success { background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); color: #155724; border: 1px solid #c3e6cb; }
        .alert-error { background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%); color: #721c24; border: 1px solid #f5c6cb; }
        .batch-input { min-height: 120px; }
        .preview { margin: 12px 0 16px; padding: 12px; border-radius: 12px; background: #f8fafc; color: #4a5568; font-size: .92rem; white-space: pre-wrap; }
        .controls-row, .inline-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px; }
        .inline-row { justify-content: flex-start; align-items: end; }
        .inline-row .form-group { flex: 1; min-width: 260px; margin-bottom: 0; }
        pre.result { background: #1a202c; color: #e2e8f0; padding: 14px; border-radius: 12px; overflow-x: auto; margin-top: 12px; display: none; }
        @media (max-width: 768px) { .container { padding: 16px; } .controls-row, .domain-item { flex-direction: column; align-items: stretch; } .domain-actions { justify-content: flex-start; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-top">
                <div>
                    <h1>🛠️ 自定义域名管理后台</h1>
                    <p>管理和配置自定义域名，优化访问性能</p>
                    <p class="muted" id="cache-summary">缓存状态加载中...</p>
                </div>
                <div>
                    <div class="user-pill">当前用户：${username}</div>
                    <form class="logout-form" method="POST" action="/admin/logout"><button type="submit">退出登录</button></form>
                </div>
            </div>
        </div>

        <div id="alert-container"></div>

        <div class="stats">
            <div class="stat-card"><div class="stat-number" id="total-domains">-</div><div class="stat-label">总域名数</div></div>
            <div class="stat-card"><div class="stat-number" id="github-domains">-</div><div class="stat-label">GitHub 域名</div></div>
            <div class="stat-card"><div class="stat-number" id="custom-domains">-</div><div class="stat-label">自定义域名</div></div>
            <div class="stat-card"><div class="stat-number" id="resolved-domains">-</div><div class="stat-label">已解析域名</div></div>
        </div>

        <div class="card">
            <h3>📊 服务状态</h3>
            <div class="status-grid" id="status-grid">
                <div class="status-card"><div class="status-value">加载中...</div><div class="status-label">Status</div></div>
            </div>
            <button class="btn btn-info" onclick="loadStatus()">🔄 刷新状态</button>
        </div>

        <div class="card">
            <h3>🔎 单个域名测试解析</h3>
            <div class="inline-row">
                <div class="form-group"><label for="test-domain">域名</label><input id="test-domain" placeholder="example.com"></div>
                <button class="btn btn-info" onclick="testDomain()">开始测试</button>
            </div>
            <pre class="result" id="test-result"></pre>
        </div>

        <div class="card">
            <h3>📝 批量管理域名</h3>
            <div class="form-group">
                <label for="batch-domains">域名列表 (每行一个，格式: 域名|描述):</label>
                <textarea id="batch-domains" class="batch-input" placeholder="example1.com|第一个域名&#10;example2.com|第二个域名&#10;example3.com"></textarea>
            </div>
            <div class="preview" id="batch-preview">输入域名后会在这里显示校验预览。</div>
            <button class="btn btn-primary" onclick="batchAddDomains()">📥 批量添加</button>
        </div>

        <div class="card">
            <h3>📋 域名管理</h3>
            <div class="controls-row">
                <div>
                    <button class="btn btn-success" onclick="loadDomains()">🔄 刷新列表</button>
                    <button class="btn btn-info" onclick="exportDomains()">📤 导出 JSON</button>
                </div>
                <button class="btn btn-danger" onclick="clearAllCustomDomains()">🗑️ 清空自定义域名</button>
            </div>
            <div class="domain-list" id="domain-list"><p>加载中...</p></div>
        </div>
    </div>

    <script>
        const domainPattern = /^[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
        const formatTime = (value) => value ? new Date(value).toLocaleString() : '无';
        const formatJson = (value) => JSON.stringify(value, null, 2);

        function showAlert(message, type = 'success') {
            const container = document.getElementById('alert-container');
            const alert = document.createElement('div');
            alert.className = 'alert alert-' + type;
            alert.innerHTML = '<span>' + escapeHtml(message) + '</span>';
            container.appendChild(alert);
            setTimeout(() => alert.remove(), 6000);
        }

        async function parseJsonResponse(response) {
            const text = await response.text();
            try { return text ? JSON.parse(text) : {}; } catch { return { error: text || response.statusText }; }
        }

        async function loadStatus() {
            try {
                const response = await fetch('/api/status');
                const status = await parseJsonResponse(response);
                if (!response.ok) throw new Error(status.error || '状态接口请求失败');
                const cache = status.cache || {};
                document.getElementById('cache-summary').textContent = cache.cached
                    ? '缓存：' + (cache.isValid ? '有效' : '已过期') + '｜上次刷新：' + formatTime(cache.lastUpdated) + '｜年龄：' + (cache.ageMinutes ?? '-') + ' 分钟'
                    : '缓存：未找到缓存数据';
                document.getElementById('status-grid').innerHTML = [
                    ['登录用户', status.user?.username || '-'],
                    ['Worker 版本', status.worker?.version || '-'],
                    ['Commit', status.worker?.commit || '-'],
                    ['KV 可读写', status.kv?.ok ? '正常 (' + status.kv.latencyMs + 'ms)' : '异常'],
                    ['Hosts 条数', status.hosts?.count ?? 0],
                    ['自定义域名数', status.customDomains?.count ?? 0],
                    ['最近刷新', formatTime(cache.lastUpdated)],
                    ['缓存年龄', cache.ageMinutes == null ? '-' : cache.ageMinutes + ' 分钟'],
                    ['更新次数/版本', (cache.updateCount ?? 0) + ' / ' + (cache.version || 'unknown')]
                ].map(([label, value]) => '<div class="status-card"><div class="status-value">' + escapeHtml(value) + '</div><div class="status-label">' + escapeHtml(label) + '</div></div>').join('');
            } catch (error) {
                showAlert('加载状态失败: ' + error.message, 'error');
            }
        }

        async function loadStats() {
            try {
                const response = await fetch('/hosts.json');
                const data = await response.json();
                document.getElementById('total-domains').textContent = data.total || 0;
                document.getElementById('github-domains').textContent = data.github?.length || 0;
                document.getElementById('custom-domains').textContent = data.custom?.length || 0;
                document.getElementById('resolved-domains').textContent = data.entries?.length || 0;
            } catch (error) { console.error('加载统计信息失败:', error); }
        }

        async function loadDomains() {
            const container = document.getElementById('domain-list');
            try {
                const response = await fetch('/api/custom-domains');
                const domainsData = await parseJsonResponse(response);
                if (!response.ok) throw new Error(domainsData.error || response.statusText);
                let domains = Array.isArray(domainsData) ? domainsData : Object.entries(domainsData || {}).map(([domain, info]) => ({ domain, ...info }));
                if (domains.length === 0) {
                    container.innerHTML = '<p style="text-align:center;color:#718096;padding:40px;">暂无自定义域名</p>';
                    return;
                }
                container.innerHTML = domains.map(item => {
                    const domain = escapeHtml(item.domain);
                    return '<div class="domain-item"><div class="domain-info"><strong>' + domain + '</strong>' +
                        (item.description ? '<br><small>' + escapeHtml(item.description) + '</small>' : '') +
                        '<br><small>IP: ' + escapeHtml(item.ip || '未解析') + ' | 添加时间: ' + escapeHtml(formatTime(item.timestamp || item.addedAt)) + '</small></div>' +
                        '<div class="domain-actions"><button class="btn btn-info btn-small" onclick="testDomain(&quot;' + domain + '&quot;)">🔎 测试</button>' +
                        '<button class="btn btn-success btn-small" onclick="optimizeDomain(&quot;' + domain + '&quot;)">🚀 优选</button>' +
                        '<button class="btn btn-danger btn-small" onclick="removeDomain(&quot;' + domain + '&quot;)">🗑️ 删除</button></div></div>';
                }).join('');
            } catch (error) {
                container.innerHTML = '<p style="text-align:center;color:#e53e3e;padding:40px;">加载失败: ' + escapeHtml(error.message) + '</p>';
                showAlert('加载域名列表失败: ' + error.message, 'error');
            }
        }

        function parseBatchInput() {
            const input = document.getElementById('batch-domains').value.trim();
            const seen = new Set();
            const valid = [], invalid = [], duplicates = [];
            input.split('\\n').map(line => line.trim()).filter(Boolean).forEach((line, index) => {
                const parts = line.split('|');
                const domain = (parts[0] || '').trim().toLowerCase();
                const description = (parts.slice(1).join('|') || '').trim();
                if (!domainPattern.test(domain)) invalid.push({ line: index + 1, value: line, reason: '域名格式不正确' });
                else if (seen.has(domain)) duplicates.push({ line: index + 1, domain });
                else { seen.add(domain); valid.push({ domain, description }); }
            });
            return { valid, invalid, duplicates };
        }

        function updateBatchPreview() {
            const { valid, invalid, duplicates } = parseBatchInput();
            document.getElementById('batch-preview').textContent = '有效: ' + valid.length + ' 个；无效: ' + invalid.length + ' 个；重复: ' + duplicates.length + ' 个' +
                (invalid.length ? '\\n无效行: ' + invalid.slice(0, 5).map(i => '#' + i.line + ' ' + i.value).join('；') : '') +
                (duplicates.length ? '\\n重复行: ' + duplicates.slice(0, 5).map(i => '#' + i.line + ' ' + i.domain).join('；') : '');
        }

        async function batchAddDomains() {
            const { valid, invalid, duplicates } = parseBatchInput();
            updateBatchPreview();
            if (valid.length === 0) return showAlert('没有可导入的有效域名，请检查预览提示。', 'error');
            if ((invalid.length || duplicates.length) && !confirm('发现 ' + invalid.length + ' 个无效、' + duplicates.length + ' 个重复，将仅导入 ' + valid.length + ' 个有效域名。继续吗？')) return;
            try {
                const response = await fetch('/api/custom-domains/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domains: valid }) });
                const result = await parseJsonResponse(response);
                if (response.ok) {
                    showAlert('批量操作完成: 成功/更新 ' + result.added + ' 个，失败 ' + result.failed + ' 个' + (result.errors?.length ? '；请查看控制台详情' : ''));
                    if (result.errors?.length) console.warn('批量失败详情:', result.errors);
                    document.getElementById('batch-domains').value = '';
                    updateBatchPreview(); loadDomains(); loadStats(); loadStatus();
                } else showAlert(result.error || '批量添加失败', 'error');
            } catch (error) { showAlert('批量添加失败: ' + error.message, 'error'); }
        }

        async function testDomain(domainArg) {
            const input = document.getElementById('test-domain');
            const domain = (domainArg || input.value || '').trim().toLowerCase();
            const resultBox = document.getElementById('test-result');
            if (!domainPattern.test(domain)) return showAlert('请输入有效域名，例如 example.com', 'error');
            input.value = domain;
            resultBox.style.display = 'block'; resultBox.textContent = '解析中...';
            try {
                const response = await fetch('/api/custom-domains/test?domain=' + encodeURIComponent(domain));
                const result = await parseJsonResponse(response);
                resultBox.textContent = formatJson(result);
                if (!response.ok) showAlert(result.error || '测试失败', 'error');
            } catch (error) { resultBox.textContent = error.message; showAlert('测试失败: ' + error.message, 'error'); }
        }

        async function removeDomain(domain) {
            if (!confirm('确定要删除域名 ' + domain + ' 吗？')) return;
            if (prompt('二次确认：请输入 DELETE 删除 ' + domain) !== 'DELETE') return showAlert('已取消删除', 'error');
            try {
                const response = await fetch('/api/custom-domains/' + encodeURIComponent(domain), { method: 'DELETE' });
                const result = await parseJsonResponse(response);
                if (response.ok) { showAlert('域名 ' + domain + ' 删除成功'); loadDomains(); loadStats(); loadStatus(); }
                else showAlert(result.error || '删除失败', 'error');
            } catch (error) { showAlert('删除域名失败: ' + error.message, 'error'); }
        }

        async function optimizeDomain(domain) {
            showAlert('正在优选域名 ' + domain + '...');
            try {
                const response = await fetch('/api/optimize/' + encodeURIComponent(domain), { method: 'POST' });
                const result = await parseJsonResponse(response);
                if (response.ok) { showAlert('域名 ' + domain + ' 优选完成，IP: ' + (result.bestIp || result.ip || '未知')); loadDomains(); loadStatus(); }
                else showAlert(result.error || '优选失败', 'error');
            } catch (error) { showAlert('优选域名失败: ' + error.message, 'error'); }
        }

        async function exportDomains() {
            try {
                const response = await fetch('/api/custom-domains/export');
                const result = await parseJsonResponse(response);
                if (!response.ok) throw new Error(result.error || '导出失败');
                const blob = new Blob([formatJson(result)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'custom-domains-' + Date.now() + '.json'; a.click(); URL.revokeObjectURL(url);
                showAlert('已导出 ' + (result.count || 0) + ' 个自定义域名');
            } catch (error) { showAlert('导出失败: ' + error.message, 'error'); }
        }

        async function clearAllCustomDomains() {
            if (!confirm('确定要清空所有自定义域名吗？此操作不可恢复！')) return;
            if (prompt('二次确认：请输入 CLEAR 确认清空所有自定义域名') !== 'CLEAR') return showAlert('已取消清空', 'error');
            try {
                const response = await fetch('/api/custom-domains', { method: 'DELETE' });
                const result = await parseJsonResponse(response);
                if (response.ok) showAlert('清空完成，删除了 ' + result.count + ' 个域名');
                else showAlert(result.error || '清空操作失败', 'error');
                loadDomains(); loadStats(); loadStatus();
            } catch (error) { showAlert('清空操作失败: ' + error.message, 'error'); }
        }

        document.addEventListener('DOMContentLoaded', () => {
            loadStats(); loadStatus(); loadDomains(); updateBatchPreview();
            document.getElementById('batch-domains').addEventListener('input', updateBatchPreview);
            document.getElementById('batch-domains').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) batchAddDomains(); });
            document.getElementById('test-domain').addEventListener('keydown', (e) => { if (e.key === 'Enter') testDomain(); });
        });
    </script>
</body>
</html>`

  return c.html(adminHtml)
})

// 管理后台调试端点
admin.get("/debug", async (c) => {
  try {
    const customDomains = await getCustomDomains(c.env)
    
    return c.json({
      stored_domains: customDomains.map(cd => cd.domain),
      stored_count: customDomains.length,
      custom_domains: customDomains,
      timestamp: Date.now()
    })
  } catch (error) {
    return c.json({ 
      error: "Debug failed: " + (error instanceof Error ? error.message : String(error)) 
    }, 500)
  }
})



app.get("/hosts.json", async (c) => {
  try {
    // 检查是否强制刷新缓存
    const forceRefresh = await allowRefreshForRequest(c)
    
    console.log(`JSON request - refresh: ${forceRefresh}`)
    
    const allData = await getCompleteHostsData(c.env, forceRefresh)
    
    // 分离 GitHub 域名和自定义域名
    const githubData = []
    const customData = []
    
    for (const [ip, domain] of allData) {
      if (domain.includes('github') || domain.includes('githubusercontent')) {
        githubData.push([ip, domain])
      } else {
        customData.push([ip, domain])
      }
    }

    // 添加缓存控制头，参考 TinsFox 最佳实践
    c.header('Cache-Control', forceRefresh ? 'no-cache' : 'public, max-age=3600') // 1小时缓存
    c.header('X-Cache-Status', forceRefresh ? 'MISS' : 'HIT')

    return c.json({
      entries: allData,
      total: allData.length,
      github: githubData,
      custom: customData,
      includeCustom: true,
      timestamp: new Date().toISOString(),
      cacheStatus: forceRefresh ? 'refreshed' : 'cached'
    })
  } catch (error) {
    console.error("Error in /hosts.json:", error)
    return c.json({
      entries: [],
      total: 0,
      github: [],
      custom: [],
      includeCustom: true,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, 500)
  }
})

const quoteYamlScalar = (value: unknown) => {
  const text = String(value)
  return `"${text.replace(/\\/g, "\\\\").replace(/\"/g, '\\"').replace(/[\u0000-\u001f\u007f-\u009f]/g, (char) => {
    const code = char.charCodeAt(0)
    switch (char) {
      case "\b": return "\\b"
      case "\t": return "\\t"
      case "\n": return "\\n"
      case "\f": return "\\f"
      case "\r": return "\\r"
      default: return `\\x${code.toString(16).padStart(2, "0")}`
    }
  })}"`
}

const formatClashHostsYaml = (entries: HostEntry[]) => {
  const lines = ["hosts:"]
  for (const [ip, domain] of entries) {
    lines.push(`  ${quoteYamlScalar(domain)}: ${quoteYamlScalar(ip)}`)
  }
  return `${lines.join("\n")}\n`
}

app.get("/clash-hosts.yaml", async (c) => {
  try {
    const refreshRequested = c.req.query('refresh') === 'true'
    const forceRefresh = await allowRefreshForRequest(c)
    const includeCustomDomains = c.req.query('custom') !== 'false'

    console.log(`Clash YAML request - refresh requested: ${refreshRequested}, refresh allowed: ${forceRefresh}, custom: ${includeCustomDomains}`)

    const allData = includeCustomDomains
      ? forceRefresh
        ? await getCompleteHostsData(c.env, true)
        : await getCachedCompleteHostsData(c.env)
      : forceRefresh
        ? await getHostsData(c.env, true)
        : await getCachedHostsData(c.env)

    const yamlContent = formatClashHostsYaml(allData)

    c.header('Cache-Control', forceRefresh ? 'no-cache' : 'public, max-age=3600')
    c.header('X-Cache-Status', forceRefresh ? 'MISS' : 'HIT')
    return c.body(yamlContent, 200, {
      'Content-Type': 'text/yaml; charset=utf-8',
      'Cache-Control': forceRefresh ? 'no-cache' : 'public, max-age=3600',
      'X-Cache-Status': forceRefresh ? 'MISS' : 'HIT'
    })
  } catch (error) {
    console.error("Error in /clash-hosts.yaml:", error)
    return c.body(`# Error generating Clash hosts YAML: ${quoteYamlScalar(error instanceof Error ? error.message : String(error))}\nhosts:\n`, 500, {
      'Content-Type': 'text/yaml; charset=utf-8'
    })
  }
})

app.get("/hosts", async (c) => {
  try {
    // 获取查询参数
    const forceRefresh = await allowRefreshForRequest(c)
    const optimizeParam = c.req.query('optimize')
    const customParam = c.req.query('custom')
    
    // 默认启用所有功能
    const enableOptimization = optimizeParam !== 'false'
    const includeCustomDomains = customParam !== 'false'
    
    console.log(`Hosts request - refresh: ${forceRefresh}, optimize: ${enableOptimization}, custom: ${includeCustomDomains}`)
    
    let allData: HostEntry[]
    
    if (includeCustomDomains) {
      // 包含自定义域名的完整数据
      allData = await getCompleteHostsData(c.env, forceRefresh)
      console.log(`合并后总数据 (包含自定义域名): ${allData.length} 条`)
    } else {
      // 仅 GitHub 域名数据
      allData = await getHostsData(c.env, forceRefresh)
      console.log(`GitHub 数据: ${allData.length} 条`)
    }
    
    const hostsContent = formatHostsFile(allData)
    console.log(`生成的hosts文件长度: ${hostsContent.length} 字符`)
    
    // 添加缓存控制头
    c.header('Cache-Control', forceRefresh ? 'no-cache' : 'public, max-age=3600') // 1小时缓存
    c.header('X-Cache-Status', forceRefresh ? 'MISS' : 'HIT')
    c.header('Content-Type', 'text/plain; charset=utf-8')
    
    return c.text(hostsContent)
  } catch (error) {
    console.error("Error in /hosts:", error)
    return c.text(`# Error generating hosts file: ${error instanceof Error ? error.message : String(error)}`, 500)
  }
})

// 自定义域名管理 API
app.get("/api/custom-domains", async (c) => {
  try {
    const customDomains = await getCustomDomains(c.env)
    return c.json(customDomains)
  } catch (error) {
    console.error("Error getting custom domains:", error)
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})

app.post("/api/custom-domains", async (c) => {

  try {
    const body = await c.req.json()
    const { domain, description } = body

    if (!domain || typeof domain !== "string") {
      return c.json({ error: "Domain is required" }, 400)
    }

    // 简单的域名格式验证
    const normalizedDomain = normalizeDomain(domain)
    if (!DOMAIN_PATTERN.test(normalizedDomain)) {
      return c.json({ error: "Invalid domain format" }, 400)
    }

    const result = await addCustomDomain(c.env, normalizedDomain)

    if (result) {
      const message = result.isUpdate 
        ? `域名 ${normalizedDomain} 已存在，已更新其配置`
        : `域名 ${normalizedDomain} 添加成功`
        
      return c.json({ 
        message, 
        domain: normalizedDomain,
        result,
        isUpdate: result.isUpdate 
      })
    } else {
      return c.json({ error: "Failed to add domain or resolve IP" }, 500)
    }
  } catch (error) {
    return c.json({ error: "Invalid request body" }, 400)
  }
})

// 批量添加自定义域名 API
app.post("/api/custom-domains/batch", async (c) => {
  try {
    const body = await c.req.json()
    const { domains } = body

    if (!domains || !Array.isArray(domains)) {
      return c.json({ error: "Domains array is required" }, 400)
    }

    const results = []
    const errors = []

    for (const domainData of domains) {
      const { domain, description } = domainData

      if (!domain || typeof domain !== "string") {
        errors.push({ domain: domain || "unknown", error: "Domain is required" })
        continue
      }

      // 简单的域名格式验证
      const normalizedDomain = normalizeDomain(domain)
      if (!DOMAIN_PATTERN.test(normalizedDomain)) {
        errors.push({ domain, error: "Invalid domain format" })
        continue
      }

      try {
        const result = await addCustomDomain(c.env, normalizedDomain)
        if (result) {
          const status = result.isUpdate ? "updated" : "success"
          results.push({ domain: normalizedDomain, status })
        } else {
          errors.push({ domain, error: "Failed to add domain" })
        }
      } catch (error) {
        errors.push({ domain, error: error instanceof Error ? error.message : "Unknown error" })
      }
    }

    return c.json({
      message: "Batch operation completed",
      added: results.length,
      failed: errors.length,
      results,
      errors
    })
  } catch (error) {
    return c.json({ error: "Invalid request body" }, 400)
  }
})

app.get("/api/custom-domains/export", async (c) => {
  try {
    const customDomains = await getCustomDomains(c.env)
    c.header("Content-Disposition", `attachment; filename="custom-domains-${Date.now()}.json"`)
    return c.json({
      exportedAt: new Date().toISOString(),
      count: customDomains.length,
      domains: customDomains
    })
  } catch (error) {
    console.error("Error exporting custom domains:", error)
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})

app.get("/api/custom-domains/test", async (c) => {
  const domain = normalizeDomain(c.req.query("domain") || "")
  if (!DOMAIN_PATTERN.test(domain)) {
    return c.json({ error: "Valid domain query parameter is required" }, 400)
  }

  const startedAt = Date.now()
  try {
    const [resolvedIp, customDomains] = await Promise.all([
      fetchIPFromMultipleDNS(domain),
      getCustomDomains(c.env)
    ])
    const storedInfo = customDomains.find(cd => cd.domain === domain)

    return c.json({
      domain,
      resolvedIp,
      standardResolution: resolvedIp || "解析失败",
      success: Boolean(resolvedIp),
      durationMs: Date.now() - startedAt,
      storedInfo: storedInfo || null,
      timestamp: new Date().toISOString()
    }, resolvedIp ? 200 : 404)
  } catch (error) {
    return c.json({
      domain,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    }, 500)
  }
})

app.delete("/api/custom-domains/:domain", async (c) => {
  const domain = c.req.param("domain")
  const success = await removeCustomDomain(c.env, domain)

  if (success) {
    return c.json({ message: "Domain removed successfully", domain })
  } else {
    return c.json({ error: "Domain not found or failed to remove" }, 404)
  }
})

app.post("/api/optimize/:domain", async (c) => {
  const domain = c.req.param("domain")
  
  try {
    // 重新解析域名获取新的 IP
    const newIp = await fetchIPFromMultipleDNS(domain)
    if (!newIp) {
      return c.json({ error: "Failed to resolve domain" }, 404)
    }
    
    // 更新自定义域名
    const result = await addCustomDomain(c.env, domain, newIp)
    if (result) {
      return c.json(result)
    } else {
      return c.json({ error: "Failed to update domain" }, 500)
    }
  } catch (error) {
    console.error(`Error optimizing domain ${domain}:`, error)
    return c.json({ error: "Internal server error" }, 500)
  }
})

// 全域名优选 API - 用于主页立即刷新功能
app.post("/api/optimize-all", async (c) => {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substring(2, 15)

  try {
    console.log(`=== 开始执行全域名优选 [${requestId}] ===`)
    console.log(`请求时间: ${new Date().toISOString()}`)
    console.log(`请求来源: ${c.req.header('user-agent') || 'Unknown'}`)
    console.log(`API token provided: ${c.req.header('x-api-key') ? 'yes' : 'no'}`)
    console.log(`请求IP: ${c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'Unknown'}`)

    // 第一步：重新获取最新的GitHub域名数据（这会触发所有GitHub域名的重新解析）
    console.log(`[${requestId}] 第一步：开始重新解析GitHub域名...`)
    const githubStartTime = Date.now()
    let githubDuration = 0

    let githubEntries = []
    try {
      githubEntries = await fetchLatestHostsData()
      await storeData(c.env, githubEntries)
      githubDuration = Date.now() - githubStartTime
      console.log(`[${requestId}] GitHub域名优选完成: ${githubEntries.length} 个域名，耗时: ${githubDuration}ms`)
    } catch (githubError) {
      githubDuration = Date.now() - githubStartTime
      console.error(`[${requestId}] GitHub域名优选失败 (耗时: ${githubDuration}ms):`, githubError)
      // GitHub域名优选失败不应该阻止自定义域名优选
      console.log(`[${requestId}] GitHub域名优选失败，但继续处理自定义域名`)
    }

    // 第二步：优选所有自定义域名
    console.log(`[${requestId}] 第二步：开始优选自定义域名...`)
    const customStartTime = Date.now()

    const customDomains = await getCustomDomains(c.env)
    console.log(`[${requestId}] 获取到 ${customDomains?.length || 0} 个自定义域名`)

    const customResults = []
    const customErrors = []
    let customSuccessCount = 0

    if (Array.isArray(customDomains) && customDomains.length > 0) {
      console.log(`[${requestId}] 找到 ${customDomains.length} 个自定义域名，开始逐个优选...`)

      // 为每个自定义域名执行优选
      for (let i = 0; i < customDomains.length; i++) {
        const domainData = customDomains[i]
        const domain = domainData.domain
        const domainStartTime = Date.now()

        try {
          console.log(`[${requestId}] 正在优选自定义域名 ${i + 1}/${customDomains.length}: ${domain}`)
          console.log(`[${requestId}] 当前IP: ${domainData.ip}`)

          // 重新解析域名获取新的 IP
          const newIp = await fetchIPFromMultipleDNS(domain)
          const domainDuration = Date.now() - domainStartTime

          if (newIp) {
            console.log(`[${requestId}] 域名 ${domain} DNS解析成功: ${newIp} (耗时: ${domainDuration}ms)`)

            // 更新域名信息，传递新解析的IP
            const updateResult = await addCustomDomain(c.env, domain, newIp)

            if (updateResult) {
              const ipChanged = domainData.ip !== newIp
              customResults.push({
                domain,
                status: "success",
                oldIp: domainData.ip,
                newIp: newIp,
                updated: ipChanged,
                duration: domainDuration
              })
              customSuccessCount++
              console.log(`[${requestId}] 自定义域名 ${domain} 优选成功: ${domainData.ip} -> ${newIp} ${ipChanged ? '(IP已更新)' : '(IP未变化)'}`)
            } else {
              customErrors.push({
                domain,
                error: "更新失败",
                oldIp: domainData.ip,
                newIp: newIp,
                duration: domainDuration
              })
              console.error(`[${requestId}] 自定义域名 ${domain} 更新失败，DNS解析成功但存储失败`)
            }
          } else {
            customErrors.push({
              domain,
              error: "DNS解析失败",
              oldIp: domainData.ip,
              duration: domainDuration
            })
            console.error(`[${requestId}] 自定义域名 ${domain} DNS解析失败 (耗时: ${domainDuration}ms)`)
          }
        } catch (error) {
          const domainDuration = Date.now() - domainStartTime
          const errorMessage = error instanceof Error ? error.message : "未知错误"
          customErrors.push({
            domain,
            error: errorMessage,
            oldIp: domainData.ip,
            duration: domainDuration
          })
          console.error(`[${requestId}] 自定义域名 ${domain} 优选异常 (耗时: ${domainDuration}ms):`, error)
        }
      }

      const customTotalDuration = Date.now() - customStartTime
      console.log(`[${requestId}] 自定义域名优选完成，总耗时: ${customTotalDuration}ms`)
    } else {
      console.log(`[${requestId}] 没有找到自定义域名`)
    }

    const totalOptimized = githubEntries.length + customSuccessCount
    const totalFailed = customErrors.length
    const totalDuration = Date.now() - startTime

    console.log(`[${requestId}] === 全域名优选完成 ===`)
    console.log(`[${requestId}] 总耗时: ${totalDuration}ms`)
    console.log(`[${requestId}] GitHub域名: ${githubEntries.length} 个`)
    console.log(`[${requestId}] 自定义域名成功: ${customSuccessCount} 个`)
    console.log(`[${requestId}] 自定义域名失败: ${customErrors.length} 个`)
    console.log(`[${requestId}] 总优选成功: ${totalOptimized} 个`)
    console.log(`[${requestId}] 总失败: ${totalFailed} 个`)

    // 构建详细的响应
    const response = {
      success: true,
      requestId,
      message: `全域名优选完成: GitHub域名 ${githubEntries.length} 个，自定义域名成功 ${customSuccessCount} 个，失败 ${customErrors.length} 个`,
      optimized: totalOptimized,
      failed: totalFailed,
      duration: totalDuration,
      timestamp: new Date().toISOString(),
      githubDomains: githubEntries.length,
      customDomains: {
        total: customDomains?.length || 0,
        optimized: customSuccessCount,
        failed: customErrors.length
      },
      results: customResults,
      errors: customErrors,
      performance: {
        totalDuration,
        githubDuration: githubDuration || 0,
        customDuration: customStartTime ? Date.now() - customStartTime : 0
      }
    }

    console.log(`[${requestId}] 返回成功响应`)
    return c.json(response)

  } catch (error) {
    const totalDuration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.error(`[${requestId}] === 全域名优选失败 ===`)
    console.error(`[${requestId}] 错误时间: ${new Date().toISOString()}`)
    console.error(`[${requestId}] 执行时长: ${totalDuration}ms`)
    console.error(`[${requestId}] 错误类型: ${error instanceof Error ? error.constructor.name : typeof error}`)
    console.error(`[${requestId}] 错误消息: ${errorMessage}`)
    console.error(`[${requestId}] 错误堆栈:`, error instanceof Error ? error.stack : 'No stack trace')

    // 构建详细的错误响应
    const errorResponse = {
      success: false,
      requestId,
      error: "全域名优选失败: " + errorMessage,
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
      duration: totalDuration,
      timestamp: new Date().toISOString()
    }

    console.error(`[${requestId}] 返回错误响应:`, errorResponse)
    return c.json(errorResponse, 500)
  }
})

app.post("/api/reset", async (c) => {
  const newEntries = await resetHostsData(c.env)

  return c.json({
    message: "Reset completed",
    entriesCount: newEntries.length,
    entries: newEntries,
  })
})

// 批量清空自定义域名 API
app.delete("/api/custom-domains", async (c) => {
  try {
    const customDomains = await getCustomDomains(c.env)
    let domainCount = 0
    
    // 计算域名数量
    if (Array.isArray(customDomains)) {
      domainCount = customDomains.length
    } else if (typeof customDomains === 'object' && customDomains !== null) {
      domainCount = Object.keys(customDomains).length
    }
    
    if (domainCount === 0) {
      return c.json({ message: "No custom domains to clear", count: 0 })
    }
    
    // 直接清空 KV 存储
    await c.env.custom_hosts.delete("custom_domains")
    
    return c.json({ 
      message: "All custom domains cleared successfully", 
      count: domainCount 
    })
  } catch (error) {
    console.error("Error clearing custom domains:", error)
    return c.json({ error: "Failed to clear custom domains" }, 500)
  }
})

// 测试自定义域名解析的API
app.get("/test-custom-domains", async (c) => {
  try {
    const customDomains = await getCustomDomains(c.env)
    let domains: string[] = []
    
    // 兼容数组和对象格式
    if (Array.isArray(customDomains)) {
      domains = customDomains.map(cd => cd.domain)
    } else if (typeof customDomains === 'object' && customDomains !== null) {
      domains = Object.keys(customDomains)
    }
    
    if (domains.length === 0) {
      return c.json({
        message: "没有找到自定义域名",
        domains: [],
        tests: []
      })
    }
    
    const tests = []
    
    for (const domain of domains) {
      console.log(`测试域名: ${domain}`)
      
      try {
        const standardIp = await fetchIPFromMultipleDNS(domain)
        
        tests.push({
          domain,
          standardResolution: standardIp || '解析失败',
          resolvedIp: standardIp,
          storedInfo: Array.isArray(customDomains) 
            ? customDomains.find(cd => cd.domain === domain)
            : customDomains[domain]
        })
      } catch (error) {
        tests.push({
          domain,
          standardResolution: '解析错误',
          resolvedIp: null,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
    
    return c.json({
      message: `测试了 ${domains.length} 个自定义域名`,
      domains,
      tests
    })
  } catch (error) {
    return c.json({ 
      error: "测试失败: " + (error instanceof Error ? error.message : String(error)) 
    }, 500)
  }
})

// 调试 API：获取自定义域名解析状态
app.get("/debug", async (c) => {
  try {
    const customDomains = await getCustomDomains(c.env)
    
    return c.json({
      stored_domains: customDomains.map(cd => cd.domain),
      stored_count: customDomains.length,
      custom_domains: customDomains,
      timestamp: Date.now()
    })
  } catch (error) {
    return c.json({ 
      error: "Debug failed: " + (error instanceof Error ? error.message : String(error)) 
    }, 500)
  }
})

app.get("/api/status", async (c) => {
  try {
    return c.json(await buildAdminStatus(c))
  } catch (error) {
    console.error("Error building status:", error)
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})

// 缓存管理 API - 参考 TinsFox/github-hosts 最佳实践
app.get("/api/cache/status", async (c) => {
  try {
    return c.json(await getCacheStatusSnapshot(c.env))
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})

app.post("/api/cache/refresh", async (c) => {
  try {
    console.log("Manual cache refresh requested")
    
    // 强制刷新 GitHub 域名数据
    const newEntries = await fetchLatestHostsData()
    await storeData(c.env, newEntries)
    
    return c.json({
      message: "Cache refreshed successfully",
      entriesCount: newEntries.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error refreshing cache:", error)
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})

app.delete("/api/cache", async (c) => {
  try {
    console.log("Cache clear requested")
    
    await c.env.custom_hosts.delete("domain_data")
    
    return c.json({
      message: "Cache cleared successfully",
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error clearing cache:", error)
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})


// 管理后台路由
app.route("/admin", admin)

// 通用路由处理
app.get("*", async (c) => {
  const path = c.req.path
  
  // 检查是否是域名查询路径
  if (path !== "/" && !path.startsWith("/api/") && !path.startsWith("/hosts") && path !== "/favicon.ico" && !path.startsWith("/admin")) {
    const domain = path.substring(1) // 移除开头的 /
    
    // 简单验证是否是域名格式
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
      const data = await getDomainData(c.env, domain)

      if (!data) {
        return c.json({ error: "Domain not found" }, 404)
      }

      return c.json(data)
    }
  }
  
  // 默认返回 404
  return c.text("Not Found", 404)
})

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(handleSchedule(event, env))
  },
}
