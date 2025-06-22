import { DNS_PROVIDERS, GITHUB_URLS, HOSTS_TEMPLATE } from "../constants"
import { Bindings, CustomDomainList, OptimizationResult } from "../types"

export type HostEntry = [string, string]

interface DomainData {
  ip: string
  lastUpdated: string
  lastChecked: string
}

interface DomainDataList {
  [key: string]: DomainData
}
interface KVData {
  domain_data: DomainDataList
  lastUpdated: string
}

interface DnsQuestion {
  name: string
  type: number
}

interface DnsAnswer {
  name: string
  type: number
  TTL: number
  data: string
}

interface DnsResponse {
  Status: number
  TC: boolean
  RD: boolean
  RA: boolean
  AD: boolean
  CD: boolean
  Question: DnsQuestion[]
  Answer: DnsAnswer[]
}

async function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries === 0) throw error
    await new Promise((resolve) => setTimeout(resolve, delay))
    return retry(fn, retries - 1, delay * 2)
  }
}

export async function fetchIPFromIPAddress(
  domain: string,
  providerName?: string
): Promise<string | null> {
  const provider =
    DNS_PROVIDERS.find((p) => p.name === providerName) || DNS_PROVIDERS[0]

  try {
    const response = await retry(() =>
      fetch(provider.url(domain), { headers: provider.headers })
    )

    if (!response.ok) return null

    const data = (await response.json()) as DnsResponse

    // 查找类型为 1 (A记录) 的答案
    const aRecord = data.Answer?.find((answer) => answer.type === 1)
    const ip = aRecord?.data

    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
      return ip
    }
  } catch (error) {
    console.error(`Error with DNS provider:`, error)
  }

  return null
}

export async function fetchLatestHostsData(useOptimization: boolean = false): Promise<HostEntry[]> {
  const entries: HostEntry[] = []
  const batchSize = 5

  for (let i = 0; i < GITHUB_URLS.length; i += batchSize) {
    console.log(
      `Processing batch ${i / batchSize + 1}/${Math.ceil(
        GITHUB_URLS.length / batchSize
      )}`
    )

    const batch = GITHUB_URLS.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (domain) => {
        if (useOptimization) {
          const optimized = await optimizeDomainIP(domain)
          console.log(`Domain: ${domain}, Optimized IP: ${optimized?.ip}, Response Time: ${optimized?.responseTime}ms`)
          return optimized ? ([optimized.ip, domain] as HostEntry) : null
        } else {
          const ip = await fetchIPFromIPAddress(domain)
          console.log(`Domain: ${domain}, IP: ${ip}`)
          return ip ? ([ip, domain] as HostEntry) : null
        }
      })
    )

    entries.push(
      ...batchResults.filter((result): result is HostEntry => result !== null)
    )

    if (i + batchSize < GITHUB_URLS.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  console.log(`Total entries found: ${entries.length}`)
  return entries
}
export async function storeData(
  env: Bindings,
  data: HostEntry[]
): Promise<void> {

  await updateHostsData(env, data)
}
export async function getHostsData(env: Bindings, useOptimization: boolean = false): Promise<HostEntry[]> {
  const kvData = (await env.github_hosts.get("domain_data", {
    type: "json",
  })) as KVData | null

  // 如果数据不存在，或者最后更新时间超过1小时，获取新数据
  if (
    !kvData?.lastUpdated ||
    new Date(kvData.lastUpdated).getTime() + 1000 * 60 * 60 < Date.now() ||
    Object.keys(kvData.domain_data || {}).length === 0
  ) {
    const newEntries = await fetchLatestHostsData(useOptimization)
    await storeData(env, newEntries)
    return newEntries
  }

  try {
    // 从 KV 获取所有域名的数据
    const entries: HostEntry[] = []
    for (const domain of GITHUB_URLS) {
      const domainData = kvData.domain_data[domain]
      if (domainData) {
        entries.push([domainData.ip, domain])
      }
    }
    return entries
  } catch (error) {
    console.error("Error getting hosts data:", error)
    return []
  }
}

