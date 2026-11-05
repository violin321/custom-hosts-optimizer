import { test } from "node:test";
import assert from "node:assert/strict";
import { publicAddress } from "../src/core/validation";
import { resolveCandidates } from "../src/core/dns";

test("public IPv4 checks use precise special-purpose ranges", () => {
  for (const ip of [
    "192.0.66.2",
    "192.0.1.1",
    "192.0.3.1",
    "192.0.0.9",
    "192.0.0.10",
    "8.8.8.8",
    "2001:4860:4860::8888",
  ])
    assert.equal(publicAddress(ip), true, ip);
  for (const ip of [
    "192.0.0.0",
    "192.0.0.8",
    "192.0.0.11",
    "192.0.0.255",
    "192.0.2.1",
    "192.0.2.255",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "127.0.0.1",
    "169.254.1.1",
    "100.64.0.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "2001:db8::1",
    "invalid",
  ])
    assert.equal(publicAddress(ip), false, ip);
});

test("DNS accepts github.blog's public address and distinguishes empty, filtered and failed queries", async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async (input) =>
      Response.json({
        Status: 0,
        Answer:
          new URL(String(input)).searchParams.get("type") === "A"
            ? [{ type: 1, data: "192.0.66.2" }]
            : [],
      });
    assert.deepEqual((await resolveCandidates("github.blog")).ips, [
      "192.0.66.2",
    ]);

    globalThis.fetch = async () => Response.json({ Status: 0, Answer: [] });
    await assert.rejects(
      resolveCandidates("assets-cdn.github.com"),
      /DNS 查询成功，但未返回 A\/AAAA 地址/,
    );

    globalThis.fetch = async (input) =>
      Response.json({
        Status: 0,
        Answer:
          new URL(String(input)).searchParams.get("type") === "A"
            ? [{ type: 1, data: "192.168.1.1" }]
            : [],
      });
    await assert.rejects(
      resolveCandidates("example.com"),
      /均为非公网或无效地址/,
    );

    globalThis.fetch = async () => {
      throw Error("network offline");
    };
    await assert.rejects(
      resolveCandidates("example.com"),
      /所有 DNS 查询均失败/,
    );

    globalThis.fetch = async (input) => {
      if (new URL(String(input)).hostname === "dns.google")
        throw Error("network offline");
      return Response.json({ Status: 0, Answer: [] });
    };
    await assert.rejects(
      resolveCandidates("example.com"),
      /部分 DNS 查询失败，其余查询未返回 A\/AAAA 地址/,
    );

    globalThis.fetch = async () => Response.json({ Status: 3 });
    await assert.rejects(
      resolveCandidates("example.com"),
      /所有 DNS 查询均失败（DNS 状态 3）/,
    );
  } finally {
    globalThis.fetch = saved;
  }
});
