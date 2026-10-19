'use strict';
/* Network helpers for joining from phones.

   The TV page is often opened on the server computer itself as http://localhost:3000.
   Phones can't reach "localhost" (it means the phone itself), so join links and QR codes
   swap it for this computer's address on the home network, e.g. http://192.168.1.20:3000. */

const os = require('os');

const VIRTUAL = /vethernet|virtualbox|vmware|wsl|docker|hyper-v|loopback|tailscale|zerotier|vpn|utun|tun|tap/i;

function isPrivate(ip) {
  return /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

/* Best guess at this computer's address on the home network (Wi-Fi or Ethernet). */
function lanAddresses(ifaces = os.networkInterfaces()) {
  const found = [];
  Object.entries(ifaces || {}).forEach(([name, list]) => {
    (list || []).forEach(a => {
      const v4 = a.family === 'IPv4' || a.family === 4;
      if (!v4 || a.internal) return;
      found.push({ name, ip: a.address, score: (isPrivate(a.address) ? 2 : 0) + (VIRTUAL.test(name) ? -3 : 0) + (/^192\.168\./.test(a.address) ? 1 : 0) });
    });
  });
  return found.sort((x, y) => y.score - x.score).map(x => x.ip);
}

const isLocalHost = host => /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)(:\d+)?$/i.test(host || '');

/* The address phones should use, from the request that loaded the TV page. */
function joinBase(headers, env = process.env, ifaces) {
  if (env.PUBLIC_URL) return env.PUBLIC_URL.replace(/\/+$/, '');
  // Forwarded headers are client-controlled unless a trusted reverse proxy
  // sanitises them. Follow the same opt-in rule as room-code rate limiting.
  const trusted = env.TRUST_PROXY === '1';
  let proto = trusted ? String(headers['x-forwarded-proto'] || 'http').split(',')[0].trim() : 'http';
  let host = String((trusted && headers['x-forwarded-host']) || headers.host || 'localhost').split(',')[0].trim();
  // When an HTTPS hosting service terminates TLS, browser Origin reveals the
  // scheme of the actual site. Accept it only for exactly the same host, so
  // unrelated origins cannot generate misleading cross-domain join QR codes.
  if (!trusted && headers.origin) {
    try {
      const origin = new URL(headers.origin);
      if (origin.host === host && ['http:', 'https:'].includes(origin.protocol)) proto = origin.protocol.slice(0, -1);
    } catch (_) { /* Invalid Origin: keep the direct scheme. */ }
  }
  if (isLocalHost(host)) {
    const ip = lanAddresses(ifaces)[0];
    if (ip) host = ip + (host.includes(':') && !host.startsWith('[') ? ':' + host.split(':').pop() : '');
  }
  return `${proto}://${host}`;
}

module.exports = { lanAddresses, joinBase, isLocalHost };
