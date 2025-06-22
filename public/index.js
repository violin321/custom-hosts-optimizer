// 获取当前页面的基础 URL
const baseUrl = window.location.origin

// 当前激活的选项卡
let currentTab = 'hosts'

// API Key（从 localStorage 获取）
let apiKey = localStorage.getItem('github-hosts-api-key') || ''

function escapeHtml(str) {
  const div = document.createElement("div")
  div.textContent = str
  return div.innerHTML
}

// 显示消息
function showMessage(message, type = 'info') {
  const container = document.createElement('div')
  container.className = `message ${type}`
  container.textContent = message
  
  // 插入到当前活动选项卡的顶部
  const activeTab = document.querySelector('.tab-content.active')
  if (activeTab) {
    activeTab.insertBefore(container, activeTab.firstChild)
    
    // 3秒后自动删除
    setTimeout(() => {
      if (container.parentNode) {
        container.parentNode.removeChild(container)
      }
    }, 3000)
  }
}

// 复制到剪贴板
async function copyToClipboard(text, btn) {
  try {
    if (typeof text === 'object') {
      // 如果传入的是按钮元素（旧的调用方式）
      const hostsElement = document.getElementById("hosts")
      await navigator.clipboard.writeText(hostsElement.textContent)
      btn = text
    } else {
      // 如果传入的是文本
      await navigator.clipboard.writeText(text)
    }

    const originalText = btn.textContent
    btn.textContent = "已复制"
    btn.style.backgroundColor = '#10b981'

    setTimeout(() => {
      btn.textContent = originalText
      btn.style.backgroundColor = ''
    }, 1000)
  } catch (err) {
    console.error("复制失败:", err)
    showMessage('复制失败，请手动选择复制', 'error')
  }
}

// 加载 hosts 内容
async function loadHosts() {
  const hostsElement = document.getElementById("hosts")
  if (!hostsElement) return

  try {
    hostsElement.textContent = "正在加载 hosts 内容..."
    
    const optimize = document.getElementById('optimizeToggle')?.checked || false
    const custom = document.getElementById('customToggle')?.checked !== false
    
    const params = new URLSearchParams()
    if (optimize) params.append('optimize', 'true')
    if (!custom) params.append('custom', 'false')
    
    const response = await fetch(`${baseUrl}/hosts?${params.toString()}`)
    if (!response.ok) throw new Error("Failed to load hosts")
    
    const hostsContent = await response.text()
    hostsElement.textContent = hostsContent
  } catch (error) {
    hostsElement.textContent = "加载 hosts 内容失败，请稍后重试"
    console.error("Error loading hosts:", error)
    showMessage('加载失败，请稍后重试', 'error')
  }
}

// 选项卡切换
function switchTab(tabName) {
  // 更新选项卡状态
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active')
  })
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active')
  
  // 更新内容区域
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active')
  })
  document.getElementById(`${tabName}-tab`).classList.add('active')
  
  currentTab = tabName
  
  // 根据选项卡加载相应内容
  if (tabName === 'hosts') {
    loadHosts()
  } else if (tabName === 'custom') {
    loadCustomDomains()
  }
}

// 加载自定义域名列表
async function loadCustomDomains() {
  const container = document.getElementById('customDomainsList')
  if (!container) return
  
  if (!apiKey) {
    container.innerHTML = '<p>请输入 API Key 查看自定义域名列表</p>'
    return
  }
  
  try {
    container.innerHTML = '<div class="loading">正在加载自定义域名...</div>'
    
    const response = await fetch(`${baseUrl}/api/custom-domains?key=${encodeURIComponent(apiKey)}`)
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API Key 无效')
      }
      throw new Error('加载失败')
    }
    
    const domains = await response.json()
    const domainList = Object.values(domains)
    
    if (domainList.length === 0) {
      container.innerHTML = '<p>暂无自定义域名</p>'
      return
    }
    
    container.innerHTML = domainList.map(domain => `
      <div class="domain-item">
        <div class="domain-info">
          <h4>${escapeHtml(domain.domain)}</h4>
          <p>${domain.description || '无描述'}</p>
          <p>添加时间: ${new Date(domain.addedAt).toLocaleString()}</p>
          ${domain.lastUpdated ? `<p>最后更新: ${new Date(domain.lastUpdated).toLocaleString()}</p>` : ''}
        </div>
        <div class="domain-actions">
          <button class="btn btn-small btn-primary" onclick="optimizeDomain('${domain.domain}')">优选</button>
          <button class="btn btn-small btn-danger" onclick="removeDomain('${domain.domain}')">删除</button>
        </div>
      </div>
    `).join('')
  } catch (error) {
    container.innerHTML = `<p style="color: var(--error-color)">加载失败: ${error.message}</p>`
    console.error('Error loading custom domains:', error)
  }
}

