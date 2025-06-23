<div align="center">
  <img src="public/logo.svg" width="140" height="140" alt="优选自定义host logo">
  <h1>优选自定义host</h1>
  <p>自定义域名访问加速，智能 IP 优选解决访问慢的问题。基于 Cloudflare Workers 部署。</p>
  
  <p>
    <a href="#快速开始">快速开始</a> •
    <a href="#特性">特性</a> •
    <a href="#使用方法">使用方法</a> •
    <a href="#自定义域名">自定义域名</a> •
    <a href="#部署指南">部署指南</a>
  </p>
</div>

## 特性

- 🚀 基于 Cloudflare Workers 部署，全球 CDN 加速
- 🌍 多 DNS 服务支持（Cloudflare DNS、Google DNS）
- ⚡️ 智能 IP 优选，自动检测最佳响应时间
- 🔄 每小时自动更新，保持最新状态
- 💾 使用 Cloudflare KV 存储数据
- 🎯 支持自定义域名管理
- 📡 提供完整 REST API 接口
- 🔐 简化的权限控制系统
- 🔄 GitHub Actions 自动化部署

## 快速开始

### 🚀 一键部署（推荐）

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Yan-nian/custom-hosts-optimizer)

1. 点击上方按钮
2. 授权 GitHub 访问
3. 选择 Cloudflare 账户
4. 等待自动部署完成

### 🔄 自动部署（GitHub Actions）

Fork 仓库后享受自动化部署：

#### 步骤 1：Fork 仓库
点击仓库右上角的 "Fork" 按钮，将仓库 Fork 到您的 GitHub 账户。

#### 步骤 2：获取 Cloudflare API Token
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击右上角头像 → "My Profile" 
3. 切换到 "API Tokens" 标签页
4. 点击 "Create Token"
5. 使用 "Edit Cloudflare Workers" 模板或自定义权限：
   - **权限**：`Account:Cloudflare Workers:Edit`, `Zone:Zone Settings:Read`, `Zone:Zone:Read`
   - **账户资源**：包含您的账户
   - **区域资源**：包含所有区域（或特定区域）
6. 点击 "Continue to summary" 然后 "Create Token"
7. **复制生成的 Token**（只显示一次）

#### 步骤 3：创建 KV 命名空间
1. 在 Cloudflare Dashboard 进入 "Workers & Pages"
2. 点击右侧的 "KV" 
3. 点击 "Create a namespace"
4. 命名空间名称：`custom-hosts` 或其他名称
5. 点击 "Add"
6. **复制命名空间 ID**（在列表中点击命名空间查看）

#### 步骤 4：配置 GitHub Secrets（重要）
1. 进入您 Fork 的仓库
2. 点击 "Settings" → "Secrets and variables" → "Actions"
3. 点击 "New repository secret"
4. **必须添加以下两个 Secrets**：
   
   **第一个 Secret：**
   - **Name**: `CLOUDFLARE_API_TOKEN`
   - **Value**: 步骤 2 中复制的 API Token
   
   **第二个 Secret：**
   - **Name**: `KV_NAMESPACE_ID`
   - **Value**: 步骤 3 中复制的命名空间 ID

⚠️ **注意**：两个 Secrets 都必须设置，否则自动部署会失败！
6. **复制创建的命名空间 ID**

#### 步骤 5：配置 KV Namespace（安全方式）

**⚠️ 安全提醒**：不要在公开仓库中直接暴露 KV Namespace ID

**方法一：使用环境变量（推荐）**
1. 在 GitHub Secrets 中添加：
   - `KV_NAMESPACE_ID` = 您的 KV 命名空间 ID
   - `KV_PREVIEW_ID` = 您的预览环境 KV ID（可选，通常与生产相同）

2. 修改 `wrangler.toml`：
   ```toml
   [[kv_namespaces]]
   binding = "custom_hosts"
   id = "YOUR_KV_NAMESPACE_ID"  # 保持不变，由 wrangler 自动替换
   preview_id = "YOUR_KV_NAMESPACE_ID"  # 保持不变
   ```

