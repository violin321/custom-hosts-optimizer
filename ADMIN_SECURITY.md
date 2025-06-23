# 管理后台安全访问说明

## 🔐 后台访问方式

为了确保管理后台的安全性，后台入口已完全从前台页面隐藏。

### 访问地址

管理后台的访问地址为：
```
https://your-domain.com/admin-x7k9m3q2
```

### 认证信息

- **用户名**: `admin`
- **密码**: `admin123`

### 访问步骤

1. 在浏览器中输入管理后台地址：`/admin-x7k9m3q2`
2. 系统会显示登录页面
3. 输入用户名和密码
4. 点击"登录"按钮即可进入管理后台

### 安全特性

✅ **隐蔽性**: 管理后台入口已从前台页面完全移除，普通用户无法发现后台地址

✅ **复杂路径**: 使用难以猜测的路径 `/admin-x7k9m3q2`，降低被暴力破解的风险

✅ **认证保护**: 即使知道后台地址，仍需要正确的用户名和密码才能访问

✅ **美观界面**: 提供友好的登录界面，支持现代浏览器

### 修改认证信息

如需修改用户名和密码，请编辑 `src/index.ts` 文件中的以下代码：

```typescript
// 预设的管理员凭据
const validUsername = "admin";      // 修改用户名
const validPassword = "admin123";   // 修改密码
```

### 修改访问路径

如需修改管理后台访问路径，请同时修改以下两处：

1. 登录表单中的跳转地址（`src/index.ts` 第131行）：
```typescript
const adminUrl = '/your-new-admin-path?user=' + encodeURIComponent(username) + '&pass=' + encodeURIComponent(password);
```

2. 路由绑定（`src/index.ts` 第488行）：
```typescript
app.route("/your-new-admin-path", admin.use("*", adminAuth))
```

### 部署说明

修改后请重新部署 Cloudflare Worker：

```bash
# 方式1: 使用脚本部署
./deploy.sh

# 方式2: 使用 wrangler 部署
npx wrangler deploy
```

### 注意事项

⚠️ **保密**: 请务必保管好管理后台的访问地址和认证信息

⚠️ **定期更新**: 建议定期更换用户名、密码和访问路径

⚠️ **访问记录**: 建议监控管理后台的访问日志，发现异常及时处理

## 🛡️ 进一步安全建议

1. **IP 白名单**: 可考虑添加 IP 白名单功能，限制只有特定 IP 可以访问管理后台
2. **访问频率限制**: 添加访问频率限制，防止暴力破解
3. **会话管理**: 实现会话超时机制
4. **双因素认证**: 对于高安全要求场景，可考虑实现 2FA
