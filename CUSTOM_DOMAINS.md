# 自定义域名和 IP 优选功能

## 功能概述

这个更新为 GitHub Hosts 项目添加了两个重要功能：

1. **自定义域名管理** - 允许用户添加和管理自己需要加速的域名
2. **IP 优选功能** - 通过测试响应时间自动选择最快的 IP 地址

## 新增功能

### 1. 自定义域名管理

#### API 接口

- `GET /api/custom-domains?key=API_KEY` - 获取自定义域名列表
- `POST /api/custom-domains?key=API_KEY` - 添加自定义域名
- `DELETE /api/custom-domains/{domain}?key=API_KEY` - 删除自定义域名
- `POST /api/optimize/{domain}?key=API_KEY` - 优选指定域名的 IP

#### 添加自定义域名示例

```bash
curl -X POST "https://your-domain.com/api/custom-domains?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "description": "测试域名"}'
```

#### 删除自定义域名示例

```bash
curl -X DELETE "https://your-domain.com/api/custom-domains/example.com?key=YOUR_API_KEY"
```

### 2. IP 优选功能

#### 工作原理

1. 从多个 DNS 提供商获取域名的所有可用 IP 地址
2. 并发测试每个 IP 的响应时间
3. 选择响应时间最短的 IP 地址
4. 将结果缓存到 Cloudflare KV

#### 启用优选功能

在获取 hosts 文件时添加 `optimize=true` 参数：

```bash
# 获取优选后的 hosts 文件
curl "https://your-domain.com/hosts?optimize=true"

# 获取优选后的 JSON 数据
curl "https://your-domain.com/hosts.json?optimize=true"
```

#### 手动重置缓存并启用优选

```bash
curl -X POST "https://your-domain.com/reset?key=YOUR_API_KEY&optimize=true"
```

### 3. 前端界面更新

新的前端界面包含四个选项卡：

1. **Hosts 文件** - 查看和下载 hosts 文件，可选择是否启用优选
2. **自定义域名** - 管理自定义域名（需要 API Key）
3. **API 文档** - 查看完整的 API 文档
4. **使用帮助** - 详细的使用说明

#### 自定义域名管理界面

- 支持添加、删除自定义域名
- 支持为单个域名执行 IP 优选
- 显示域名添加时间和最后更新时间
- 支持域名描述字段

## 环境变量配置

### 新增环境变量

- `ENABLE_OPTIMIZATION` - 在定时任务中是否默认启用优选功能（可选，默认为 false）

### 现有环境变量

- `API_KEY` - 管理 API 的密钥（必需）

## 使用场景

### 1. 企业内网场景

企业可以添加内部服务域名到自定义域名列表，系统会自动为这些域名找到最优的 IP 地址。

```javascript
// 添加企业内部服务
await fetch('/api/custom-domains?key=API_KEY', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domain: 'internal-service.company.com',
    description: '企业内部服务'
  })
})
```

### 2. CDN 优选场景

为使用 CDN 的网站选择最快的边缘节点：

```javascript
// 为 CDN 域名执行优选
await fetch('/api/optimize/cdn.example.com?key=API_KEY', {
  method: 'POST'
})
```

### 3. 游戏加速场景

为游戏服务器域名选择延迟最低的 IP：

```bash
# 添加游戏服务器域名
curl -X POST "https://your-domain.com/api/custom-domains?key=API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain": "game-server.example.com", "description": "游戏服务器"}'

# 执行优选
curl -X POST "https://your-domain.com/api/optimize/game-server.example.com?key=API_KEY"
```

## 部署说明

### 1. 更新 wrangler.toml

确保 `wrangler.toml` 中包含必要的环境变量：

```toml
[env.production.vars]
API_KEY = "your-secret-api-key"
ENABLE_OPTIMIZATION = "false"  # 可选，定时任务是否启用优选
```

### 2. 部署到 Cloudflare Workers

```bash
npm run deploy
```

### 3. 设置 KV 命名空间

确保 Cloudflare KV 命名空间 `github_hosts` 已正确绑定。

## 性能考虑

### 1. IP 优选性能

- IP 优选功能会增加响应时间，建议在非高峰时段执行
- 优选结果会缓存，避免重复测试
- 可以通过 `optimize=false` 参数禁用实时优选

### 2. 自定义域名限制

- 建议限制自定义域名数量（目前无硬性限制）
- 每个域名的优选过程可能需要 5-10 秒

### 3. 缓存策略

- GitHub 域名数据缓存 1 小时
- 自定义域名优选结果永久缓存，直到手动更新
- 可通过 `/reset` 接口清空所有缓存

## 故障排除

### 1. API Key 无效

确保使用正确的 API Key，可以在浏览器开发者工具中检查网络请求。

### 2. 域名格式错误

域名必须符合标准格式（例如：`example.com`），不支持 IP 地址或无效格式。

### 3. 优选失败

如果某个域名优选失败，可能的原因：
- 域名无法解析
- 所有 IP 都无法访问
- 网络超时

### 4. 自定义域名不显示

检查：
- API Key 是否正确
- 是否已添加自定义域名
- 浏览器控制台是否有错误信息

## 开发说明

### 1. 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 运行测试
pnpm test
```

### 2. 添加新的 DNS 提供商

在 `src/constants.ts` 中的 `DNS_PROVIDERS` 数组添加新的提供商：

```typescript
{
  url: (domain: string) => `https://new-dns-provider.com/resolve?name=${domain}&type=A`,
  headers: { Accept: "application/dns-json" },
  name: "New DNS Provider",
}
```

### 3. 自定义优选算法

可以修改 `src/services/hosts.ts` 中的 `optimizeDomainIP` 函数来实现不同的优选策略。

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这些功能。请确保：

1. 代码符合项目的编码规范
2. 添加适当的测试
3. 更新相关文档

## 许可证

本项目采用 MIT 许可证，详见 LICENSE 文件。
