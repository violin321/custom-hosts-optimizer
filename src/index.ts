import { Hono } from "hono"
import { basicAuth } from "hono/basic-auth"
import {
  formatHostsFile,
  getDomainData,
  getHostsData,
  resetHostsData,
  getCustomDomains,
  addCustomDomain,
  removeCustomDomain,
  optimizeCustomDomain,
  fetchCustomDomainsData,
  fetchLatestHostsData,
} from "./services/hosts"
import { handleSchedule } from "./scheduled"
import { Bindings } from "./types"

const app = new Hono<{ Bindings: Bindings }>()

// 管理员认证中间件 - 使用URL参数验证
const adminAuth = async (c: any, next: any) => {
  const username = c.req.query("user");
  const password = c.req.query("pass");
  
  // 预设的管理员凭据
  const validUsername = "admin";
  const validPassword = "admin123";

  // 检查URL参数中的凭据
  if (username === validUsername && password === validPassword) {
    // 认证成功，继续执行后续中间件
    return await next();
  }

  // 认证失败，返回登录页面
  const loginHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理后台登录</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
        }
        .login-container {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            width: 100%;
            max-width: 400px;
        }
        .login-title {
            text-align: center;
            margin-bottom: 2rem;
            color: #333;
        }
        .form-group {
            margin-bottom: 1rem;
        }
        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: #555;
        }
        input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 1rem;
            box-sizing: border-box;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
        }
        .login-btn {
            width: 100%;
            padding: 0.75rem;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 1rem;
            cursor: pointer;
            margin-top: 1rem;
        }
        .login-btn:hover {
            background: #5a6fd8;
        }
        .error {
            color: #e74c3c;
            margin-top: 1rem;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <h2 class="login-title">🔐 管理后台登录</h2>
        <form id="loginForm">
            <div class="form-group">
                <label for="username">用户名:</label>
                <input type="text" id="username" name="username" value="admin" required>
            </div>
            <div class="form-group">
                <label for="password">密码:</label>
                <input type="password" id="password" name="password" placeholder="请输入密码" required>
            </div>
            <button type="submit" class="login-btn">登录</button>
            <div class="error" id="error" style="display: none;">用户名或密码错误</div>
        </form>
    </div>
    <script>
        document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            // 构建带认证参数的URL
            const adminUrl = '/admin-x7k9m3q2?user=' + encodeURIComponent(username) + '&pass=' + encodeURIComponent(password);
            window.location.href = adminUrl;
        });
        
        // 检查是否有错误参数
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('error') === 'auth') {
            document.getElementById('error').style.display = 'block';
        }
    </script>
