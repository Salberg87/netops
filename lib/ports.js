import net from 'net';

const COMMON_PORTS = {
  21: 'FTP',
  22: 'SSH',
  25: 'SMTP',
  53: 'DNS',
  80: 'HTTP',
  110: 'POP3',
  143: 'IMAP',
  443: 'HTTPS',
  465: 'SMTPS',
  587: 'SMTP (submission)',
  993: 'IMAPS',
  995: 'POP3S',
  3000: 'Dev server',
  3306: 'MySQL',
  5432: 'PostgreSQL',
  5900: 'VNC',
  6379: 'Redis',
  8080: 'HTTP alt',
  8443: 'HTTPS alt',
  8888: 'HTTP alt',
  9090: 'Prometheus'
};

/**
 * Check if a single port is open on a host
 * @param {string} host - Target host
 * @param {number} port - Port number
 * @param {number} timeout - Connection timeout in ms
 * @returns {Promise<object>} Port status
 */
export async function checkPort(host, port, timeout = 3000) {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      const responseTime = Date.now() - startTime;
      socket.destroy();
      resolve({
        port,
        status: 'open',
        service: COMMON_PORTS[port] || 'unknown',
        responseTime
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        port,
        status: 'filtered',
        service: COMMON_PORTS[port] || 'unknown',
        responseTime: timeout
      });
    });

    socket.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      resolve({
        port,
        status: error.code === 'ECONNREFUSED' ? 'closed' : 'filtered',
        service: COMMON_PORTS[port] || 'unknown',
        responseTime,
        error: error.code
      });
    });

    socket.connect(port, host);
  });
}

/**
 * Scan multiple ports on a host
 * @param {string} host - Target host
 * @param {number[]} ports - Array of ports to scan
 * @param {number} timeout - Timeout per port
 * @param {number} concurrency - Max concurrent connections
 * @returns {Promise<object>} Scan results
 */
export async function scanPorts(host, ports, timeout = 3000, concurrency = 20) {
  const results = [];
  const startTime = Date.now();

  // Process in batches for concurrency control
  for (let i = 0; i < ports.length; i += concurrency) {
    const batch = ports.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(port => checkPort(host, port, timeout))
    );
    results.push(...batchResults);
  }

  const totalTime = Date.now() - startTime;
  const open = results.filter(r => r.status === 'open');
  const closed = results.filter(r => r.status === 'closed');
  const filtered = results.filter(r => r.status === 'filtered');

  return {
    success: true,
    host,
    totalPorts: ports.length,
    open: open.length,
    closed: closed.length,
    filtered: filtered.length,
    results,
    totalTime
  };
}

/**
 * Scan common ports
 */
export async function scanCommonPorts(host, timeout = 3000) {
  const ports = Object.keys(COMMON_PORTS).map(Number);
  return scanPorts(host, ports, timeout);
}

/**
 * Get the list of common ports
 */
export function getCommonPorts() {
  return COMMON_PORTS;
}
