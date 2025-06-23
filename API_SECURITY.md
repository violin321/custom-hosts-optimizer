# API 安全验证机制

## 📋 概述

为了保护管理类 API 不被恶意调用，本项目实现了基于后台地址验证和 API Key 的双重安全机制。

## 🔒 验证策略

### 受保护的 API

以下管理类 API 需要通过验证才能访问：

**POST/PUT/DELETE 方法的以下路径：**
- `/api/custom-domains` - 自定义域名管理
- `/api/optimize-all` - 全域名优选
- `/api/optimize/` - 单域名优选
- `/api/reset` - 重置数据
- `/api/cache/refresh` - 刷新缓存
- `/api/cache` - 清空缓存

### 验证方式

#### 1. 管理后台验证（推荐）
- **访问路径**: `/admin`
- **验证原理**: 检查 HTTP Referer 头，确保请求来自管理后台页面
- **适用场景**: 网页界面操作

#### 2. API Key 验证
- **Header 方式**: `x-api-key: YOUR_API_KEY`
- **Query 方式**: `?key=YOUR_API_KEY`
- **获取方式**: 联系管理员或查看环境变量配置

#### 3. 特殊API Key（主页刷新功能）
- **Key值**: `main-page-refresh`
- **权限**: 仅允许访问以下API
  - `/api/optimize-all` - 全域名优选
  - `/api/cache/refresh` - 刷新缓存
- **用途**: 供主页刷新功能使用，权限受限，安全性更高

## 🛡️ 安全特性

### 请求来源验证
```typescript
// 检查 Referer 头
const referer = c.req.header('referer')
const isValidReferer = referer && referer.includes('/admin')

// 检查 Origin 头  
const origin = c.req.header('origin')
const host = c.req.header('host')
const isValidOrigin = origin && host && origin.includes(host)
```

### API Key 验证
```typescript
// 支持 Header 和 Query 两种方式
const apiKey = c.req.header('x-api-key') || c.req.query('key')
const isValidApiKey = !c.env.API_KEY || apiKey === c.env.API_KEY
```

### 错误响应
```json
{
  "error": "Access denied. Please use the admin panel to manage APIs.",
  "code": "ADMIN_ACCESS_REQUIRED", 
  "hint": "Visit /admin to access management features"
}
```

## 🚀 使用示例

### 1. 通过管理后台使用

```javascript
// 在管理后台页面中，所有 API 调用会自动包含正确的 Referer
fetch('/api/optimize-all', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
```

### 2. 使用 API Key

```bash
# Header 方式
curl -X POST -H "x-api-key: YOUR_API_KEY" \\
  https://your-domain.com/api/optimize-all

# Query 方式  
curl -X POST \\
  "https://your-domain.com/api/optimize-all?key=YOUR_API_KEY"

# 刷新缓存
curl -X POST \\
  "https://your-domain.com/api/cache/refresh?key=YOUR_API_KEY"
```

### 3. 使用特殊API Key

```bash
# 主页刷新功能 - 全域名优选
curl -X POST -H "x-api-key: main-page-refresh" \\
  https://your-domain.com/api/optimize-all

# 主页刷新功能 - 刷新缓存  
curl -X POST -H "x-api-key: main-page-refresh" \\
  https://your-domain.com/api/cache/refresh

# 尝试访问其他API会被拒绝
curl -X POST -H "x-api-key: main-page-refresh" \\
  https://your-domain.com/api/reset
# 返回: {"error":"Access denied. Main page refresh key can only access optimization and cache refresh APIs."}
```

### 4. 公开 API（无需验证）

```bash
# 获取 hosts 文件
curl https://your-domain.com/hosts

# 获取 JSON 数据
curl https://your-domain.com/hosts.json

# 查看缓存状态
curl https://your-domain.com/api/cache/status

# 获取自定义域名列表（GET 方法）
curl https://your-domain.com/api/custom-domains
```

## ⚙️ 配置说明

### 环境变量

**本地开发 (.dev.vars):**
```env
API_KEY=local-dev-key-123
```

**生产环境 (wrangler secret):**
```bash
# 设置生产环境 API Key
wrangler secret put API_KEY
# 输入你的安全 API Key
```

**注意：** API Key 也可以通过管理后台动态设置，存储在 KV 中的配置会覆盖环境变量。

### 管理后台地址配置

**默认管理后台地址：** `/admin-x7k9m3q2`

**动态配置管理后台地址：**
1. 访问默认管理后台地址
2. 在"系统设置"中输入新的管理后台地址
3. 点击"更新后台地址"
4. 重新部署服务使新地址生效

**API 方式配置：**
```bash
# 更新管理后台地址
curl -X PUT "https://your-domain.com/api/system/admin-path?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"adminPath":"/my-secret-admin"}'

# 更新 API Key
curl -X PUT "https://your-domain.com/api/system/api-key" \
  -H "referer: https://your-domain.com/admin-x7k9m3q2" \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"your-new-secure-api-key"}'
```

### 验证逻辑配置

```typescript
// 受保护的 API 路径
const protectedPaths = [
  '/api/custom-domains',
  '/api/optimize-all', 
  '/api/optimize/',
  '/api/reset',
  '/api/cache/refresh',
  '/api/cache'
]

// 需要验证的 HTTP 方法
const protectedMethods = ['POST', 'DELETE', 'PUT']
```

## 🔧 故障排除

### 常见问题

**1. API 访问被拒绝**
- 确保使用正确的 API Key
- 确保从管理后台页面发起请求
- 检查 HTTP 方法是否正确

**2. 管理后台无法使用 API**
- 确保浏览器没有屏蔽 Referer 头
- 检查是否在 `/admin` 路径下
- 尝试刷新页面重新加载

**3. API Key 验证失败**
- 检查环境变量是否正确配置
- 确保 Key 没有额外的空格或字符
- 对于生产环境，确保使用 `wrangler secret put` 设置

### 调试信息

开发环境下，验证过程会在控制台输出详细日志：

```
API 访问已验证: /api/optimize-all
API 访问被拒绝: /api/optimize-all, referer: undefined, origin: http://localhost:8787
```

## 📚 最佳实践

### 1. 安全配置
- 生产环境必须设置强密码 API Key
- 定期更换 API Key
- 不要在前端代码中硬编码 API Key

### 2. 访问控制
- 优先使用管理后台进行管理操作
- API Key 仅用于自动化脚本和外部集成
- 监控 API 访问日志，及时发现异常

### 3. 错误处理
- 客户端应妥善处理 403 错误
- 提供用户友好的错误提示
- 实现重试机制和降级策略

## 🎯 安全效果

通过实施这套验证机制，实现了：

- ✅ **防止恶意调用**: 未授权用户无法执行管理操作
- ✅ **保护系统资源**: 防止恶意优选和缓存操作
- ✅ **用户体验友好**: 管理后台操作无感知验证
- ✅ **灵活集成**: 支持 API Key 用于自动化场景
- ✅ **日志监控**: 记录所有访问尝试便于审计

这套机制在保证安全性的同时，最大程度保持了易用性和灵活性。
