# GitHub Actions 自动部署指南

本指南详细说明如何配置 GitHub Actions 来实现 Cloudflare Workers 的自动部署。

## 🎯 功能概述

### 自动化特性

- ✅ **自动部署** - 推送到 main 分支自动部署到生产环境
- ✅ **预览部署** - Pull Request 自动创建预览环境  
- ✅ **状态检查** - 部署状态显示在 GitHub 检查中
- ✅ **评论通知** - 预览链接自动评论到 PR
- ✅ **手动触发** - 支持手动执行部署
- ✅ **多环境** - 支持生产和预览环境

## 🛠️ 快速开始

### 步骤 1: Fork 仓库

1. 点击仓库页面右上角的 "Fork" 按钮
2. 选择您的 GitHub 账户
3. 等待 Fork 完成

### 步骤 2: 获取 Cloudflare 凭据

#### API Token

1. 访问 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 "Create Token"
3. 选择 "Custom token" 模板
4. 配置权限：
   ```
   Account: Cloudflare Workers:Edit
   Zone: Zone:Read (可选，如果使用自定义域名)
   ```
5. 账户资源：选择您的账户
6. 区域资源：选择您的域名（如果有）
7. 点击 "Continue to summary" 然后 "Create Token"
8. **复制并安全保存生成的 Token**

#### Account ID

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 在右侧边栏找到 "Account ID"
3. 复制 Account ID

### 步骤 3: 配置 GitHub Secrets

1. 进入您 Fork 的仓库
2. 点击 `Settings` 选项卡
3. 在左侧菜单中选择 `Secrets and variables` > `Actions`
4. 点击 `New repository secret`
5. 添加以下两个 Secrets：

#### Secret 1: CLOUDFLARE_API_TOKEN
- **Name**: `CLOUDFLARE_API_TOKEN`
- **Secret**: 粘贴您在步骤2中获取的 API Token

#### Secret 2: CLOUDFLARE_ACCOUNT_ID  
- **Name**: `CLOUDFLARE_ACCOUNT_ID`
- **Secret**: 粘贴您的 Cloudflare Account ID

### 步骤 4: 配置 KV 命名空间

在第一次部署前，需要创建 KV 命名空间：

```bash
# 本地配置（如果需要）
npx wrangler kv:namespace create "custom_hosts"
npx wrangler kv:namespace create "custom_hosts" --preview
```

更新 `wrangler.toml` 中的 KV 命名空间 ID。

### 步骤 5: 触发首次部署

#### 方法 1: 推送代码
```bash
git commit --allow-empty -m "触发首次部署"
git push origin main
```

#### 方法 2: 手动触发
1. 进入仓库的 `Actions` 页面
2. 选择 "Deploy to Cloudflare Workers" 工作流
3. 点击 "Run workflow"
4. 选择分支并点击 "Run workflow"

## 📋 工作流详解

### 生产环境部署

**触发条件:**
- 推送到 `main` 或 `master` 分支
- 手动触发

**部署流程:**
1. 检出代码
2. 设置 Node.js 环境
3. 安装依赖
4. 使用 Wrangler 部署到生产环境

### 预览环境部署

**触发条件:**
- 创建或更新 Pull Request

**部署流程:**
1. 检出 PR 代码
2. 部署到预览环境
3. 在 PR 中评论预览链接

## 🔍 监控和调试

### 查看部署状态

1. **GitHub Actions 页面**
   - 进入仓库的 `Actions` 页面
   - 查看工作流运行历史和日志

2. **部署检查**
   - PR 和提交会显示部署状态检查
   - 绿色勾号表示部署成功
   - 红色 X 表示部署失败

3. **Cloudflare Dashboard**
   - 查看 Worker 部署版本
   - 监控流量和性能

### 调试部署失败

#### 常见错误和解决方案

**1. API Token 权限不足**
```
Error: Authentication error
```
**解决方案**: 检查 API Token 权限，确保包含 `Cloudflare Workers:Edit`

**2. Account ID 错误**
```
Error: Account ID not found
```  
**解决方案**: 验证 `CLOUDFLARE_ACCOUNT_ID` Secret 是否正确

**3. KV 命名空间不存在**
```
Error: KV namespace not found
```
**解决方案**: 创建 KV 命名空间并更新 `wrangler.toml`

