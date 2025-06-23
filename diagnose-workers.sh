#!/bin/bash

echo "🔍 Cloudflare Workers 诊断脚本"
echo "================================"

# 检查是否已登录
echo "1. 检查 Cloudflare 登录状态..."
if pnpm exec wrangler whoami &> /dev/null; then
    echo "✅ 已登录 Cloudflare"
    pnpm exec wrangler whoami
else
    echo "❌ 未登录 Cloudflare"
    echo "请先运行: pnpm exec wrangler login"
    exit 1
fi

echo ""
echo "2. 检查 KV Namespaces..."
echo "现有的 KV Namespaces:"
pnpm exec wrangler kv:namespace list

echo ""
echo "3. 检查配置文件..."
if [ -f "wrangler.toml" ]; then
    echo "✅ wrangler.toml 存在"
    echo "KV 绑定配置:"
    grep -A 3 "kv_namespaces" wrangler.toml || echo "❌ 未找到 KV 绑定配置"
else
    echo "❌ wrangler.toml 不存在"
fi

echo ""
echo "4. 尝试本地开发服务器..."
echo "提示: 如果本地开发正常但线上异常，请检查以下项目:"
echo "- KV namespace 是否在线上存在"
echo "- KV 数据是否为空"
echo "- 网络请求在 Workers 环境中的限制"

echo ""
echo "5. 推荐调试步骤:"
echo "a) 先确保本地开发正常:"
echo "   pnpm run dev"
echo ""
echo "b) 检查部署配置:"
echo "   pnpm exec wrangler deploy --dry-run"
echo ""
echo "c) 部署到线上:"
echo "   pnpm exec wrangler deploy"
echo ""
echo "d) 查看线上日志:"
echo "   pnpm exec wrangler tail"
echo ""
echo "e) 测试线上服务:"
echo "   curl https://your-worker.your-subdomain.workers.dev/debug"

echo ""
echo "6. 常见问题解决方案:"
echo "- 如果 KV 不存在，创建它: pnpm exec wrangler kv:namespace create custom_hosts"
echo "- 如果数据为空，可以通过管理后台添加域名"
echo "- 如果还有问题，可以查看 Workers 控制台的实时日志"
