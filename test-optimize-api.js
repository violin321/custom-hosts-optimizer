// 测试优选API功能
const baseUrl = 'http://localhost:8787';

async function testOptimizeAPI() {
    console.log('=== 开始测试优选API ===');
    console.log('时间:', new Date().toISOString());
    
    try {
        console.log('发送优选请求...');
        const startTime = Date.now();
        
        const response = await fetch(`${baseUrl}/api/optimize-all`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'main-page-refresh',
                'User-Agent': 'Test-Script/1.0'
            }
        });
        
        const duration = Date.now() - startTime;
        console.log(`请求完成，耗时: ${duration}ms`);
        console.log('响应状态:', response.status, response.statusText);
        console.log('响应头:', Object.fromEntries(response.headers.entries()));
        
        const result = await response.json();
        console.log('响应内容:', JSON.stringify(result, null, 2));
        
        if (response.ok) {
            console.log('✅ 优选API测试成功！');
            console.log(`- GitHub域名: ${result.githubDomains || 0} 个`);
            console.log(`- 自定义域名总数: ${result.customDomains?.total || 0} 个`);
            console.log(`- 自定义域名成功: ${result.customDomains?.optimized || 0} 个`);
            console.log(`- 自定义域名失败: ${result.customDomains?.failed || 0} 个`);
            console.log(`- 总优选成功: ${result.optimized || 0} 个`);
            console.log(`- 总失败: ${result.failed || 0} 个`);
            console.log(`- 服务器处理时间: ${result.duration || 0}ms`);
            
            if (result.errors && result.errors.length > 0) {
                console.log('❌ 部分域名优选失败:');
                result.errors.forEach(error => {
                    console.log(`  - ${error.domain}: ${error.error}`);
                });
            }
            
            if (result.results && result.results.length > 0) {
                console.log('✅ 成功优选的域名:');
                result.results.slice(0, 5).forEach(res => {
                    console.log(`  - ${res.domain}: ${res.oldIp} -> ${res.newIp} ${res.updated ? '(已更新)' : '(未变化)'}`);
                });
                if (result.results.length > 5) {
                    console.log(`  ... 还有 ${result.results.length - 5} 个域名`);
                }
            }
            
        } else {
            console.log('❌ 优选API测试失败！');
            console.log('错误信息:', result.error || '未知错误');
            console.log('错误代码:', result.code || 'UNKNOWN');
        }
        
    } catch (error) {
        console.log('❌ 优选API测试异常！');
        console.log('错误类型:', error.name);
        console.log('错误消息:', error.message);
        console.log('错误堆栈:', error.stack);
    }
    
    console.log('=== 优选API测试结束 ===\n');
}

async function testBasicAPI() {
    console.log('=== 开始测试基础API ===');
    
    try {
        // 测试hosts.json
        console.log('测试 /hosts.json...');
        const jsonResponse = await fetch(`${baseUrl}/hosts.json`);
        if (jsonResponse.ok) {
            const jsonData = await jsonResponse.json();
            console.log(`✅ hosts.json 成功: ${jsonData.total} 条记录`);
        } else {
            console.log(`❌ hosts.json 失败: ${jsonResponse.status}`);
        }
        
        // 测试hosts
        console.log('测试 /hosts...');
        const hostsResponse = await fetch(`${baseUrl}/hosts`);
        if (hostsResponse.ok) {
            const hostsContent = await hostsResponse.text();
            console.log(`✅ hosts 成功: ${hostsContent.length} 字符`);
        } else {
            console.log(`❌ hosts 失败: ${hostsResponse.status}`);
        }
        
    } catch (error) {
        console.log('❌ 基础API测试异常:', error.message);
    }
    
    console.log('=== 基础API测试结束 ===\n');
}

async function runAllTests() {
    console.log('🧪 开始运行所有测试...\n');
    
    await testBasicAPI();
    await testOptimizeAPI();
    
    console.log('🎉 所有测试完成！');
}

// 运行测试
runAllTests().catch(console.error);
