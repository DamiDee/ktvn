import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_ACCOUNT_FILTERS, filterAccounts, accountSearchText, accountDay, accountDate, contactPhoneHref } from '../src/features/admin/accounts/account-directory.ts';
const users = [
  { id: 'a', first_name: 'Ada', last_name: 'Obi', username: 'ada', email: 'ada@example.test', phone: '08012345678', city: 'Jabi', address: 'First Street', country: 'Nigeria', role: 'User', is_active: true, is_identity_verified: true, created_at: '2026-10-27T23:30:00Z' },
  { id: 'b', first_name: 'Bayo', last_name: 'Akin', city: 'Kuje', role: 'Driver', is_active: false, is_identity_verified: false, created_at: '2026-10-26T10:00:00Z', driver_profile: { track: 'Both', licence_number: 'FCT-123', guarantor_name: 'Chioma', guarantor_phone: '08033333333' } },
  { id: 'c', first_name: 'Chika', last_name: 'Dan', city: 'Jabi', role: 'Driver', is_active: true, is_identity_verified: true, created_at: '2026-10-28T08:00:00Z', driver_profile: { track: 'Professional' } },
];
const apply = (filters) => filterAccounts(users, { ...EMPTY_ACCOUNT_FILTERS, ...filters }).map((u) => u.id);
test('account filters compose and clear without modifying source records', () => {
  assert.deepEqual(apply({}), ['a','b','c']);
  assert.deepEqual(apply({role:'Driver',active:'active',identity:'verified',city:'Jabi',track:'professional'}), ['c']);
  assert.deepEqual(apply({active:'inactive',identity:'unverified'}), ['b']);
  assert.deepEqual(apply({city:'missing'}), []);
  assert.equal(users[1].driver_profile.track, 'Both');
});
test('both-track drivers appear under professional and volunteer filters', () => {
  assert.deepEqual(apply({track:'professional'}), ['b','c']);
  assert.deepEqual(apply({track:'volunteer'}), ['b']);
  assert.deepEqual(apply({role:'User',track:'professional'}), []);
});
test('registration date ranges use the same Nigeria date shown in the table', () => {
  assert.equal(accountDay(users[0].created_at), '2026-10-28');
  assert.deepEqual(apply({since:'2026-10-28',until:'2026-10-28'}), ['a','c']);
  assert.equal(accountDay('invalid'), ''); assert.equal(accountDate(null), 'Not available');
});
test('search includes contact, location, licence, guarantor and both passenger labels', () => {
  const text=accountSearchText(users[0]).toLowerCase();
  for (const value of ['ada obi','ada@example.test','08012345678','234 801 234 5678','jabi','passenger','member']) assert.ok(text.includes(value), value);
  assert.match(accountSearchText(users[1]), /FCT-123.*Chioma.*08033333333/);
});
test('only real phone numbers become call links', () => {
  assert.equal(contactPhoneHref('+234 801 234 5678'), 'tel:+2348012345678');
  assert.equal(contactPhoneHref('javascript:alert(1)'), undefined);
  assert.equal(contactPhoneHref(null), undefined);
});
