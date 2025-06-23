# 管理后台地址配置指南

本指南详细说明如何自定义管理后台的访问地址，提高安全性。

## 🔐 为什么要自定义后台地址？

1. **安全性**：默认路径容易被猜测和攻击
2. **隐私性**：避免暴露管理入口
3. **防扫描**：减少自动化扫描工具的发现概率

## 📝 修改步骤详解

### 第一步：准备工作

1. **Fork 仓库**
   ```bash
   # 在 GitHub 上点击 Fork 按钮
   # 然后克隆你的 fork
   git clone https://github.com/your-username/custom-hosts-optimizer.git
   cd custom-hosts-optimizer
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

### 第二步：修改源代码

打开 `src/index.ts` 文件，需要修改两处地方：

#### 位置 1：管理后台路由定义

**查找这行代码（大约在第 1329 行附近）：**
```typescript
// 管理后台路由
app.route("/admin-x7k9m3q2", admin.use("*", adminAuth))
```

**修改为您的自定义路径：**
```typescript
// 管理后台路由 - 自定义安全路径
app.route("/your-secret-admin-path", admin.use("*", adminAuth))
```

#### 位置 2：域名查询路由排除

**查找这行代码（大约在第 1332 行附近）：**
```typescript
if (path !== "/" && !path.startsWith("/api/") && !path.startsWith("/hosts") && path !== "/favicon.ico" && !path.startsWith("/admin-x7k9m3q2")) {
```

**修改为：**
```typescript
if (path !== "/" && !path.startsWith("/api/") && !path.startsWith("/hosts") && path !== "/favicon.ico" && !path.startsWith("/your-secret-admin-path")) {
```

### 第三步：验证修改

1. **检查语法**
   ```bash
   npm run build
   ```

2. **本地测试**
   ```bash
   npm run dev
   ```
   
   访问 `http://localhost:8787/your-secret-admin-path` 验证是否正常

### 第四步：部署到生产环境

```bash
npm run deploy
```

部署成功后，访问：`https://your-worker-url.workers.dev/your-secret-admin-path`

## 🛡️ 安全最佳实践

### 路径命名规范

**✅ 推荐的路径格式：**
```
/mgmt-abc123xyz
/secure-panel-456def
/admin-x9k2m4q7
/control-789secure
/backend-xyz456abc
```

**❌ 避免的路径：**
```
/admin
/manage
/backend
/control
/dashboard
/panel
```

### 路径要求

1. **长度**：建议 15-25 个字符
2. **组成**：字母 + 数字 + 连字符
3. **格式**：必须以 `/` 开头
4. **复杂度**：包含随机字符，避免规律

### 路径生成器

您可以使用以下方法生成安全路径：

```bash
# 方法 1：使用 openssl
echo "/admin-$(openssl rand -hex 8)"

# 方法 2：使用 uuidgen（macOS/Linux）
echo "/mgmt-$(uuidgen | tr '[:upper:]' '[:lower:]' | cut -d'-' -f1)"

# 方法 3：在线生成器
# 访问：https://www.random.org/strings/
```

## 🔄 定期更换策略

### 建议更换频率

- **高安全需求**：每月更换
- **中等安全需求**：每季度更换
- **低安全需求**：每半年更换

### 更换流程

1. 生成新的安全路径
2. 修改源代码
3. 重新部署应用
4. 更新书签和文档
5. 通知相关人员

## ⚠️ 注意事项

### 修改前备份

```bash
# 备份当前配置
cp src/index.ts src/index.ts.backup

# 记录当前后台地址
echo "当前后台地址: /admin-x7k9m3q2" > admin_path_backup.txt
```

### 避免常见错误

1. **忘记修改第二处代码**
   - 必须同时修改路由定义和路径排除
   - 否则会导致路由冲突

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

### 故障恢复

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

## 📊 安全检查清单

- [ ] 路径包含随机字符
- [ ] 路径长度适中（15-25字符）
- [ ] 避免了常见词汇
- [ ] 修改了两处代码位置
- [ ] 本地测试通过
- [ ] 部署成功
- [ ] 新地址可正常访问
- [ ] 备份了原始配置
- [ ] 更新了书签和文档

## 🆘 故障排除

### 常见问题

**Q: 修改后提示 404 错误**
A: 检查路径是否正确，确保同时修改了两处代码

**Q: 部署失败**
A: 检查语法错误，运行 `npm run build` 查看详细错误

**Q: 可以访问但功能异常**
A: 检查认证中间件是否正确配置

**Q: 忘记了新的后台地址**
A: 查看部署的源代码或重新修改为已知地址

### 获取帮助

如果遇到问题，请：

1. 查看 [Issues](https://github.com/Yan-nian/custom-hosts-optimizer/issues)
2. 提供详细的错误信息
3. 包含修改的代码片段
4. 说明部署环境和配置

## 📚 相关文档

- [手动部署指南](MANUAL_DEPLOY.md)
- [安全配置指南](ADMIN_SECURITY.md)
- [API 安全说明](API_SECURITY.md)
