/** Run once in the deployed repository. Keys are masked and never logged. */
import { readFileSync, writeFileSync, existsSync, copyFileSync, chmodSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { resolve } from 'node:path';
const root = process.cwd();
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
if (pkg.name !== 'k-rides') throw new Error('Run this command in the K-Rides website folder.');
if (!process.stdin.isTTY) { console.error('Run this interactively in the server terminal. The key is masked while you paste it.'); process.exit(1); }
const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
const terminal = createInterface({ input: process.stdin, output, terminal: true });
async function hidden(label) { process.stdout.write(label); const value = (await terminal.question('')).trim().replace(/^['"]|['"]$/g, ''); process.stdout.write('\n'); return value; }
let browser, server;
try {
 browser = await hidden('Paste the Google browser key (hidden): ');
 server = await hidden('Paste the server key, or press Enter to use the same currently working key: ');
} finally { terminal.close(); }
if (!/^AIza[\w-]{30,50}$/.test(browser) || server && !/^AIza[\w-]{30,50}$/.test(server)) { console.error('The key format was not recognised. No settings were changed.'); process.exit(1); }
const file = resolve(root, '.env.production.local');
const original = existsSync(file) ? readFileSync(file, 'utf8') : '';
if (existsSync(file)) { const backup = `${file}.backup-${Date.now()}`; copyFileSync(file, backup); chmodSync(backup, 0o600); }
const names = ['GOOGLE_MAPS_BROWSER_API_KEY','GOOGLE_MAPS_SERVER_API_KEY','NEXT_PUBLIC_GOOGLE_MAPS_API_KEY','NEXT_PUBLIC_RIDES_MAP_PROVIDER'];
const lines = original.split('\n').filter((line) => !names.some((name) => new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`).test(line)));
const values = { GOOGLE_MAPS_BROWSER_API_KEY: browser, GOOGLE_MAPS_SERVER_API_KEY: server || browser, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: browser, NEXT_PUBLIC_RIDES_MAP_PROVIDER: 'google' };
writeFileSync(file, lines.join('\n').trimEnd()+'\n'+Object.entries(values).map(([name,value])=>`${name}=${value}`).join('\n')+'\n', { mode: 0o600 }); chmodSync(file,0o600);
console.log('Google Maps settings saved in the ignored production settings file. Other settings were preserved.');
console.log('Now rebuild and restart the website, then run: npm run maps:verify -- https://app.freebus.cloud');
