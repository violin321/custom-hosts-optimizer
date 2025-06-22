#!/bin/bash

# GitHub Hosts 一键部署脚本
# 部署到 Cloudflare Workers

set -e

echo "🚀 GitHub Hosts 部署脚本"
echo "========================"

# 检查是否安装了必要工具
if ! command -v pnpm &> /dev/null; then
    echo "❌ 错误: 未找到 pnpm，请先安装 pnpm"
    exit 1
fi

# 检查是否已登录 Cloudflare
echo "📋 检查 Cloudflare 登录状态..."
if ! pnpm exec wrangler auth whoami &> /dev/null; then
    echo "🔐 需要登录 Cloudflare 账户"
    pnpm exec wrangler auth login
fi

# 安装依赖
echo "📦 安装依赖..."
pnpm install

# 创建 KV 命名空间（如果不存在）
echo "🗄️  设置 KV 命名空间..."

# 检查当前配置
if grep -q "id = \"b47d7f8c9df14032b4fd6c65b2f81e63\"" wrangler.toml; then
    echo "⚠️  检测到默认的 KV 命名空间 ID，建议创建新的命名空间"
    read -p "是否创建新的 KV 命名空间? (y/N): " create_kv
    
    if [[ $create_kv =~ ^[Yy]$ ]]; then
        echo "🆕 创建新的 KV 命名空间..."
        kv_output=$(pnpm exec wrangler kv:namespace create "github_hosts")
        
        # 提取命名空间 ID
        namespace_id=$(echo "$kv_output" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
        
        if [ -n "$namespace_id" ]; then
            # 更新 wrangler.toml
            sed -i "s/id = \"b47d7f8c9df14032b4fd6c65b2f81e63\"/id = \"$namespace_id\"/" wrangler.toml
            echo "✅ 已更新 KV 命名空间 ID: $namespace_id"
        else
            echo "❌ 无法获取命名空间 ID，请手动设置"
        fi
    fi
else
    echo "✅ KV 命名空间配置看起来正常"
fi

# 设置 API Key
echo "🔑 设置 API Key..."
if pnpm exec wrangler secret list | grep -q "API_KEY"; then
    echo "✅ API_KEY 已存在"
    read -p "是否要更新 API_KEY? (y/N): " update_key
    if [[ $update_key =~ ^[Yy]$ ]]; then
        pnpm exec wrangler secret put API_KEY
    fi
else
    echo "🆕 设置新的 API Key（用于管理自定义域名）"
    pnpm exec wrangler secret put API_KEY
fi

# 询问是否启用优选功能
echo "⚡ 优选功能配置..."
read -p "是否在定时任务中启用 IP 优选功能? (y/N): " enable_opt

if [[ $enable_opt =~ ^[Yy]$ ]]; then
    if pnpm exec wrangler secret list | grep -q "ENABLE_OPTIMIZATION"; then
        pnpm exec wrangler secret delete ENABLE_OPTIMIZATION
    fi
    echo "true" | pnpm exec wrangler secret put ENABLE_OPTIMIZATION
    echo "✅ 已启用定时任务优选功能"
else
    if pnpm exec wrangler secret list | grep -q "ENABLE_OPTIMIZATION"; then
        pnpm exec wrangler secret delete ENABLE_OPTIMIZATION
    fi
    echo "false" | pnpm exec wrangler secret put ENABLE_OPTIMIZATION
    echo "✅ 已禁用定时任务优选功能"
fi

# 部署
echo "🚀 开始部署..."
pnpm run deploy

echo ""
echo "🎉 部署完成！"
echo ""

# 获取部署的 URL
worker_url=$(pnpm exec wrangler deployments list --json 2>/dev/null | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$worker_url" ]; then
    echo "🌐 你的 Worker URL: $worker_url"
    echo ""
    echo "📋 快速测试命令："
    echo "   获取 hosts 文件: curl $worker_url/hosts"
    echo "   获取 JSON 数据:  curl $worker_url/hosts.json"
    echo "   启用优选功能:    curl \"$worker_url/hosts?optimize=true\""
    echo ""
    echo "🔧 管理 API 示例："
    echo "   添加自定义域名: curl -X POST \"$worker_url/api/custom-domains?key=YOUR_API_KEY\" \\"
    echo "                    -H \"Content-Type: application/json\" \\"
    echo "                    -d '{\"domain\": \"example.com\", \"description\": \"测试域名\"}'"
    echo ""
    echo "📚 更多信息请查看 DEPLOYMENT.md 文件"
else
    echo "⚠️  无法获取 Worker URL，请在 Cloudflare 控制台查看"
fi

echo ""
echo "✨ 享受你的 GitHub 加速服务吧！"
