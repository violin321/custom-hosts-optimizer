import type { DomainRecord, Snapshot, StoreState, HostEntry } from "../types";
import { GITHUB_URLS } from "../constants";
import { domainName, ipAddress } from "./validation";
export const now = () => new Date().toISOString();
export function legacyRecord(item: any, domain?: string): DomainRecord | null {
  try {
    const name = domainName(domain || item.domain),
      ip = ipAddress(item.ip);
    return {
      domain: name,
      ip,
      candidates: [ip],
      mode:
        item.mode ||
        (item.resolveMethod === "manual" ||
        item.resolveMethod === "migrated" ||
        !domain
          ? "manual"
          : "dns"),
      isActive: item.isActive !== false,
      addedAt: item.addedAt || item.lastUpdated || now(),
      lastSuccessAt: item.lastSuccessAt || item.resolvedAt || item.lastUpdated,
      lastChangedAt: item.lastChangedAt || item.lastUpdated,
      source: item.provider || item.resolveMethod || "legacy",
    };
  } catch {
    return null;
  }
}
export async function importLegacy(kv: KVNamespace): Promise<StoreState> {
  const [github, custom] = await Promise.all([
    kv.get<any>("domain_data", "json"),
    kv.get<any>("custom_domains", "json"),
  ]);
  return {
    schemaVersion: 2,
    github: Object.entries(github?.domain_data || {})
      .filter(([domain]) => GITHUB_URLS.includes(domain))
      .map(([domain, value]) => legacyRecord(value, domain))
      .filter((v): v is DomainRecord => !!v)
      .map((r) => ({ ...r, mode: "probe" as const })),
    custom: Object.values(custom || {})
      .map((item) => legacyRecord(item))
      .filter((v): v is DomainRecord => !!v),
  };
}
export async function snapshotFor(
  state: StoreState,
): Promise<Snapshot | undefined> {
  const gh = state.github
    .filter((r) => r.isActive && r.ip)
    .map((r) => [r.ip, r.domain] as HostEntry);
  const custom = state.custom
    .filter((r) => r.isActive && r.ip)
    .map((r) => [r.ip, r.domain] as HostEntry);
  const combined = new Map(gh.map(([ip, d]) => [d, ip]));
  custom.forEach(([ip, d]) => combined.set(d, ip));
  const entries = [...combined]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, ip]) => [ip, d] as HostEntry);
  if (!entries.length) return undefined;
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(entries)),
  );
  const version = [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return {
    schemaVersion: 2,
    version,
    entries,
    github: gh,
    custom,
    changedAt:
      state.snapshot?.version === version ? state.snapshot.changedAt : now(),
    publishedAt: now(),
    lastSuccessAt: state.lastSuccessAt,
  };
}
export function formatHosts(snapshot: Snapshot, custom = true): string {
  const entries = custom ? snapshot.entries : snapshot.github;
  return `# Custom Hosts — ${snapshot.version}\n${entries.map(([ip, d]) => `${ip.padEnd(40)} ${d}`).join("\n")}\n# 数据变更时间：${snapshot.changedAt}\n`;
}
export function formatYaml(snapshot: Snapshot, custom = true): string {
  return (
    "hosts:\n" +
    (custom ? snapshot.entries : snapshot.github)
      .map(([ip, d]) => `  ${JSON.stringify(d)}: ${JSON.stringify(ip)}`)
      .join("\n") +
    "\n"
  );
}