export async function updateHostsData(
  env: Bindings,
  newEntries?: HostEntry[]
): Promise<void> {
  try {
    const currentTime = new Date().toISOString()
    const kvData = (await env.github_hosts.get("domain_data", {
      type: "json",
    })) as KVData | null || { domain_data: {}, lastUpdated: currentTime }

    if (!newEntries) {
      // 只更新检查时间
      for (const domain in kvData.domain_data) {
        kvData.domain_data[domain] = {
          ...kvData.domain_data[domain],
          lastChecked: currentTime,
        }
      }
    } else {
      // 更新域名数据
      for (const [ip, domain] of newEntries) {
        const oldData = kvData.domain_data[domain]
        const hasChanged = !oldData || oldData.ip !== ip

        kvData.domain_data[domain] = {
          ip,
          lastUpdated: hasChanged ? currentTime : oldData?.lastUpdated || currentTime,
          lastChecked: currentTime,
        }
      }
    }

    kvData.lastUpdated = currentTime
    await env.github_hosts.put("domain_data", JSON.stringify(kvData))
  } catch (error) {
    console.error("Error updating hosts data:", error)
  }
}

export function formatHostsFile(entries: HostEntry[]): string {
  const content = entries
    .map(([ip, domain]) => `${ip.padEnd(30)}${domain}`)
    .join("\n")

  const updateTime = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  })

  return HOSTS_TEMPLATE.replace("{content}", content).replace(
    "{updateTime}",
    updateTime
  )
}

// 修改：获取单个域名数据的方法，直接从爬虫获取实时数据
export async function getDomainData(
  env: Bindings,
  domain: string
): Promise<DomainData | null> {
  try {
    const ip = await fetchIPFromIPAddress(domain)
    if (!ip) {
      return null
    }

    const currentTime = new Date().toISOString()
    const kvData = (await env.github_hosts.get("domain_data", {
      type: "json",
    })) as KVData | null || { domain_data: {}, lastUpdated: currentTime }

    const newData: DomainData = {
      ip,
      lastUpdated: currentTime,
      lastChecked: currentTime,
    }

    kvData.domain_data[domain] = newData
    kvData.lastUpdated = currentTime
    await env.github_hosts.put("domain_data", JSON.stringify(kvData))

    return newData
  } catch (error) {
    console.error(`Error getting data for domain ${domain}:`, error)
    return null
  }
}

// 修改：清空 KV 并重新获取所有数据
export async function resetHostsData(env: Bindings, useOptimization: boolean = false): Promise<HostEntry[]> {
  try {
    console.log("Clearing KV data...")
    await env.github_hosts.delete("domain_data")
    console.log("KV data cleared")

    console.log("Fetching new data...")
    const newEntries = await fetchLatestHostsData(useOptimization)
    console.log("New entries fetched:", newEntries)

    await updateHostsData(env, newEntries)
    console.log("New data stored in KV")

    return newEntries
  } catch (error) {
    console.error("Error resetting hosts data:", error)
    return []
  }
}

