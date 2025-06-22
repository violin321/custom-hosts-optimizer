# 自定义域名管理指南 - 优选自定义host

## 功能说明

**✨ 最新更新：已移除 API Key 认证，现在可以直接使用所有功能！**

自定义域名管理功能允许您：

- 添加自定义域名（单个添加或批量添加）
- 删除自定义域名
- 执行 IP 优选操作
- 查看自定义域名列表

## 🚀 新功能：批量添加域名

现在支持批量添加多个域名，大大提高了操作效率！

### 批量添加格式支持

支持以下多种格式，每行一个域名：

1. **纯域名格式**：
   ```
   example1.com
   example2.com
   example3.com
   ```

2. **域名 + 描述（逗号分隔）**：
   ```
   github.com,GitHub 官网
   google.com,Google 搜索
   stackoverflow.com,技术问答网站
   ```

3. **域名 + 描述（空格分隔）**：
   ```
   youtube.com 视频网站
   twitter.com 社交媒体
   linkedin.com 职业社交平台
   ```

### 使用方法

1. **打开应用**：访问您部署的域名
2. **切换到"自定义域名"选项卡**
3. **选择添加方式**：
   - **单个添加**：在"单个添加域名"区域输入域名和描述
   - **批量添加**：在"批量添加域名"的文本框中粘贴域名列表
4. **点击相应的添加按钮**

## API 使用说明

### 获取自定义域名列表
```bash
curl "https://your-worker.your-domain.workers.dev/api/custom-domains"
```

### 添加单个自定义域名
```bash
curl -X POST "https://your-worker.your-domain.workers.dev/api/custom-domains" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "description": "示例域名"}'
```

### 批量添加自定义域名
```bash
curl -X POST "https://your-worker.your-domain.workers.dev/api/custom-domains/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "domains": [
      {"domain": "example1.com", "description": "示例网站1"},
      {"domain": "example2.com", "description": "示例网站2"},
      {"domain": "example3.com"}
    ]
  }'
```

### 删除自定义域名
```bash
curl -X DELETE "https://your-worker.your-domain.workers.dev/api/custom-domains/example.com"
```

### IP 优选
```bash
curl -X POST "https://your-worker.your-domain.workers.dev/api/optimize/example.com"
```

## 批量添加 API 响应格式

批量添加接口会返回详细的操作结果：

```json
{
  "message": "Batch operation completed",
  "added": 5,
  "failed": 1,
  "results": [
    {"domain": "example1.com", "status": "success"},
    {"domain": "example2.com", "status": "success"}
  ],
  "errors": [
    {"domain": "invalid-domain", "error": "Invalid domain format"}
  ]
}
```

## 常见问题

### Q: 为什么移除了 API Key 认证？
A: 为了提高易用性，让用户可以更方便地使用自定义域名功能。如果您需要在生产环境中保护此功能，建议在网络层面进行访问控制。

### Q: 批量添加有数量限制吗？
A: 目前没有硬性数量限制，但建议单次批量添加不超过 100 个域名，以确保操作稳定性。

### Q: 批量添加时部分域名失败怎么办？
A: 系统会返回详细的成功和失败列表。您可以查看错误信息，修正有问题的域名后重新添加。

### Q: 支持哪些域名格式？
A: 支持标准的域名格式，如：
- `example.com`
- `subdomain.example.com`
- `example.co.uk`

### Q: 如何查看批量添加的详细结果？
A: 批量添加完成后，页面会显示成功和失败的数量。详细的错误信息可以在浏览器的开发者控制台中查看。

## 示例

以下是一个批量添加常用网站的示例：

```
github.com,GitHub 代码托管
stackoverflow.com,技术问答
developer.mozilla.org,MDN 文档
npmjs.com,NPM 包管理
cloudflare.com,CDN 服务
vercel.com,部署平台
netlify.com,静态站点部署
digitalocean.com,云服务器
aws.amazon.com,亚马逊云服务
google.com,Google 搜索
```

将上述内容复制到批量添加文本框中，点击"批量添加"即可一次性添加所有域名！
