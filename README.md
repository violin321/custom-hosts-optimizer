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

1. **Fork 仓库到您的 GitHub 账户**
2. **配置 Secrets**（在仓库 Settings > Secrets > Actions）：
   - `CLOUDFLARE_API_TOKEN` - Cloudflare API Token
3. **推送代码即可自动部署**

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

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests！

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

您可以使用以下方法生成安全路径：

```bash
# 方法 1：使用 openssl
echo "/admin-$(openssl rand -hex 8)"

# 方法 2：使用 uuidgen（macOS/Linux）
echo "/mgmt-$(uuidgen | tr '[:upper:]' '[:lower:]' | cut -d'-' -f1)"
```

### 定期更换策略

#### 建议更换频率

- **高安全需求**：每月更换
- **中等安全需求**：每季度更换
- **低安全需求**：每半年更换

#### 更换流程

1. 生成新的安全路径
2. 修改源代码（三处位置）
3. 重新部署应用
4. 更新书签和文档
5. 通知相关人员

### 注意事项

#### 修改前备份

```bash
# 备份当前配置
cp src/index.ts src/index.ts.backup

# 记录当前后台地址
echo "当前后台地址: /admin-x7k9m3q2" > admin_path_backup.txt
```

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
