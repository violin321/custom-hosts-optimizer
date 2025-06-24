// 获取当前页面的基础 URL
const baseUrl = window.location.origin

// 当前激活的选项卡
let currentTab = 'hosts'

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
  
  //  插入到当前活动选项卡的顶部
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

// 缓存 hosts 内容和更新时间
let cachedHostsContent = null
let lastHostsUpdate = null
const HOSTS_CACHE_DURATION = 60 * 60 * 1000 // 1小时缓存
let autoRefreshTimer = null

// 从 localStorage 恢复缓存
function restoreCache() {
  try {
    const cached = localStorage.getItem('hosts_cache')
    const timestamp = localStorage.getItem('hosts_cache_timestamp')
    
    if (cached && timestamp) {
      const now = Date.now()
      const cacheTime = parseInt(timestamp)
      
      // 如果缓存未过期，恢复缓存
      if (now - cacheTime < HOSTS_CACHE_DURATION) {
        cachedHostsContent = cached
        lastHostsUpdate = cacheTime
        return true
      } else {
        // 清除过期缓存
        localStorage.removeItem('hosts_cache')
        localStorage.removeItem('hosts_cache_timestamp')
      }
    }
  } catch (error) {
    console.warn('恢复缓存失败:', error)
  }
  return false
}

// 保存缓存到 localStorage
function saveCache(content, timestamp) {
  try {
    localStorage.setItem('hosts_cache', content)
    localStorage.setItem('hosts_cache_timestamp', timestamp.toString())
  } catch (error) {
    console.warn('保存缓存失败:', error)
  }
}

// 更新状态显示
function updateHostsStatus(message, type = 'info') {
  const statusElement = document.getElementById('hostsStatus')
  if (statusElement) {
    statusElement.textContent = message
    statusElement.className = `status-text ${type}`
  }
}

// 计算下次更新时间并显示倒计时
function updateCountdown() {
  if (!lastHostsUpdate) return
  
  const now = Date.now()
  const timeLeft = HOSTS_CACHE_DURATION - (now - lastHostsUpdate)
  
  if (timeLeft > 0) {
    const minutes = Math.ceil(timeLeft / (60 * 1000))
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    let timeText = ''
    if (hours > 0) {
      timeText = `${hours}小时${mins}分钟`
    } else {
      timeText = `${mins}分钟`
    }
    
    updateHostsStatus(`使用缓存数据，${timeText}后自动更新`, 'info')
    console.log(`Hosts缓存状态: 剩余${timeText}`)
  } else {
    // 缓存已过期，触发更新
    console.log('Hosts缓存已过期，触发自动更新')
    if (currentTab === 'hosts') {
      loadHosts(true)
    }
  }
}

