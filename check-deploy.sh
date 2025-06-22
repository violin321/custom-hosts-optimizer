#!/bin/bash

# 部署前检查脚本

echo "🔍 部署前检查..."
echo "=================="

# 检查 Node.js 版本
echo "📋 Node.js 版本:"
node --version

# 检查 pnpm 版本  
echo "📋 pnpm 版本:"
pnpm --version

# 检查 wrangler 版本
echo "📋 Wrangler 版本:"
pnpm exec wrangler --version

# 检查是否已登录 Cloudflare
echo "🔐 Cloudflare 登录状态:"
if pnpm exec wrangler auth whoami &> /dev/null; then
    echo "✅ 已登录: $(pnpm exec wrangler auth whoami)"
else
    echo "❌ 未登录 Cloudflare"
    echo "请运行: pnpm exec wrangler auth login"
fi

# 检查配置文件
echo "📄 配置文件检查:"
if [ -f "wrangler.toml" ]; then
    echo "✅ wrangler.toml 存在"
    
    # 检查 KV 绑定
    if grep -q "binding = \"github_hosts\"" wrangler.toml; then
        echo "✅ KV 绑定配置正确"
        kv_id=$(grep 'id = ' wrangler.toml | head -1 | cut -d'"' -f2)
        echo "   KV ID: $kv_id"
    else
        echo "❌ KV 绑定配置缺失"
    fi
    
    # 检查定时任务
    if grep -q "crons" wrangler.toml; then
        echo "✅ 定时任务配置存在"
    else
        echo "⚠️  定时任务配置缺失"
    fi
else
    echo "❌ wrangler.toml 不存在"
fi

# 检查源代码
echo "📝 源代码检查:"
if [ -f "src/index.ts" ]; then
    echo "✅ 主入口文件存在"
else
    echo "❌ 主入口文件缺失"
fi

if [ -d "public" ]; then
    echo "✅ 静态资源目录存在"
    file_count=$(find public -type f | wc -l)
    echo "   包含 $file_count 个文件"
else
    echo "❌ 静态资源目录缺失"
fi

# 检查依赖
echo "📦 依赖检查:"
if [ -f "package.json" ]; then
    echo "✅ package.json 存在"
    if [ -d "node_modules" ]; then
        echo "✅ 依赖已安装"
    else
        echo "⚠️  依赖未安装，请运行: pnpm install"
    fi
else
    echo "❌ package.json 不存在"
fi

# 检查 secrets
echo "🔐 Secrets 检查:"
if pnpm exec wrangler auth whoami &> /dev/null; then
    if pnpm exec wrangler secret list | grep -q "API_KEY"; then
        echo "✅ API_KEY 已配置"
    else
        echo "⚠️  API_KEY 未配置"
        echo "   请运行: pnpm exec wrangler secret put API_KEY"
    fi
    
    if pnpm exec wrangler secret list | grep -q "ENABLE_OPTIMIZATION"; then
        echo "✅ ENABLE_OPTIMIZATION 已配置"
    else
        echo "ℹ️  ENABLE_OPTIMIZATION 未配置（可选）"
    fi
else
    echo "❌ 无法检查 secrets - 请先登录 Cloudflare"
fi

echo ""
echo "🚀 准备部署?"
echo "如果所有检查都通过，可以运行: ./deploy.sh 或 pnpm run deploy"
