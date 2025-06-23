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

如果需要设置 API Key：

```bash
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

### 自定义管理后台地址

为了安全考虑，建议您自定义管理后台的访问地址：

#### 步骤 1：修改源代码

1. **找到路由配置文件**
   打开 `src/index.ts` 文件

2. **查找管理后台路由**
   搜索以下代码行：
   ```typescript
   // 管理后台路由
   app.route("/admin-x7k9m3q2", admin.use("*", adminAuth))
   ```

3. **修改路径**
   将 `/admin-x7k9m3q2` 替换为您的自定义路径：
   ```typescript
   // 管理后台路由 - 修改为您的自定义路径
   app.route("/your-secret-admin-path", admin.use("*", adminAuth))
   ```

4. **查找域名查询路由排除**
   在同一文件中，找到这行代码：
   ```typescript
   if (path !== "/" && !path.startsWith("/api/") && !path.startsWith("/hosts") && path !== "/favicon.ico" && !path.startsWith("/admin-x7k9m3q2")) {
   ```
   
   将其中的 `/admin-x7k9m3q2` 也修改为您的自定义路径：
   ```typescript
   if (path !== "/" && !path.startsWith("/api/") && !path.startsWith("/hosts") && path !== "/favicon.ico" && !path.startsWith("/your-secret-admin-path")) {
   ```

#### 步骤 2：重新部署

修改完成后，重新部署应用：

```bash
npm run deploy
```

#### 步骤 3：访问新地址

部署成功后，使用新地址访问管理后台：
```
https://your-worker-url.workers.dev/your-secret-admin-path
```

#### 安全建议

1. **使用复杂路径**
   ```
   ❌ 不好的例子：/admin, /manage, /backend
   ✅ 好的例子：/admin-x7k9m3q2, /mgmt-abc123xyz, /secure-panel-456
   ```

2. **路径要求**
   - 必须以 `/` 开头
   - 建议包含随机字符
   - 避免常见词汇
   - 长度适中（10-20个字符）

3. **定期更换**
   - 建议每3-6个月更换一次
   - 重要变更后立即更换
   - 记录在安全的地方

#### 示例完整修改

假设您要将后台地址改为 `/secure-mgmt-789xyz`：

**修改前：**
```typescript
// 管理后台路由
app.route("/admin-x7k9m3q2", admin.use("*", adminAuth))

// ...其他代码...

if (path !== "/" && !path.startsWith("/api/") && !path.startsWith("/hosts") && path !== "/favicon.ico" && !path.startsWith("/admin-x7k9m3q2")) {
```

**修改后：**
```typescript
// 管理后台路由
app.route("/secure-mgmt-789xyz", admin.use("*", adminAuth))

// ...其他代码...

if (path !== "/" && !path.startsWith("/api/") && !path.startsWith("/hosts") && path !== "/favicon.ico" && !path.startsWith("/secure-mgmt-789xyz")) {
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

## 重新部署指南

### 何时需要重新部署

在以下情况下，您需要重新部署 Worker：

1. **配置修改** - 修改代码中的管理后台路径后需要重新部署
2. **环境变量更改** - 添加或修改 secrets 后
3. **代码更新** - 获取最新功能和修复
4. **配置文件修改** - `wrangler.toml` 更改后

### 重新部署步骤

#### 方法 1：命令行部署

```bash
# 进入项目目录
cd your-project-directory

# 重新部署
npm run deploy
# 或
npx wrangler deploy
```

#### 方法 2：Cloudflare Dashboard

1. **登录 Cloudflare Dashboard**
   ```
   https://dash.cloudflare.com
   ```

2. **导航到 Workers**
   - 点击左侧菜单 "Workers & Pages"
   - 找到您的 Worker 服务

3. **重新部署**
   - 点击 Worker 名称
   - 点击 "Quick edit"
   - 点击 "Save and Deploy"

#### 方法 3：从 Git 仓库

如果您的代码已推送到 Git：

```bash
# 克隆或拉取最新代码
git clone https://github.com/your-username/your-repo.git
# 或
git pull origin main

# 安装依赖（如果需要）
npm install

# 部署
npm run deploy
```

### 自定义管理后台地址流程

如需自定义管理后台地址，请按照上述"自定义管理后台地址"章节的详细步骤操作：

1. **修改源代码**
   - 在 `src/index.ts` 中修改路由配置
   - 更新两处代码：路由定义和路径排除
   - 确保路径复杂且安全

2. **重新部署**
   ```bash
   npm run deploy
   ```

3. **访问新地址**
   - 使用新地址访问管理后台
   - 验证功能正常

4. **更新书签/文档**
   - 更新浏览器书签
   - 安全保存新地址

### 验证部署

部署完成后，进行以下验证：

```bash
# 检查 Worker 状态
npx wrangler tail

# 测试基本功能
curl https://your-worker-url.workers.dev/hosts

# 测试管理后台
curl https://your-worker-url.workers.dev/your-admin-path
```

### 故障排除

#### 部署失败

```bash
# 检查配置
npx wrangler whoami
npx wrangler kv:namespace list

# 查看详细错误
npx wrangler deploy --compatibility-date=2024-10-28 --verbose
```

#### 管理后台无法访问

1. **确认地址正确**
   - 检查是否使用了新地址
   - 确认地址格式（以 `/` 开头）

2. **检查部署状态**
   - 确认重新部署已完成
   - 查看 Worker 日志

3. **清除缓存**
   - 清除浏览器缓存
   - 尝试隐私模式访问

#### 功能异常

```bash
# 查看实时日志
npx wrangler tail --format=pretty

# 检查 KV 数据
npx wrangler kv:key list --binding=custom_hosts
```

### 自动化部署

考虑设置自动化部署：

#### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

#### 本地脚本

```bash
#!/bin/bash
# deploy.sh
echo "开始重新部署..."
npm run deploy
if [ $? -eq 0 ]; then
    echo "✅ 部署成功"
    echo "🔗 访问: https://your-worker-url.workers.dev"
else
    echo "❌ 部署失败"
    exit 1
fi
```

### 最佳实践

1. **部署前备份**
   - 记录当前配置
   - 导出重要数据

2. **分步部署**
   - 先在预览环境测试
   - 确认无误后部署到生产

3. **监控部署**
   - 观察部署日志
   - 及时验证功能

4. **文档更新**
   - 更新相关文档
   - 通知用户地址变更