// 添加自定义域名
async function addCustomDomain() {
  const domainInput = document.getElementById('domainInput')
  const descriptionInput = document.getElementById('descriptionInput')
  const apiKeyInput = document.getElementById('apiKey')
  
  const domain = domainInput.value.trim()
  const description = descriptionInput.value.trim()
  const currentApiKey = apiKeyInput.value.trim() || apiKey
  
  if (!domain) {
    showMessage('请输入域名', 'error')
    return
  }
  
  if (!currentApiKey) {
    showMessage('请输入 API Key', 'error')
    return
  }
  
  // 简单的域名格式验证
  if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    showMessage('域名格式不正确', 'error')
    return
  }
  
  try {
    const response = await fetch(`${baseUrl}/api/custom-domains?key=${encodeURIComponent(currentApiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ domain, description })
    })
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API Key 无效')
      }
      const error = await response.json()
      throw new Error(error.error || '添加失败')
    }
    
    // 保存 API Key
    if (currentApiKey !== apiKey) {
      apiKey = currentApiKey
      localStorage.setItem('github-hosts-api-key', apiKey)
    }
    
    showMessage(`域名 ${domain} 添加成功`, 'success')
    
    // 清空表单
    domainInput.value = ''
    descriptionInput.value = ''
    
    // 重新加载域名列表
    loadCustomDomains()
  } catch (error) {
    showMessage(`添加失败: ${error.message}`, 'error')
    console.error('Error adding custom domain:', error)
  }
}

// 删除自定义域名
async function removeDomain(domain) {
  if (!confirm(`确定要删除域名 ${domain} 吗？`)) {
    return
  }
  
  if (!apiKey) {
    showMessage('请先输入 API Key', 'error')
    return
  }
  
  try {
    const response = await fetch(`${baseUrl}/api/custom-domains/${encodeURIComponent(domain)}?key=${encodeURIComponent(apiKey)}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API Key 无效')
      }
      throw new Error('删除失败')
    }
    
    showMessage(`域名 ${domain} 删除成功`, 'success')
    loadCustomDomains()
  } catch (error) {
    showMessage(`删除失败: ${error.message}`, 'error')
    console.error('Error removing domain:', error)
  }
}

// 优选域名
async function optimizeDomain(domain) {
  if (!apiKey) {
    showMessage('请先输入 API Key', 'error')
    return
  }
  
  try {
    showMessage(`正在为 ${domain} 进行 IP 优选...`, 'info')
    
    const response = await fetch(`${baseUrl}/api/optimize/${encodeURIComponent(domain)}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST'
    })
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API Key 无效')
      }
      throw new Error('优选失败')
    }
    
    const result = await response.json()
    showMessage(`${domain} 优选完成，最佳 IP: ${result.bestIp}，响应时间: ${result.responseTime}ms`, 'success')
    loadCustomDomains()
  } catch (error) {
    showMessage(`优选失败: ${error.message}`, 'error')
    console.error('Error optimizing domain:', error)
  }
}

// 设置事件监听器
function setupEventListeners() {
  // 选项卡切换
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab')
      switchTab(tabName)
    })
  })
  
  // 复制按钮
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-btn')) {
      const copyTarget = e.target.getAttribute('data-copy')
      
      if (copyTarget) {
        // 复制指定元素的内容
        const targetElement = document.getElementById(copyTarget)
        if (targetElement) {
          copyToClipboard(targetElement.textContent, e.target)
        }
      } else if (e.target.id === 'copyHosts') {
        // 复制 hosts 内容
        const hostsElement = document.getElementById("hosts")
        if (hostsElement) {
          copyToClipboard(hostsElement.textContent, e.target)
        }
      }
    }
  })
  
  // 刷新 hosts 按钮
  const refreshBtn = document.getElementById('refreshHosts')
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadHosts)
  }
  
  // 优化和自定义域名切换按钮
  const optimizeToggle = document.getElementById('optimizeToggle')
  const customToggle = document.getElementById('customToggle')
  
  if (optimizeToggle) {
    optimizeToggle.addEventListener('change', loadHosts)
  }
  
  if (customToggle) {
    customToggle.addEventListener('change', loadHosts)
  }
  
  // 添加域名按钮
  const addDomainBtn = document.getElementById('addDomain')
  if (addDomainBtn) {
    addDomainBtn.addEventListener('click', addCustomDomain)
  }
  
  // API Key 输入框变化事件
  const apiKeyInput = document.getElementById('apiKey')
  if (apiKeyInput) {
    // 设置初始值
    if (apiKey) {
      apiKeyInput.value = apiKey
    }
    
    apiKeyInput.addEventListener('input', (e) => {
      const newApiKey = e.target.value.trim()
      if (newApiKey !== apiKey) {
        apiKey = newApiKey
        localStorage.setItem('github-hosts-api-key', apiKey)
        // 如果在自定义域名选项卡，重新加载列表
        if (currentTab === 'custom') {
          loadCustomDomains()
        }
      }
    })
  }
  
  // 表单回车提交
  const domainInput = document.getElementById('domainInput')
  if (domainInput) {
    domainInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addCustomDomain()
      }
    })
  }
}

// 初始化
function init() {
  setupEventListeners()
  
  // 初始化 SwitchHosts URL
  const switchHostsUrlElement = document.getElementById('switchHostsUrl')
  if (switchHostsUrlElement) {
    switchHostsUrlElement.textContent = `${baseUrl}/hosts`
  }
  
  // 加载初始内容
  if (currentTab === 'hosts') {
    loadHosts()
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init)
