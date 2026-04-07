import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Get all network interfaces with details
 * @returns {Promise<object>} Interface information
 */
export async function getInterfaces() {
  const interfaces = os.networkInterfaces();
  const result = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    const iface = {
      name,
      addresses: addrs.map(a => ({
        address: a.address,
        family: a.family,
        netmask: a.netmask,
        internal: a.internal,
        mac: a.mac
      }))
    };

    // Classify interface type
    iface.type = classifyInterface(name);
    result.push(iface);
  }

  return {
    success: true,
    interfaces: result,
    hostname: os.hostname(),
    platform: os.platform()
  };
}

/**
 * Classify interface by name
 */
function classifyInterface(name) {
  if (name.startsWith('lo')) return 'loopback';
  if (name.startsWith('en0') || name.startsWith('wlan')) return 'wifi';
  if (name.startsWith('en') || name.startsWith('eth')) return 'ethernet';
  if (name.startsWith('utun') || name.startsWith('tun') || name.startsWith('tap')) return 'vpn/tunnel';
  if (name.startsWith('bridge')) return 'bridge';
  if (name.startsWith('awdl')) return 'airdrop';
  if (name.startsWith('llw')) return 'low-latency-wlan';
  if (name.startsWith('ap')) return 'access-point';
  if (name.startsWith('gif') || name.startsWith('stf')) return 'tunnel';
  if (name.startsWith('anpi')) return 'apple-network';
  return 'other';
}

/**
 * Get routing table
 * @returns {Promise<object>} Routing information
 */
export async function getRoutes() {
  const platform = os.platform();

  try {
    let command;
    if (platform === 'win32') {
      command = 'route print';
    } else if (platform === 'darwin') {
      command = 'netstat -rn';
    } else {
      command = 'ip route show';
    }

    const { stdout } = await execAsync(command);
    const routes = parseRoutes(stdout, platform);

    // Get default gateway
    const defaultRoute = routes.find(r => r.destination === 'default' || r.destination === '0.0.0.0');

    return {
      success: true,
      routes,
      defaultGateway: defaultRoute?.gateway || null,
      defaultInterface: defaultRoute?.interface || null
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Parse routing table output
 */
function parseRoutes(output, platform) {
  const lines = output.split('\n').filter(l => l.trim());
  const routes = [];

  if (platform === 'darwin') {
    // Skip header lines
    let started = false;
    for (const line of lines) {
      if (line.match(/^Destination/)) {
        started = true;
        continue;
      }
      if (!started) continue;
      if (line.match(/^Internet6:|^Routing Tables/)) {
        started = false;
        continue;
      }

      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        routes.push({
          destination: parts[0],
          gateway: parts[1],
          flags: parts[2],
          interface: parts[parts.length - 1]
        });
      }
    }
  } else if (platform === 'linux') {
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const route = { destination: parts[0] };
      for (let i = 1; i < parts.length; i += 2) {
        if (parts[i] === 'via') route.gateway = parts[i + 1];
        if (parts[i] === 'dev') route.interface = parts[i + 1];
        if (parts[i] === 'metric') route.metric = parts[i + 1];
      }
      routes.push(route);
    }
  }

  return routes;
}

/**
 * Detect active VPN connections
 * @returns {Promise<object>} VPN detection results
 */
export async function detectVPN() {
  const platform = os.platform();
  const vpns = [];

  try {
    // Check for VPN tunnel interfaces
    const interfaces = os.networkInterfaces();
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (name.startsWith('utun') || name.startsWith('tun') || name.startsWith('tap') ||
          name.startsWith('ppp') || name.startsWith('ipsec')) {
        const ipv4 = addrs.find(a => a.family === 'IPv4');
        if (ipv4) {
          vpns.push({
            interface: name,
            address: ipv4.address,
            type: 'tunnel'
          });
        }
      }
    }

    // Check for known VPN processes
    const vpnProcesses = [
      { name: 'Proton VPN', patterns: ['protonvpn', 'ProtonVPN', 'WireGuard-Extension'] },
      { name: 'NordVPN', patterns: ['nordvpn', 'NordVPN'] },
      { name: 'ExpressVPN', patterns: ['expressvpn', 'ExpressVPN'] },
      { name: 'Mullvad', patterns: ['mullvad'] },
      { name: 'Tailscale', patterns: ['tailscaled'] },
      { name: 'WireGuard', patterns: ['wireguard-go', 'wg-quick'] },
      { name: 'OpenVPN', patterns: ['openvpn'] },
      { name: 'Cloudflare WARP', patterns: ['warp-svc', 'CloudflareWARP'] }
    ];

    const { stdout } = await execAsync('ps aux');

    for (const vpn of vpnProcesses) {
      for (const pattern of vpn.patterns) {
        if (stdout.toLowerCase().includes(pattern.toLowerCase())) {
          // Check if already detected
          if (!vpns.find(v => v.name === vpn.name)) {
            vpns.push({
              name: vpn.name,
              type: 'process',
              running: true
            });
          } else {
            // Update existing entry with name
            const existing = vpns.find(v => !v.name);
            if (existing) existing.name = vpn.name;
          }
          break;
        }
      }
    }

    // Check proxy settings (macOS)
    if (platform === 'darwin') {
      try {
        const { stdout: proxyOut } = await execAsync('scutil --proxy');
        const httpProxy = proxyOut.match(/HTTPEnable\s*:\s*1/);
        const httpsProxy = proxyOut.match(/HTTPSEnable\s*:\s*1/);
        const socksProxy = proxyOut.match(/SOCKSEnable\s*:\s*1/);

        if (httpProxy || httpsProxy || socksProxy) {
          vpns.push({
            name: 'System Proxy',
            type: 'proxy',
            http: !!httpProxy,
            https: !!httpsProxy,
            socks: !!socksProxy
          });
        }
      } catch (e) {
        // Ignore proxy check errors
      }
    }

    // Check default route to see if traffic goes through VPN
    const { stdout: routeOut } = await execAsync('route -n get default 2>/dev/null || ip route show default 2>/dev/null');
    const ifaceMatch = routeOut.match(/interface:\s*(\S+)/);
    const gwMatch = routeOut.match(/gateway:\s*(\S+)/);

    const defaultInterface = ifaceMatch?.[1] || null;
    const isVpnRoute = defaultInterface && (
      defaultInterface.startsWith('utun') ||
      defaultInterface.startsWith('tun') ||
      defaultInterface.startsWith('ppp')
    );

    return {
      success: true,
      vpnDetected: vpns.length > 0,
      activeVpnRoute: isVpnRoute,
      defaultInterface,
      defaultGateway: gwMatch?.[1] || null,
      vpns
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
