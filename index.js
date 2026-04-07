#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import { ping, pingMultiple } from './lib/ping.js';
import { dnsLookup, comprehensiveDnsCheck, reverseDnsLookup, testDnsServer } from './lib/dns.js';
import { httpTest, checkInternetConnectivity } from './lib/http.js';
import { comprehensiveSpeedTest, downloadSpeedTest, uploadSpeedTest, latencyTest } from './lib/speedtest.js';
import { traceroute } from './lib/traceroute.js';
import { scanPorts, scanCommonPorts, checkPort } from './lib/ports.js';
import { getInterfaces, getRoutes, detectVPN } from './lib/interfaces.js';
import { getWifiInfo } from './lib/wifi.js';
import { whoisLookup } from './lib/whois.js';
import { checkCertificate } from './lib/cert.js';
import {
  formatPingResults,
  formatDnsResults,
  formatComprehensiveDns,
  formatHttpResults,
  formatSpeedTestResults,
  formatConnectivityResults,
  formatTracerouteResults,
  formatPortResults,
  formatInterfaceResults,
  formatRouteResults,
  formatVpnResults,
  formatWifiResults,
  formatWhoisResults,
  formatCertResults,
  setJsonMode,
  outputResult,
  printBanner
} from './lib/formatter.js';

const program = new Command();

program
  .name('netops')
  .description('A lightweight CLI tool for network diagnostics and testing')
  .version('2.0.0')
  .option('--json', 'Output results as JSON');

// Apply JSON mode before all commands
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();
  if (opts.json) setJsonMode(true);
});

// Ping command
program
  .command('ping <host>')
  .description('Ping a host and display statistics')
  .option('-c, --count <number>', 'Number of ping packets to send', '4')
  .action(async (host, options) => {
    const spinner = ora(`Pinging ${host}...`).start();

    try {
      const results = await ping(host, parseInt(options.count));
      spinner.stop();
      outputResult(results, formatPingResults);
    } catch (error) {
      spinner.fail('Ping failed');
      console.error(error.message);
    }
  });

// DNS lookup command
program
  .command('dns <domain>')
  .description('Perform DNS lookup for a domain')
  .option('-t, --type <type>', 'DNS record type (A, AAAA, MX, TXT, CNAME, NS)', 'A')
  .option('-a, --all', 'Perform comprehensive DNS check (all record types)')
  .action(async (domain, options) => {
    if (options.all) {
      const spinner = ora(`Performing comprehensive DNS check for ${domain}...`).start();
      try {
        const results = await comprehensiveDnsCheck(domain);
        spinner.stop();
        outputResult(results, formatComprehensiveDns);
      } catch (error) {
        spinner.fail('DNS check failed');
        console.error(error.message);
      }
    } else {
      const spinner = ora(`Looking up ${options.type} records for ${domain}...`).start();
      try {
        const results = await dnsLookup(domain, options.type);
        spinner.stop();
        outputResult(results, formatDnsResults);
      } catch (error) {
        spinner.fail('DNS lookup failed');
        console.error(error.message);
      }
    }
  });

// Reverse DNS lookup command
program
  .command('rdns <ip>')
  .description('Perform reverse DNS lookup for an IP address')
  .action(async (ip) => {
    const spinner = ora(`Performing reverse DNS lookup for ${ip}...`).start();

    try {
      const results = await reverseDnsLookup(ip);
      spinner.stop();
      outputResult(results, (r) => {
        if (r.success) {
          console.log(`\nHostnames for ${ip}:`);
          r.hostnames.forEach(hostname => console.log(`  - ${hostname}`));
          console.log(`Response time: ${r.responseTime}ms`);
        } else {
          console.error(`Failed: ${r.error}`);
        }
      });
    } catch (error) {
      spinner.fail('Reverse DNS lookup failed');
      console.error(error.message);
    }
  });

// HTTP test command
program
  .command('http <url>')
  .description('Test HTTP/HTTPS connectivity and measure response time')
  .option('-m, --method <method>', 'HTTP method', 'GET')
  .action(async (url, options) => {
    const spinner = ora(`Testing ${url}...`).start();

    try {
      const results = await httpTest(url, { method: options.method });
      spinner.stop();
      outputResult(results, formatHttpResults);
    } catch (error) {
      spinner.fail('HTTP test failed');
      console.error(error.message);
    }
  });

// Internet connectivity check
program
  .command('check')
  .description('Check internet connectivity')
  .action(async () => {
    const spinner = ora('Checking internet connectivity...').start();

    try {
      const results = await checkInternetConnectivity();
      spinner.stop();
      outputResult(results, formatConnectivityResults);
    } catch (error) {
      spinner.fail('Connectivity check failed');
      console.error(error.message);
    }
  });

