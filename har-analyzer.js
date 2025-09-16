import fs from 'fs';

function analyzeHAR(filePath, environment) {
    const harData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const entries = harData.log.entries;
    const pageTimings = harData.log.pages[0].pageTimings;
    
    console.log(`\n=== ${environment.toUpperCase()} ENVIRONMENT ANALYSIS ===`);
    console.log(`Total requests: ${entries.length}`);
    console.log(`Page load time: ${pageTimings.onLoad}ms`);
    console.log(`DOM content loaded: ${pageTimings.onContentLoad}ms`);
    
    // Analyze request timings
    const requestAnalysis = entries.map(entry => ({
        url: entry.request.url,
        method: entry.request.method,
        status: entry.response.status,
        totalTime: entry.time,
        waitTime: entry.timings.wait,
        receiveTime: entry.timings.receive,
        blocked: entry.timings.blocked,
        dns: entry.timings.dns,
        connect: entry.timings.connect,
        ssl: entry.timings.ssl,
        size: entry.response.bodySize,
        resourceType: entry._resourceType
    }));
    
    // Find slowest requests
    const slowestRequests = requestAnalysis
        .filter(req => req.totalTime > 0)
        .sort((a, b) => b.totalTime - a.totalTime)
        .slice(0, 10);
    
    console.log('\nSlowest requests:');
    slowestRequests.forEach((req, i) => {
        const url = req.url.length > 80 ? req.url.substring(0, 80) + '...' : req.url;
        console.log(`${i + 1}. ${req.totalTime.toFixed(2)}ms - ${req.resourceType} - ${url}`);
        console.log(`   Wait: ${req.waitTime.toFixed(2)}ms, Receive: ${req.receiveTime.toFixed(2)}ms`);
    });
    
    // API requests analysis
    const apiRequests = requestAnalysis.filter(req => req.url.includes('/api/'));
    if (apiRequests.length > 0) {
        console.log('\nAPI requests:');
        apiRequests.forEach(req => {
            const apiPath = req.url.split('/api/')[1];
            console.log(`  ${req.method} /api/${apiPath} - ${req.totalTime.toFixed(2)}ms (wait: ${req.waitTime.toFixed(2)}ms)`);
        });
    }
    
    // Resource type breakdown
    const resourceTypes = {};
    requestAnalysis.forEach(req => {
        if (!resourceTypes[req.resourceType]) {
            resourceTypes[req.resourceType] = { count: 0, totalTime: 0, totalSize: 0 };
        }
        resourceTypes[req.resourceType].count++;
        resourceTypes[req.resourceType].totalTime += req.totalTime;
        resourceTypes[req.resourceType].totalSize += req.size || 0;
    });
    
    console.log('\nResource type breakdown:');
    Object.entries(resourceTypes).forEach(([type, stats]) => {
        console.log(`  ${type}: ${stats.count} requests, avg ${(stats.totalTime / stats.count).toFixed(2)}ms, ${(stats.totalSize / 1024).toFixed(2)}KB total`);
    });
    
    // Connection analysis
    const connections = {};
    entries.forEach(entry => {
        const connId = entry._connectionId;
        if (connId) {
            if (!connections[connId]) connections[connId] = 0;
            connections[connId]++;
        }
    });
    
    console.log(`\nConnection reuse: ${Object.keys(connections).length} connections for ${entries.length} requests`);
    
    return {
        environment,
        totalRequests: entries.length,
        pageLoadTime: pageTimings.onLoad,
        domContentLoaded: pageTimings.onContentLoad,
        slowestRequests: slowestRequests.slice(0, 5),
        apiRequests,
        resourceTypes,
        connectionCount: Object.keys(connections).length
    };
}

// Analyze both environments
const devAnalysis = analyzeHAR('d:/Coding/PracticeTools/dev.har', 'dev');
const prodAnalysis = analyzeHAR('d:/Coding/PracticeTools/prod.har', 'prod');

console.log('\n=== COMPARISON SUMMARY ===');
console.log(`Page Load Time: Dev ${devAnalysis.pageLoadTime}ms vs Prod ${prodAnalysis.pageLoadTime}ms`);
console.log(`DOM Content Loaded: Dev ${devAnalysis.domContentLoaded}ms vs Prod ${prodAnalysis.domContentLoaded}ms`);
console.log(`Total Requests: Dev ${devAnalysis.totalRequests} vs Prod ${prodAnalysis.totalRequests}`);
console.log(`Connections: Dev ${devAnalysis.connectionCount} vs Prod ${prodAnalysis.connectionCount}`);

console.log('\n=== KEY DIFFERENCES ===');
if (devAnalysis.pageLoadTime > prodAnalysis.pageLoadTime * 1.5) {
    console.log('⚠️  Dev environment is significantly slower than prod');
}

// Compare API response times
console.log('\nAPI Response Time Comparison:');
devAnalysis.apiRequests.forEach(devReq => {
    const prodReq = prodAnalysis.apiRequests.find(p => p.url.split('/api/')[1] === devReq.url.split('/api/')[1]);
    if (prodReq) {
        const apiPath = devReq.url.split('/api/')[1];
        const diff = devReq.totalTime - prodReq.totalTime;
        const diffPercent = ((diff / prodReq.totalTime) * 100).toFixed(1);
        console.log(`  /api/${apiPath}: Dev ${devReq.totalTime.toFixed(2)}ms vs Prod ${prodReq.totalTime.toFixed(2)}ms (${diff > 0 ? '+' : ''}${diffPercent}%)`);
    }
});