// 新增：IP 优选测试函数
async function testIPResponse(ip: string, domain: string, timeout: number = 5000): Promise<number> {
  try {
    const startTime = Date.now()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    const response = await fetch(`https://${ip}`, {
      method: 'HEAD',
      headers: {
        'Host': domain,
        'User-Agent': 'Mozilla/5.0 (compatible; github-hosts-optimizer/1.0)'
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    if (response.ok || response.status === 301 || response.status === 302) {
      return responseTime
    }
    return Infinity
  } catch (error) {
    return Infinity
  }
}

// 新增：获取域名的多个 IP 地址
export async function fetchAllIPsForDomain(domain: string): Promise<string[]> {
  const ips: Set<string> = new Set()
  
  // 从多个 DNS 提供商获取 IP
  for (const provider of DNS_PROVIDERS) {
    try {
      const response = await retry(() =>
        fetch(provider.url(domain), { headers: provider.headers })
      )

      if (!response.ok) continue

      const data = (await response.json()) as DnsResponse
      const aRecords = data.Answer?.filter((answer) => answer.type === 1)
      
      aRecords?.forEach(record => {
        if (record.data && /^\d+\.\d+\.\d+\.\d+$/.test(record.data)) {
          ips.add(record.data)
        }
      })
    } catch (error) {
      console.error(`Error with DNS provider ${provider.name}:`, error)
    }
  }
  
  return Array.from(ips)
}

// 新增：优选域名最佳 IP
export async function optimizeDomainIP(domain: string): Promise<{ ip: string, responseTime: number } | null> {
  try {
    const ips = await fetchAllIPsForDomain(domain)
    
    if (ips.length === 0) {
      return null
    }
    
    console.log(`Testing ${ips.length} IPs for domain: ${domain}`)
    
    // 并发测试所有 IP 的响应时间
    const testResults = await Promise.all(
      ips.map(async (ip) => {
        const responseTime = await testIPResponse(ip, domain)
        return { ip, responseTime }
      })
    )
    
    // 筛选出有效的 IP（响应时间不是 Infinity）
    const validResults = testResults.filter(result => result.responseTime !== Infinity)
    
    if (validResults.length === 0) {
      // 如果没有有效的 IP，返回第一个可用的 IP
      return ips.length > 0 ? { ip: ips[0], responseTime: Infinity } : null
    }
    
    // 按响应时间排序，返回最快的 IP
    validResults.sort((a, b) => a.responseTime - b.responseTime)
    
    console.log(`Best IP for ${domain}: ${validResults[0].ip} (${validResults[0].responseTime}ms)`)
    return validResults[0]
  } catch (error) {
    console.error(`Error optimizing IP for domain ${domain}:`, error)
    return null
  }
}

// 新增：自定义域名管理函数
export async function getCustomDomains(env: Bindings): Promise<CustomDomainList> {
  try {
    const data = await env.github_hosts.get("custom_domains", { type: "json" }) as CustomDomainList | null
    return data || {}
  } catch (error) {
    console.error("Error getting custom domains:", error)
    return {}
  }
}

export async function addCustomDomain(env: Bindings, domain: string, description?: string): Promise<boolean> {
  try {
    const customDomains = await getCustomDomains(env)
    
    customDomains[domain] = {
      domain,
      description,
      addedAt: new Date().toISOString()
    }
    
    await env.github_hosts.put("custom_domains", JSON.stringify(customDomains))
    return true
  } catch (error) {
    console.error("Error adding custom domain:", error)
    return false
  }
}

export async function removeCustomDomain(env: Bindings, domain: string): Promise<boolean> {
  try {
    const customDomains = await getCustomDomains(env)
    
    if (customDomains[domain]) {
      delete customDomains[domain]
      await env.github_hosts.put("custom_domains", JSON.stringify(customDomains))
      return true
    }
    
    return false
  } catch (error) {
    console.error("Error removing custom domain:", error)
    return false
  }
}

export async function optimizeCustomDomain(env: Bindings, domain: string): Promise<OptimizationResult | null> {
  try {
    const result = await optimizeDomainIP(domain)
    
    if (!result) {
      return null
    }
    
    // 更新自定义域名的最后更新时间
    const customDomains = await getCustomDomains(env)
    if (customDomains[domain]) {
      customDomains[domain].lastUpdated = new Date().toISOString()
      await env.github_hosts.put("custom_domains", JSON.stringify(customDomains))
    }
    
    return {
      domain,
      bestIp: result.ip,
      responseTime: result.responseTime,
      testTime: new Date().toISOString()
    }
  } catch (error) {
    console.error(`Error optimizing custom domain ${domain}:`, error)
    return null
  }
}

export async function fetchCustomDomainsData(env: Bindings, useOptimization: boolean = false): Promise<HostEntry[]> {
  try {
    const customDomains = await getCustomDomains(env)
    const domains = Object.keys(customDomains)
    
    if (domains.length === 0) {
      return []
    }
    
    const entries: HostEntry[] = []
    
    for (const domain of domains) {
      if (useOptimization) {
        const optimized = await optimizeDomainIP(domain)
        if (optimized) {
          entries.push([optimized.ip, domain])
        }
      } else {
        const ip = await fetchIPFromIPAddress(domain)
        if (ip) {
          entries.push([ip, domain])
        }
      }
    }
    
    return entries
  } catch (error) {
    console.error("Error fetching custom domains data:", error)
    return []
  }
}
