import https from 'https';

/**
 * Download speed test using a test file
 */
export async function downloadSpeedTest(duration = 10000) {
  // Use multiple test URLs for reliability
  const testUrls = [
    'https://speed.cloudflare.com/__down?bytes=25000000', // 25MB
    'https://proof.ovh.net/files/10Mb.dat',
    'https://ash-speed.hetzner.com/10MB.bin'
  ];

  let bestResult = null;

  for (const url of testUrls) {
    const result = await performDownloadTest(url, duration);
    if (result.success && (!bestResult || result.speedMbps > bestResult.speedMbps)) {
      bestResult = result;
    }
    if (bestResult && bestResult.speedMbps > 0) {
      break; // Use first successful test
    }
  }

  return bestResult || {
    success: false,
    error: 'All download tests failed'
  };
}

/**
 * Perform a single download test
 */
function performDownloadTest(url, duration) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let totalBytes = 0;
    let firstByteTime = null;

    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        resolve({
          success: false,
          error: `HTTP ${res.statusCode}`
        });
        return;
      }

      res.on('data', (chunk) => {
        if (!firstByteTime) {
          firstByteTime = Date.now() - startTime;
        }
        totalBytes += chunk.length;

        // Stop after specified duration
        if (Date.now() - startTime >= duration) {
          req.destroy();
          res.destroy();
        }
      });

      res.on('end', () => {
        const totalTime = (Date.now() - startTime) / 1000;
        const speedMbps = (totalBytes * 8) / (totalTime * 1000000);
        const speedMBps = totalBytes / (totalTime * 1000000);

        resolve({
          success: true,
          totalBytes,
          duration: totalTime.toFixed(2),
          speedMbps: speedMbps.toFixed(2),
          speedMBps: speedMBps.toFixed(2),
          latency: firstByteTime
        });
      });

      res.on('error', () => {
        resolve({
          success: false,
          error: 'Download failed'
        });
      });
    });

    req.on('error', () => {
      resolve({
        success: false,
        error: 'Connection failed'
      });
    });

    req.setTimeout(duration + 2000, () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Timeout'
      });
    });
  });
}

/**
 * Upload speed test
 */
export async function uploadSpeedTest(duration = 10000) {
  const testUrl = 'https://speed.cloudflare.com/__up';
  const startTime = Date.now();

  return new Promise((resolve) => {
    // Generate random data to upload
    const chunkSize = 1024 * 1024; // 1MB chunks
    let totalBytes = 0;

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    };

    const req = https.request(testUrl, options, (res) => {
      res.on('data', () => {}); // Consume response
      res.on('end', () => {
        const totalTime = (Date.now() - startTime) / 1000;
        const speedMbps = (totalBytes * 8) / (totalTime * 1000000);
        const speedMBps = totalBytes / (totalTime * 1000000);

        resolve({
          success: true,
          totalBytes,
          duration: totalTime.toFixed(2),
          speedMbps: speedMbps.toFixed(2),
          speedMBps: speedMBps.toFixed(2)
        });
      });
    });

    req.on('error', () => {
      resolve({
        success: false,
        error: 'Upload failed'
      });
    });

    // Send data chunks
    const sendChunk = () => {
      if (Date.now() - startTime >= duration) {
        req.end();
        return;
      }

      const chunk = Buffer.alloc(chunkSize);
      totalBytes += chunkSize;
      req.write(chunk, () => {
        setImmediate(sendChunk);
      });
    };

    sendChunk();
  });
}

/**
 * Latency test (ping-like measurement to web server)
 */
export async function latencyTest(count = 10) {
  const testUrl = 'https://www.google.com';
  const latencies = [];

  for (let i = 0; i < count; i++) {
    const startTime = Date.now();

    const latency = await new Promise((resolve) => {
      const req = https.get(testUrl, (res) => {
        res.resume(); // Consume response
        resolve(Date.now() - startTime);
      });

      req.on('error', () => {
        resolve(null);
      });

      req.setTimeout(5000);
    });

    if (latency !== null) {
      latencies.push(latency);
    }
  }

  if (latencies.length === 0) {
    return {
      success: false,
      error: 'All latency tests failed'
    };
  }

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);

  // Calculate jitter (average difference between consecutive measurements)
  let jitter = 0;
  if (latencies.length > 1) {
    let totalDiff = 0;
    for (let i = 1; i < latencies.length; i++) {
      totalDiff += Math.abs(latencies[i] - latencies[i - 1]);
    }
    jitter = totalDiff / (latencies.length - 1);
  }

  // Standard deviation
  const variance = latencies.reduce((sum, val) => sum + Math.pow(val - avgLatency, 2), 0) / latencies.length;
  const stdDev = Math.sqrt(variance);

  return {
    success: true,
    count: latencies.length,
    avgLatency: avgLatency.toFixed(2),
    minLatency,
    maxLatency,
    jitter: jitter.toFixed(2),
    stdDev: stdDev.toFixed(2),
    latencies
  };
}

/**
 * Comprehensive speed test
 */
export async function comprehensiveSpeedTest() {
  console.log('Running latency test...');
  const latency = await latencyTest(5);

  console.log('Running download speed test...');
  const download = await downloadSpeedTest(10000);

  console.log('Running upload speed test...');
  const upload = await uploadSpeedTest(8000);

  return {
    latency,
    download,
    upload,
    timestamp: new Date().toISOString()
  };
}
