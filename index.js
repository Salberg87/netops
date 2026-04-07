#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { createRequire } from "module";
import { execSync, spawn } from "child_process";
import { ping } from "./lib/ping.js";
import {
  dnsLookup,
  comprehensiveDnsCheck,
  reverseDnsLookup,
  testDnsServer,
} from "./lib/dns.js";
import { httpTest, checkInternetConnectivity } from "./lib/http.js";
import {
  comprehensiveSpeedTest,
  downloadSpeedTest,
  uploadSpeedTest,
  latencyTest,
} from "./lib/speedtest.js";
import { traceroute } from "./lib/traceroute.js";
import { scanPorts, scanCommonPorts } from "./lib/ports.js";
import { getInterfaces, getRoutes, detectVPN } from "./lib/interfaces.js";
import { getWifiInfo } from "./lib/wifi.js";
import { whoisLookup } from "./lib/whois.js";
import { checkCertificate } from "./lib/cert.js";
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
  formatLatencyResults,
  formatDnsSpeedResults,
  outputResult,
  setJsonMode,
} from "./lib/formatter.js";
import {
  banner,
  footer,
  section,
  status,
  kv,
  blank,
  setSuppressOutput,
} from "./lib/ui.js";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const program = new Command();

program
  .name("netops")
  .description("Network diagnostics CLI")
  .version(pkg.version)
  .option("--json", "Output results as JSON")
  .option("--no-color", "Disable colored output");

program.showSuggestionAfterError(true);

// Commands that manage their own banner/footer
const selfManagedCommands = new Set(["diagnose", "full", "report", "ask"]);
let _compositeMode = false;

// Apply global options before all commands
program.hook("preAction", (thisCommand, actionCommand) => {
  const opts = thisCommand.opts();
  if (opts.json) setJsonMode(true);
  if (opts.color === false) chalk.level = 0;

  const cmdName = actionCommand.name();
  if (selfManagedCommands.has(cmdName)) {
    _compositeMode = true;
  }

  if (!_compositeMode && !opts.json) banner();
});

program.hook("postAction", (thisCommand) => {
  const opts = thisCommand.opts();
  if (!_compositeMode && !opts.json) footer();
});

// ==========================================
// BASIC COMMANDS
// ==========================================

program
  .command("ping <host>")
  .description("Ping a host and display statistics")
  .option("-c, --count <number>", "Number of ping packets to send", "4")
  .action(async (host, options) => {
    const spinner = ora({ text: `Pinging ${host}...`, color: "cyan" }).start();
    try {
      const results = await ping(host, parseInt(options.count));
      spinner.stop();
      outputResult(results, formatPingResults);
    } catch (error) {
      spinner.fail("Ping failed");
      console.error(error.message);
    }
  });

program
  .command("dns <domain>")
  .description("Perform DNS lookup for a domain")
  .option(
    "-t, --type <type>",
    "DNS record type (A, AAAA, MX, TXT, CNAME, NS)",
    "A",
  )
  .option("-a, --all", "Perform comprehensive DNS check (all record types)")
  .action(async (domain, options) => {
    if (options.all) {
      const spinner = ora({
        text: `DNS check for ${domain}...`,
        color: "cyan",
      }).start();
      try {
        const results = await comprehensiveDnsCheck(domain);
        spinner.stop();
        outputResult(results, formatComprehensiveDns);
      } catch (error) {
        spinner.fail("DNS check failed");
        console.error(error.message);
      }
    } else {
      const spinner = ora({
        text: `Looking up ${options.type} for ${domain}...`,
        color: "cyan",
      }).start();
      try {
        const results = await dnsLookup(domain, options.type);
        spinner.stop();
        outputResult(results, formatDnsResults);
      } catch (error) {
        spinner.fail("DNS lookup failed");
        console.error(error.message);
      }
    }
  });

program
  .command("rdns <ip>")
  .description("Reverse DNS lookup for an IP address")
  .action(async (ip) => {
    const spinner = ora({
      text: `Reverse DNS for ${ip}...`,
      color: "cyan",
    }).start();
    try {
      const results = await reverseDnsLookup(ip);
      spinner.stop();
      outputResult(results, (r) => {
        section("Reverse DNS");
        if (r.success) {
          status(
            "ok",
            `${ip}${r.responseTime ? " — " + r.responseTime + "ms" : ""}`,
          );
          for (const hostname of r.hostnames) {
            kv("Host", hostname);
          }
        } else {
          status("fail", `${ip} — ${r.error}`);
        }
      });
    } catch (error) {
      spinner.fail("Reverse DNS lookup failed");
      console.error(error.message);
    }
  });

