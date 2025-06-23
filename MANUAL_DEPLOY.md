# 手动部署指南

本指南将帮助您手动部署自定义 hosts 服务到 Cloudflare Workers。

## 前置要求

1. **Cloudflare 账户** - 免费账户即可
2. **Node.js** - 版本 20 或更高
3. **Git** - 用于克隆仓库

## 部署步骤

### 1. 克隆仓库

```bash
git clone https://github.com/Yan-nian/custom-host.git
cd custom-host
```

### 2. 安装依赖

```bash
# 使用 npm
npm install

# 或使用 pnpm（推荐）
pnpm install
```

### 3. 配置 Cloudflare

#### 3.1 获取 Cloudflare API Token

1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 点击 "Create Token"
3. 选择 "Custom token" 模板
4. 配置权限：
   - Account: Cloudflare Workers:Edit
   - Zone: Zone:Read, Zone Settings:Read
5. 账户资源：包含你的账户
6. 区域资源：包含你的域名（如果有）
7. 点击 "Continue to summary" 然后 "Create Token"

#### 3.2 登录 Cloudflare

```bash
# 方法1：使用 API Token
export CLOUDFLARE_API_TOKEN="your-api-token-here"

# 方法2：交互式登录
npx wrangler login
```

#### 3.3 创建 KV 命名空间

```bash
# 创建生产环境 KV 命名空间
npx wrangler kv:namespace create "custom_hosts"

# 创建预览环境 KV 命名空间
npx wrangler kv:namespace create "custom_hosts" --preview
```

命令执行后会输出类似以下内容：
```
🌀 Creating namespace with title "custom-hosts-optimizer-custom_hosts"
✨ Success! Add the following to your configuration file in your kv_namespaces array:
{ binding = "custom_hosts", id = "abcdef1234567890", preview_id = "fedcba0987654321" }
```

#### 3.4 更新配置文件

将上一步获得的 KV 命名空间 ID 填入 `wrangler.toml` 文件：

```toml
[[kv_namespaces]]
binding = "custom_hosts"
id = "你的KV命名空间ID"  # 替换为实际的 ID
preview_id = "你的预览KV命名空间ID"  # 替换为实际的预览 ID
```

### 4. 设置环境变量（可选）

如果需要设置管理后台密码：

```bash
# 设置管理后台密码
npx wrangler secret put ADMIN_PASSWORD
# 输入你想要的密码

# 如果需要设置 API Key
npx wrangler secret put API_KEY
# 输入你的 API Key
```

### 5. 部署应用

```bash
# 开发环境测试
npm run dev

# 部署到生产环境
npm run deploy
```

### 6. 验证部署

部署成功后，你会看到类似输出：
```
✨ Successfully published your application to https://custom-hosts-optimizer.your-subdomain.workers.dev/
```

访问这个 URL 即可使用你的自定义 hosts 服务。

## 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 | 是否必需 |
|--------|------|--------|----------|
| `ADMIN_USERNAME` | 管理后台用户名 | `admin` | 否 |
| `ADMIN_PASSWORD` | 管理后台密码 | 无 | 推荐设置 |
| `API_KEY` | API 访问密钥 | 无 | 否 |

### KV 命名空间

应用使用 Cloudflare KV 存储以下数据：
- `domain_data` - 域名解析数据
- `custom_domains` - 自定义域名列表

## 自定义配置

### 修改域名列表

编辑 `src/constants.ts` 文件中的 `GITHUB_URLS` 数组：

```typescript
export const GITHUB_URLS = [
  "github.com",
  "api.github.com",
  // 添加你需要的域名
  "your-custom-domain.com"
]
```

### 修改 DNS 提供商

编辑 `src/constants.ts` 文件中的 `DNS_PROVIDERS` 数组：

```typescript
export const DNS_PROVIDERS = [
  {
    name: "Cloudflare",
    url: (domain: string) => `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`,
    headers: { "Accept": "application/dns-json" }
  },
  // 添加其他 DNS 提供商
]
```

## 故障排除

### 常见问题

1. **KV 命名空间错误**
   - 确保 `wrangler.toml` 中的 KV ID 正确
   - 检查是否有权限访问 KV 命名空间

2. **部署失败**
   - 检查网络连接
   - 确保已正确登录 Cloudflare
   - 检查 `wrangler.toml` 配置

3. **访问被拒绝**
   - 检查 Cloudflare Workers 计划限制
   - 确保域名解析正确

### 日志查看

```bash
# 查看 Worker 日志
npx wrangler tail

# 查看特定部署的日志
npx wrangler tail --format=pretty
```

## 更新应用

```bash
# 拉取最新代码
git pull origin main

# 重新部署
npm run deploy
```

## 卸载

如需卸载应用：

```bash
# 删除 Worker
npx wrangler delete

# 删除 KV 命名空间
npx wrangler kv:namespace delete --binding=custom_hosts
```

## 技术支持

如遇到问题，请：
1. 查看 [Issues](https://github.com/Yan-nian/custom-host/issues)
2. 创建新的 Issue 描述问题
3. 提供错误日志和配置信息
