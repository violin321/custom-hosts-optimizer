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

// 管理员认证中间件
const adminAuth = basicAuth({
  username: "admin", 
  password: "admin123",
  realm: "管理后台认证",
})

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
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header h1 { color: #333; margin-bottom: 10px; }
        .header p { color: #666; }
        .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #333; }
        .form-group input, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
        .btn { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-right: 10px; }
        .btn-primary { background-color: #007bff; color: white; }
        .btn-danger { background-color: #dc3545; color: white; }
        .btn-success { background-color: #28a745; color: white; }
        .btn:hover { opacity: 0.9; }
        .domain-list { max-height: 400px; overflow-y: auto; }
        .domain-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee; }
        .domain-info { flex: 1; }
        .domain-actions { display: flex; gap: 10px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 10px; }
        .alert { padding: 15px; margin-bottom: 20px; border-radius: 4px; }
        .alert-success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .alert-error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .batch-input { min-height: 100px; }
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
        </div>

        <!-- 添加域名 -->
        <div class="card">
            <h3>➕ 添加自定义域名</h3>
            <div class="form-group">
                <label for="domain">域名:</label>
                <input type="text" id="domain" placeholder="例如: example.com">
            </div>
            <div class="form-group">
                <label for="description">描述 (可选):</label>
                <input type="text" id="description" placeholder="域名用途描述">
            </div>
            <button class="btn btn-primary" onclick="addDomain()">添加域名</button>
        </div>

        <!-- 批量操作 -->
        <div class="card">
            <h3>📝 批量添加域名</h3>
            <div class="form-group">
                <label for="batch-domains">域名列表 (每行一个，格式: 域名|描述):</label>
                <textarea id="batch-domains" class="batch-input" placeholder="example1.com|第一个域名&#10;example2.com|第二个域名&#10;example3.com"></textarea>
            </div>
            <button class="btn btn-primary" onclick="batchAddDomains()">批量添加</button>
        </div>

        <!-- 域名列表 -->
        <div class="card">
            <h3>📋 域名管理</h3>
            <div style="margin-bottom: 15px;">
                <button class="btn btn-success" onclick="loadDomains()">🔄 刷新列表</button>
                <button class="btn btn-danger" onclick="clearAllCustomDomains()" style="float: right;">🗑️ 清空自定义域名</button>
            </div>
            <div class="domain-list" id="domain-list">
                <p>加载中...</p>
            </div>
        </div>
    </div>

    <script>
        // 显示通知
        function showAlert(message, type = 'success') {
            const container = document.getElementById('alert-container');
            const alert = document.createElement('div');
            alert.className = \`alert alert-\${type}\`;
            alert.textContent = message;
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
            } catch (error) {
                console.error('加载统计信息失败:', error);
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
                    container.innerHTML = '<p>暂无自定义域名</p>';
                    return;
                }

                container.innerHTML = domains.map(domain => \`
                    <div class="domain-item">
                        <div class="domain-info">
                            <strong>\${domain.domain}</strong>
                            \${domain.description ? \`<br><small>\${domain.description}</small>\` : ''}
                            <br><small>IP: \${domain.ip || '未解析'} | 添加时间: \${new Date(domain.timestamp).toLocaleString()}</small>
                        </div>
                        <div class="domain-actions">
                            <button class="btn btn-success" onclick="optimizeDomain('\${domain.domain}')">优选</button>
                            <button class="btn btn-danger" onclick="removeDomain('\${domain.domain}')">删除</button>
                        </div>
                    </div>
                \`).join('');
            } catch (error) {
                showAlert('加载域名列表失败: ' + error.message, 'error');
            }
        }

        // 添加域名
        async function addDomain() {
            const domain = document.getElementById('domain').value.trim();
            const description = document.getElementById('description').value.trim();

            if (!domain) {
                showAlert('请输入域名', 'error');
                return;
            }

            try {
                const response = await fetch('/api/custom-domains', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ domain, description })
                });

                const result = await response.json();
                if (response.ok) {
                    showAlert(\`域名 \${domain} 添加成功\`);
                    document.getElementById('domain').value = '';
                    document.getElementById('description').value = '';
                    loadDomains();
                    loadStats();
                } else {
                    showAlert(result.error || '添加失败', 'error');
                }
            } catch (error) {
                showAlert('添加域名失败: ' + error.message, 'error');
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
                    showAlert(\`域名 \${domain} 优选完成，新IP: \${result.ip}\`);
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
                const domains = await fetch('/api/custom-domains').then(r => r.json());
                let successCount = 0;
                
                for (const domain of domains) {
                    try {
                        await fetch(\`/api/custom-domains/\${encodeURIComponent(domain.domain)}\`, {
                            method: 'DELETE'
                        });
                        successCount++;
                    } catch (error) {
                        console.error(\`删除 \${domain.domain} 失败:\`, error);
                    }
                }

                showAlert(\`清空完成，删除了 \${successCount} 个域名\`);
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
        document.getElementById('domain').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addDomain();
        });
    </script>
</body>
</html>`

  return c.html(adminHtml)
})

// 将管理后台路由组应用到应用中，并使用认证中间件
app.route("/admin", admin.use("*", adminAuth))

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

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(handleSchedule(event, env))
  },
}