program
  .command("http <url>")
  .description("Test HTTP/HTTPS connectivity and measure response time")
  .option("-m, --method <method>", "HTTP method", "GET")
  .action(async (url, options) => {
    const spinner = ora({ text: `Testing ${url}...`, color: "cyan" }).start();
    try {
      const results = await httpTest(url, { method: options.method });
      spinner.stop();
      outputResult(results, formatHttpResults);
    } catch (error) {
      spinner.fail("HTTP test failed");
      console.error(error.message);
    }
  });

program
  .command("check")
  .description("Check internet connectivity")
  .action(async () => {
    const spinner = ora({
      text: "Checking connectivity...",
      color: "cyan",
    }).start();
    try {
      const results = await checkInternetConnectivity();
      spinner.stop();
      outputResult(results, formatConnectivityResults);
    } catch (error) {
      spinner.fail("Connectivity check failed");
      console.error(error.message);
    }
  });

program
  .command("speed")
  .description("Run a comprehensive internet speed test")
  .option("-d, --download-only", "Run download test only")
  .option("-u, --upload-only", "Run upload test only")
  .action(async (options) => {
    try {
      if (options.downloadOnly) {
        const spinner = ora({
          text: "Testing download speed...",
          color: "cyan",
        }).start();
        const download = await downloadSpeedTest(10000);
        spinner.stop();
        outputResult({ download }, formatSpeedTestResults);
      } else if (options.uploadOnly) {
        const spinner = ora({
          text: "Testing upload speed...",
          color: "cyan",
        }).start();
        const upload = await uploadSpeedTest(8000);
        spinner.stop();
        outputResult({ upload }, formatSpeedTestResults);
      } else {
        const results = await comprehensiveSpeedTest();
        outputResult(results, formatSpeedTestResults);
      }
    } catch (error) {
      console.error("Speed test failed:", error.message);
    }
  });

program
  .command("latency")
  .description("Test network latency")
  .option("-c, --count <number>", "Number of tests to run", "10")
  .action(async (options) => {
    const spinner = ora({ text: "Testing latency...", color: "cyan" }).start();
    try {
      const results = await latencyTest(parseInt(options.count));
      spinner.stop();
      outputResult(results, formatLatencyResults);
    } catch (error) {
      spinner.fail("Latency test failed");
      console.error(error.message);
    }
  });

program
  .command("dns-speed")
  .description("Test DNS server response time")
  .option("-d, --domain <domain>", "Domain to test", "google.com")
  .option("-i, --iterations <number>", "Number of iterations", "5")
  .action(async (options) => {
    const spinner = ora({
      text: "Testing DNS speed...",
      color: "cyan",
    }).start();
    try {
      const results = await testDnsServer(
        options.domain,
        parseInt(options.iterations),
      );
      spinner.stop();
      outputResult(results, formatDnsSpeedResults);
    } catch (error) {
      spinner.fail("DNS speed test failed");
      console.error(error.message);
    }
  });

// ==========================================
// NETWORK COMMANDS
// ==========================================

program
  .command("trace <host>")
  .description("Trace the route to a host")
  .option("-m, --max-hops <number>", "Maximum number of hops", "30")
  .action(async (host, options) => {
    const spinner = ora({
      text: `Tracing route to ${host}...`,
      color: "cyan",
    }).start();
    try {
      const results = await traceroute(host, parseInt(options.maxHops));
      spinner.stop();
      outputResult(results, formatTracerouteResults);
    } catch (error) {
      spinner.fail("Traceroute failed");
      console.error(error.message);
    }
  });

program
  .command("ports <host>")
  .description("Scan ports on a host")
  .option(
    "-p, --ports <ports>",
    "Comma-separated list of ports or range (e.g. 80,443 or 1-1024)",
  )
  .option("-t, --timeout <ms>", "Timeout per port in ms", "3000")
  .action(async (host, options) => {
    let ports;
    if (options.ports) {
      ports = [];
      for (const part of options.ports.split(",")) {
        if (part.includes("-")) {
          const [start, end] = part.split("-").map(Number);
          for (let i = start; i <= end; i++) ports.push(i);
        } else {
          ports.push(parseInt(part));
        }
      }
    }

    const label = ports
      ? `Scanning ${ports.length} ports on ${host}`
      : `Scanning common ports on ${host}`;
    const spinner = ora({ text: `${label}...`, color: "cyan" }).start();

    try {
      const results = ports
        ? await scanPorts(host, ports, parseInt(options.timeout))
        : await scanCommonPorts(host, parseInt(options.timeout));
      spinner.stop();
      outputResult(results, formatPortResults);
    } catch (error) {
      spinner.fail("Port scan failed");
      console.error(error.message);
    }
  });