// 加载 hosts 内容
async function loadHosts(forceRefresh = false) {
  const hostsElement = document.getElementById("hosts")
  if (!hostsElement) {
    console.error('无法找到 hosts 元素，页面可能未完全加载')
    // 等待 1秒 后重试
    setTimeout(() => {
      console.log('重试加载 hosts 内容...')
      loadHosts(forceRefresh)
    }, 1000)
    return
  }

  const now = Date.now()
  
  console.log(`loadHosts调用: forceRefresh=${forceRefresh}, 缓存时间=${lastHostsUpdate ? new Date(lastHostsUpdate).toLocaleString() : '无'}`)
  console.log('hosts元素状态:', hostsElement ? '找到' : '未找到')
  
  // 如果有缓存且未过期且不是强制刷新，使用缓存
  if (!forceRefresh && cachedHostsContent && lastHostsUpdate && 
      (now - lastHostsUpdate < HOSTS_CACHE_DURATION)) {
    console.log('使用缓存数据显示hosts内容')
    hostsElement.textContent = cachedHostsContent
    updateCountdown()
    return
  }

  try {
    console.log('开始获取hosts数据...')
    // 显示更新状态
    updateHostsStatus('正在更新 hosts 数据...', 'updating')
    
    // 如果有缓存内容，先显示缓存，然后在后台更新
    if (cachedHostsContent && !forceRefresh) {
      hostsElement.textContent = cachedHostsContent
    } else {
      hostsElement.textContent = "正在加载 hosts 内容..."
    }
    
    // 默认启用 IP 优选和自定义域名功能
    const optimize = true
    const custom = true
    
    const params = new URLSearchParams()
    if (!optimize) params.append('optimize', 'false')
    if (!custom) params.append('custom', 'false')
    if (forceRefresh) params.append('refresh', 'true')
    
    const queryString = params.toString()
    const url = queryString ? `${baseUrl}/hosts?${queryString}` : `${baseUrl}/hosts`
    
    console.log('发起 API 请求:', url)
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const hostsContent = await response.text()
    console.log(`成功获取hosts数据，长度: ${hostsContent.length}`)
    console.log('Hosts内容预览:', hostsContent.substring(0, 200) + '...')
    
    // 检查内容是否有效
    if (!hostsContent || hostsContent.length < 100) {
      throw new Error('获取的 hosts 内容为空或太短')
    }
    
    // 更新缓存和显示内容
    const isContentChanged = cachedHostsContent !== hostsContent
    cachedHostsContent = hostsContent
    lastHostsUpdate = now
    hostsElement.textContent = hostsContent
    
    // 保存到 localStorage
    saveCache(hostsContent, now)
    console.log(`hosts内容${isContentChanged ? '已' : '未'}更新，已保存到缓存`)
    
    // 更新状态
    if (isContentChanged) {
      updateHostsStatus('hosts 内容已更新', 'success')
      setTimeout(() => {
        updateCountdown()
      }, 3000)
    } else {
      updateCountdown()
    }
    
    // 如果是后台更新且内容有变化，显示提示
    if (!forceRefresh && isContentChanged) {
      showMessage('hosts 内容已更新', 'success')
    }
    
    // 重新设置自动刷新定时器
    setupAutoRefresh()
    
  } catch (error) {
    console.error("获取hosts数据失败:", error)
    // 如果有缓存，保持显示缓存内容
    if (!cachedHostsContent) {
      hostsElement.textContent = "加载 hosts 内容失败，请稍后重试"
    }
    updateHostsStatus('更新失败，使用缓存数据', 'error')
    showMessage('加载失败，请稍后重试', 'error')
    
    // 即使失败也要设置重试定时器
    setupAutoRefresh()
  }
}

// 设置自动刷新定时器
function setupAutoRefresh() {
  // 清除现有定时器
  if (autoRefreshTimer) {
    clearTimeout(autoRefreshTimer)
  }
  
  if (!lastHostsUpdate) return
  
  const now = Date.now()
  const timeLeft = HOSTS_CACHE_DURATION - (now - lastHostsUpdate)
  
  if (timeLeft > 0) {
    // 设置在缓存过期时自动刷新
    autoRefreshTimer = setTimeout(() => {
      if (currentTab === 'hosts') {
        console.log('自动刷新 hosts 内容')
        loadHosts(true)
      }
    }, timeLeft)
  } else {
    // 缓存已过期，立即刷新
    if (currentTab === 'hosts') {
      loadHosts(true)
    }
  }
}

// 设置倒计时更新定时器（内存泄漏修复）
let countdownTimerInterval = null

function setupCountdownTimer() {
  // 清理之前的定时器
  if (countdownTimerInterval) {
    clearInterval(countdownTimerInterval)
  }
  
  // 每分钟更新一次倒计时显示
  countdownTimerInterval = setInterval(() => {
    if (currentTab === 'hosts' && lastHostsUpdate) {
      updateCountdown()
    }
  }, 60 * 1000) // 每分钟更新
}

// 清理定时器函数
function cleanupTimers() {
  if (countdownTimerInterval) {
    clearInterval(countdownTimerInterval)
    countdownTimerInterval = null
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
    // 只有在没有缓存或缓存过期时才加载
    const now = Date.now()
    const needRefresh = !cachedHostsContent || !lastHostsUpdate || 
                       (now - lastHostsUpdate >= HOSTS_CACHE_DURATION)
    
    if (needRefresh) {
      loadHosts(false) // 不强制刷新，让函数内部判断
    } else {
      // 使用缓存显示
      const hostsElement = document.getElementById("hosts")
      if (hostsElement && cachedHostsContent) {
        hostsElement.textContent = cachedHostsContent
        updateCountdown()
      }
    }
  }
}