</body>
</html>`;
  
  return c.html(loginHtml);
}

// 管理后台路由组
const admin = new Hono<{ Bindings: Bindings }>()

// 管理后台主页
admin.get("/", async (c) => {
  const adminHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>自定义域名管理后台</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        .container { 
            max-width: 1400px; 
            margin: 0 auto; 
            padding: 20px; 
        }
        .header { 
            background: rgba(255,255,255,0.95); 
            padding: 30px; 
            border-radius: 16px; 
            margin-bottom: 24px; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            text-align: center;
        }
        .header h1 { 
            color: #2d3748; 
            margin-bottom: 8px; 
            font-size: 2.2rem;
            font-weight: 700;
        }
        .header p { 
            color: #718096; 
            font-size: 1.1rem;
        }
        .card { 
            background: rgba(255,255,255,0.95); 
            padding: 24px; 
            border-radius: 16px; 
            margin-bottom: 24px; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }
        .card h3 {
            color: #2d3748;
            margin-bottom: 20px;
            font-size: 1.3rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .form-group { margin-bottom: 16px; }
        .form-group label { 
            display: block; 
            margin-bottom: 6px; 
            font-weight: 600; 
            color: #4a5568;
            font-size: 0.95rem;
        }
        .form-group textarea { 
            width: 100%; 
            padding: 12px 16px; 
            border: 2px solid #e2e8f0; 
            border-radius: 12px; 
            font-size: 14px; 
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            transition: all 0.2s ease;
            resize: vertical;
            line-height: 1.5;
        }
        .form-group textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .btn { 
            padding: 12px 24px; 
            border: none; 
            border-radius: 12px; 
            cursor: pointer; 
            font-size: 14px; 
            font-weight: 600;
            margin-right: 12px; 
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .btn-primary { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-primary:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        .btn-danger { 
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); 
            color: white; 
            box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
        }
        .btn-danger:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 6px 20px rgba(255, 107, 107, 0.6);
        }
        .btn-success { 
            background: linear-gradient(135deg, #51cf66 0%, #40c057 100%); 
            color: white; 
            box-shadow: 0 4px 15px rgba(81, 207, 102, 0.4);
        }
        .btn-success:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 6px 20px rgba(81, 207, 102, 0.6);
        }
        .btn-info {
            background: linear-gradient(135deg, #339af0 0%, #228be6 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(51, 154, 240, 0.4);
        }
        .btn-info:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(51, 154, 240, 0.6);
        }
        .domain-list { 
            max-height: 500px; 
            overflow-y: auto; 
            background: #f8fafc;
            border-radius: 12px;
            padding: 16px;
        }
        .domain-item { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 16px; 
            background: white;
            border-radius: 12px;
            margin-bottom: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            transition: all 0.2s ease;
        }
        .domain-item:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .domain-info { flex: 1; }
        .domain-info strong {
            color: #2d3748;
            font-size: 1.1rem;
        }
        .domain-info small {
            color: #718096;
            font-size: 0.85rem;
        }
        .domain-actions { 
            display: flex; 
            gap: 8px; 
        }
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            margin-bottom: 24px; 
        }
        .stat-card { 
            background: rgba(255,255,255,0.95); 
            padding: 24px; 
            border-radius: 16px; 
            text-align: center; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            transition: all 0.2s ease;
        }
        .stat-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 40px rgba(0,0,0,0.15);
        }
        .stat-number { 
            font-size: 2.5em; 
            font-weight: 700; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .stat-label { 
            color: #718096; 
            margin-top: 8px; 
            font-weight: 500;
        }
        .alert { 
            padding: 16px 20px; 
            margin-bottom: 20px; 
            border-radius: 12px; 
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .alert-success { 
            background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); 
            color: #155724; 
            border: 1px solid #c3e6cb; 
        }
        .alert-error { 
            background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%); 
            color: #721c24; 
            border: 1px solid #f5c6cb; 
        }
        .batch-input { 
            min-height: 120px; 
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        }
        .debug-section {
            background: #f8fafc;
            border-radius: 12px;
            padding: 20px;
            margin-top: 16px;
        }
        .debug-item {
            background: white;
            padding: 12px;
            border-radius: 8px;
            margin: 8px 0;
            border-left: 4px solid #667eea;
        }
        .debug-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 16px;
            margin-top: 16px;
        }
        .debug-card {
            background: white;
            padding: 16px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .debug-card h4 {
            color: #2d3748;
            margin-bottom: 12px;
            font-size: 1.1rem;
        }
        .debug-list {
            max-height: 200px;
            overflow-y: auto;
            font-family: 'SFMono-Regular', Consolas, monospace;
            font-size: 0.85rem;
            line-height: 1.4;
        }
        .controls-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 12px;
        }
        .controls-left {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }
        @media (max-width: 768px) {
            .container { padding: 16px; }
            .controls-row { flex-direction: column; align-items: stretch; }
            .controls-left { justify-content: center; }
            .stats { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
            .debug-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛠️ 自定义域名管理后台</h1>
            <p>管理和配置自定义域名，优化访问性能</p>
        </div>

        <div id="alert-container"></div>

        <!-- 统计信息 -->
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number" id="total-domains">-</div>
                <div class="stat-label">总域名数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="github-domains">-</div>
                <div class="stat-label">GitHub 域名</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="custom-domains">-</div>
                <div class="stat-label">自定义域名</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="resolved-domains">-</div>
                <div class="stat-label">已解析域名</div>
            </div>
        </div>

        <!-- 批量添加域名 -->
        <div class="card">
            <h3>📝 批量管理域名</h3>
            <div class="form-group">
                <label for="batch-domains">域名列表 (每行一个，格式: 域名|描述):</label>
                <textarea id="batch-domains" class="batch-input" placeholder="example1.com|第一个域名&#10;example2.com|第二个域名&#10;example3.com"></textarea>
            </div>
            <button class="btn btn-primary" onclick="batchAddDomains()">📥 批量添加</button>
        </div>

        <!-- 域名列表与调试信息 -->
        <div class="card">
            <h3>📋 域名管理与调试</h3>
            <div class="controls-row">
                <div class="controls-left">
                    <button class="btn btn-success" onclick="loadDomains()">🔄 刷新列表</button>
                    <button class="btn btn-info" onclick="loadDebugInfo()">🔍 调试信息</button>
                </div>
                <button class="btn btn-danger" onclick="clearAllCustomDomains()">🗑️ 清空自定义域名</button>
            </div>
            <div class="domain-list" id="domain-list">
                <p>加载中...</p>
            </div>
            
            <div id="debug-section" class="debug-section" style="display: none;">
                <h4>🔍 调试信息</h4>
                <div class="debug-grid">
                    <div class="debug-card">
                        <h4>存储的域名 (<span id="stored-count">0</span>)</h4>
                        <div id="stored-domains" class="debug-list"></div>
                    </div>
                    <div class="debug-card">
                        <h4>已解析域名 - 优化模式 (<span id="resolved-opt-count">0</span>)</h4>
                        <div id="resolved-opt-domains" class="debug-list"></div>
                    </div>
                    <div class="debug-card">
                        <h4>已解析域名 - 标准模式 (<span id="resolved-std-count">0</span>)</h4>
                        <div id="resolved-std-domains" class="debug-list"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // 显示通知
        function showAlert(message, type = 'success') {
            const container = document.getElementById('alert-container');
            const alert = document.createElement('div');
            alert.className = \`alert alert-\${type}\`;
            alert.innerHTML = \`
                <span>\${message}</span>
            \`;
            container.appendChild(alert);
            setTimeout(() => alert.remove(), 5000);
        }

        // 加载统计信息
        async function loadStats() {
            try {
                const response = await fetch('/hosts.json');
                const data = await response.json();
                document.getElementById('total-domains').textContent = data.total;
                document.getElementById('github-domains').textContent = data.github.length;
                document.getElementById('custom-domains').textContent = data.custom.length;
                document.getElementById('resolved-domains').textContent = data.custom.length;
            } catch (error) {
                console.error('加载统计信息失败:', error);
            }
        }

        // 加载调试信息
        async function loadDebugInfo() {
            try {
                const debugSection = document.getElementById('debug-section');
                debugSection.style.display = debugSection.style.display === 'none' ? 'block' : 'none';
                
                if (debugSection.style.display === 'block') {
                    const response = await fetch('/debug');
                    const data = await response.json();
                    
                    document.getElementById('stored-count').textContent = data.stored_count;
                    document.getElementById('resolved-opt-count').textContent = data.resolved_count_opt;
                    document.getElementById('resolved-std-count').textContent = data.resolved_count_no_opt;
                    
                    document.getElementById('stored-domains').innerHTML = 
                        data.stored_domains.map(domain => \`<div>\${domain}</div>\`).join('');
                    
                    document.getElementById('resolved-opt-domains').innerHTML = 
                        data.resolved_with_optimization.map(item => \`<div>\${item.ip} → \${item.domain}</div>\`).join('');
                    
                    document.getElementById('resolved-std-domains').innerHTML = 
                        data.resolved_without_optimization.map(item => \`<div>\${item.ip} → \${item.domain}</div>\`).join('');
                }
            } catch (error) {
                showAlert('加载调试信息失败: ' + error.message, 'error');
            }
        }

        // 加载域名列表
        async function loadDomains() {
            try {
                const response = await fetch('/api/custom-domains');
                const domainsData = await response.json();
                const container = document.getElementById('domain-list');
                
                // 将对象转换为数组
                const domains = Object.entries(domainsData).map(([domain, info]) => ({
                    domain,
                    ...info
                }));
                
                if (domains.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #718096; padding: 40px;">暂无自定义域名</p>';
                    return;
                }

                container.innerHTML = domains.map(domain => {
                    // 安全地处理时间戳
                    let timeStr = '未知时间';
                    if (domain.timestamp && typeof domain.timestamp === 'number' && domain.timestamp > 0) {
                        try {
                            timeStr = new Date(domain.timestamp).toLocaleString();
                        } catch (e) {
                            timeStr = '无效时间';
                        }
                    }
                    
                    return \`
                    <div class="domain-item">
                        <div class="domain-info">
                            <strong>\${domain.domain}</strong>
                            \${domain.description ? \`<br><small>\${domain.description}</small>\` : ''}
                            <br><small>IP: \${domain.ip || '未解析'} | 添加时间: \${timeStr}</small>
                        </div>
                        <div class="domain-actions">
                            <button class="btn btn-success btn-small" onclick="optimizeDomain('\${domain.domain}')">🚀 优选</button>
                            <button class="btn btn-danger btn-small" onclick="removeDomain('\${domain.domain}')">🗑️ 删除</button>
                        </div>
                    </div>
                    \`;
                }).join('');
            } catch (error) {
                showAlert('加载域名列表失败: ' + error.message, 'error');
            }
        }

        // 批量添加域名
        async function batchAddDomains() {
            const input = document.getElementById('batch-domains').value.trim();
            if (!input) {
                showAlert('请输入域名列表', 'error');
                return;
            }

            const lines = input.split('\\n').filter(line => line.trim());
            const domains = lines.map(line => {
                const parts = line.split('|');
                return {
                    domain: parts[0]?.trim(),
                    description: parts[1]?.trim() || ''
                };
            }).filter(item => item.domain);

            if (domains.length === 0) {
                showAlert('没有有效的域名', 'error');
                return;
            }

            try {
                const response = await fetch('/api/custom-domains/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ domains })
                });

                const result = await response.json();
                if (response.ok) {
                    showAlert(\`批量操作完成: 成功 \${result.added} 个，失败 \${result.failed} 个\`);
                    if (result.errors.length > 0) {
                        console.log('失败的域名:', result.errors);
                    }
                    document.getElementById('batch-domains').value = '';
                    loadDomains();
                    loadStats();
                } else {
                    showAlert(result.error || '批量添加失败', 'error');
                }
            } catch (error) {
                showAlert('批量添加失败: ' + error.message, 'error');
            }
        }

        // 删除域名
        async function removeDomain(domain) {
            if (!confirm(\`确定要删除域名 \${domain} 吗？\`)) return;

            try {
                const response = await fetch(\`/api/custom-domains/\${encodeURIComponent(domain)}\`, {
                    method: 'DELETE'
                });

                const result = await response.json();
                if (response.ok) {
                    showAlert(\`域名 \${domain} 删除成功\`);
                    loadDomains();
                    loadStats();
                } else {
                    showAlert(result.error || '删除失败', 'error');
                }
            } catch (error) {
                showAlert('删除域名失败: ' + error.message, 'error');
            }
        }

        // 优选域名
        async function optimizeDomain(domain) {
            showAlert(\`正在优选域名 \${domain}...\`);
            
            try {
                const response = await fetch(\`/api/optimize/\${encodeURIComponent(domain)}\`, {
                    method: 'POST'
                });

                const result = await response.json();
                if (response.ok) {
                    showAlert(\`域名 \${domain} 优选完成，最佳IP: \${result.bestIp}，响应时间: \${result.responseTime}ms\`);
                    loadDomains();
                } else {
                    showAlert(result.error || '优选失败', 'error');
                }
            } catch (error) {
                showAlert('优选域名失败: ' + error.message, 'error');
            }
        }

        // 清空所有自定义域名
        async function clearAllCustomDomains() {
            if (!confirm('确定要清空所有自定义域名吗？此操作不可恢复！')) return;

            try {
                const response = await fetch('/api/custom-domains', {
                    method: 'DELETE'
                });

                if (response.ok) {
                    const result = await response.json();
                    showAlert(\`清空完成，删除了 \${result.count} 个域名\`);
                } else {
                    const error = await response.json();
                    showAlert(error.error || '清空操作失败', 'error');
                }
                
                loadDomains();
                loadStats();
            } catch (error) {
                showAlert('清空操作失败: ' + error.message, 'error');
            }
        }

        // 页面加载时初始化
        document.addEventListener('DOMContentLoaded', () => {
            loadStats();
            loadDomains();
        });

        // 回车键提交
        document.getElementById('batch-domains').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                batchAddDomains();
            }
        });
    </script>
</body>
</html>`

  return c.html(adminHtml)
})

