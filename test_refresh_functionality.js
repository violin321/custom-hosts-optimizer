// 测试强制刷新功能的脚本
// 在浏览器控制台中运行此脚本来测试功能

console.log('=== 开始测试强制刷新功能 ===');

// 测试1: 检查新按钮是否存在
function testButtonExists() {
  const forceRefreshBtn = document.getElementById('forceRefreshDisplay');
  const cacheStatus = document.getElementById('cacheStatus');
  
  console.log('测试1: 检查新元素是否存在');
  console.log('- 强制刷新按钮:', forceRefreshBtn ? '✓ 存在' : '✗ 不存在');
  console.log('- 缓存状态指示器:', cacheStatus ? '✓ 存在' : '✗ 不存在');
  
  return forceRefreshBtn && cacheStatus;
}

// 测试2: 检查缓存状态更新函数
function testCacheStatusFunction() {
  console.log('测试2: 检查缓存状态更新函数');
  
  if (typeof updateCacheStatus === 'function') {
    console.log('- updateCacheStatus函数: ✓ 存在');
    
    // 测试函数调用
    updateCacheStatus('测试状态', 'cached');
    console.log('- 函数调用测试: ✓ 完成');
    return true;
  } else {
    console.log('- updateCacheStatus函数: ✗ 不存在');
    return false;
  }
}

// 测试3: 检查强制刷新函数
function testForceRefreshFunction() {
  console.log('测试3: 检查强制刷新函数');
  
  if (typeof forceRefreshHostsDisplay === 'function') {
    console.log('- forceRefreshHostsDisplay函数: ✓ 存在');
    return true;
  } else {
    console.log('- forceRefreshHostsDisplay函数: ✗ 不存在');
    return false;
  }
}

// 测试4: 模拟点击强制刷新按钮
async function testForceRefreshClick() {
  console.log('测试4: 模拟点击强制刷新按钮');
  
  const forceRefreshBtn = document.getElementById('forceRefreshDisplay');
  if (!forceRefreshBtn) {
    console.log('- 按钮不存在，跳过测试');
    return false;
  }
  
  console.log('- 点击前按钮状态:', {
    text: forceRefreshBtn.textContent,
    disabled: forceRefreshBtn.disabled
  });
  
  // 模拟点击
  forceRefreshBtn.click();
  
  // 等待一小段时间观察状态变化
  setTimeout(() => {
    console.log('- 点击后按钮状态:', {
      text: forceRefreshBtn.textContent,
      disabled: forceRefreshBtn.disabled
    });
  }, 100);
  
  return true;
}

// 运行所有测试
async function runAllTests() {
  console.log('开始运行所有测试...\n');
  
  const test1 = testButtonExists();
  const test2 = testCacheStatusFunction();
  const test3 = testForceRefreshFunction();
  
  if (test1 && test2 && test3) {
    console.log('\n前置测试通过，开始功能测试...');
    await testForceRefreshClick();
  } else {
    console.log('\n前置测试失败，请检查代码实现');
  }
  
  console.log('\n=== 测试完成 ===');
}

// 自动运行测试
runAllTests();

// 导出测试函数供手动调用
window.testRefreshFunctionality = {
  runAllTests,
  testButtonExists,
  testCacheStatusFunction,
  testForceRefreshFunction,
  testForceRefreshClick
};

console.log('测试脚本已加载，可以通过 window.testRefreshFunctionality 访问测试函数');
