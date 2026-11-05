import { readFile, writeFile } from "node:fs/promises";
const id = process.env.KV_NAMESPACE_ID;
if (!/^[a-f0-9]{32}$/.test(id || ""))
  throw Error("KV_NAMESPACE_ID must be configured");
const source = await readFile("wrangler.toml", "utf8");
await writeFile(
  "wrangler.toml",
  source.replaceAll("YOUR_KV_NAMESPACE_ID", id) +
    `\n[vars]\nCOMMIT_HASH = ${JSON.stringify(process.env.GITHUB_SHA || "local")}\n`,
);
