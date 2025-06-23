<div align="center">
  <img src="public/logo.svg" width="140" height="140" alt="优选自定义host logo">
  <h1>优选自定义host</h1>
  <p>自定义域名访问加速，智能 IP 优选解决访问慢的问题。使用 Cloudflare Workers 和公共 DNS API 来获取最优 IP 地址。</p>
  
  <p>
    <a href="#快速开始">快速开始</a> •
    <a href="#特性">特性</a> •
    <a href="#使用方法">使用方法</a> •
    <a href="#API-文档">API 文档</a> •
    <a href="#部署指南">部署指南</a>
  </p>
</div>

## 🚀 新功能

- ✨ **自定义域名管理** - 添加任意域名进行 IP 优选
- ⚡ **智能 IP 优选** - 自动测试响应时间，选择最快 IP
- 🎯 **现代化界面** - 全新的选项卡式管理界面
- 🔧 **完整 API** - RESTful API 支持所有功能
- 🛠️ **管理后台** - 安全的管理员界面
- 🔒 **权限控制** - 使用管理后台地址作为 API Key
- 🔄 **自动部署** - GitHub Actions 集成，推送代码自动部署

## 特性

- 🚀 使用 Cloudflare Workers 部署，无需服务器
- 🌍 多 DNS 服务支持（Cloudflare DNS、Google DNS）
- ⚡️ 每 60 分钟自动更新 DNS 记录
- 💾 使用 Cloudflare KV 存储数据
- 🔄 提供多种使用方式（脚本、手动、工具）
- 📡 提供 REST API 接口
- 🎯 自定义域名 IP 优选
- 🧠 智能响应时间检测
- 🔐 安全的权限控制系统
- 🔄 GitHub Actions 自动化部署

## 快速开始

### 🚀 一键部署（推荐）

使用 Cloudflare Workers 一键部署，无需本地环境：

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Yan-nian/custom-hosts-optimizer)

**部署步骤**：
1. 点击上方按钮
2. 授权 GitHub 访问
3. 选择 Cloudflare 账户
4. 等待自动部署完成

### 🔄 自动部署（GitHub Actions）

Fork 仓库后享受自动化部署体验：

1. **Fork 仓库到您的 GitHub 账户**
2. **配置 Secrets**（在仓库 Settings > Secrets and variables > Actions）：
   - `CLOUDFLARE_API_TOKEN` - Cloudflare API Token
   - `CLOUDFLARE_ACCOUNT_ID` - Cloudflare 账户 ID
3. **推送代码即可自动部署**

**自动化特性**：
- ✅ 推送到 main 分支自动部署到生产环境
- ✅ Pull Request 自动创建预览部署
- ✅ 部署状态检查和通知
- ✅ 预览 URL 自动评论到 PR

