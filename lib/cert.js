import https from 'https';
import tls from 'tls';

/**
 * Check SSL/TLS certificate for a host
 * @param {string} host - Hostname to check
 * @param {number} port - Port number (default 443)
 * @returns {Promise<object>} Certificate details
 */
export async function checkCertificate(host, port = 443) {
  const startTime = Date.now();

  return new Promise((resolve) => {
    try {
      const options = {
        host,
        port,
        servername: host,
        rejectUnauthorized: false // Allow self-signed for inspection
      };

      const socket = tls.connect(options, () => {
        const responseTime = Date.now() - startTime;
        const cert = socket.getPeerCertificate(true);
        const authorized = socket.authorized;
        const authError = socket.authorizationError;
        const protocol = socket.getProtocol();
        const cipher = socket.getCipher();

        socket.destroy();

        if (!cert || !cert.subject) {
          resolve({
            success: false,
            host,
            error: 'No certificate returned',
            responseTime
          });
          return;
        }

        const now = new Date();
        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const daysRemaining = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));
        const isExpired = daysRemaining < 0;
        const isExpiringSoon = daysRemaining <= 30 && daysRemaining >= 0;

        // Build certificate chain
        const chain = [];
        let currentCert = cert;
        const seen = new Set();
        while (currentCert && !seen.has(currentCert.fingerprint256)) {
          seen.add(currentCert.fingerprint256);
          chain.push({
            subject: formatDN(currentCert.subject),
            issuer: formatDN(currentCert.issuer),
            serialNumber: currentCert.serialNumber
          });
          currentCert = currentCert.issuerCertificate;
          // Break if self-signed (issuer === subject)
          if (currentCert && currentCert.fingerprint256 === cert.fingerprint256) break;
        }

        // Extract SANs
        const sans = [];
        if (cert.subjectaltname) {
          const parts = cert.subjectaltname.split(', ');
          for (const part of parts) {
            const [type, value] = part.split(':');
            sans.push({ type, value });
          }
        }

        resolve({
          success: true,
          host,
          port,
          responseTime,
          authorized,
          authError: authError || null,
          protocol,
          cipher: cipher ? {
            name: cipher.name,
            version: cipher.version,
            bits: cipher.bits || extractBitsFromCipherName(cipher.name)
          } : null,
          subject: formatDN(cert.subject),
          issuer: formatDN(cert.issuer),
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          daysRemaining,
          isExpired,
          isExpiringSoon,
          serialNumber: cert.serialNumber,
          fingerprint: cert.fingerprint256,
          sans,
          chain,
          bits: cert.bits,
          keyUsage: cert.ext_key_usage || []
        });
      });

      socket.on('error', (error) => {
        resolve({
          success: false,
          host,
          port,
          error: error.message,
          responseTime: Date.now() - startTime
        });
      });

      socket.setTimeout(10000, () => {
        socket.destroy();
        resolve({
          success: false,
          host,
          port,
          error: 'Connection timeout',
          responseTime: Date.now() - startTime
        });
      });
    } catch (error) {
      resolve({
        success: false,
        host,
        port,
        error: error.message,
        responseTime: Date.now() - startTime
      });
    }
  });
}

/**
 * Extract cipher bits from cipher name (fallback for TLS 1.3 where bits is null)
 */
function extractBitsFromCipherName(name) {
  if (!name) return null;
  const match = name.match(/(\d{3})/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Format a Distinguished Name object to string
 */
function formatDN(dn) {
  if (!dn) return '';
  const parts = [];
  if (dn.CN) parts.push(`CN=${dn.CN}`);
  if (dn.O) parts.push(`O=${dn.O}`);
  if (dn.OU) parts.push(`OU=${dn.OU}`);
  if (dn.L) parts.push(`L=${dn.L}`);
  if (dn.ST) parts.push(`ST=${dn.ST}`);
  if (dn.C) parts.push(`C=${dn.C}`);
  return parts.join(', ');
}
