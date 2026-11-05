export type HostEntry = [string, string];
export type DomainMode = "manual" | "dns" | "probe";
export interface DomainRecord {
  domain: string;
  ip: string;
  candidates: string[];
  mode: DomainMode;
  isActive: boolean;
  addedAt: string;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastChangedAt?: string;
  lastError?: string;
  source?: string;
  resolutionMs?: number;
  resolutionSource?: string;
  probe?: {
    testedAt: string;
    network: string;
    successRate: number;
    latencyMs: number;
  };
}
export interface Snapshot {
  schemaVersion: 2;
  version: string;
  entries: HostEntry[];
  github: HostEntry[];
  custom: HostEntry[];
  changedAt: string;
  publishedAt: string;
  lastSuccessAt?: string;
}
export interface RefreshJob {
  id: string;
  status: "queued" | "running" | "success" | "partial" | "failed";
  startedAt: string;
  finishedAt?: string;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  errors: { domain: string; error: string }[];
  pending: string[];
  results: Record<
    string,
    { ips: string[]; source: string; durationMs: number }
  >;
  cancelled?: boolean;
}
export interface StoreState {
  schemaVersion: 2;
  github: DomainRecord[];
  custom: DomainRecord[];
  snapshot?: Snapshot;
  job?: RefreshJob;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  publicationError?: string;
}
export interface Bindings {
  custom_hosts: KVNamespace;
  COORDINATOR: DurableObjectNamespace;
  ASSETS: Fetcher;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  API_TOKEN?: string;
  PROBE_TOKEN?: string;
  COMMIT_HASH?: string;
}
