/** Verify map configuration without printing keys, response bodies, or raw errors. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function connectionMessage(error) {
  const code = error?.cause?.code ?? error?.code;
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) return 'The server could not resolve the website address. Check its DNS settings.';
  if (code === 'ECONNREFUSED') return 'The connection was refused. Check that the website process is running and the address/port is correct.';
  if (['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(code) || ['TimeoutError', 'AbortError'].includes(error?.name)) return 'The website did not respond within 15 seconds. Check connectivity and the website process.';
  if (['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(code)) return 'The server could not validate the website TLS certificate. Check the certificate chain and server clock.';
  return 'The server could not connect to the website. Check its network connection and website process.';
}

function responseMessage(status, json) {
  if (status === 404) return 'The website responds, but /api/maps/config is missing. Pull the latest code, rebuild, and restart the correct website process.';
  if ([502, 504].includes(status) || status === 503 && !json) return 'The web server could not reach a ready website process. Check PM2 status and the website logs.';
  if ([401, 403].includes(status)) return 'Access to /api/maps/config was blocked. Check the web server access rules.';
  return json ? 'The website returned unexpected map configuration.' : 'The endpoint returned a web page instead of map configuration. Check the deployed code and web server routing.';
}

export async function verifyGoogleMaps(target, { fetcher = fetch, output = console } = {}) {
  if (!target) {
    output.error('Usage: npm run maps:verify -- https://app.freebus.cloud');
    return 1;
  }
  let url;
  try {
    url = new URL('/api/maps/config', target);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch {
    output.error('Provide a valid website address starting with https:// or http://.');
    return 1;
  }

  let response, data;
  try {
    response = await fetcher(url, { signal: AbortSignal.timeout(15_000), cache: 'no-store' });
    const body = await response.text();
    try { data = JSON.parse(body); } catch { /* HTML errors need a status-specific explanation. */ }
  } catch (error) {
    output.error(connectionMessage(error));
    output.error('To test the app directly on the deployment server, run: npm run maps:verify -- http://127.0.0.1:4000');
    return 1;
  }

  const json = data !== null && typeof data === 'object' && !Array.isArray(data);
  const provider = json && data.provider === 'google' ? 'google' : 'unknown';
  const configured = response.ok && provider === 'google' && data.configured === true && typeof data.apiKey === 'string' && data.apiKey.trim().length > 0;
  output.log(JSON.stringify({ provider, configured, status: response.status }));
  if (configured) return 0;
  if (response.status === 503 && provider === 'google' && data.configured === false) {
    output.error('The deployed app is running, but no Google browser key is configured. Run npm run maps:configure in its deployment folder, then restart the website.');
  } else output.error(responseMessage(response.status, json));
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await verifyGoogleMaps(process.argv[2]);
}
