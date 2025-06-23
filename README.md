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

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Yan-nian/custom-host)

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
git clone https://github.com/Yan-nian/custom-host.git
cd custom-host
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
https://your-worker-url.workers.dev/admin
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

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- 感谢 [GitHub520](https://github.com/521xueweihan/GitHub520) 提供的灵感
- 感谢 Cloudflare 提供的强大平台
- 感谢所有贡献者和用户的支持

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests！

1. Fork 本项目
2. 创建功能分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -am 'Add new feature'`
4. 推送分支：`git push origin feature/new-feature`
5. 提交 Pull Request

## 🙏 鸣谢

- [GitHub520](https://github.com/521xueweihan/GitHub520) - 灵感来源
- [TinsFox/github-hosts](https://github.com/TinsFox/github-hosts) - 技术参考
- [Cloudflare Workers](https://workers.cloudflare.com/) - 提供强大的边缘计算平台

## ⭐ Star History

如果这个项目对你有帮助，请给它一个星标！

[![Star History Chart](https://api.star-history.com/svg?repos=Yan-nian/custom-host&type=Date)](https://star-history.com/#Yan-nian/custom-host&Date)

## 🙏 鸣谢

- [GitHub520](https://github.com/521xueweihan/GitHub520) - 灵感来源  
- [TinsFox/github-hosts](https://github.com/TinsFox/github-hosts) - 技术参考
- [Cloudflare Workers](https://workers.cloudflare.com/) - 提供强大的边缘计算平台

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。
