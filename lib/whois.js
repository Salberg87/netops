import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Perform a WHOIS lookup for a domain
 * @param {string} domain - Domain to look up
 * @returns {Promise<object>} WHOIS results
 */
export async function whoisLookup(domain) {
  const startTime = Date.now();

  try {
    const { stdout } = await execAsync(`whois ${domain}`, { timeout: 15000 });
    const responseTime = Date.now() - startTime;
    const parsed = parseWhoisOutput(stdout);

    return {
      success: true,
      domain,
      responseTime,
      ...parsed,
      raw: stdout
    };
  } catch (error) {
    return {
      success: false,
      domain,
      error: error.message,
      responseTime: Date.now() - startTime
    };
  }
}

/**
 * Parse WHOIS output into structured data
 */
function parseWhoisOutput(output) {
  const info = {};
  const lines = output.split('\n');

  const fieldMap = {
    'registrar': 'registrar',
    'registrar url': 'registrarUrl',
    'creation date': 'createdDate',
    'created': 'createdDate',
    'registry expiry date': 'expiryDate',
    'expiry date': 'expiryDate',
    'expires': 'expiryDate',
    'updated date': 'updatedDate',
    'last modified': 'updatedDate',
    'registrant organization': 'organization',
    'registrant country': 'country',
    'registrant name': 'registrantName',
    'name server': 'nameServers',
    'nserver': 'nameServers',
    'domain name': 'domainName',
    'domain status': 'status',
    'dnssec': 'dnssec'
  };

  const nameServers = [];
  const statuses = [];

  for (const line of lines) {
    const match = line.match(/^\s*([^:]+):\s*(.+)/);
    if (!match) continue;

    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();

    if (fieldMap[key]) {
      if (fieldMap[key] === 'nameServers') {
        nameServers.push(value.toLowerCase());
      } else if (fieldMap[key] === 'status') {
        statuses.push(value);
      } else {
        info[fieldMap[key]] = value;
      }
    }
  }

  if (nameServers.length > 0) info.nameServers = [...new Set(nameServers)];
  if (statuses.length > 0) info.status = statuses;

  // Calculate days until expiry
  if (info.expiryDate) {
    const expiry = new Date(info.expiryDate);
    if (!isNaN(expiry.getTime())) {
      const daysUntilExpiry = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
      info.daysUntilExpiry = daysUntilExpiry;
    }
  }

  return info;
}
