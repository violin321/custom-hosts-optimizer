import { spawnSync } from "node:child_process";
const required = [
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
    "SESSION_SECRET",
    "API_TOKEN",
  ],
  optional = ["PROBE_TOKEN"];
if (required.some((key) => !process.env[key]))
  throw Error("Required application secrets are missing");
const payload = Object.fromEntries(
  [...required, ...optional]
    .filter((key) => process.env[key])
    .map((key) => [key, process.env[key]]),
);
const result = spawnSync("pnpm", ["exec", "wrangler", "secret", "bulk"], {
  input: JSON.stringify(payload),
  encoding: "utf8",
});
if (result.status !== 0)
  throw Error(
    "Application secret synchronization failed; credentials were not printed",
  );
console.log("Application secrets synchronized");
