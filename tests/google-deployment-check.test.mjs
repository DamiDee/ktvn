import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyGoogleMaps } from '../scripts/verify-google-maps.mjs';

async function check(fetcher, target = 'https://app.freebus.cloud') {
  const messages = [];
  const status = await verifyGoogleMaps(target, { fetcher, output: { log: (line) => messages.push(line), error: (line) => messages.push(line) } });
  return { status, text: messages.join('\n') };
}

test('deployment verification confirms configuration without logging the key', async () => {
  const result = await check(async () => Response.json({ provider: 'google', configured: true, apiKey: 'browser-key-never-log' }));
  assert.equal(result.status, 0);
  assert.match(result.text, /"configured":true/);
  assert.ok(!result.text.includes('browser-key-never-log'));
});

test('deployment verification distinguishes HTML 404 and gateway errors', async () => {
  for (const [status, expected] of [[404, /latest code/], [502, /PM2 status/], [503, /PM2 status/], [504, /PM2 status/]]) {
    const result = await check(async () => new Response('<html>private-error-body</html>', { status }));
    assert.equal(result.status, 1);
    assert.match(result.text, expected);
    assert.ok(!result.text.includes('private-error-body'));
  }
});

test('missing production key has separate guidance from missing deployment code', async () => {
  const result = await check(async () => Response.json({ provider: 'google', configured: false }, { status: 503 }));
  assert.equal(result.status, 1);
  assert.match(result.text, /maps:configure/);
  assert.ok(!result.text.includes('latest code'));
});

test('network and TLS failures give useful guidance without exposing raw errors', async () => {
  for (const [code, expected] of [['ENOTFOUND', /DNS/], ['ECONNREFUSED', /refused/], ['UND_ERR_CONNECT_TIMEOUT', /15 seconds/], ['CERT_HAS_EXPIRED', /TLS certificate/]]) {
    const result = await check(async () => { throw new TypeError('secret-in-upstream-error', { cause: { code } }); });
    assert.equal(result.status, 1);
    assert.match(result.text, expected);
    assert.match(result.text, /127\.0\.0\.1:4000/);
    assert.ok(!result.text.includes('secret-in-upstream-error'));
  }
});

test('unexpected and malformed configuration are failures without response-body logging', async () => {
  for (const value of [null, [], { provider: 'google', configured: true }, { provider: 'google', configured: true, apiKey: ' ' }]) {
    const result = await check(async () => Response.json(value));
    assert.equal(result.status, 1);
  }
  const html = await check(async () => new Response('<html>private-page</html>'));
  assert.match(html.text, /web page/);
  assert.ok(!html.text.includes('private-page'));
});

test('invalid website addresses are rejected before any network request', async () => {
  for (const target of [undefined, 'not-a-url', 'ftp://app.freebus.cloud', 'https://user:private@app.freebus.cloud']) {
    let called = false;
    const result = await check(async () => { called = true; }, target === undefined ? null : target);
    assert.equal(result.status, 1);
    assert.equal(called, false);
    assert.ok(!result.text.includes('private'));
  }
});