**方法二：本地配置文件（Fork 后私有部署）**
1. 创建 `.dev.vars` 文件（已在 .gitignore 中）：
   ```
   KV_NAMESPACE_ID=your-actual-kv-id
   ```
2. 在 `wrangler.toml` 中使用环境变量：
   ```toml
   [[kv_namespaces]]
   binding = "custom_hosts"
   id = "${KV_NAMESPACE_ID}"
   preview_id = "${KV_NAMESPACE_ID}"
   ```

**方法三：直接替换（仅私有仓库）**
如果您的 Fork 是私有仓库，可以直接替换：
```toml
[[kv_namespaces]]
binding = "custom_hosts"
id = "your-actual-kv-namespace-id"
preview_id = "your-actual-kv-namespace-id"
```

#### 步骤 6：验证配置
在触发部署前，请确认：
- ✅ GitHub Secrets 中已设置 `CLOUDFLARE_API_TOKEN`
- ✅ GitHub Secrets 中已设置 `KV_NAMESPACE_ID`
- ✅ 您选择了合适的 KV 配置方法（推荐方法一）

#### 步骤 7：触发部署
推送任何更改到 main 分支即可自动部署：
```bash
git commit --allow-empty -m "触发自动部署"
git push origin main
```

🎯 **部署成功后**，访问 `https://your-worker-name.your-account.workers.dev` 查看您的服务！

### 手动部署

如果需要自定义配置：

1. **克隆仓库**
```bash
git clone https://github.com/Yan-nian/custom-hosts-optimizer.git
cd custom-hosts-optimizer
```

2. **安装依赖并部署**
```bash
pnpm install
npx wrangler login
pnpm run deploy
```

## 使用方法

### 🌐 Web 界面

访问部署的 Worker URL：
- **查看/下载 hosts 文件**
- **自定义域名管理**
- **API 文档和使用说明**

### 📋 SwitchHosts 工具

