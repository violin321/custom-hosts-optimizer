import { publicAddress, domainName } from "./validation";
export async function resolveCandidates(
  input: string,
): Promise<{ ips: string[]; source: string; durationMs: number }> {
  const domain = domainName(input),
    started = Date.now();
  const providers = [
    "https://cloudflare-dns.com/dns-query",
    "https://dns.google/resolve",
  ];
  const results = await Promise.allSettled(
    providers.flatMap((provider) =>
      ["A", "AAAA"].map(async (type) => {
        const url = new URL(provider);
        url.searchParams.set("name", domain);
        url.searchParams.set("type", type);
        for (let attempt = 0; attempt < 2; attempt++) {
          let response: Response;
          try {
            response = await fetch(url, {
              headers: { Accept: "application/dns-json" },
              signal: AbortSignal.timeout(2500),
            });
          } catch (e) {
            if (attempt === 0) continue;
            throw e;
          }
          if (!response.ok) {
            await response.body?.cancel();
            if (
              attempt === 0 &&
              (response.status >= 500 || response.status === 429)
            )
              continue;
            throw Error(`DNS HTTP ${response.status}`);
          }
          const data = (await response.json()) as {
            Status: number;
            Answer?: { type: number; data: string }[];
          };
          if (data.Status !== 0) {
            if (attempt === 0 && data.Status === 2) continue;
            throw Error(`DNS 状态 ${data.Status}`);
          }
          return (data.Answer || [])
            .filter(
              (a) =>
                a.type === (type === "A" ? 1 : 28) && publicAddress(a.data),
            )
            .map((a) => a.data);
        }
        return [];
      }),
    ),
  );
  const ips = [
    ...new Set(
      results.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      ),
    ),
  ];
  if (!ips.length) throw Error("所有 DNS 来源均未返回有效公共 IP");
  return {
    ips: ips.slice(0, 8),
    source: "cloudflare/google-doh",
    durationMs: Date.now() - started,
  };
}
