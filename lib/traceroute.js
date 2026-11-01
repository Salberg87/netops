import { execFile } from 'child_process';
import { assertHost, toBoundedInt } from './validate.js';
import { promisify } from 'util';
import os from 'os';

const execFileAsync = promisify(execFile);

/**
 * Run traceroute to a host
 * @param {string} host - Target host
 * @param {number} maxHops - Maximum number of hops
 * @returns {Promise<object>} Traceroute results
 */
export async function traceroute(host, maxHops = 30) {
  const platform = os.platform();

  try {
    assertHost(host);
    const hopLimit = String(toBoundedInt(maxHops, { min: 1, max: 64, fallback: 30 }));
    const [cmd, args] = platform === 'win32'
      ? ['tracert', ['-h', hopLimit, host]]
      : ['traceroute', ['-m', hopLimit, '-q', '1', host]];
    const { stdout } = await execFileAsync(cmd, args, { timeout: 60000 });
    const hops = parseTracerouteOutput(stdout, platform);

    return {
      success: true,
      host,
      hops,
      totalHops: hops.length
    };
  } catch (error) {
    // traceroute may exit non-zero but still produce output
    if (error.stdout) {
      const hops = parseTracerouteOutput(error.stdout, platform);
      if (hops.length > 0) {
        return {
          success: true,
          host,
          hops,
          totalHops: hops.length,
          partial: true
        };
      }
    }
    return {
      success: false,
      host,
      error: error.message
    };
  }
}

/**
 * Parse traceroute output
 */
function parseTracerouteOutput(output, platform) {
  const lines = output.split('\n').filter(l => l.trim());
  const hops = [];

  for (const line of lines) {
    // Skip header lines
    if (line.match(/^traceroute|^Tracing|^over a maximum/i)) continue;
    if (line.match(/^Trace complete/i)) continue;

    if (platform === 'win32') {
      const match = line.match(/^\s*(\d+)\s+([\d<*]+\s*ms)\s+([\d<*]+\s*ms)\s+([\d<*]+\s*ms)\s+(.+)/);
      if (match) {
        hops.push({
          hop: parseInt(match[1]),
          rtt: match[2].trim(),
          host: match[5].trim(),
          timeout: match[2].includes('*')
        });
      }
    } else {
      const match = line.match(/^\s*(\d+)\s+(.+)/);
      if (match) {
        const hopNum = parseInt(match[1]);
        const rest = match[2].trim();

        if (rest === '* * *' || rest === '*') {
          hops.push({
            hop: hopNum,
            rtt: null,
            host: '*',
            timeout: true
          });
        } else {
          // Parse hostname/IP and RTT
          const hopMatch = rest.match(/^(\S+)\s+\(?([\d.]+)\)?\s+([\d.]+)\s*ms/);
          const ipOnly = rest.match(/^([\d.]+)\s+([\d.]+)\s*ms/);

          if (hopMatch) {
            hops.push({
              hop: hopNum,
              host: hopMatch[1],
              ip: hopMatch[2],
              rtt: parseFloat(hopMatch[3]),
              timeout: false
            });
          } else if (ipOnly) {
            hops.push({
              hop: hopNum,
              host: ipOnly[1],
              ip: ipOnly[1],
              rtt: parseFloat(ipOnly[2]),
              timeout: false
            });
          } else {
            hops.push({
              hop: hopNum,
              host: rest.split(/\s/)[0],
              rtt: null,
              timeout: rest.includes('*')
            });
          }
        }
      }
    }
  }

  return hops;
}