1. 下载 [SwitchHosts](https://github.com/oldj/SwitchHosts)
2. 添加规则：
   - 方案名：GitHub Hosts
   - 类型：远程
   - URL：`https://your-worker-url.workers.dev/hosts`
   - 自动更新：1 小时

## 自定义域名

### 🛠️ 管理后台

访问管理后台进行可视化管理：
```
https://your-worker-url.workers.dev/admin-x7k9m3q2
```

功能特性：
- 📊 统计仪表板
- ➕ 添加/管理域名
-  一键域名优选
- 🗑️ 删除和清空操作

### 🚀 API 接口

**API Key**：使用管理后台地址作为 API Key（默认：`admin-x7k9m3q2`）

```bash
# 添加域名
curl -X POST "https://your-worker-url.workers.dev/api/custom-domains?key=admin-x7k9m3q2" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com"}'

# 优选域名 IP
curl -X POST "https://your-worker-url.workers.dev/api/optimize/example.com?key=admin-x7k9m3q2"

# 获取优选后的 hosts
curl "https://your-worker-url.workers.dev/hosts?optimize=true&custom=true"
```

## 💡 使用场景

### 企业内网优化
为企业内部服务域名选择最优 IP：
```bash
curl -X POST "https://your-worker.workers.dev/api/custom-domains?key=admin-x7k9m3q2" \
  -d '{"domain": "internal.company.com", "description": "内部服务"}'
```

### CDN 节点优选
为 CDN 域名选择最快的边缘节点：
```bash
curl -X POST "https://your-worker.workers.dev/api/optimize/cdn.example.com?key=admin-x7k9m3q2"
```

### 游戏加速
## 部署指南

### 自定义管理后台地址（推荐）

默认管理后台地址：`/admin-x7k9m3q2`，建议修改为自定义路径提高安全性。

1. **Fork 仓库并修改代码**
   - 编辑 `src/index.ts`，搜索 `admin-x7k9m3q2` 并替换为你的自定义路径
   - 同时修改 `adminPathAsApiKey` 变量

2. **部署到 Cloudflare**
   ```bash
   git clone https://github.com/your-username/custom-hosts-optimizer.git
   cd custom-hosts-optimizer
   pnpm install
   npx wrangler login
   pnpm run deploy
   ```

### 配置 KV 存储

1. 在 Cloudflare Dashboard 创建 KV 命名空间
2. 修改 `wrangler.toml` 中的 KV ID
3. 重新部署

## 📊 技术特性

- **IP 优选算法**：并发测试多个 IP，自动选择最快的
- **智能缓存**：GitHub 域名缓存 1 小时，自定义域名长期缓存
- **定时任务**：每小时自动更新 DNS 记录
- **权限控制**：管理后台地址即 API Key，简化配置

## 🔧 故障排除

### 常见部署问题

#### 1. GitHub Actions 失败："Unable to authenticate request"
**原因**：未配置 `CLOUDFLARE_API_TOKEN` Secret  
**解决**：按照步骤 2-4 配置 Cloudflare API Token

#### 2. GitHub Actions 失败："KV namespace 'YOUR_KV_NAMESPACE_ID' is not valid"
**原因**：未配置 `KV_NAMESPACE_ID` Secret  
**解决**：按照步骤 3-4 创建 KV 命名空间并配置 Secret

#### 3. 部署成功但访问报错："KV namespace not found"
**原因**：KV 命名空间 ID 配置错误  
**解决**：检查 Secret 中的 KV ID 是否与实际创建的命名空间 ID 一致

#### 4. API 调用返回 403 错误
**原因**：API Key 不正确  
**解决**：使用管理后台地址（去掉开头的 `/`）作为 API Key，默认是 `admin-x7k9m3q2`

#### 5. 自定义域名无法添加
**原因**：域名格式错误或网络问题  
**解决**：确保域名格式正确（如 `example.com`），检查网络连接

#### 6. 本地开发时 KV 错误
**原因**：本地环境未配置 KV  
**解决**：创建 `.dev.vars` 文件并设置 `KV_NAMESPACE_ID=your-id`

### 获取帮助

- 📖 查看 [Issues](https://github.com/Yan-nian/custom-hosts-optimizer/issues) 获取解决方案
- 🐛 报告 Bug 或请求功能
- 💬 参与讨论和交流

## 部署指南

### 自定义管理后台地址（推荐）

默认管理后台地址：`/admin-x7k9m3q2`，建议修改为自定义路径提高安全性。

1. **Fork 仓库并修改代码**
   - 编辑 `src/index.ts`，搜索 `admin-x7k9m3q2` 并替换为你的自定义路径
   - 同时修改 `adminPathAsApiKey` 变量

2. **部署到 Cloudflare**
   ```bash
   git clone https://github.com/your-username/custom-hosts-optimizer.git
   cd custom-hosts-optimizer
   pnpm install
   npx wrangler login
   pnpm run deploy
   ```

### 配置 KV 存储

1. 在 Cloudflare Dashboard 创建 KV 命名空间
2. 修改 `wrangler.toml` 中的 KV ID
3. 重新部署

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests！

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

#### 避免常见错误

1. **忘记修改第三处代码**
   - 必须同时修改路由定义、路径排除和 API Key
   - 否则会导致 API 验证失败

2. **路径格式错误**
   ```typescript
   ❌ 错误：app.route("admin-new", ...)      // 缺少开头的 /
   ❌ 错误：app.route("/admin new", ...)     // 包含空格
   ✅ 正确：app.route("/admin-new", ...)     // 正确格式
   ```

3. **部署后无法访问**
   - 检查路径是否正确修改
   - 确认部署是否成功
   - 清除浏览器缓存

#### 故障恢复

如果修改后无法访问，可以：

1. **回滚代码**
   ```bash
   cp src/index.ts.backup src/index.ts
   npm run deploy
   ```

2. **检查日志**
   ```bash
   npx wrangler tail
   ```

3. **验证配置**
   ```bash
   npx wrangler dev
   ```
