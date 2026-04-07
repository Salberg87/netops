import https from 'https';
import http from 'http';
import { URL } from 'url';

/**
 * Test HTTP/HTTPS connectivity and measure response time
 * @param {string} url - The URL to test
 * @param {object} options - Request options
 * @returns {Promise<object>} HTTP test results
 */
export async function httpTest(url, options = {}) {
  const startTime = Date.now();

  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        timeout: options.timeout || 10000,
        headers: {
          'User-Agent': 'NetOps/1.0',
          ...options.headers
        }
      };

      const req = protocol.request(requestOptions, (res) => {
        const responseTime = Date.now() - startTime;
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          resolve({
            success: true,
            url,
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            responseTime,
            contentLength: data.length,
            protocol: parsedUrl.protocol
          });
        });
      });

      req.on('error', (error) => {
        const responseTime = Date.now() - startTime;
        resolve({
          success: false,
          url,
          error: error.message,
          responseTime
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const responseTime = Date.now() - startTime;
        resolve({
          success: false,
          url,
          error: 'Request timeout',
          responseTime
        });
      });

      req.end();
    } catch (error) {
      const responseTime = Date.now() - startTime;
      resolve({
        success: false,
        url,
        error: error.message,
        responseTime
      });
    }
  });
}

/**
 * Test multiple URLs
 */
export async function testMultipleUrls(urls, options = {}) {
  const promises = urls.map(url => httpTest(url, options));
  return await Promise.all(promises);
}

/**
 * Check if internet is reachable
 */
export async function checkInternetConnectivity() {
  const testUrls = [
    'https://www.google.com',
    'https://www.cloudflare.com',
    'https://www.amazon.com'
  ];

  const results = await testMultipleUrls(testUrls);
  const successCount = results.filter(r => r.success).length;

  return {
    connected: successCount > 0,
    successRate: (successCount / testUrls.length * 100).toFixed(1),
    results
  };
}

/**
 * Measure download speed from a URL
 */
export async function measureDownloadSpeed(url, duration = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let totalBytes = 0;
    let firstByteTime = null;

    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const req = protocol.get(url, (res) => {
        res.on('data', (chunk) => {
          if (!firstByteTime) {
            firstByteTime = Date.now() - startTime;
          }
          totalBytes += chunk.length;

          // Stop after duration
          if (Date.now() - startTime >= duration) {
            res.destroy();
          }
        });

        res.on('end', () => {
          const totalTime = (Date.now() - startTime) / 1000; // in seconds
          const speedMbps = (totalBytes * 8) / (totalTime * 1000000); // Convert to Mbps

          resolve({
            success: true,
            totalBytes,
            duration: totalTime,
            speedMbps: speedMbps.toFixed(2),
            speedMBps: (totalBytes / (totalTime * 1000000)).toFixed(2),
            firstByteTime
          });
        });

        res.on('error', (error) => {
          resolve({
            success: false,
            error: error.message
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message
        });
      });

      req.setTimeout(duration + 1000);
    } catch (error) {
      resolve({
        success: false,
        error: error.message
      });
    }
  });
}
