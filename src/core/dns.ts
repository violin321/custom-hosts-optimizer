import { publicAddress, domainName, errorText } from "./validation";
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
          const addresses = (data.Answer || []).filter(
            (a) => a.type === (type === "A" ? 1 : 28),
          );
          return {
            addressCount: addresses.length,
            ips: addresses
              .filter((a) => publicAddress(a.data))
              .map((a) => a.data),
          };
        }
        throw Error("DNS 查询重试次数已耗尽");
      }),
    ),
  );
  const successful = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const ips = [...new Set(successful.flatMap((result) => result.ips))];
  if (!ips.length) {
    if (!successful.length) {
      const reasons = [
        ...new Set(
          results.flatMap((result) =>
            result.status === "rejected" ? [errorText(result.reason)] : [],
          ),
        ),
      ];
      throw Error(`所有 DNS 查询均失败（${reasons.join("；")}）`);
    }
    if (successful.some((result) => result.addressCount > 0))
      throw Error("DNS 返回的 IP 均为非公网或无效地址，已过滤");
    if (successful.length < results.length)
      throw Error("部分 DNS 查询失败，其余查询未返回 A/AAAA 地址");
    throw Error("DNS 查询成功，但未返回 A/AAAA 地址");
  }
  return {
    ips: ips.slice(0, 8),
    source: "cloudflare/google-doh",
    durationMs: Date.now() - started,
  };
}
