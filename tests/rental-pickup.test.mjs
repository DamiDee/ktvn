import test from 'node:test';
import assert from 'node:assert/strict';
import { rentalPickupPlace, rentalPickupText } from '../src/features/rentals/pickup.ts';
test('rental pickup preserves coordinates through the text-only API', () => {
 const place = { name: 'Jabi Lake Mall', secondary: 'Abuja', point: { lat: 9.076439, lng: 7.425385 } };
 const saved = rentalPickupText(place);
 assert.deepEqual(rentalPickupPlace(saved).point, place.point);
 assert.equal(rentalPickupText(rentalPickupPlace(saved)), saved);
 assert.equal(rentalPickupPlace('Old hotel pickup'), null);
 assert.equal(rentalPickupPlace('Bad\nCoordinates: 999, 7'), null);
 assert.throws(() => rentalPickupText({ ...place, point: { lat: NaN, lng: 7 } }));
});
