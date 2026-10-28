/** Verify a deployed site's public map configuration without printing its key. */
const target = process.argv[2];
if (!target) { console.error('Usage: node scripts/verify-google-maps.mjs https://app.freebus.cloud'); process.exit(1); }
try {
  const response = await fetch(new URL('/api/maps/config', target), { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  const data = await response.json();
  const configured = response.ok && data.provider === 'google' && data.configured === true && typeof data.apiKey === 'string' && data.apiKey.length > 0;
  console.log(JSON.stringify({ provider: data.provider ?? 'unknown', configured, status: response.status }));
  if (!configured) { console.error('Set GOOGLE_MAPS_BROWSER_API_KEY in the hosting environment and restart the app. If this endpoint is missing, deploy the current source first.'); process.exitCode = 1; }
} catch { console.error('The deployed Google Maps configuration could not be verified. Check the deployment and its hosting environment.'); process.exitCode = 1; }
