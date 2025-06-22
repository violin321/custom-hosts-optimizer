# GitHub Actions 自动部署配置

这个文档说明如何使用 GitHub Actions 自动部署到 Cloudflare Workers。

## 1. 设置 GitHub Secrets

在你的 GitHub 仓库中，进入 Settings > Secrets and variables > Actions，添加以下 secrets：

### 必需的 Secrets

#### `CLOUDFLARE_API_TOKEN`
- **描述**: Cloudflare API Token，用于部署权限
- **获取方式**:
  1. 访问 https://dash.cloudflare.com/profile/api-tokens
  2. 点击 "Create Token" 
  3. 选择 "Custom token"
  4. 设置权限：
     - Account: `Cloudflare Workers:Edit`
     - Zone: `Zone:Read` (如果使用自定义域名)
     - Zone: `Zone Settings:Read` (如果使用自定义域名)
  5. 设置账户资源：包含你的账户
  6. 如果使用自定义域名，设置区域资源
  7. 创建并复制 token

#### `WORKER_API_KEY`
- **描述**: Worker 应用的 API Key，用于管理自定义域名
- **设置**: 输入一个安全的随机字符串，例如：`your-secure-random-key-123`

### 可选的 Secrets

#### `ENABLE_OPTIMIZATION`
- **描述**: 是否在定时任务中启用 IP 优选功能
- **值**: `true` 或 `false`
- **默认**: 如果不设置，默认为 `false`

#### `CREATE_NEW_KV`
- **描述**: 是否创建新的 KV 命名空间
- **值**: `true` 或 `false`
- **使用场景**: 第一次部署时设置为 `true`

## 2. 更新 KV 命名空间 ID

如果你创建了新的 KV 命名空间，需要更新 `wrangler.toml` 文件：

1. 在 GitHub Actions 运行日志中找到新创建的 KV 命名空间 ID
2. 更新 `wrangler.toml` 文件中的 `id` 字段
3. 提交并推送更改

## 3. 触发部署

### 自动部署
- 推送到 `main` 或 `master` 分支时自动触发
- 创建 Pull Request 时也会触发（但不会实际部署 secrets）

### 手动部署
1. 进入 GitHub 仓库的 Actions 页面
2. 选择 "Deploy to Cloudflare Workers" 工作流
3. 点击 "Run workflow"
4. 选择分支并点击 "Run workflow"

## 4. 验证部署

部署成功后：

1. 检查 GitHub Actions 日志确认无错误
2. 访问你的 Worker URL（在日志中显示）
3. 测试基本功能：
   ```bash
   curl https://your-worker.your-subdomain.workers.dev/hosts
   ```
4. 测试管理 API：
   ```bash
   curl "https://your-worker.your-subdomain.workers.dev/api/custom-domains?key=YOUR_API_KEY"
   ```

## 5. 自定义域名配置

如果要使用自定义域名：

1. 在 Cloudflare 控制台中添加域名到 Workers
2. 或者在 `wrangler.toml` 中配置：
   ```toml
   [env.production]
   routes = [
     { pattern = "your-domain.com/*", custom_domain = true }
   ]
   ```

## 6. 环境管理

### 多环境部署
可以配置不同的环境（staging, production）：

```toml
[env.staging]
name = "github-hosts-staging"
vars = { ENABLE_OPTIMIZATION = "true" }

[env.production]
name = "github-hosts-production"
vars = { ENABLE_OPTIMIZATION = "false" }
```

然后在 GitHub Actions 中指定环境：
```bash
pnpm exec wrangler deploy --env production
```

## 7. 监控和维护

### 查看部署状态
- GitHub Actions 页面显示部署历史
- Cloudflare 控制台显示 Worker 状态

### 更新 Secrets
当需要更新 API Key 或其他配置时：
1. 在 GitHub Secrets 中更新值
2. 重新运行 GitHub Actions 工作流

### 回滚
如果需要回滚到之前的版本：
1. 在 GitHub 中恢复到之前的提交
2. 重新触发部署

## 8. 故障排除

### 常见错误

#### 权限错误
- 检查 `CLOUDFLARE_API_TOKEN` 是否有正确的权限
- 确保 token 没有过期

#### KV 命名空间错误
- 确保 `wrangler.toml` 中的 KV ID 正确
- 检查命名空间是否存在于正确的账户中

#### Secrets 设置失败
- 确保 Worker 已成功部署
- 检查 API Token 权限

### 调试技巧
1. 查看 GitHub Actions 的详细日志
2. 使用 `wrangler tail` 查看 Worker 日志
3. 在 Cloudflare 控制台检查 Worker 状态

## 9. 安全最佳实践

1. **API Token 安全**
   - 定期轮换 Cloudflare API Token
   - 使用最小权限原则
   - 监控 token 使用情况

2. **Worker API Key**
   - 使用强随机密码
   - 定期更新
   - 限制访问来源（如果需要）

3. **代码安全**
   - 不要在代码中硬编码敏感信息
   - 定期更新依赖
   - 使用 Dependabot 监控安全漏洞

## 10. 成本优化

- 监控 Workers 使用量
- 合理设置定时任务频率
- 使用缓存减少 KV 读写
- 考虑使用 Cloudflare 的免费套餐限制