详细配置请参考：[自动部署指南](#自动部署配置)

### 手动部署

如果需要自定义配置，可以手动部署：

#### 前置要求
- Cloudflare 账户（免费账户即可）
- Node.js 20+ （仅手动部署需要）

#### 部署步骤
1. **克隆仓库**
```bash
git clone https://github.com/Yan-nian/custom-hosts-optimizer.git
cd custom-hosts-optimizer
```

2. **安装依赖并部署**
```bash
npm install
npx wrangler login
npm run deploy
```

> 详细配置说明请参考：[手动部署指南](MANUAL_DEPLOY.md)

## 使用方法

### 🌐 Web 界面

访问部署的 Worker URL，使用现代化的 Web 界面：

- **Hosts 文件** - 查看和下载 hosts 文件
- **自定义域名管理** - 添加和管理你的自定义域名
- **API 文档** - 查看完整 API 文档
- **使用帮助** - 详细使用说明

### 📋 SwitchHosts 工具

1. 下载 [SwitchHosts](https://github.com/oldj/SwitchHosts)
2. 添加规则：
   - 方案名：GitHub Hosts
   - 类型：远程
   - URL：`https://your-worker-url.workers.dev/hosts`
   - 自动更新：1 小时

### 💻 命令行工具

#### MacOS 用户
```bash
sudo curl -fsSL https://github.com/Yan-nian/custom-host/releases/download/v1.0.0/custom-hosts.darwin-arm64 -o custom-hosts && sudo chmod +x ./custom-hosts && ./custom-hosts
```

#### Windows 用户
在管理员权限的 PowerShell 中执行：
```powershell
irm https://github.com/Yan-nian/custom-host/releases/download/v1.0.0/custom-hosts.windows-amd64.exe | iex
```

#### Linux 用户
```bash
sudo curl -fsSL https://github.com/Yan-nian/custom-host/releases/download/v1.0.0/custom-hosts.linux-amd64 -o custom-hosts && sudo chmod +x ./custom-hosts && ./custom-hosts
```

## 🆕 自定义域名功能

### 🛠️ 管理后台（推荐）

访问管理后台进行可视化管理：

```
https://your-worker-url.workers.dev/admin-x7k9m3q2
```

**功能特性**：
- 📊 统计仪表板
- ➕ 可视化添加域名
- 📝 批量导入域名
- 🔄 一键域名优选
- 🗑️ 删除和清空操作

**API Key 说明**：
- � **简化的 API Key**：使用管理后台地址作为 API Key
- 🔒 **默认 API Key**：`admin-x7k9m3q2`（与管理后台地址相同）
- 🛡️ **安全性**：自定义管理后台地址即自动更换 API Key

**重要提示**：
- 管理后台地址在部署时配置，如需修改请重新部署
- 建议使用复杂且不易猜测的管理后台路径确保安全

详细配置请参考：[管理后台配置指南](ADMIN_GUIDE.md)

### 🚀 API 接口

#### 添加自定义域名

```bash
curl -X POST "https://your-worker-url.workers.dev/api/custom-domains?key=admin-x7k9m3q2" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "description": "我的网站"}'
```

#### 优选域名 IP

```bash
curl -X POST "https://your-worker-url.workers.dev/api/optimize/example.com?key=admin-x7k9m3q2"
```

#### 获取优选后的 hosts

```bash
# 包含 IP 优选和自定义域名
curl "https://your-worker-url.workers.dev/hosts?optimize=true&custom=true"
```

## 🔑 API Key 说明

### 简化设计

为了简化配置和提高安全性，本项目采用了创新的 API Key 设计：

**核心原理**：
- 🔗 **管理后台地址即 API Key**：使用管理后台的路径（不含 `/`）作为 API Key
- 🔒 **默认 API Key**：`admin-x7k9m3q2`
- 🛡️ **自动安全**：自定义管理后台地址时，API Key 自动随之变更

### 使用方法

#### 默认配置下的 API 调用
```bash
# 添加自定义域名
curl -X POST "https://your-worker.workers.dev/api/custom-domains?key=admin-x7k9m3q2" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com"}'

# 优选域名 IP
curl -X POST "https://your-worker.workers.dev/api/optimize/example.com?key=admin-x7k9m3q2"
```

#### 自定义后台地址后
如果您将管理后台地址修改为 `/secure-panel-abc123`，那么：
- 新的 API Key 变为：`secure-panel-abc123`
- 所有 API 调用需要使用新的 Key

### 安全优势

1. **无需额外配置**：部署后即可使用，无需设置复杂的 API Key
2. **自动同步**：修改管理后台地址自动更新 API Key
3. **知者可用**：只有知道管理后台地址的人才能使用 API
4. **简化管理**：减少了密钥管理的复杂性

### 兼容性说明

- 📱 **主页刷新**：主页的刷新按钮使用特殊 Key（`main-page-refresh`），仅可访问优选和缓存刷新功能
- 🔧 **管理后台**：从管理后台发起的操作会自动验证来源，无需额外认证
- 🌐 **外部调用**：需要使用当前的管理后台地址作为 API Key

## 📋 配置

### 环境变量

在部署时，你可以设置以下环境变量：

| 变量名 | 描述 | 默认值 | 必需 |
|--------|------|--------|------|
| `API_KEY` | API 访问密钥（已简化为使用管理后台地址） | `admin-x7k9m3q2` | 否 |

### 自定义域名列表

编辑 `src/constants.ts` 文件来自定义需要优选的域名：

```typescript
export const GITHUB_URLS = [
  "github.com",
  "api.github.com",
  "raw.githubusercontent.com",
  // 添加你的域名
  "your-domain.com"
]
```

### DNS 提供商

支持多个 DNS 提供商，默认包括：
- Cloudflare DNS
- Google DNS

可在 `src/constants.ts` 中自定义更多提供商。

## 🔧 API 文档

### 基础接口

| 接口 | 方法 | 参数 | 描述 |
|------|------|------|------|
| `/hosts` | GET | `optimize`, `custom` | 获取 hosts 文件内容 |
| `/hosts.json` | GET | `optimize`, `custom` | 获取 JSON 格式数据 |
| `/{domain}` | GET | - | 获取指定域名的实时解析结果 |

### 管理接口（需要 API Key）

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/custom-domains` | GET | 获取自定义域名列表 |
| `/api/custom-domains` | POST | 添加自定义域名 |
| `/api/custom-domains/{domain}` | DELETE | 删除自定义域名 |
| `/api/optimize/{domain}` | POST | 优选指定域名的 IP |
| `/reset` | POST | 清空缓存并重新获取数据 |

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
为游戏服务器选择低延迟 IP：
```bash
curl -X POST "https://your-worker.workers.dev/api/custom-domains?key=admin-x7k9m3q2" \
  -d '{"domain": "game-server.com", "description": "游戏服务器"}'
```

## 🎯 高级功能

### IP 优选算法
- 从多个 DNS 提供商获取所有可用 IP
- 并发测试每个 IP 的响应时间
- 自动选择响应最快的 IP 地址
- 智能缓存避免重复测试

### 智能缓存
- GitHub 域名数据缓存 1 小时
- 自定义域名优选结果长期缓存
- 支持手动刷新和重置

### 定时任务
- 每小时自动更新 DNS 记录
- 可选择是否启用 IP 优选
- 通过环境变量控制行为

## ⚙️ 配置选项

### 环境变量

- `API_KEY` - 现在自动使用管理后台地址（简化配置）
- `ENABLE_OPTIMIZATION` - 定时任务是否启用优选（可选）

### wrangler.toml 配置

```toml
[triggers]
crons = ["0 */1 * * *"]  # 每小时执行

[[kv_namespaces]]
binding = "github_hosts"
id = "your-kv-namespace-id"
```

## 📊 性能与限制

### Cloudflare 免费限制
- Workers: 100,000 requests/day
- KV: 100,000 reads/day, 1,000 writes/day
- 适合个人和小团队使用

### 性能优化建议
- IP 优选会增加响应时间，建议非实时场景使用
- 合理设置定时任务频率
- 利用缓存机制减少重复计算

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests！

1. Fork 本项目
2. 创建功能分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -am 'Add new feature'`
4. 推送分支：`git push origin feature/new-feature`
5. 提交 Pull Request

## ⭐ Star History

如果这个项目对你有帮助，请给它一个星标！

[![Star History Chart](https://api.star-history.com/svg?repos=Yan-nian/custom-hosts-optimizer&type=Date)](https://star-history.com/#Yan-nian/custom-hosts-optimizer&Date)

## 🙏 鸣谢

- [GitHub520](https://github.com/521xueweihan/GitHub520) - 灵感来源  
- [TinsFox/github-hosts](https://github.com/TinsFox/github-hosts) - 技术参考
- [Cloudflare Workers](https://workers.cloudflare.com/) - 提供强大的边缘计算平台

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 🔄 重新部署

在某些情况下，您可能需要重新部署服务，例如：

### 何时需要重新部署

1. **更新管理后台地址后** - 必须重新部署才能生效
2. **修改系统配置后** - 某些配置更改需要重启服务
3. **更新代码后** - 获取最新功能和修复
4. **环境变量更改后** - 新的环境变量需要重新部署生效

### 重新部署方法

#### 一键部署用户

如果您使用的是一键部署：

1. **访问 Cloudflare Dashboard**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
   - 进入 Workers & Pages 

2. **找到您的 Worker**
   - 在 Workers 列表中找到您的服务（通常名为 `custom-hosts-optimizer`）

3. **重新部署**
   - 点击 Worker 名称进入详情页
   - 点击 "Deploy" 或 "Quick edit" 
   - 点击 "Save and Deploy" 重新部署

#### 手动部署用户

如果您使用的是手动部署：

```bash
# 进入项目目录
cd custom-hosts-optimizer

# 拉取最新代码（可选）
git pull origin main

# 重新部署
npm run deploy
```

#### 使用 GitHub Actions（如果配置了）

```bash
# 推送任意更改触发自动部署
git commit --allow-empty -m "触发重新部署"
git push origin main
```

### 验证部署

重新部署后，请验证：

1. **访问新的管理后台地址**（如果有更改）
2. **检查功能是否正常**
3. **查看 Worker 日志**确认没有错误

### 常见问题

- **Q: 更新管理后台地址后无法访问？**
  - A: 确保已重新部署，并使用新地址访问

- **Q: 重新部署后数据丢失了？**
  - A: 数据存储在 KV 中，重新部署不会影响数据

- **Q: 部署失败怎么办？**
  - A: 检查 Cloudflare 控制台的错误日志，确认配置正确

### 🔧 自定义配置

#### 🚪 自定义管理后台地址

为了安全考虑，您可以自定义管理后台的访问地址：

1. **Fork 仓库**：在 GitHub 上 fork 这个项目

2. **修改配置**：编辑 `src/index.ts` 文件
   
   **查找并修改管理后台路由：**
   ```typescript
   // 找到这行代码
   app.route("/admin-x7k9m3q2", admin.use("*", adminAuth))
   
   // 修改为您的自定义路径
   app.route("/your-secret-admin", admin.use("*", adminAuth))
   ```
   
   **同时修改路径排除逻辑：**
   ```typescript
   // 找到这行代码（大约在文件末尾）
   !path.startsWith("/admin-x7k9m3q2")
   
   // 修改为
   !path.startsWith("/your-secret-admin")
   ```

3. **重新部署**：使用您修改后的代码进行部署

4. **访问新地址**：`https://your-domain.workers.dev/your-secret-admin`
5. **更新 API Key**：新的 API Key 变为 `your-secret-admin`（不含 `/`）

**API Key 自动更新**：
```bash
# 修改后台地址为 /secure-panel-abc123 后
curl -X POST "https://your-worker.workers.dev/api/custom-domains?key=secure-panel-abc123" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com"}'
```

**安全建议**：
- 使用复杂且不易猜测的路径（如：`/mgmt-abc123xyz`）
- 避免常见词汇（如：`/admin`、`/manage`）
- 定期更换管理后台路径
- 不要在公开场所分享管理地址

**路径示例**：
```
✅ 推荐：/secure-panel-x9k2m4, /admin-abc123xyz, /mgmt-789secure
❌ 避免：/admin, /manage, /backend, /control
```

#### 🔑 API Key 配置

**重要**：API Key 现在已简化为使用管理后台地址：

1. **默认 API Key**：`admin-x7k9m3q2`
2. **自定义后**：如果您将管理后台改为 `/my-admin-panel`，API Key 即为 `my-admin-panel`
3. **无需额外设置**：API Key 与管理后台地址自动同步，简化了配置流程

**使用示例**：
```bash
# 使用默认 API Key
curl -X POST "https://your-worker.workers.dev/api/custom-domains?key=admin-x7k9m3q2"

# 自定义后台地址后的 API Key
curl -X POST "https://your-worker.workers.dev/api/custom-domains?key=my-admin-panel"
```

## 🔄 自动部署配置

### GitHub Actions 自动部署

本项目已配置 GitHub Actions，可以实现：

#### 🚀 主要特性

1. **自动部署** - 推送代码到 main 分支自动部署到生产环境
2. **预览部署** - Pull Request 自动创建预览环境
3. **状态检查** - 显示部署状态和结果
4. **评论通知** - 在 PR 中自动评论预览链接

#### 🛠️ 配置步骤

##### 1. 获取 Cloudflare 凭据

**API Token:**
1. 访问 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 "Create Token"
3. 使用 "Custom token" 模板
4. 配置权限：
   - Account: `Cloudflare Workers:Edit`
   - Zone: `Zone:Read` (如果使用自定义域名)
5. 复制生成的 Token

**Account ID:**
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 在右侧边栏找到 "Account ID"
3. 复制 Account ID

##### 2. 配置 GitHub Secrets

在您的 GitHub 仓库中：

1. 进入 `Settings` > `Secrets and variables` > `Actions`
2. 点击 `New repository secret`
3. 添加以下 Secrets：

| Secret 名称 | 值 | 说明 |
|------------|----|----|
| `CLOUDFLARE_API_TOKEN` | 您的 API Token | 用于 Cloudflare API 认证 |
| `CLOUDFLARE_ACCOUNT_ID` | 您的 Account ID | Cloudflare 账户标识 |

##### 3. 触发部署

配置完成后，以下操作会自动触发部署：

- **推送到 main 分支** → 自动部署到生产环境
- **创建 Pull Request** → 自动创建预览部署
- **手动触发** → 在 Actions 页面手动运行

#### 📋 部署工作流程

```yaml
# 生产环境部署
on:
  push:
    branches: [ main ]

# 预览环境部署  
on:
  pull_request:
    branches: [ main ]

# 手动触发
workflow_dispatch:
```

#### 🔍 监控部署

1. **查看部署状态**：
   - 进入仓库的 `Actions` 页面
   - 查看工作流运行状态

2. **部署成功通知**：
   - 生产部署：检查 Actions 输出获取 Worker URL
   - 预览部署：自动在 PR 中评论预览链接

3. **故障排除**：
   ```bash
   # 常见问题检查
   - API Token 权限是否正确
   - Account ID 是否匹配
   - wrangler.toml 配置是否正确
   ```

#### ⚙️ 自定义配置

如需自定义部署行为，编辑 `.github/workflows/deploy.yml`：

**自定义触发条件:**
```yaml
on:
  push:
    branches: [ main, develop ]  # 添加更多分支
    paths:
      - 'src/**'  # 仅当源码变化时触发
      - 'wrangler.toml'
```

**添加环境变量:**
```yaml
env:
  NODE_ENV: production
  CUSTOM_VAR: ${{ secrets.CUSTOM_VAR }}
```

**多环境部署:**
```yaml
jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    # 部署到测试环境
    
  deploy-production:
    if: github.ref == 'refs/heads/main'
    # 部署到生产环境
```

#### 🔒 安全最佳实践

1. **Secrets 管理**：
   - 仅添加必要的 Secrets
   - 定期轮换 API Token
   - 使用最小权限原则

2. **分支保护**：
   - 启用分支保护规则
   - 要求 PR 审核
   - 要求状态检查通过

3. **环境保护**：
   ```yaml
   environment: production
   # 可添加审批流程
   ```

#### 🚨 常见问题

**Q: 部署失败，提示权限不足**
A: 检查 API Token 权限，确保包含 `Cloudflare Workers:Edit`

**Q: 找不到 Account ID**  
A: 在 Cloudflare Dashboard 右侧边栏查找，或访问任意域名管理页面查看

**Q: 预览部署没有评论链接**
A: 检查 GitHub Actions 是否有仓库写入权限

**Q: 部署成功但无法访问**
A: 检查 Worker 是否正确绑定域名和 KV 命名空间

#### 💡 高级功能

**Slack 通知集成:**
```yaml
- name: Notify Slack
  if: success()
  uses: 8398a7/action-slack@v3
  with:
    status: success
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

**部署回滚:**
```bash
# 手动回滚到上一版本
wrangler rollback

# 或指定版本
wrangler rollback --version-id <version-id>
```

**性能监控:**
- 在部署后自动运行性能测试
- 集成 Lighthouse CI
- 监控 Worker 响应时间

### 📈 部署统计

启用自动部署后，您可以在以下位置查看部署信息：

- **GitHub Actions** - 部署历史和日志
- **Cloudflare Dashboard** - Worker 部署版本
- **PR 评论** - 预览环境链接
- **Status Checks** - 部署状态检查

### 🎯 下一步

设置完自动部署后，建议：

1. **自定义管理后台地址** - 参考 [配置指南](ADMIN_PATH_CONFIG.md)
2. **配置自定义域名** - 绑定您的域名
3. **设置监控告警** - 监控 Worker 健康状态
4. **优化缓存策略** - 根据使用情况调整缓存
