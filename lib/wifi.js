import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Get WiFi information
 * @returns {Promise<object>} WiFi details
 */
export async function getWifiInfo() {
  const platform = os.platform();

  try {
    if (platform === 'darwin') {
      return await getMacWifiInfo();
    } else if (platform === 'linux') {
      return await getLinuxWifiInfo();
    } else if (platform === 'win32') {
      return await getWindowsWifiInfo();
    }

    return {
      success: false,
      error: `Unsupported platform: ${platform}`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get WiFi info on macOS
 */
async function getMacWifiInfo() {
  try {
    // Try the modern system_profiler approach first
    const { stdout: profilerOut } = await execAsync(
      'system_profiler SPAirPortDataType -json 2>/dev/null',
      { timeout: 10000 }
    );

    const data = JSON.parse(profilerOut);
    const airportData = data?.SPAirPortDataType?.[0];
    const currentNetwork = airportData?.spairport_airport_interfaces?.[0]?.spairport_current_network_information;

    // Also try airport CLI for signal info
    let signalInfo = {};
    try {
      const airportPath = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport';
      const { stdout: airportOut } = await execAsync(`${airportPath} -I 2>/dev/null`);
      signalInfo = parseAirportOutput(airportOut);
    } catch (e) {
      // airport CLI may not be available on newer macOS
    }

    // Try wdutil for modern macOS
    if (!signalInfo.ssid) {
      try {
        const { stdout: wdutilOut } = await execAsync('wdutil info 2>/dev/null');
        const wdInfo = parseWdutilOutput(wdutilOut);
        signalInfo = { ...signalInfo, ...wdInfo };
      } catch (e) {
        // wdutil requires sudo, may not work
      }
    }

    // Fallback to networksetup
    if (!signalInfo.ssid) {
      try {
        const { stdout: ssidOut } = await execAsync('networksetup -getairportnetwork en0 2>/dev/null');
        const ssidMatch = ssidOut.match(/Current Wi-Fi Network:\s*(.+)/);
        if (ssidMatch) signalInfo.ssid = ssidMatch[1].trim();
      } catch (e) {
        // May fail if no WiFi
      }
    }

    if (!signalInfo.ssid && !currentNetwork) {
      return {
        success: false,
        error: 'Not connected to WiFi'
      };
    }

    return {
      success: true,
      ...signalInfo,
      ...(currentNetwork ? {
        ssid: signalInfo.ssid || currentNetwork?.['_name'],
        security: currentNetwork?.spairport_security_mode
      } : {})
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Parse airport CLI output
 */
function parseAirportOutput(output) {
  const info = {};
  const lines = output.split('\n');

  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (!key || valueParts.length === 0) continue;
    const value = valueParts.join(':').trim();

    switch (key.trim()) {
      case 'SSID': info.ssid = value; break;
      case 'BSSID': info.bssid = value; break;
      case 'agrCtlRSSI': info.rssi = parseInt(value); break;
      case 'agrCtlNoise': info.noise = parseInt(value); break;
      case 'channel': info.channel = value; break;
      case 'lastTxRate': info.txRate = parseInt(value); break;
      case 'maxRate': info.maxRate = parseInt(value); break;
      case 'MCS': info.mcs = parseInt(value); break;
      case 'link auth': info.auth = value; break;
    }
  }

  // Calculate SNR if we have both values
  if (info.rssi !== undefined && info.noise !== undefined) {
    info.snr = info.rssi - info.noise;
    info.signalQuality = getSignalQuality(info.rssi);
  }

  return info;
}

/**
 * Parse wdutil output
 */
function parseWdutilOutput(output) {
  const info = {};
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('SSID')) {
      const match = trimmed.match(/SSID\s*:\s*(.+)/);
      if (match) info.ssid = match[1].trim();
    }
    if (trimmed.startsWith('RSSI')) {
      const match = trimmed.match(/RSSI\s*:\s*([-\d]+)/);
      if (match) info.rssi = parseInt(match[1]);
    }
    if (trimmed.startsWith('Noise')) {
      const match = trimmed.match(/Noise\s*:\s*([-\d]+)/);
      if (match) info.noise = parseInt(match[1]);
    }
    if (trimmed.startsWith('Channel')) {
      const match = trimmed.match(/Channel\s*:\s*(.+)/);
      if (match) info.channel = match[1].trim();
    }
    if (trimmed.startsWith('Tx Rate')) {
      const match = trimmed.match(/Tx Rate\s*:\s*(\d+)/);
      if (match) info.txRate = parseInt(match[1]);
    }
  }

  if (info.rssi !== undefined && info.noise !== undefined) {
    info.snr = info.rssi - info.noise;
    info.signalQuality = getSignalQuality(info.rssi);
  }

  return info;
}

/**
 * Get WiFi info on Linux
 */
async function getLinuxWifiInfo() {
  try {
    const { stdout } = await execAsync('iwconfig 2>/dev/null || nmcli dev wifi show-password 2>/dev/null');
    const info = {};

    const ssidMatch = stdout.match(/ESSID:"([^"]+)"/);
    const freqMatch = stdout.match(/Frequency:([\d.]+)/);
    const qualMatch = stdout.match(/Link Quality=(\d+)\/(\d+)/);
    const signalMatch = stdout.match(/Signal level=([-\d]+)/);
    const rateMatch = stdout.match(/Bit Rate=([\d.]+)/);

    if (ssidMatch) info.ssid = ssidMatch[1];
    if (freqMatch) info.frequency = parseFloat(freqMatch[1]);
    if (qualMatch) info.linkQuality = `${qualMatch[1]}/${qualMatch[2]}`;
    if (signalMatch) {
      info.rssi = parseInt(signalMatch[1]);
      info.signalQuality = getSignalQuality(info.rssi);
    }
    if (rateMatch) info.txRate = parseFloat(rateMatch[1]);

    return {
      success: !!info.ssid,
      ...info,
      ...(info.ssid ? {} : { error: 'Not connected to WiFi' })
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get WiFi info on Windows
 */
async function getWindowsWifiInfo() {
  try {
    const { stdout } = await execAsync('netsh wlan show interfaces');
    const info = {};

    const ssidMatch = stdout.match(/SSID\s+:\s+(.+)/);
    const signalMatch = stdout.match(/Signal\s+:\s+(\d+)%/);
    const radioMatch = stdout.match(/Radio type\s+:\s+(.+)/);
    const channelMatch = stdout.match(/Channel\s+:\s+(\d+)/);
    const rateMatch = stdout.match(/Receive rate.*?:\s+([\d.]+)/);

    if (ssidMatch) info.ssid = ssidMatch[1].trim();
    if (signalMatch) info.signalPercent = parseInt(signalMatch[1]);
    if (radioMatch) info.radioType = radioMatch[1].trim();
    if (channelMatch) info.channel = channelMatch[1];
    if (rateMatch) info.rxRate = parseFloat(rateMatch[1]);

    return {
      success: !!info.ssid,
      ...info,
      ...(info.ssid ? {} : { error: 'Not connected to WiFi' })
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Assess signal quality based on RSSI
 */
function getSignalQuality(rssi) {
  if (rssi >= -50) return 'Excellent';
  if (rssi >= -60) return 'Good';
  if (rssi >= -70) return 'Fair';
  if (rssi >= -80) return 'Weak';
  return 'Very weak';
}