// Speed test command
program
  .command('speed')
  .description('Run a comprehensive internet speed test')
  .option('-d, --download-only', 'Run download test only')
  .option('-u, --upload-only', 'Run upload test only')
  .action(async (options) => {
    printBanner();

    try {
      if (options.downloadOnly) {
        const spinner = ora('Testing download speed...').start();
        const download = await downloadSpeedTest(10000);
        spinner.stop();
        outputResult({ download }, formatSpeedTestResults);
      } else if (options.uploadOnly) {
        const spinner = ora('Testing upload speed...').start();
        const upload = await uploadSpeedTest(8000);
        spinner.stop();
        outputResult({ upload }, formatSpeedTestResults);
      } else {
        const results = await comprehensiveSpeedTest();
        outputResult(results, formatSpeedTestResults);
      }
    } catch (error) {
      console.error('Speed test failed:', error.message);
    }
  });

// Latency test command
program
  .command('latency')
  .description('Test network latency')
  .option('-c, --count <number>', 'Number of tests to run', '10')
  .action(async (options) => {
    const spinner = ora('Testing latency...').start();

    try {
      const results = await latencyTest(parseInt(options.count));
      spinner.stop();

      outputResult(results, (r) => {
        if (r.success) {
          console.log('\n=== LATENCY TEST RESULTS ===\n');
          console.log(`Average: ${r.avgLatency}ms`);
          console.log(`Min: ${r.minLatency}ms`);
          console.log(`Max: ${r.maxLatency}ms`);
          console.log(`Jitter: ${r.jitter}ms`);
          console.log(`Std Dev: ${r.stdDev}ms`);
          console.log(`Tests: ${r.count}/${options.count}`);
        } else {
          console.error(`Failed: ${r.error}`);
        }
      });
    } catch (error) {
      spinner.fail('Latency test failed');
      console.error(error.message);
    }
  });

// DNS server speed test
program
  .command('dns-speed')
  .description('Test DNS server response time')
  .option('-d, --domain <domain>', 'Domain to test', 'google.com')
  .option('-i, --iterations <number>', 'Number of iterations', '5')
  .action(async (options) => {
    const spinner = ora('Testing DNS server speed...').start();

    try {
      const results = await testDnsServer(options.domain, parseInt(options.iterations));
      spinner.stop();

      outputResult(results, (r) => {
        console.log('\n=== DNS SERVER SPEED TEST ===\n');
        console.log(`Domain: ${r.domain}`);
        console.log(`Average: ${r.avgTime}ms`);
        console.log(`Min: ${r.minTime}ms`);
        console.log(`Max: ${r.maxTime}ms`);
        console.log(`Iterations: ${r.iterations}`);
      });
    } catch (error) {
      spinner.fail('DNS speed test failed');
      console.error(error.message);
    }
  });

// ==========================================
// NEW COMMANDS
// ==========================================

// Traceroute command
program
  .command('trace <host>')
  .description('Trace the route to a host')
  .option('-m, --max-hops <number>', 'Maximum number of hops', '30')
  .action(async (host, options) => {
    const spinner = ora(`Tracing route to ${host}...`).start();

    try {
      const results = await traceroute(host, parseInt(options.maxHops));
      spinner.stop();
      outputResult(results, formatTracerouteResults);
    } catch (error) {
      spinner.fail('Traceroute failed');
      console.error(error.message);
    }
  });

// Port scan command
program
  .command('ports <host>')
  .description('Scan ports on a host')
  .option('-p, --ports <ports>', 'Comma-separated list of ports or range (e.g. 80,443 or 1-1024)')
  .option('-t, --timeout <ms>', 'Timeout per port in ms', '3000')
  .action(async (host, options) => {
    let ports;

    if (options.ports) {
      ports = [];
      for (const part of options.ports.split(',')) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);
          for (let i = start; i <= end; i++) ports.push(i);
        } else {
          ports.push(parseInt(part));
        }
      }
    }

    const label = ports ? `Scanning ${ports.length} ports on ${host}` : `Scanning common ports on ${host}`;
    const spinner = ora(`${label}...`).start();

    try {
      const results = ports
        ? await scanPorts(host, ports, parseInt(options.timeout))
        : await scanCommonPorts(host, parseInt(options.timeout));
      spinner.stop();
      outputResult(results, formatPortResults);
    } catch (error) {
      spinner.fail('Port scan failed');
      console.error(error.message);
    }
  });

