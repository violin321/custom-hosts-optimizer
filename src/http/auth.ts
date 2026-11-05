import type { Context } from "hono";
import type { Bindings } from "../types";
type Ctx = Context<{ Bindings: Bindings }>;
const COOKIE = "cho_session",
  MAX_AGE = 86400;
const encoder = new TextEncoder();
export function equal(a: string, b: string): boolean {
  const x = encoder.encode(a),
    y = encoder.encode(b);
  if (x.length !== y.length) return false;
  let v = 0;
  for (let i = 0; i < x.length; i++) v |= x[i] ^ y[i];
  return v === 0;
}
const encode = (text: string) =>
  btoa(String.fromCharCode(...encoder.encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const decode = (text: string) =>
  new TextDecoder().decode(
    Uint8Array.from(
      atob(
        text
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(Math.ceil(text.length / 4) * 4, "="),
      ),
      (c) => c.charCodeAt(0),
    ),
  );
async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
async function credentialsVersion(env: Bindings) {
  return sign(
    `${env.ADMIN_USERNAME}\0${env.ADMIN_PASSWORD}`,
    env.SESSION_SECRET || "",
  );
}
export function bearer(c: Ctx, secret: string | undefined) {
  if (!secret) return false;
  const token =
    c.req.header("Authorization")?.match(/^Bearer (.+)$/i)?.[1] ||
    c.req.header("x-api-key") ||
    "";
  return equal(token, secret);
}
export async function session(c: Ctx): Promise<string | null> {
  const value = c.req
    .header("Cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  if (!value || !c.env.SESSION_SECRET) return null;
  try {
    const parts = value.split(".");
    if (
      parts.length !== 2 ||
      !equal(await sign(parts[0], c.env.SESSION_SECRET), parts[1])
    )
      return null;
    const p = JSON.parse(decode(parts[0])),
      now = Math.floor(Date.now() / 1000);
    return p.username === c.env.ADMIN_USERNAME &&
      p.exp > now &&
      p.iat <= now + 60 &&
      p.exp - p.iat <= MAX_AGE &&
      p.v === (await credentialsVersion(c.env))
      ? p.username
      : null;
  } catch {
    return null;
  }
}
export async function cookie(env: Bindings, username: string) {
  if (!env.SESSION_SECRET) throw Error("SESSION_SECRET 未配置");
  const iat = Math.floor(Date.now() / 1000);
  const payload = encode(
    JSON.stringify({
      username,
      iat,
      exp: iat + MAX_AGE,
      v: await credentialsVersion(env),
    }),
  );
  return `${COOKIE}=${payload}.${await sign(payload, env.SESSION_SECRET)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
}
export const logoutCookie = () =>
  `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
export function sameOrigin(c: Ctx) {
  const origin = c.req.header("Origin");
  return origin
    ? origin === new URL(c.req.url).origin
    : c.req.header("Sec-Fetch-Site") !== "cross-site";
}
export async function fingerprint(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
