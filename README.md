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
- 🛠️ **管理后台** - 受密码保护的管理员界面
- 🔒 **权限控制** - 灵活的 API Key 权限管理

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

## 快速开始

### 🚀 一键部署（推荐）

使用 Cloudflare Workers 一键部署，无需本地环境：

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Yan-nian/custom-hosts-optimizer)

**部署步骤**：
1. 点击上方按钮
2. 授权 GitHub 访问
3. 选择 Cloudflare 账户
4. 等待自动部署完成

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

访问受密码保护的管理后台进行可视化管理：

```
https://your-worker-url.workers.dev/admin-x7k9m3q2
```

**默认账户**：
- 用户名：`admin`
- 密码：`admin123`

**功能特性**：
- 📊 统计仪表板
- ➕ 可视化添加域名
- 📝 批量导入域名
- 🔄 一键域名优选
- 🗑️ 删除和清空操作
- 🔧 系统配置管理（API Key 管理）

**重要提示**：
- 管理后台地址在部署时配置，如需修改请重新部署
- 建议使用复杂且不易猜测的管理后台路径确保安全

详细配置请参考：[管理后台配置指南](ADMIN_GUIDE.md)

### 🚀 API 接口

#### 添加自定义域名

```bash
curl -X POST "https://your-worker-url.workers.dev/api/custom-domains?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "description": "我的网站"}'
```

#### 优选域名 IP

```bash
curl -X POST "https://your-worker-url.workers.dev/api/optimize/example.com?key=YOUR_API_KEY"
```

#### 获取优选后的 hosts

```bash
# 包含 IP 优选和自定义域名
curl "https://your-worker-url.workers.dev/hosts?optimize=true&custom=true"
```

## 📋 配置

### 环境变量

在部署时，你可以设置以下环境变量：

| 变量名 | 描述 | 默认值 | 必需 |
|--------|------|--------|------|
| `ADMIN_USERNAME` | 管理后台用户名 | `admin` | 否 |
| `ADMIN_PASSWORD` | 管理后台密码 | 无 | 推荐 |
| `API_KEY` | API 访问密钥 | 无 | 否 |

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
curl -X POST "https://your-worker.workers.dev/api/custom-domains?key=API_KEY" \
  -d '{"domain": "internal.company.com", "description": "内部服务"}'
```

### CDN 节点优选
为 CDN 域名选择最快的边缘节点：
```bash
curl -X POST "https://your-worker.workers.dev/api/optimize/cdn.example.com?key=API_KEY"
```

### 游戏加速
为游戏服务器选择低延迟 IP：
```bash
curl -X POST "https://your-worker.workers.dev/api/custom-domains?key=API_KEY" \
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

- `API_KEY` - 管理 API 的密钥（必需）
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

部署后请立即通过管理后台设置安全的 API Key：

1. 访问管理后台
2. 在"系统设置"中设置复杂的 API Key
3. 使用 API Key 进行外部调用验证

### 🎯 管理后台功能