// Network interfaces command
program
  .command('iface')
  .description('Show network interfaces and IP addresses')
  .action(async () => {
    try {
      const results = await getInterfaces();
      outputResult(results, formatInterfaceResults);
    } catch (error) {
      console.error('Failed to get interfaces:', error.message);
    }
  });

// Routing table command
program
  .command('route')
  .description('Show routing table and default gateway')
  .action(async () => {
    const spinner = ora('Getting routing table...').start();

    try {
      const results = await getRoutes();
      spinner.stop();
      outputResult(results, formatRouteResults);
    } catch (error) {
      spinner.fail('Failed to get routes');
      console.error(error.message);
    }
  });

// VPN detection command
program
  .command('vpn')
  .description('Detect active VPN and proxy connections')
  .action(async () => {
    const spinner = ora('Detecting VPN/proxy...').start();

    try {
      const results = await detectVPN();
      spinner.stop();
      outputResult(results, formatVpnResults);
    } catch (error) {
      spinner.fail('VPN detection failed');
      console.error(error.message);
    }
  });

// WiFi info command
program
  .command('wifi')
  .description('Show WiFi connection details (signal, channel, noise)')
  .action(async () => {
    const spinner = ora('Getting WiFi info...').start();

    try {
      const results = await getWifiInfo();
      spinner.stop();
      outputResult(results, formatWifiResults);
    } catch (error) {
      spinner.fail('WiFi check failed');
      console.error(error.message);
    }
  });

// WHOIS command
program
  .command('whois <domain>')
  .description('WHOIS lookup for a domain')
  .action(async (domain) => {
    const spinner = ora(`Looking up WHOIS for ${domain}...`).start();

    try {
      const results = await whoisLookup(domain);
      spinner.stop();
      outputResult(results, formatWhoisResults);
    } catch (error) {
      spinner.fail('WHOIS lookup failed');
      console.error(error.message);
    }
  });

// SSL certificate check command
program
  .command('cert <host>')
  .description('Check SSL/TLS certificate for a host')
  .option('-p, --port <number>', 'Port number', '443')
  .action(async (host, options) => {
    const spinner = ora(`Checking certificate for ${host}...`).start();

    try {
      const results = await checkCertificate(host, parseInt(options.port));
      spinner.stop();
      outputResult(results, formatCertResults);
    } catch (error) {
      spinner.fail('Certificate check failed');
      console.error(error.message);
    }
  });

// ==========================================
// COMPOSITE COMMANDS
// ==========================================

// All-in-one diagnostic command
program
  .command('diagnose')
  .description('Run comprehensive network diagnostics (no speed test)')
  .action(async () => {
    printBanner();
    console.log('Running comprehensive network diagnostics...\n');

    // Internet connectivity
    const spinner1 = ora('Step 1/6: Checking internet connectivity...').start();
    const connectivity = await checkInternetConnectivity();
    spinner1.stop();
    formatConnectivityResults(connectivity);

    if (!connectivity.connected) {
      console.log('\nInternet connectivity issues detected. Stopping diagnostics.');
      return;
    }

    // VPN/proxy check
    const spinner2 = ora('Step 2/6: Checking VPN/proxy...').start();
    const vpnResult = await detectVPN();
    spinner2.stop();
    formatVpnResults(vpnResult);

    // DNS test
    const spinner3 = ora('Step 3/6: Testing DNS resolution...').start();
    const dnsResult = await dnsLookup('google.com', 'A');
    spinner3.stop();
    formatDnsResults(dnsResult);

    // Ping test
    const spinner4 = ora('Step 4/6: Testing ping to google.com...').start();
    const pingResult = await ping('google.com', 4);
    spinner4.stop();
    formatPingResults(pingResult);

    // Latency test
    const spinner5 = ora('Step 5/6: Testing latency...').start();
    const latencyResult = await latencyTest(5);
    spinner5.stop();

    if (latencyResult.success) {
      console.log('\n=== LATENCY TEST ===\n');
      console.log(`Average: ${latencyResult.avgLatency}ms`);
      console.log(`Min: ${latencyResult.minLatency}ms`);
      console.log(`Max: ${latencyResult.maxLatency}ms`);
      console.log(`Jitter: ${latencyResult.jitter}ms`);
    }

    // Interfaces
    const spinner6 = ora('Step 6/6: Getting interface info...').start();
    const ifaceResult = await getInterfaces();
    spinner6.stop();
    formatInterfaceResults(ifaceResult);

    console.log('\n' + '='.repeat(50));
    console.log('Diagnostics complete!');
  });

