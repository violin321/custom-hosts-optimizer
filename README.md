<div align="center">
  <img src="public/logo.svg" width="140" height="140" alt="优选自定义host logo">
  <h1>优选自定义host</h1>
  <p>自定义域名访问加速，智能 IP 优选解决访问慢的问题。使用 Cloudflare Workers 和公共 DNS API 来获取最优 IP 地址。</p>
</div>

## 🚀 新功能

- ✨ **自定义域名管理** - 添加任意域名进行 IP 优选
- ⚡ **智能 IP 优选** - 自动测试响应时间，选择最快 IP
- 🎯 **现代化界面** - 全新的选项卡式管理界面
- 🔧 **完整 API** - RESTful API 支持所有功能
- 🤖 **GitHub Actions** - 一键自动化部署
- 🛠️ **管理后台** - 受密码保护的管理员界面

## 特性

- 🚀 使用 Cloudflare Workers 部署，无需服务器
- 🌍 多 DNS 服务支持（Cloudflare DNS、Google DNS）
- ⚡️ 每 60 分钟自动更新 DNS 记录
- 💾 使用 Cloudflare KV 存储数据
- 🔄 提供多种使用方式（脚本、手动、工具）
- 📡 提供 REST API 接口
- 🎯 自定义域名 IP 优选
- 🧠 智能响应时间检测

## 快速开始

### 方法 1：使用已部署的服务

直接使用我们的公共服务：`https://github-hosts.tinsfox.com`

### 方法 2：GitHub Actions 一键部署

1. Fork 这个仓库
2. 在 GitHub Secrets 中设置：
   - `CLOUDFLARE_API_TOKEN` - 你的 Cloudflare API Token
3. 触发 GitHub Actions 自动部署

> **功能说明**：现在无需 API Key，可以直接使用所有自定义域名功能。详细使用方法请参考：[自定义域名管理指南](CUSTOM_DOMAINS_GUIDE.md)

详细说明：[GitHub Actions 部署指南](GITHUB_ACTIONS_DEPLOY.md)

### 方法 3：手动部署

```bash
# 克隆仓库
git clone https://github.com/Yan-nian/hosts.git
cd hosts

# 安装依赖
pnpm install

# 登录 Cloudflare
pnpm exec wrangler auth login

# 一键部署
./deploy.sh
```

详细说明：[手动部署指南](DEPLOYMENT.md)

## 使用方法

### 🌐 Web 界面

访问部署的 Worker URL，使用现代化的 Web 界面：

- **Hosts 文件** - 查看和下载 hosts 文件
- **自定义域名** - 管理你的自定义域名
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
sudo curl -fsSL https://github.com/Yan-nian/hosts/releases/download/v0.0.1/custom-hosts.darwin-arm64 -o custom-hosts && sudo chmod +x ./custom-hosts && ./custom-hosts
```

#### Windows 用户
在管理员权限的 PowerShell 中执行：
```powershell
irm https://github.com/Yan-nian/hosts/releases/download/v0.0.1/custom-hosts.windows-amd64.exe | iex
```

#### Linux 用户
```bash
sudo curl -fsSL https://github.com/Yan-nian/hosts/releases/download/v0.0.1/custom-hosts.linux-amd64 -o custom-hosts && sudo chmod +x ./custom-hosts && ./custom-hosts
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

---

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/TinsFox">TinsFox</a></p>
  <p>如果这个项目对你有帮助，请考虑给个 ⭐️</p>
</div>

### 3. 手动更新

1. 获取 hosts：访问 [https://github-hosts.tinsfox.com/hosts](https://github-hosts.tinsfox.com/hosts)
2. 更新本地 hosts 文件：
   - Windows：`C:\Windows\System32\drivers\etc\hosts`
   - MacOS/Linux：`/etc/hosts`
3. 刷新 DNS：
   - Windows：`ipconfig /flushdns`
   - MacOS：`sudo killall -HUP mDNSResponder`
   - Linux：`sudo systemd-resolve --flush-caches`

## API 文档

- `GET /hosts` - 获取 hosts 文件内容
- `GET /hosts.json` - 获取 JSON 格式的数据
- `GET /{domain}` - 获取指定域名的实时 DNS 解析结果
- `POST /reset` - 清空缓存并重新获取所有数据（需要 API 密钥）

## 常见问题

### 权限问题
- Windows：需要以管理员身份运行
- MacOS/Linux：需要 sudo 权限

### 定时任务未生效
- Windows：检查任务计划程序中的 "GitHub Hosts Updater"
- MacOS/Linux：使用 `crontab -l` 检查

### 更新失败
- 检查日志：`~/.github-hosts/logs/update.log`
- 确保网络连接和文件权限正常

## 部署指南

1. Fork 本项目
2. 创建 Cloudflare Workers 账号
3. 安装并部署：
```bash
pnpm install
pnpm run dev    # 本地开发
pnpm run deploy # 部署到 Cloudflare
```

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Yan-nian/hosts)

## 鸣谢

- [GitHub520](https://github.com/521xueweihan/GitHub520)
- [![Powered by DartNode](https://dartnode.com/branding/DN-Open-Source-sm.png)](https://dartnode.com "Powered by DartNode - Free VPS for Open Source")

## 许可证

[MIT](./LICENSE)
