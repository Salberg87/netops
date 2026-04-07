import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);
const resolveCname = promisify(dns.resolveCname);
const resolveNs = promisify(dns.resolveNs);
const reverse = promisify(dns.reverse);

/**
 * Perform DNS lookup for a domain
 * @param {string} domain - Domain to lookup
 * @param {string} recordType - Type of DNS record (A, AAAA, MX, TXT, CNAME, NS)
 * @returns {Promise<object>} DNS lookup results
 */
export async function dnsLookup(domain, recordType = 'A') {
  const startTime = Date.now();

  try {
    let records;

    switch (recordType.toUpperCase()) {
      case 'A':
        records = await resolve4(domain);
        break;
      case 'AAAA':
        records = await resolve6(domain);
        break;
      case 'MX':
        records = await resolveMx(domain);
        break;
      case 'TXT':
        records = await resolveTxt(domain);
        break;
      case 'CNAME':
        records = await resolveCname(domain);
        break;
      case 'NS':
        records = await resolveNs(domain);
        break;
      default:
        throw new Error(`Unsupported record type: ${recordType}`);
    }

    const responseTime = Date.now() - startTime;

    return {
      success: true,
      domain,
      recordType,
      records,
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      success: false,
      domain,
      recordType,
      error: error.message,
      responseTime
    };
  }
}

/**
 * Perform comprehensive DNS check
 */
export async function comprehensiveDnsCheck(domain) {
  const types = ['A', 'AAAA', 'MX', 'TXT', 'NS'];
  const results = {};

  for (const type of types) {
    results[type] = await dnsLookup(domain, type);
  }

  return results;
}

/**
 * Reverse DNS lookup
 */
export async function reverseDnsLookup(ip) {
  const startTime = Date.now();

  try {
    const hostnames = await reverse(ip);
    const responseTime = Date.now() - startTime;

    return {
      success: true,
      ip,
      hostnames,
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      success: false,
      ip,
      error: error.message,
      responseTime
    };
  }
}

/**
 * Test DNS server response time
 */
export async function testDnsServer(testDomain = 'google.com', iterations = 5) {
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    try {
      await resolve4(testDomain);
      times.push(Date.now() - startTime);
    } catch (error) {
      // Ignore errors for timing purposes
    }
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  return {
    domain: testDomain,
    iterations,
    avgTime: avgTime.toFixed(2),
    minTime,
    maxTime,
    times
  };
}