program
  .command("iface")
  .description("Show network interfaces and IP addresses")
  .action(async () => {
    try {
      const results = await getInterfaces();
      outputResult(results, formatInterfaceResults);
    } catch (error) {
      console.error("Failed to get interfaces:", error.message);
    }
  });

program
  .command("route")
  .description("Show routing table and default gateway")
  .action(async () => {
    const spinner = ora({
      text: "Getting routing table...",
      color: "cyan",
    }).start();
    try {
      const results = await getRoutes();
      spinner.stop();
      outputResult(results, formatRouteResults);
    } catch (error) {
      spinner.fail("Failed to get routes");
      console.error(error.message);
    }
  });

program
  .command("vpn")
  .description("Detect active VPN and proxy connections")
  .action(async () => {
    const spinner = ora({
      text: "Detecting VPN/proxy...",
      color: "cyan",
    }).start();
    try {
      const results = await detectVPN();
      spinner.stop();
      outputResult(results, formatVpnResults);
    } catch (error) {
      spinner.fail("VPN detection failed");
      console.error(error.message);
    }
  });

program
  .command("wifi")
  .description("Show WiFi connection details (signal, channel, noise)")
  .action(async () => {
    const spinner = ora({
      text: "Getting WiFi info...",
      color: "cyan",
    }).start();
    try {
      const results = await getWifiInfo();
      spinner.stop();
      outputResult(results, formatWifiResults);
    } catch (error) {
      spinner.fail("WiFi check failed");
      console.error(error.message);
    }
  });

// ==========================================
// LOOKUP COMMANDS
// ==========================================

program
  .command("whois <domain>")
  .description("WHOIS lookup for a domain")
  .action(async (domain) => {
    const spinner = ora({
      text: `WHOIS for ${domain}...`,
      color: "cyan",
    }).start();
    try {
      const results = await whoisLookup(domain);
      spinner.stop();
      outputResult(results, formatWhoisResults);
    } catch (error) {
      spinner.fail("WHOIS lookup failed");
      console.error(error.message);
    }
  });

program
  .command("cert <host>")
  .description("Check SSL/TLS certificate for a host")
  .option("-p, --port <number>", "Port number", "443")
  .action(async (host, options) => {
    const spinner = ora({
      text: `Checking certificate for ${host}...`,
      color: "cyan",
    }).start();
    try {
      const results = await checkCertificate(host, parseInt(options.port));
      spinner.stop();
      outputResult(results, formatCertResults);
    } catch (error) {
      spinner.fail("Certificate check failed");
      console.error(error.message);
    }
  });

// ==========================================
// REPORT / ASK COMMANDS
// ==========================================

program
  .command("report")
  .description("Generate a markdown network report (for piping to LLMs)")
  .action(async () => {
    _compositeMode = true;
    setSuppressOutput(true);
    const { generateReport } = await import("./lib/report.js");
    const report = await generateReport();
    setSuppressOutput(false);
    console.log(report);
  });

program
  .command("ask [prompt]")
  .description("Run diagnostics and ask Claude to analyze the results")
  .action(async (prompt) => {
    _compositeMode = true;

    // Check if claude is available
    try {
      execSync("which claude", { stdio: "ignore" });
    } catch {
      console.error(
        "Error: claude CLI not found. Install from https://claude.ai/claude-code",
      );
      process.exit(1);
    }

    // Generate report
    setSuppressOutput(true);
    const { generateReport } = await import("./lib/report.js");
    const report = await generateReport();
    setSuppressOutput(false);

    const defaultPrompt =
      "Analyze this network diagnostic report. Flag any issues and suggest fixes. Be concise.";
    const userPrompt = prompt || defaultPrompt;

    const claude = spawn("claude", ["-p", userPrompt], {
      stdio: ["pipe", "inherit", "inherit"],
    });

    claude.stdin.write(report);
    claude.stdin.end();

    claude.on("close", (code) => {
      process.exit(code || 0);
    });
  });

// ==========================================
// COMPOSITE COMMANDS
// ==========================================

