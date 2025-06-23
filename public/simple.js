// 简化版主页功能脚本
// 获取当前页面的基础 URL
const baseUrl = window.location.origin

// 显示消息
function showMessage(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`)
  
  // 尝试在页面中显示消息
  const container = document.createElement('div')
  container.className = `message ${type}`
  container.textContent = message
  container.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 1000;
    padding: 10px 15px; border-radius: 5px; color: white;
    background: ${type === 'error' ? '#f56565' : type === 'success' ? '#48bb78' : '#4299e1'};
  `
  
  document.body.appendChild(container)
  
  setTimeout(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }, 3000)
}

// 加载缓存状态
async function loadCacheStatus() {
  try {
    const response = await fetch(`${baseUrl}/api/cache/status`)
    if (response.ok) {
      const status = await response.json()
      const statusElement = document.getElementById('hostsStatus')
      
      if (statusElement && status.cached) {
        const ageText = status.ageMinutes < 60 
          ? `${status.ageMinutes} 分钟前` 
          : `${Math.round(status.ageMinutes / 60)} 小时前`
        
        const validText = status.isValid 
          ? `缓存有效，${ageText}更新` 
          : '缓存已过期，建议刷新'
        
        statusElement.textContent = validText
        statusElement.className = status.isValid ? 'status-text valid' : 'status-text expired'
        
        console.log(`缓存状态: ${validText}, 域名数: ${status.domainCount}`)
      }
    }
  } catch (error) {
    console.error('Failed to load cache status:', error)
  }
}

// 加载 hosts 内容
async function loadHosts() {
  console.log('开始加载 hosts 内容...')
  
  const hostsElement = document.getElementById("hosts")
  if (!hostsElement) {
    console.error('找不到 hosts 元素')
    showMessage('页面元素加载失败', 'error')
    return
  }
  
  try {
    hostsElement.textContent = "正在加载 hosts 内容..."
    
    const response = await fetch(`${baseUrl}/hosts`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const hostsContent = await response.text()
    console.log(`成功获取 hosts 内容，长度: ${hostsContent.length}`)
    
    hostsElement.textContent = hostsContent
    
    // 更新状态
    const statusElement = document.getElementById('hostsStatus')
    if (statusElement) {
      statusElement.textContent = '内容已更新'
    }
    
    showMessage('Hosts 内容加载成功', 'success')
    
    // 重新加载缓存状态
    await loadCacheStatus()
    
  } catch (error) {
    console.error('加载 hosts 失败:', error)
    hostsElement.textContent = "加载失败，请重试"
    showMessage(`加载失败: ${error.message}`, 'error')
  }
}

// 全域名优选
async function optimizeAllDomains() {
  console.log('开始全域名优选...')
  
  const refreshBtn = document.getElementById('refreshHosts')
  const statusElement = document.getElementById('hostsStatus')
  
  if (!refreshBtn) {
    console.error('找不到刷新按钮')
    showMessage('页面元素加载失败', 'error')
    return
  }
  
  const originalText = refreshBtn.textContent
  
  try {
    // 更新按钮状态
    refreshBtn.textContent = '正在优选...'
    refreshBtn.disabled = true
    
    if (statusElement) {
      statusElement.textContent = '正在执行全域名优选...'
    }
    
    showMessage('开始执行全域名优选，请稍候...', 'info')
    
    const response = await fetch(`${baseUrl}/api/optimize-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const result = await response.json()
    console.log('优选结果:', result)
    
    showMessage(
      `全域名优选完成！成功 ${result.optimized} 个，失败 ${result.failed} 个`, 
      'success'
    )
    
    // 等待1秒后重新加载 hosts
    setTimeout(() => {
      console.log('优选完成，重新加载 hosts...')
      loadHosts()
    }, 1000)
    
  } catch (error) {
    console.error('全域名优选失败:', error)
    showMessage(`优选失败: ${error.message}`, 'error')
    
    if (statusElement) {
      statusElement.textContent = '优选失败'
    }
  } finally {
    // 恢复按钮状态
    refreshBtn.textContent = originalText
    refreshBtn.disabled = false
  }
}

// 复制到剪贴板
async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text)
    
    const originalText = btn.textContent
    btn.textContent = "已复制"
    btn.style.backgroundColor = '#10b981'
    
    setTimeout(() => {
      btn.textContent = originalText
      btn.style.backgroundColor = ''
    }, 1000)
    
    showMessage('复制成功', 'success')
  } catch (err) {
    console.error("复制失败:", err)
    showMessage('复制失败，请手动选择复制', 'error')
  }
}

// 页面初始化
function initPage() {
  console.log('=== 页面初始化开始 ===')
  
  // 检查关键元素
  const hostsElement = document.getElementById("hosts")
  const refreshBtn = document.getElementById('refreshHosts')
  const copyBtn = document.getElementById('copyHosts')
  const switchHostsUrl = document.getElementById('switchHostsUrl')
  
  console.log('元素检查结果:')
  console.log('- hosts:', hostsElement ? '✓' : '✗')
  console.log('- refreshHosts:', refreshBtn ? '✓' : '✗')
  console.log('- copyHosts:', copyBtn ? '✓' : '✗')
  console.log('- switchHostsUrl:', switchHostsUrl ? '✓' : '✗')
  
  // 设置 SwitchHosts URL
  if (switchHostsUrl) {
    switchHostsUrl.textContent = `${baseUrl}/hosts`
  }
  
  // 绑定刷新按钮事件
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.log('刷新按钮被点击')
      optimizeAllDomains()
    })
    console.log('刷新按钮事件已绑定')
  } else {
    console.error('无法绑定刷新按钮事件')
  }
  
  // 绑定复制按钮事件
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (hostsElement) {
        copyToClipboard(hostsElement.textContent, copyBtn)
      }
    })
    console.log('复制按钮事件已绑定')
  }
  
  // 绑定选项卡切换
  const tabs = document.querySelectorAll('.tab')
  const tabContents = document.querySelectorAll('.tab-content')
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      console.log('选项卡被点击:', tab.getAttribute('data-tab'))
      
      // 移除所有活动状态
      tabs.forEach(t => t.classList.remove('active'))
      tabContents.forEach(tc => tc.classList.remove('active'))
      
      // 添加当前活动状态
      tab.classList.add('active')
      const targetTab = tab.getAttribute('data-tab')
      const targetContent = document.getElementById(`${targetTab}-tab`)
      if (targetContent) {
        targetContent.classList.add('active')
        console.log('切换到选项卡:', targetTab)
      } else {
        console.error('找不到选项卡内容:', `${targetTab}-tab`)
      }
    })
  })
  
  console.log('选项卡事件已绑定，找到', tabs.length, '个选项卡')

  // 绑定其他复制按钮
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-btn') && e.target.getAttribute('data-copy')) {
      const copyTarget = e.target.getAttribute('data-copy')
      const targetElement = document.getElementById(copyTarget)
      if (targetElement) {
        copyToClipboard(targetElement.textContent, e.target)
      }
    }
  })
  
  // 加载初始内容
  console.log('开始加载初始 hosts 内容...')
  loadHosts()
  
  // 每5分钟更新一次缓存状态
  setInterval(loadCacheStatus, 5 * 60 * 1000)
  
  console.log('=== 页面初始化完成 ===')
}

// 等待 DOM 加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage)
} else {
  // DOM 已经加载完成
  initPage()
}

// 导出函数供调试使用
window.debugFunctions = {
  loadHosts,
  optimizeAllDomains,
  showMessage,
  loadCacheStatus
}