// Full test suite - everything including speed test
program
  .command('full')
  .description('Run ALL tests including speed test (comprehensive + speed)')
  .action(async () => {
    printBanner();
    console.log('Running FULL network test suite...\n');
    console.log('This will take approximately 30-60 seconds.\n');

    // Internet connectivity
    const spinner1 = ora('Step 1/9: Checking internet connectivity...').start();
    const connectivity = await checkInternetConnectivity();
    spinner1.stop();
    formatConnectivityResults(connectivity);

    if (!connectivity.connected) {
      console.log('\nInternet connectivity issues detected. Stopping tests.');
      return;
    }

    // VPN/proxy check
    const spinner2 = ora('Step 2/9: Checking VPN/proxy...').start();
    const vpnResult = await detectVPN();
    spinner2.stop();
    formatVpnResults(vpnResult);

    // Interface info
    const spinnerIface = ora('Step 3/9: Getting interface info...').start();
    const ifaceResult = await getInterfaces();
    spinnerIface.stop();
    formatInterfaceResults(ifaceResult);

    // DNS comprehensive check
    const spinner3 = ora('Step 4/9: Performing comprehensive DNS check...').start();
    const dnsResult = await comprehensiveDnsCheck('google.com');
    spinner3.stop();
    formatComprehensiveDns(dnsResult);

    // DNS server speed
    const spinner4 = ora('Step 5/9: Testing DNS server speed...').start();
    const dnsSpeedResult = await testDnsServer('google.com', 5);
    spinner4.stop();
    console.log('\n=== DNS SERVER SPEED ===\n');
    console.log(`Average: ${dnsSpeedResult.avgTime}ms`);
    console.log(`Min: ${dnsSpeedResult.minTime}ms`);
    console.log(`Max: ${dnsSpeedResult.maxTime}ms`);

    // Ping test
    const spinner5 = ora('Step 6/9: Testing ping to google.com...').start();
    const pingResult = await ping('google.com', 4);
    spinner5.stop();
    formatPingResults(pingResult);

    // HTTP test
    const spinner6 = ora('Step 7/9: Testing HTTP connectivity...').start();
    const httpResult = await httpTest('https://www.google.com');
    spinner6.stop();
    formatHttpResults(httpResult);

    // Latency test
    const spinner7 = ora('Step 8/9: Testing latency...').start();
    const latencyResult = await latencyTest(10);
    spinner7.stop();
    if (latencyResult.success) {
      console.log('\n=== LATENCY TEST ===\n');
      console.log(`Average: ${latencyResult.avgLatency}ms`);
      console.log(`Min: ${latencyResult.minLatency}ms`);
      console.log(`Max: ${latencyResult.maxLatency}ms`);
      console.log(`Jitter: ${latencyResult.jitter}ms`);
    }

    // Speed test (this is the longest part)
    console.log('\n' + '='.repeat(50));
    console.log('Step 9/9: Running comprehensive speed test...');
    console.log('This may take 20-30 seconds...\n');
    const speedResults = await comprehensiveSpeedTest();
    formatSpeedTestResults(speedResults);

    // Final summary
    console.log('\n' + '='.repeat(50));
    console.log('='.repeat(50));
    console.log('FULL TEST SUITE COMPLETE!');
    console.log('='.repeat(50));
    console.log('\nSUMMARY:');
    console.log(`  ${connectivity.connected ? '✓' : '✗'} Internet Connectivity: ${connectivity.connected ? 'Connected' : 'Disconnected'}`);
    console.log(`  ${vpnResult.vpnDetected ? '⚡' : '✓'} VPN/Proxy: ${vpnResult.vpnDetected ? `Detected (${vpnResult.vpns.length})` : 'None detected'}`);
    console.log(`  ${dnsResult.A?.success ? '✓' : '✗'} DNS Resolution: ${dnsResult.A?.success ? 'Working' : 'Failed'}`);
    console.log(`  ${pingResult.success ? '✓' : '✗'} Ping: ${pingResult.success ? pingResult.avgTime + 'ms avg' : 'Failed'}`);
    console.log(`  ${httpResult.success ? '✓' : '✗'} HTTP: ${httpResult.success ? httpResult.statusCode : 'Failed'}`);
    console.log(`  ${latencyResult.success ? '✓' : '✗'} Latency: ${latencyResult.success ? latencyResult.avgLatency + 'ms avg (jitter: ' + latencyResult.jitter + 'ms)' : 'Failed'}`);
    if (speedResults.download?.success) {
      console.log(`  ✓ Download Speed: ${speedResults.download.speedMbps} Mbps`);
    }
    if (speedResults.upload?.success) {
      console.log(`  ✓ Upload Speed: ${speedResults.upload.speedMbps} Mbps`);
    }
    console.log('\n' + '='.repeat(50));
  });

program.parse();