// 将管理后台路由组应用到应用中，并使用认证中间件
app.route("/admin-x7k9m3q2", admin.use("*", adminAuth))

app.get("/", async (c) => {
  const html = await c.env.ASSETS.get("index.html")
  if (!html) {
    return c.text("Template not found", 404)
  }

  return c.html(html)
})

app.get("/hosts.json", async (c) => {
  const useOptimization = c.req.query("optimize") === "true"
  const includeCustom = c.req.query("custom") !== "false"

  const githubData = await getHostsData(c.env, useOptimization)
  let customData: any[] = []

  if (includeCustom) {
    customData = await fetchCustomDomainsData(c.env, useOptimization)
  }

  return c.json({
    github: githubData,
    custom: customData,
    total: githubData.length + customData.length,
  })
})

app.get("/hosts", async (c) => {
  const useOptimization = c.req.query("optimize") === "true"
  const includeCustom = c.req.query("custom") !== "false"

  const githubData = await getHostsData(c.env, useOptimization)
  let customData: any[] = []

  if (includeCustom) {
    customData = await fetchCustomDomainsData(c.env, useOptimization)
  }

  const allData = [...githubData, ...customData]
  const hostsContent = formatHostsFile(allData)
  return c.text(hostsContent)
})

// 自定义域名管理 API
app.get("/api/custom-domains", async (c) => {
  const customDomains = await getCustomDomains(c.env)
  return c.json(customDomains)
})

