import { isIP } from "node:net";
export class InputError extends Error {}
export function domainName(value: unknown): string {
  if (typeof value !== "string") throw new InputError("域名必须是文本");
  const domain = value.trim().toLowerCase().replace(/\.$/, "");
  if (
    domain.length > 253 ||
    !domain.includes(".") ||
    !domain
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    throw new InputError("域名格式无效");
  return domain;
}
export function ipAddress(value: unknown): string {
  if (typeof value !== "string" || !isIP(value))
    throw new InputError("IP 地址格式无效");
  return value;
}
export function publicAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b, c, d] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      // IANA: 192.0.0.0/24 is special-purpose, except global anycast .9/.10;
      // 192.0.2.0/24 is documentation. Other 192.0.* addresses can be public.
      (a === 192 && b === 0 && c === 0 && d !== 9 && d !== 10) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  return (
    isIP(ip) === 6 &&
    /^(2|3)/i.test(ip) &&
    !ip.toLowerCase().startsWith("2001:db8:")
  );
}
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "操作失败";
