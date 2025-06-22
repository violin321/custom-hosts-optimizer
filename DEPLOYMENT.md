# Cloudflare Workers 部署指南

这是一个详细的部署指南，帮助你将 GitHub Hosts 项目部署到 Cloudflare Workers。

## 前置要求

1. Cloudflare 账户
2. 已安装 Node.js 和 pnpm
3. 已克隆本项目代码

## 步骤 1：准备环境

### 1.1 安装依赖
```bash
pnpm install
```

### 1.2 登录 Cloudflare
```bash
pnpm exec wrangler auth login
```
这会打开浏览器，登录你的 Cloudflare 账户并授权 wrangler。

## 步骤 2：配置 KV 命名空间

### 2.1 创建 KV 命名空间
```bash
# 创建生产环境的 KV 命名空间
pnpm exec wrangler kv:namespace create "github_hosts"

# 创建预览环境的 KV 命名空间（可选）
pnpm exec wrangler kv:namespace create "github_hosts" --preview
```

### 2.2 更新 wrangler.toml
运行上述命令后，会得到类似这样的输出：
```
🌀 Creating namespace with title "github-hosts-github_hosts"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "github_hosts", id = "your-namespace-id" }
```

将生成的 ID 更新到 `wrangler.toml` 文件中：

```toml
[[kv_namespaces]]
binding = "github_hosts"
id = "your-actual-namespace-id"  # 替换为实际的 ID
```

## 步骤 3：配置环境变量

### 3.1 设置 API Key
```bash
# 设置 API Key 用于管理接口
pnpm exec wrangler secret put API_KEY
```
输入一个安全的密钥，用于访问管理 API。

### 3.2 可选：启用优选功能（定时任务）
```bash
# 如果希望定时任务默认启用优选功能
pnpm exec wrangler secret put ENABLE_OPTIMIZATION
# 输入 "true" 或 "false"
```

### 3.3 或者在 wrangler.toml 中配置（不推荐生产环境）
```toml
[vars]
API_KEY = "your-api-key"
ENABLE_OPTIMIZATION = "false"
```

## 步骤 4：部署应用

### 4.1 首次部署
```bash
pnpm run deploy
```

### 4.2 验证部署
部署成功后，会显示你的 Worker URL，类似：
```
https://github-hosts.your-subdomain.workers.dev
```

## 步骤 5：配置自定义域名（可选）

### 5.1 添加自定义域名
在 Cloudflare 控制台中：
1. 进入 Workers & Pages
2. 选择你的 Worker
3. 点击 "Custom domains"
4. 添加你的域名

### 5.2 或使用命令行
```bash
pnpm exec wrangler deploy --custom-domain your-domain.com
```

## 步骤 6：测试功能

### 6.1 基本功能测试
```bash
# 获取 hosts 文件
curl https://your-worker-url.workers.dev/hosts

# 获取 JSON 格式数据
curl https://your-worker-url.workers.dev/hosts.json

# 测试优选功能
curl "https://your-worker-url.workers.dev/hosts?optimize=true"
```

### 6.2 管理 API 测试
```bash
# 添加自定义域名
curl -X POST "https://your-worker-url.workers.dev/api/custom-domains?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "description": "测试域名"}'

# 查看自定义域名
curl "https://your-worker-url.workers.dev/api/custom-domains?key=YOUR_API_KEY"

# 优选域名
curl -X POST "https://your-worker-url.workers.dev/api/optimize/example.com?key=YOUR_API_KEY"
```

## 步骤 7：监控和维护

### 7.1 查看日志
```bash
pnpm exec wrangler tail
```

### 7.2 查看分析数据
在 Cloudflare 控制台的 Workers & Pages 部分可以查看请求统计。

### 7.3 更新部署
```bash
# 代码更新后重新部署
pnpm run deploy
```

## 常见问题

### Q1: KV 命名空间绑定失败
确保 `wrangler.toml` 中的 KV 命名空间 ID 正确，并且该命名空间存在于你的 Cloudflare 账户中。

### Q2: API Key 访问被拒绝
检查是否正确设置了 API_KEY secret：
```bash
pnpm exec wrangler secret list
```

### Q3: 定时任务不工作
确保 `wrangler.toml` 中配置了 cron 触发器：
```toml
[triggers]
crons = ["0 */1 * * *"]  # 每小时执行一次
```

### Q4: 优选功能太慢
IP 优选需要测试多个 IP 的响应时间，可能需要几十秒。可以：
- 使用缓存结果：`?optimize=false`
- 减少测试频率
- 手动触发优选

### Q5: 自定义域名不工作
确保：
1. 域名已在 Cloudflare 托管
2. 正确添加了 Custom Domain
3. DNS 记录正确指向 Workers

## 安全建议

1. **API Key 安全**
   - 使用强密码作为 API Key
   - 定期更换 API Key
   - 不要在代码中硬编码 API Key

2. **访问控制**
   - 考虑添加 IP 白名单
   - 实现请求频率限制
   - 监控异常访问

3. **数据保护**
   - 定期备份 KV 数据
   - 监控存储使用量
   - 实现数据清理策略

## 进阶配置

### 多环境部署
```toml
[env.staging]
name = "github-hosts-staging"
vars = { ENABLE_OPTIMIZATION = "true" }

[env.production]
name = "github-hosts-production"
vars = { ENABLE_OPTIMIZATION = "false" }
```

### 自定义 Cron 调度
```toml
[triggers]
crons = [
  "0 */2 * * *",    # 每2小时执行一次
  "0 0 * * *"       # 每天午夜执行一次
]
```

### 请求限制
考虑添加 Cloudflare Rate Limiting 规则来保护你的 Worker。

## 成本估算

- **Workers 免费套餐**: 100,000 requests/day
- **KV 免费套餐**: 100,000 reads/day, 1,000 writes/day, 1GB storage
- **超出限制**: 按量付费

对于大多数个人使用场景，免费套餐已经足够。

## 支持

如果遇到问题：
1. 查看 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
2. 检查本项目的 GitHub Issues
3. 查看 Cloudflare 控制台的错误日志