app.post("/api/custom-domains", async (c) => {

  try {
    const body = await c.req.json()
    const { domain, description } = body

    if (!domain || typeof domain !== "string") {
      return c.json({ error: "Domain is required" }, 400)
    }

    // 简单的域名格式验证
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
      return c.json({ error: "Invalid domain format" }, 400)
    }

    const success = await addCustomDomain(c.env, domain, description)

    if (success) {
      return c.json({ message: "Domain added successfully", domain })
    } else {
      return c.json({ error: "Failed to add domain" }, 500)
    }
  } catch (error) {
    return c.json({ error: "Invalid request body" }, 400)
  }
})

// 批量添加自定义域名 API
app.post("/api/custom-domains/batch", async (c) => {
  try {
    const body = await c.req.json()
    const { domains } = body

    if (!domains || !Array.isArray(domains)) {
      return c.json({ error: "Domains array is required" }, 400)
    }

    const results = []
    const errors = []

    for (const domainData of domains) {
      const { domain, description } = domainData

      if (!domain || typeof domain !== "string") {
        errors.push({ domain: domain || "unknown", error: "Domain is required" })
        continue
      }

      // 简单的域名格式验证
      if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
        errors.push({ domain, error: "Invalid domain format" })
        continue
      }

      try {
        const success = await addCustomDomain(c.env, domain, description)
        if (success) {
          results.push({ domain, status: "success" })
        } else {
          errors.push({ domain, error: "Failed to add domain" })
        }
      } catch (error) {
        errors.push({ domain, error: error instanceof Error ? error.message : "Unknown error" })
      }
    }

    return c.json({
      message: "Batch operation completed",
      added: results.length,
      failed: errors.length,
      results,
      errors
    })
  } catch (error) {
    return c.json({ error: "Invalid request body" }, 400)
  }
})

