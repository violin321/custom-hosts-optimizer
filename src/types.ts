export interface Bindings {
  HOSTS_STORE: KVNamespace
  API_KEY: string
  ASSETS: { get(key: string): Promise<string | null> }
  github_hosts: KVNamespace
  ENABLE_OPTIMIZATION?: string
}

export interface CustomDomain {
  domain: string
  description?: string
  addedAt: string
  lastUpdated?: string
}

export interface CustomDomainList {
  [key: string]: CustomDomain
}

export interface OptimizationResult {
  domain: string
  bestIp: string
  responseTime: number
  testTime: string
}