**4. 依赖安装失败**
```
Error: npm install failed
```
**解决方案**: 检查 `package.json` 和网络连接

### 查看详细日志

1. 点击失败的工作流运行
2. 展开失败的步骤
3. 查看详细错误信息
4. 根据错误信息进行修复

## ⚙️ 高级配置

### 自定义部署行为

编辑 `.github/workflows/deploy.yml` 来自定义部署：

#### 1. 修改触发条件

```yaml
on:
  push:
    branches: [ main, develop ]  # 支持多个分支
    paths:
      - 'src/**'                # 仅当源码改变时触发
      - 'wrangler.toml'
      - 'package.json'
```

#### 2. 添加环境变量

```yaml
env:
  NODE_ENV: production
  CUSTOM_CONFIG: ${{ secrets.CUSTOM_CONFIG }}
```

#### 3. 多环境支持

```yaml
jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    steps:
      - name: Deploy to Staging
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env staging

  deploy-production:
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Production
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

### 集成通知

#### Slack 通知

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
    message: |
      部署状态: ${{ job.status }}
      提交: ${{ github.sha }}
      分支: ${{ github.ref }}
```

#### 企业微信通知

```yaml
- name: Notify WeChat Work
  if: failure()
  run: |
    curl -X POST "${{ secrets.WECHAT_WEBHOOK }}" \
      -H "Content-Type: application/json" \
      -d '{
        "msgtype": "text",
        "text": {
          "content": "🚨 部署失败\n仓库: ${{ github.repository }}\n分支: ${{ github.ref }}\n提交: ${{ github.sha }}"
        }
      }'
```

### 性能优化

#### 1. 缓存依赖

```yaml
- name: Cache dependencies
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

#### 2. 并行构建

```yaml
strategy:
  matrix:
    node-version: [18, 20]
```

#### 3. 条件部署

```yaml
- name: Deploy only if changed
  if: contains(github.event.head_commit.message, '[deploy]')
```

## 🔒 安全最佳实践

### 1. Secrets 管理

- ✅ 仅添加必要的 Secrets
- ✅ 使用有意义的 Secret 名称
- ✅ 定期轮换 API Tokens
- ✅ 遵循最小权限原则

### 2. 分支保护

在仓库设置中配置分支保护：

1. 进入 `Settings` > `Branches`
2. 添加分支保护规则
3. 配置：
   - ✅ Require status checks to pass
   - ✅ Require pull request reviews
   - ✅ Restrict pushes

### 3. 环境保护

```yaml
environment: 
  name: production
  protection_rules:
    required_reviewers: 1
```

### 4. 审计日志

定期检查：
- GitHub Actions 运行历史
- Cloudflare 部署日志
- API Token 使用记录

## 📊 监控和分析

### 部署指标

跟踪以下关键指标：
- ✅ 部署成功率
- ✅ 部署时间
- ✅ 故障恢复时间
- ✅ 代码变更频率

### 设置监控

1. **GitHub Insights**
   - 查看 Actions 使用情况
   - 分析部署频率

2. **Cloudflare Analytics**
   - 监控 Worker 性能
   - 查看请求统计

3. **第三方工具**
   - Sentry 错误监控
   - Datadog 性能监控

## 🆘 故障排除

### 快速诊断清单

- [ ] GitHub Secrets 是否正确配置
- [ ] Cloudflare API Token 权限是否充足
- [ ] Account ID 是否匹配
- [ ] KV 命名空间是否存在
- [ ] wrangler.toml 配置是否正确
- [ ] 网络连接是否正常

### 常用调试命令

```bash
# 本地测试部署
npx wrangler dev

# 检查配置
npx wrangler whoami

# 列出 KV 命名空间
npx wrangler kv:namespace list

# 查看 Worker 日志
npx wrangler tail
```

### 获取帮助

如果遇到问题：

1. 查看 [GitHub Actions 文档](https://docs.github.com/en/actions)
2. 查看 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
3. 在仓库中提交 Issue
4. 查看社区讨论

## 📚 相关资源

- [Cloudflare Wrangler Action](https://github.com/cloudflare/wrangler-action)
- [GitHub Actions 语法](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [自定义域名配置](https://developers.cloudflare.com/workers/platform/custom-domains/)

---

通过遵循本指南，您可以轻松设置完整的自动化部署流程，享受现代化的 CI/CD 体验！
