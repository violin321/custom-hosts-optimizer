# 手动部署说明

由于在 Codespace 环境中无法直接打开浏览器进行 OAuth 登录，你需要手动配置 Cloudflare API Token。

## 方法 1：使用 API Token（推荐）

### 1. 获取 Cloudflare API Token
1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 点击 "Create Token"
3. 选择 "Custom token" 模板
4. 配置权限：
   - Account: Cloudflare Workers:Edit
   - Zone: Zone:Read
   - Zone: Zone Settings:Read
5. 账户资源：包含你的账户
6. 区域资源：包含你的域名（如果有）
7. 点击 "Continue to summary" 然后 "Create Token"

### 2. 设置环境变量
```bash
export CLOUDFLARE_API_TOKEN="your-api-token-here"
```

### 3. 创建 KV 命名空间
```bash
pnpm exec wrangler kv:namespace create "github_hosts"
```

### 4. 更新 wrangler.toml
将返回的 KV 命名空间 ID 更新到 wrangler.toml 文件中。

### 5. 设置 Secrets
```bash
pnpm exec wrangler secret put API_KEY
pnpm exec wrangler secret put ENABLE_OPTIMIZATION
```

### 6. 部署
```bash
pnpm run deploy
```

## 方法 2：本地部署

如果在 Codespace 中遇到问题，可以：

1. 将代码下载到本地
2. 在本地环境运行 `pnpm exec wrangler auth login`
3. 完成部署后，将配置同步回来

## 方法 3：GitHub Actions 自动部署

我可以为你创建一个 GitHub Actions 工作流来自动部署。
