import test from 'node:test';
import assert from 'node:assert/strict';
import { rentalPickupPlace, rentalPickupText, rentalPickupLabel } from '../src/features/rentals/pickup.ts';
test('rental pickup preserves coordinates through the text-only API', () => {
 const place = { name: 'Jabi Lake Mall', secondary: 'Abuja', point: { lat: 9.076439, lng: 7.425385 } };
 const saved = rentalPickupText(place);
 assert.deepEqual(rentalPickupPlace(saved).point, place.point);
 assert.equal(rentalPickupText(rentalPickupPlace(saved)), saved);
 assert.equal(rentalPickupPlace('Old hotel pickup'), null);
 assert.equal(rentalPickupPlace('Bad\nCoordinates: 999, 7'), null);
 assert.throws(() => rentalPickupText({ ...place, point: { lat: NaN, lng: 7 } }));
});

test('address labels hide coordinates without changing saved pickup data', () => {
 const saved = 'Airport, Abuja\nCoordinates: 9.006259, 7.269506';
 assert.equal(rentalPickupLabel(saved), 'Airport, Abuja');
 assert.equal(rentalPickupLabel('Hotel reception'), 'Hotel reception');
 assert.deepEqual(rentalPickupPlace(saved).point, { lat: 9.006259, lng: 7.269506 });
});
