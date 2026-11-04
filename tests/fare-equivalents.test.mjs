import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const file = new URL('../src/features/paid-rides/components/fare-equivalents.tsx', import.meta.url);
const mod = new Module(file.pathname), base = Module.createRequire(file);
let call, failed = false;
mod.require = path => path === '@/features/rentals/currency-equivalent' ? { useCurrencyEquivalents(amount, enabled) { call = { amount, enabled }; return { isPending: false, isError: failed, data: { updatedAt: '2026-11-04T00:00:00Z', amounts: { USD: 5.5, GBP: 4.2, EUR: 5, GHS: 61 } } }; } } : base(path);
mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file.pathname);
const render = money => renderToStaticMarkup(React.createElement(mod.exports.FareEquivalents, { money }));
test('normal fares convert kobo into naira and show four currencies without interaction', () => {
 const html = render({ amountMinor: 750000, currency: 'NGN' });
 assert.deepEqual(call, { amount: 7500, enabled: true });
 for (const code of ['USD','GBP','EUR','GHS']) assert.ok(html.includes(code));
 assert.ok(!html.includes('<select')); assert.ok(!html.includes('<button'));
});
test('conversion failure keeps the naira fallback and non-NGN fares are not converted', () => {
 failed = true;
 assert.match(render({ amountMinor: 750000, currency: 'NGN' }), /fare remains in NGN/);
 assert.equal(render({ amountMinor: 100, currency: 'USD' }), '');
 assert.equal(call.enabled, false);
});