app.delete("/api/custom-domains/:domain", async (c) => {
  const domain = c.req.param("domain")
  const success = await removeCustomDomain(c.env, domain)

  if (success) {
    return c.json({ message: "Domain removed successfully", domain })
  } else {
    return c.json({ error: "Domain not found or failed to remove" }, 404)
  }
})

app.post("/api/optimize/:domain", async (c) => {
  const domain = c.req.param("domain")
  const result = await optimizeCustomDomain(c.env, domain)

  if (result) {
    return c.json(result)
  } else {
    return c.json({ error: "Failed to optimize domain" }, 500)
  }
})

app.post("/api/reset", async (c) => {
  const useOptimization = c.req.query("optimize") === "true"

  const newEntries = await resetHostsData(c.env, useOptimization)

  return c.json({
    message: "Reset completed",
    entriesCount: newEntries.length,
    entries: newEntries,
    optimization: useOptimization ? "enabled" : "disabled",
  })
})

app.get("/:domain", async (c) => {
  const domain = c.req.param("domain")
  const data = await getDomainData(c.env, domain)

  if (!data) {
    return c.json({ error: "Domain not found" }, 404)
  }

  return c.json(data)
})

// 批量清空自定义域名 API
app.delete("/api/custom-domains", async (c) => {
  try {
    const customDomains = await getCustomDomains(c.env)
    const domainNames = Object.keys(customDomains)
    
    if (domainNames.length === 0) {
      return c.json({ message: "No custom domains to clear", count: 0 })
    }
    
    // 直接清空 KV 存储
    await c.env.custom_hosts.delete("custom_domains")
    
    return c.json({ 
      message: "All custom domains cleared successfully", 
      count: domainNames.length 
    })
  } catch (error) {
    console.error("Error clearing custom domains:", error)
    return c.json({ error: "Failed to clear custom domains" }, 500)
  }
})

// 调试 API：获取自定义域名解析状态
app.get("/debug", async (c) => {
  try {
    const customDomains = await getCustomDomains(c.env)
    const hostsData = await fetchCustomDomainsData(c.env, true) // 使用优化模式
    const hostsDataNoOpt = await fetchCustomDomainsData(c.env, false) // 不使用优化模式
    
    // 统计实际解析成功的域名数量（排除"未解析"的）
    const resolvedWithOpt = hostsData.filter(([ip]) => ip !== '未解析')
    const resolvedWithoutOpt = hostsDataNoOpt.filter(([ip]) => ip !== '未解析')
    
    return c.json({
      stored_domains: Object.keys(customDomains),
      stored_count: Object.keys(customDomains).length,
      resolved_with_optimization: hostsData.map(([ip, domain]) => ({ domain, ip })),
      resolved_without_optimization: hostsDataNoOpt.map(([ip, domain]) => ({ domain, ip })),
      resolved_count_opt: resolvedWithOpt.length,
      resolved_count_no_opt: resolvedWithoutOpt.length
    })
  } catch (error) {
    return c.json({ 
      error: "Debug failed: " + (error instanceof Error ? error.message : String(error)) 
    }, 500)
  }
})

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(handleSchedule(event, env))
  },
}
