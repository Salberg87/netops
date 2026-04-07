import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Ping a host and return statistics
 * @param {string} host - The host to ping
 * @param {number} count - Number of ping packets to send
 * @returns {Promise<object>} Ping statistics
 */
export async function ping(host, count = 4) {
  const platform = os.platform();
  let command;

  if (platform === 'win32') {
    command = `ping -n ${count} ${host}`;
  } else {
    // macOS and Linux
    command = `ping -c ${count} ${host}`;
  }

  try {
    const { stdout } = await execAsync(command);

    // Parse the output
    const stats = parsePingOutput(stdout, platform);

    return {
      success: true,
      host,
      ...stats
    };
  } catch (error) {
    return {
      success: false,
      host,
      error: error.message
    };
  }
}

/**
 * Parse ping output based on platform
 */
function parsePingOutput(output, platform) {
  const stats = {
    packetsTransmitted: 0,
    packetsReceived: 0,
    packetLoss: 0,
    minTime: 0,
    avgTime: 0,
    maxTime: 0
  };

  try {
    if (platform === 'win32') {
      // Windows parsing
      const sentMatch = output.match(/Sent = (\d+)/);
      const receivedMatch = output.match(/Received = (\d+)/);
      const lossMatch = output.match(/Lost = (\d+)/);
      const timeMatch = output.match(/Minimum = (\d+)ms, Maximum = (\d+)ms, Average = (\d+)ms/);

      if (sentMatch) stats.packetsTransmitted = parseInt(sentMatch[1]);
      if (receivedMatch) stats.packetsReceived = parseInt(receivedMatch[1]);
      if (lossMatch) {
        const lost = parseInt(lossMatch[1]);
        stats.packetLoss = (lost / stats.packetsTransmitted * 100).toFixed(1);
      }
      if (timeMatch) {
        stats.minTime = parseFloat(timeMatch[1]);
        stats.maxTime = parseFloat(timeMatch[2]);
        stats.avgTime = parseFloat(timeMatch[3]);
      }
    } else {
      // Unix-like parsing (macOS, Linux)
      const statsMatch = output.match(/(\d+) packets transmitted, (\d+) (?:packets )?received, ([\d.]+)% packet loss/);
      const timeMatch = output.match(/min\/avg\/max\/(?:stddev|mdev) = ([\d.]+)\/([\d.]+)\/([\d.]+)/);

      if (statsMatch) {
        stats.packetsTransmitted = parseInt(statsMatch[1]);
        stats.packetsReceived = parseInt(statsMatch[2]);
        stats.packetLoss = parseFloat(statsMatch[3]);
      }
      if (timeMatch) {
        stats.minTime = parseFloat(timeMatch[1]);
        stats.avgTime = parseFloat(timeMatch[2]);
        stats.maxTime = parseFloat(timeMatch[3]);
      }
    }
  } catch (error) {
    console.error('Error parsing ping output:', error);
  }

  return stats;
}

/**
 * Ping multiple hosts concurrently
 */
export async function pingMultiple(hosts, count = 4) {
  const promises = hosts.map(host => ping(host, count));
  return await Promise.all(promises);
}
