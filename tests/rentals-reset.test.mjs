import test from 'node:test';
import assert from 'node:assert/strict';
import { createRentalService, validateRental, RentalError } from '../src/features/rentals/contract.ts';
import { createResetApi } from '../src/features/auth/reset-api.ts';
const input = { carType: 'SUV', startsAt: '2099-12-01T09:00:00Z', endsAt: '2099-12-02T09:00:00Z', pickupLocation: ' Abuja ', notes: '' };
const id = '019a3e00-0000-7000-8000-000000000001';
const record = { ...input, id, userId: id, status: 'pending', assignedBy: null, assignedAt: null, createdAt: input.startsAt, updatedAt: input.startsAt };
test('rentals enforce 24 elapsed hours, future start and exact editable fields', () => {
  assert.equal(validateRental(input).pickupLocation, 'Abuja');
  assert.throws(() => validateRental({ ...input, endsAt: '2099-12-02T08:59:00Z' }));
  assert.throws(() => validateRental(input, Date.parse(input.startsAt)));
  assert.throws(() => validateRental({ ...input, userId: id }));
  assert.throws(() => validateRental({ ...input, notes: null }));
  assert.throws(() => validateRental({ ...input, pickupLocation: '  ' }));
});
test('rental requests use direct arrays, offset filters, driver assignment and empty deletion', async () => {
  const calls = [];
  const api = createRentalService(async (path, options) => { calls.push({ path, ...options }); return options.method === 'DELETE' ? new Response(null, { status: 204 }) : new Response(JSON.stringify(options.method === 'GET' ? [record] : record)); });
  assert.equal((await api.list(true, 'pending', 20)).length, 1);
  assert.equal(calls[0].path, 'admin/rentals?limit=20&offset=20&status=pending');
  await api.assign(id, id); assert.deepEqual(JSON.parse(calls[1].body), { driverId: id });
  await api.remove(id);
  await api.update(id, input); assert.equal(calls[3].method, 'PUT');
  assert.equal(JSON.parse(calls[3].body).pickupLocation, 'Abuja');
});
test('uncertain creates are never automatically retried; conflicts remain distinguishable', async () => {
  let calls = 0;
  const api = createRentalService(async () => { calls++; throw new Error('Network'); });
  await assert.rejects(api.create(input), e => e instanceof RentalError && e.uncertain);
  assert.equal(calls, 1);
  const conflict = createRentalService(async () => new Response('conflict', { status: 409 }));
  await assert.rejects(conflict.remove(id), e => e.status === 409 && !e.uncertain);
});
test('reset preserves leading zeros and password whitespace, and omits credentials', async () => {
  const calls = [];
  const api = createResetApi(async (url, options) => { calls.push({ url, ...options }); return new Response(JSON.stringify({ message: 'OK', data: '' })); }, 'https://example.test/api/v1');
  await api.request(' test@example.com ');
  await api.reset({ email: 'test@example.com', otp: '001234', newPassword: ' password ' });
  assert.equal(calls[0].credentials, 'omit');
  assert.deepEqual(JSON.parse(calls[1].body), { email: 'test@example.com', otp: '001234', newPassword: ' password ' });
  assert.throws(() => api.reset({ email: 'test@example.com', otp: '1234', newPassword: 'password' }));
  assert.throws(() => api.reset({ email: 'test@example.com', otp: '001234', newPassword: 'password', confirmPassword: 'password' }));
});
test('reset handles plain text errors and uncertain responses without retrying', async () => {
  let calls = 0;
  const api = createResetApi(async () => { calls++; throw new Error('Network'); }, 'https://example.test');
  await assert.rejects(api.reset({ email: 'test@example.com', otp: '001234', newPassword: 'password' }), /try signing in/i);
  assert.equal(calls, 1);
  await assert.rejects(createResetApi(async () => new Response('bad input', { status: 422 }), 'https://example.test').request('test@example.com'));
});

test('rental pricing validates categories and carType is required', async () => {
 const prices = { cars: { van: { price: '100000', currency: 'NGN' }, suv: { price: '200000', currency: 'NGN' }, saloon: { price: '300000', currency: 'NGN' } } };
 const api = createRentalService(async path => { assert.equal(path, 'rental/pricing'); return new Response(JSON.stringify(prices)); });
 assert.deepEqual(await api.pricing(), prices);
 assert.throws(() => validateRental({ ...input, carType: undefined }));
 assert.throws(() => validateRental({ ...input, carType: 'suv' }));
});

test('NGN equivalents multiply the NGN-base rate and reject old rates', async () => {
 const { convertNaira } = await import('../src/features/rentals/currencies.ts');
 const now = Date.now();
 const payload = { result: 'success', base_code: 'NGN', time_last_update_unix: Math.floor(now / 1000), rates: { USD: 0.001, KES: 0.1 } };
 assert.equal(convertNaira(100000, payload, now).amounts.USD, 100);
 assert.equal(convertNaira(100000, payload, now).amounts.KES, 10000);
 assert.throws(() => convertNaira(100000, payload, now + 4 * 86400000));
 assert.throws(() => convertNaira(-1, payload, now));
 assert.throws(() => convertNaira(100000, { ...payload, base_code: 'USD' }, now));
});
