import fs from 'fs';

function analyzeHAR(harFilePath) {
    const harData = JSON.parse(fs.readFileSync(harFilePath, 'utf8'));
    const entries = harData.log.entries;
    
    const analysis = {
        summary: {
            totalRequests: entries.length,
            totalTime: 0,
            failedRequests: 0,
            slowRequests: 0
        },
        slowRequests: [],
        failedRequests: [],
        apiCalls: [],
        staticAssets: {
            js: { count: 0, totalSize: 0, avgTime: 0 },
            css: { count: 0, totalSize: 0, avgTime: 0 },
            images: { count: 0, totalSize: 0, avgTime: 0 }
        }
    };
    
    entries.forEach(entry => {
        const url = entry.request.url;
        const method = entry.request.method;
        const status = entry.response.status;
        const time = entry.time;
        const size = entry.response.bodySize;
        
        // Track total time
        analysis.summary.totalTime = Math.max(analysis.summary.totalTime, entry.startedDateTime);
        
        // Failed requests
        if (status >= 400 || status === 0) {
            analysis.summary.failedRequests++;
            analysis.failedRequests.push({
                url: url.split('?')[0], // Remove query params
                method,
                status,
                time: Math.round(time),
                error: entry.response.statusText || 'Network Error'
            });
        }
        
        // Slow requests (>500ms)
        if (time > 500) {
            analysis.summary.slowRequests++;
            analysis.slowRequests.push({
                url: url.split('?')[0],
                method,
                status,
                time: Math.round(time),
                size: Math.round(size / 1024) + 'KB'
            });
        }
        
        // API calls (non-static assets)
        if (!url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ico)(\?|$)/i)) {
            analysis.apiCalls.push({
                url: url.split('?')[0],
                method,
                status,
                time: Math.round(time),
                size: size ? Math.round(size / 1024) + 'KB' : '0KB'
            });
        }
        
        // Static assets categorization
        if (url.match(/\.js(\?|$)/i)) {
            analysis.staticAssets.js.count++;
            analysis.staticAssets.js.totalSize += size || 0;
            analysis.staticAssets.js.avgTime += time;
        } else if (url.match(/\.css(\?|$)/i)) {
            analysis.staticAssets.css.count++;
            analysis.staticAssets.css.totalSize += size || 0;
            analysis.staticAssets.css.avgTime += time;
        } else if (url.match(/\.(png|jpg|jpeg|gif|svg|ico)(\?|$)/i)) {
            analysis.staticAssets.images.count++;
            analysis.staticAssets.images.totalSize += size || 0;
            analysis.staticAssets.images.avgTime += time;
        }
    });
    
    // Calculate averages
    Object.keys(analysis.staticAssets).forEach(type => {
        const asset = analysis.staticAssets[type];
        if (asset.count > 0) {
            asset.avgTime = Math.round(asset.avgTime / asset.count);
            asset.totalSize = Math.round(asset.totalSize / 1024) + 'KB';
        }
    });
    
    return analysis;
}

// Usage
if (process.argv[2]) {
    const analysis = analyzeHAR(process.argv[2]);
    console.log(JSON.stringify(analysis, null, 2));
} else {
    console.log('Usage: node har-analyzer.js <har-file-path>');
}