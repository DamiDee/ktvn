import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const key of ['window','document','HTMLElement','HTMLInputElement','Event','Node','localStorage']) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const h = React.createElement;
const file = new URL('../src/features/auth/live-password-reset.tsx', import.meta.url);
const mod = new Module(file.pathname), calls = [];
let cleared = false, blocked = false;
const Input = ({ label, ...props }) => h('label', null, label, h('input', props));
const dependencies = {
  '@tanstack/react-query': { useQueryClient: () => ({ clear() { cleared = true; } }) },
  '@/components/ui/input': { Input, PasswordInput: Input },
  '@/components/ui/button': { Button: ({ children, block: _block, loading, variant: _variant, ...props }) => { void _block; void _variant; return h('button', { type: 'button', ...props, disabled: props.disabled || loading }, children); }, ButtonLink: ({ children, variant: _variant, ...props }) => { void _variant; return h('a', props, children); } },
  '@/lib/account-session': { changeAccountSession(value) { blocked = value; } },
  './reset-api': { createResetApi: () => ({ request: async email => { calls.push(['request', email]); }, reset: async input => { calls.push(['reset', input]); } }) },
};
const require = Module.createRequire(file);
mod.require = path => path in dependencies ? dependencies[path] : require(path);
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, file.pathname);
async function type(input, value) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); }
async function submit(host) { await act(async () => host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }
test('reset form keeps OTP zeros, blocks resend, validates confirmation and clears session on success', async () => {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  localStorage.setItem('kr-freebus-user', 'old-account');
  try {
    await act(async () => root.render(h(mod.exports.LivePasswordReset)));
    await type(host.querySelector('input'), 'passenger@example.com'); await submit(host);
    assert.equal(calls[0][0], 'request');
    assert.ok([...host.querySelectorAll('button')].find(b => b.textContent.includes('Resend')).disabled);
    const inputs = host.querySelectorAll('input');
    await type(inputs[1], '001234'); await type(inputs[2], 'new-password'); await type(inputs[3], 'wrong-password');
    await submit(host); assert.equal(calls.length, 1); assert.match(host.textContent, /do not match/);
    await type(inputs[3], 'new-password'); await submit(host);
    assert.equal(calls[1][1].otp, '001234'); assert.equal(cleared, true); assert.equal(blocked, true);
    assert.equal(localStorage.getItem('kr-freebus-user'), null);
    assert.equal(host.querySelector('input'), null); assert.ok(host.querySelector('a[href="/login"]'));
  } finally { await act(async () => root.unmount()); host.remove(); }
});