// 全域名优选函数 - 主页立即刷新功能
async function optimizeAllDomains() {
  console.log('开始执行全域名优选...')
  
  const refreshBtn = document.getElementById('refreshHosts')
  const originalText = refreshBtn ? refreshBtn.textContent : '立即全域名优选'
  
  console.log('刷新按钮状态:', refreshBtn ? '找到' : '未找到')
  
  try {
    // 更新按钮状态
    if (refreshBtn) {
      refreshBtn.textContent = '正在优选...'
      refreshBtn.disabled = true
    }
    
    updateHostsStatus('正在执行全域名优选，请稍候...', 'updating')
    showMessage('开始执行全域名优选（包括GitHub域名和自定义域名），这可能需要1-2分钟时间...', 'info')
    
    // 调用全域名优选API
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000) // 2分钟超时
    
    const response = await fetch(`${baseUrl}/api/optimize-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'main-page-refresh'
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    const result = await response.json()
    
    if (response.ok) {
      const githubCount = result.githubDomains || 0
      const customTotal = result.customDomains?.total || 0
      const customOptimized = result.customDomains?.optimized || 0
      const customFailed = result.customDomains?.failed || 0
      
      let message = `全域名优选完成！`
      if (githubCount > 0) {
        message += ` GitHub域名 ${githubCount} 个`
      }
      if (customTotal > 0) {
        message += `，自定义域名: 成功 ${customOptimized} 个`
        if (customFailed > 0) {
          message += `，失败 ${customFailed} 个`
        }
      }
      
      showMessage(message, 'success')
      
      // 清除前端缓存并立即重新加载hosts内容
      console.log('全域名优选完成，清除前端缓存并重新加载hosts')
      cachedHostsContent = null
      lastHostsUpdate = null
      localStorage.removeItem('hosts_cache')
      localStorage.removeItem('hosts_cache_timestamp')
      
      // 立即重新加载hosts内容（不需要延迟，因为后端已经完成了所有更新）
      updateHostsStatus('正在更新显示内容...', 'updating')
      loadHosts(true) // 强制刷新hosts内容
      
    } else {
      showMessage(`全域名优选失败: ${result.error || '未知错误'}`, 'error')
      updateHostsStatus('全域名优选失败', 'error')
    }
    
  } catch (error) {
    console.error('全域名优选失败:', error)
    
    if (error.name === 'AbortError') {
      showMessage('全域名优选超时，请稍后重试', 'error')
      updateHostsStatus('优选超时', 'error')
    } else {
      showMessage(`全域名优选失败: ${error.message}`, 'error')
      updateHostsStatus('全域名优选失败', 'error')
    }
  } finally {
    // 恢复按钮状态
    if (refreshBtn) {
      refreshBtn.textContent = originalText
      refreshBtn.disabled = false
    }
  }
}

// 加载自定义域名列表（已移至管理后台，此函数保留以防兼容性问题）
async function loadCustomDomains() {
  console.log('自定义域名管理功能已移至管理后台')
  return
}

// 添加自定义域名（已移至管理后台）
async function addCustomDomain() {
  showMessage('自定义域名管理功能已移至专用管理系统', 'info')
  return
}

// 批量添加自定义域名（已移至管理后台）
async function addCustomDomainsBatch() {
  showMessage('自定义域名管理功能已移至专用管理系统', 'info')
  return
}

// 删除自定义域名（已移至管理后台）
async function removeDomain(domain) {
  showMessage('自定义域名管理功能已移至专用管理系统', 'info')
  return
}

// 优选域名（保留此函数以防HTML中有调用）
async function optimizeDomain(domain) {
  showMessage('域名优选功能已集成到立即优选刷新中', 'info')
  return
}

// 状态检查函数
async function checkServiceStatus() {
  const statusIndicator = document.getElementById('status-indicator')
  if (!statusIndicator) return
  
  try {
    const response = await fetch(`${baseUrl}/hosts.json`)
    if (response.ok) {
      const data = await response.json()
      statusIndicator.innerHTML = `🟢 服务正常运行 (${data.total} 条记录)`
      statusIndicator.style.background = '#e8f5e8'
      statusIndicator.style.color = '#2d5a2d'
    } else {
      statusIndicator.innerHTML = '🟡 服务响应异常'
      statusIndicator.style.background = '#fff3cd'
      statusIndicator.style.color = '#856404'
    }
  } catch (error) {
    statusIndicator.innerHTML = '🔴 服务连接失败'
    statusIndicator.style.background = '#f8d7da'
    statusIndicator.style.color = '#721c24'
  }
}

// 设置事件监听器
function setupEventListeners() {
  console.log('设置事件监听器...')
  
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
  
  // 刷新 hosts 按钮 - 执行全域名优选
  const refreshBtn = document.getElementById('refreshHosts')
  if (refreshBtn) {
    console.log('找到刷新按钮，绑定事件')
    refreshBtn.addEventListener('click', () => {
      console.log('刷新按钮被点击')
      optimizeAllDomains()
    })
  } else {
    console.error('无法找到刷新按钮元素')
    // 等待 500ms 后重试绑定
    setTimeout(() => {
      console.log('重试绑定刷新按钮事件...')
      const retryBtn = document.getElementById('refreshHosts')
      if (retryBtn) {
        console.log('重试成功，绑定刷新按钮事件')
        retryBtn.addEventListener('click', () => {
          console.log('刷新按钮被点击（重试绑定）')
          optimizeAllDomains()
        })
      } else {
        console.error('重试仍无法找到刷新按钮元素')
      }
    }, 500)
  }
}

// 初始化
function init() {
  console.log('开始初始化...')
  console.log('当前页面 URL:', window.location.href)
  console.log('baseUrl:', baseUrl)
  
  // 检查关键元素是否存在
  const hostsElement = document.getElementById("hosts")
  const refreshBtn = document.getElementById('refreshHosts')
  const tabElements = document.querySelectorAll('.tab')
  
  console.log('关键元素检查:')
  console.log('- hosts 元素:', hostsElement ? '存在' : '不存在')
  console.log('- 刷新按钮:', refreshBtn ? '存在' : '不存在')
  console.log('- 选项卡元素数量:', tabElements.length)
  
  // 如果关键元素不存在，等待 DOM 完全加载后重试
  if (!hostsElement || !refreshBtn) {
    console.warn('关键元素缺失，2秒后重试初始化...')
    setTimeout(() => {
      console.log('重试初始化...')
      init()
    }, 2000)
    return
  }
  
  setupEventListeners()
  
  // 初始化 SwitchHosts URL
  const switchHostsUrlElement = document.getElementById('switchHostsUrl')
  if (switchHostsUrlElement) {
    switchHostsUrlElement.textContent = `${baseUrl}/hosts`
    console.log('SwitchHosts URL 已设置')
  } else {
    console.warn('无法找到 switchHostsUrl 元素')
  }
  
  // 恢复缓存
  const hasCachedData = restoreCache()
  console.log('缓存恢复状态:', hasCachedData)
  
  // 加载初始内容
  if (currentTab === 'hosts') {
    console.log('当前标签页是 hosts，开始加载内容')
    if (hasCachedData) {
      // 如果有缓存，先显示缓存内容
      if (hostsElement && cachedHostsContent) {
        hostsElement.textContent = cachedHostsContent
        updateCountdown()
        console.log('显示缓存内容')
        
        // 在后台检查是否需要更新
        const now = Date.now()
        if (now - lastHostsUpdate >= HOSTS_CACHE_DURATION) {
          console.log('缓存过期，后台更新')
          loadHosts(true) // 缓存过期，后台更新
        } else {
          console.log('缓存有效，设置自动刷新定时器')
          setupAutoRefresh() // 设置自动刷新定时器
        }
      }
    } else {
      // 没有缓存，首次加载
      console.log('没有缓存，首次加载')
      loadHosts(false)
    }
  }
  
  // 设置倒计时更新定时器
  setupCountdownTimer()
  
  // 检查服务状态
  checkServiceStatus()
  
  console.log('初始化完成')
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init)

// 页面卸载时清理所有定时器
window.addEventListener('beforeunload', () => {
  // 清理所有定时器
  cleanupTimers()
  
  // 记录当前状态到日志
  console.log('页面卸载，资源已清理')
})

// 页面可见性变化时的处理
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentTab === 'hosts') {
    // 页面重新可见时，检查缓存是否过期
    const now = Date.now()
    if (lastHostsUpdate && (now - lastHostsUpdate >= HOSTS_CACHE_DURATION)) {
      console.log('页面重新可见，缓存已过期，刷新数据')
      loadHosts(true)
    } else if (lastHostsUpdate) {
      // 更新倒计时显示
      updateCountdown()
    }
  }
})

// 每分钟检查一次服务状态
setInterval(() => {
  checkServiceStatus()
}, 60 * 1000) // 每分钟检查一次