program
  .command("diagnose")
  .description("Run comprehensive network diagnostics (no speed test)")
  .action(async () => {
    _compositeMode = true;
    banner();

    const spinner1 = ora({
      text: "Checking connectivity...",
      color: "cyan",
    }).start();
    const connectivity = await checkInternetConnectivity();
    spinner1.stop();
    formatConnectivityResults(connectivity);

    if (!connectivity.connected) {
      console.log("\nInternet connectivity issues detected. Stopping.");
      footer();
      return;
    }

    const spinner2 = ora({
      text: "Checking VPN/proxy...",
      color: "cyan",
    }).start();
    const vpnResult = await detectVPN();
    spinner2.stop();
    formatVpnResults(vpnResult);

    const spinner3 = ora({ text: "Testing DNS...", color: "cyan" }).start();
    const dnsResult = await dnsLookup("google.com", "A");
    spinner3.stop();
    formatDnsResults(dnsResult);

    const spinner4 = ora({
      text: "Pinging google.com...",
      color: "cyan",
    }).start();
    const pingResult = await ping("google.com", 4);
    spinner4.stop();
    formatPingResults(pingResult);

    const spinner5 = ora({ text: "Testing latency...", color: "cyan" }).start();
    const latencyResult = await latencyTest(5);
    spinner5.stop();
    formatLatencyResults(latencyResult);

    const spinnerIface = ora({
      text: "Getting interfaces...",
      color: "cyan",
    }).start();
    const ifaceResult = await getInterfaces();
    spinnerIface.stop();
    formatInterfaceResults(ifaceResult);

    footer();
  });

program
  .command("full")
  .description("Run ALL tests including speed test")
  .action(async () => {
    _compositeMode = true;
    banner();
    blank();

    const spinner1 = ora({
      text: "Checking connectivity...",
      color: "cyan",
    }).start();
    const connectivity = await checkInternetConnectivity();
    spinner1.stop();
    formatConnectivityResults(connectivity);

    if (!connectivity.connected) {
      console.log("\nInternet connectivity issues detected. Stopping.");
      footer();
      return;
    }

    const spinner2 = ora({
      text: "Checking VPN/proxy...",
      color: "cyan",
    }).start();
    const vpnResult = await detectVPN();
    spinner2.stop();
    formatVpnResults(vpnResult);

    const spinnerIface = ora({
      text: "Getting interfaces...",
      color: "cyan",
    }).start();
    const ifaceResult = await getInterfaces();
    spinnerIface.stop();
    formatInterfaceResults(ifaceResult);

    const spinner3 = ora({ text: "DNS check...", color: "cyan" }).start();
    const dnsResult = await comprehensiveDnsCheck("google.com");
    spinner3.stop();
    formatComprehensiveDns(dnsResult);

    const spinner4 = ora({
      text: "Testing DNS speed...",
      color: "cyan",
    }).start();
    const dnsSpeedResult = await testDnsServer("google.com", 5);
    spinner4.stop();
    formatDnsSpeedResults(dnsSpeedResult);

    const spinner5 = ora({
      text: "Pinging google.com...",
      color: "cyan",
    }).start();
    const pingResult = await ping("google.com", 4);
    spinner5.stop();
    formatPingResults(pingResult);

    const spinner6 = ora({ text: "Testing HTTP...", color: "cyan" }).start();
    const httpResult = await httpTest("https://www.google.com");
    spinner6.stop();
    formatHttpResults(httpResult);

    const spinner7 = ora({ text: "Testing latency...", color: "cyan" }).start();
    const latencyResult = await latencyTest(10);
    spinner7.stop();
    formatLatencyResults(latencyResult);

    console.log("\nRunning speed test (20-30s)...\n");
    const speedResults = await comprehensiveSpeedTest();
    formatSpeedTestResults(speedResults);

    // Summary
    section("Summary");
    const connIcon = connectivity.connected ? "ok" : "fail";
    const vpnIcon = vpnResult.vpnDetected ? "warn" : "ok";
    const dnsIcon = dnsResult.A?.success ? "ok" : "fail";
    const pingIcon = pingResult.success ? "ok" : "fail";
    const httpIcon = httpResult.success ? "ok" : "fail";

    status(
      connIcon,
      `Connectivity: ${connectivity.connected ? "Connected" : "Disconnected"}`,
    );
    status(
      vpnIcon,
      `VPN/Proxy: ${vpnResult.vpnDetected ? vpnResult.vpns.length + " detected" : "None"}`,
    );
    status(dnsIcon, `DNS: ${dnsResult.A?.success ? "Working" : "Failed"}`);
    status(
      pingIcon,
      `Ping: ${pingResult.success ? pingResult.avgTime + "ms" : "Failed"}`,
    );
    status(
      httpIcon,
      `HTTP: ${httpResult.success ? httpResult.statusCode : "Failed"}`,
    );

    if (latencyResult.success) {
      status(
        "ok",
        `Latency: ${latencyResult.avgLatency}ms avg, jitter: ${latencyResult.jitter}ms`,
      );
    }
    if (speedResults.download?.success) {
      status("ok", `Download: ${speedResults.download.speedMbps} Mbps`);
    }
    if (speedResults.upload?.success) {
      status("ok", `Upload: ${speedResults.upload.speedMbps} Mbps`);
    }

    footer();
  });

program.parse();
