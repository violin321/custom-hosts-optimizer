import { Hono } from "hono"
import {
  formatHostsFile,
  getDomainData,
  getHostsData,
  resetHostsData,
  getCustomDomains,
  addCustomDomain,
  removeCustomDomain,
  optimizeCustomDomain,
  fetchCustomDomainsData,
  fetchLatestHostsData,
} from "./services/hosts"
import { handleSchedule } from "./scheduled"
import { Bindings } from "./types"

const app = new Hono<{ Bindings: Bindings }>()

app.get("/", async (c) => {
  const html = await c.env.ASSETS.get("index.html")
  if (!html) {
    return c.text("Template not found", 404)
  }

  return c.html(html)
})

app.get("/hosts.json", async (c) => {
  const useOptimization = c.req.query("optimize") === "true"
  const includeCustom = c.req.query("custom") !== "false"

  const githubData = await getHostsData(c.env, useOptimization)
  let customData: any[] = []

  if (includeCustom) {
    customData = await fetchCustomDomainsData(c.env, useOptimization)
  }

  return c.json({
    github: githubData,
    custom: customData,
    total: githubData.length + customData.length,
  })
})

app.get("/hosts", async (c) => {
  const useOptimization = c.req.query("optimize") === "true"
  const includeCustom = c.req.query("custom") !== "false"

  const githubData = await getHostsData(c.env, useOptimization)
  let customData: any[] = []

  if (includeCustom) {
    customData = await fetchCustomDomainsData(c.env, useOptimization)
  }

  const allData = [...githubData, ...customData]
  const hostsContent = formatHostsFile(allData)
  return c.text(hostsContent)
})

// 自定义域名管理 API
app.get("/api/custom-domains", async (c) => {
  const apiKey = c.req.query("key")

  if (apiKey !== c.env.API_KEY) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const customDomains = await getCustomDomains(c.env)
  return c.json(customDomains)
})

app.post("/api/custom-domains", async (c) => {
  const apiKey = c.req.query("key")

  if (apiKey !== c.env.API_KEY) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await c.req.json()
    const { domain, description } = body

    if (!domain || typeof domain !== "string") {
      return c.json({ error: "Domain is required" }, 400)
    }

    // 简单的域名格式验证
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
      return c.json({ error: "Invalid domain format" }, 400)
    }

    const success = await addCustomDomain(c.env, domain, description)

    if (success) {
      return c.json({ message: "Domain added successfully", domain })
    } else {
      return c.json({ error: "Failed to add domain" }, 500)
    }
  } catch (error) {
    return c.json({ error: "Invalid request body" }, 400)
  }
})

app.delete("/api/custom-domains/:domain", async (c) => {
  const apiKey = c.req.query("key")

  if (apiKey !== c.env.API_KEY) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const domain = c.req.param("domain")
  const success = await removeCustomDomain(c.env, domain)

  if (success) {
    return c.json({ message: "Domain removed successfully", domain })
  } else {
    return c.json({ error: "Domain not found or failed to remove" }, 404)
  }
})

app.post("/api/optimize/:domain", async (c) => {
  const apiKey = c.req.query("key")

  if (apiKey !== c.env.API_KEY) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const domain = c.req.param("domain")
  const result = await optimizeCustomDomain(c.env, domain)

  if (result) {
    return c.json(result)
  } else {
    return c.json({ error: "Failed to optimize domain" }, 500)
  }
})

app.post("/reset", async (c) => {
  const apiKey = c.req.query("key")
  const useOptimization = c.req.query("optimize") === "true"

  // 验证 API key
  if (apiKey !== c.env.API_KEY) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const newEntries = await resetHostsData(c.env, useOptimization)

  return c.json({
    message: "Reset completed",
    entriesCount: newEntries.length,
    entries: newEntries,
    optimization: useOptimization ? "enabled" : "disabled",
  })
})

app.get("/:domain", async (c) => {
  const domain = c.req.param("domain")
  const data = await getDomainData(c.env, domain)

  if (!data) {
    return c.json({ error: "Domain not found" }, 404)
  }

  return c.json(data)
})

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(handleSchedule(event, env))
  },
}
