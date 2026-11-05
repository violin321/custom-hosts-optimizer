# Custom Hosts Optimizer 2

在 Cloudflare Workers 上管理域名到 IP 的映射，并发布 hosts、JSON、Clash YAML。DNS 查询得到候选 IP；家庭旁路由的真实 HTTPS 探测决定本地测速模式的选用结果。解析耗时与访问延迟分别记录。

## 使用

- `/`：公开下载页，只读取已发布快照。
- `/hosts`、`/hosts.json`、`/clash-hosts.yaml`：同一快照的三种导出，支持 ETag/304；`?custom=false` 仅导出内置域名。
- `/admin/login`：独立管理员账号密码登录，管理入口 `/admin`。
- `/health`：有效记录非空且最近成功检查在 24 小时内才返回 200。

管理员账号来自 `ADMIN_USERNAME` / `ADMIN_PASSWORD`，与 Cloudflare 账号独立。会话有效 24 小时，HMAC 签名，Cookie 使用 HttpOnly、Secure、SameSite=Strict；账号密码变化后旧会话失效。同一来源 15 分钟最多 10 次登录尝试；会话写操作检查来源。管理 API 可使用 `Authorization: Bearer <API_TOKEN>`；不要把令牌放在 URL 或前端代码。

## 更新与失败保护

每小时定时刷新内置域名和启用的自动自定义域名。后台发起刷新后立即返回 202，任务分批运行，可查看真实进度与逐项失败原因。

- **手动固定** `manual`：刷新不覆盖 IP、开关或创建时间，可用于明确需要私网地址的映射。
- **自动解析** `dns`：Cloudflare/Google DoH 收集经过严格校验的公共 IPv4/IPv6 地址。保留仍在候选中的现有地址，否则优先 IPv4。
- **本地测速** `probe`：保留现有 IP，等待家庭旁路由验证候选。新建且没有旧值时先采用 DNS 候选，并明确标记未测速。

所有写入由单个 SQLite Durable Object 串行协调，KV 仅发布下载快照。DNS 失败保留旧值，全部失败不推进成功时间；发布失败在后台显示并安排重试。每次配置变更或完成刷新前保存备份，保留最近 10 份。后台可导出完整状态、导入自定义域名、恢复最近配置。旧版 KV 的 `domain_data`、`custom_domains` 首次迁移时只读，保留原数据用于回退；v2 后续修改以 Durable Object 为准。

## 本地开发与部署

Node.js 24+、pnpm 11.25.0：

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm dev
```

本地 `.dev.vars` 设置测试用 `ADMIN_USERNAME`、`ADMIN_PASSWORD`、`SESSION_SECRET`、`API_TOKEN`、`PROBE_TOKEN`；不要提交此文件。生产通过 GitHub production 环境 Secrets 注入，工作流保留原有凭据。

部署必需 Secrets：`KV_NAMESPACE_ID`、`CLOUDFLARE_ACCOUNT_ID`、四个管理员/应用 Secrets。Cloudflare 身份优先使用限权 `CLOUDFLARE_API_TOKEN`；兼容原 `CLOUDFLARE_API_KEY` + `CLOUDFLARE_EMAIL`。配置支持 Token 不代表现有 Global API Key 已自动迁移。生产主机名在 `wrangler.toml` routes 中明确配置；其他部署者应替换域名。首次部署创建 SQLite Durable Object，使用现有 KV。

GitHub Actions 会先运行类型检查、回归测试、构建，再部署和同步 Secrets，随后启动刷新并检查关键域名、三种格式一致性、未认证管理请求、ETag 和数据年龄。每 6 小时独立执行可用性检查；失败显示为失败的 Actions 运行，通知取决于仓库个人通知设置。

## 旁路由真实测速

`router/probe.lua` 依赖 Lua、luci.jsonc、curl、start-stop-daemon、nft；`router/run-probe.sh` 使用 flock 防止重叠。安装到 `/usr/libexec/custom-hosts-probe.lua` 与 `/usr/bin/custom-hosts-probe`。专用 `PROBE_TOKEN` 仅允许下载候选清单和提交测速，不允许修改域名配置；其值保存在 root 只读的 `/etc/custom-hosts-probe.curl`：

```text
header = "Authorization: Bearer <PROBE_TOKEN>"
```

部署前必须核对 OpenClash nft 输出链存在 `meta skgid 65534 ... return`。脚本用 root:nogroup 执行探测 curl，命中该直连豁免，HTTPS 使用真实域名/SNI、证书校验与 `--resolve` 固定候选 IP；不禁用证书验证。仅 IPv4 参与当前家庭测速，每域名最多 3 个候选、每候选 3 次成功响应（2xx/3xx 或 401/403/404/405）、按中位耗时选择。IPv6 可作为 DNS 候选，暂不宣称已做家庭 IPv6 测速。探测失败保留旧 IP，豁免缺失时拒绝上报。家中其他上游网关的转发行为不由此脚本证明。

服务端仅接受近 10 分钟测量、近 2 小时解析候选和 3–5 个有效样本；自定义手动项覆盖同名内置域名时也不会被探测覆盖。建议在每小时解析后第 5 分钟运行，第 12 分钟下载 hosts。状态文件 `/tmp/custom-hosts-probe-status.json`；日志标签 `custom-hosts-probe`。

## 恢复

先导出完整备份再做大改。后台“恢复最近配置”会先备份当前状态；JSON 导入只替换自定义域名，不覆盖管理员凭据。代码回滚需要核对存储模式：旧版读取原 KV，不包含 v2 后新增配置，应先导出并准备数据转换，不能把代码回滚当作完整数据回滚。
