import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
import { resolvePlaceSelection } from '../src/features/paid-rides/maps/resolve-place.ts';

function fixture() {
  const calls = { autocomplete: [], details: [], routes: [], tokens: 0 };
  const location = { toJSON: () => ({ lat: 9.07, lng: 7.42 }) };
  const prediction = { placeId: 'jabi', mainText: { text: 'Jabi Lake Mall' }, secondaryText: { text: 'Jabi, Abuja' }, text: { text: 'Jabi Lake Mall, Abuja' }, toPlace() { return new Place({ id: 'jabi' }); } };
  class Place {
    constructor({ id }) { this.id = id; this.location = location; this.displayName = 'Jabi Lake Mall'; this.formattedAddress = 'Jabi, Abuja'; }
    async fetchFields(options) { calls.details.push(options); }
  }
  let reject = false;
  const library = {
    AutocompleteSessionToken: class { constructor() { calls.tokens++; } },
    AutocompleteSuggestion: { fetchAutocompleteSuggestions: async (request) => { calls.autocomplete.push(request); if (reject) throw new Error('Billing not enabled'); return { suggestions: [{ placePrediction: prediction }] }; } },
    Place,
    Geocoder: class { async geocode() { return { results: [{ place_id: 'jabi', address_components: [{ long_name: 'Jabi Lake Mall' }], formatted_address: 'Jabi, Abuja' }] }; } },
    Route: { computeRoutes: async (request) => { calls.routes.push(request); return { routes: [{ path: [{ lat: 9.07, lng: 7.42 }, { lat: 9.08, lng: 7.43 }], distanceMeters: 1234, durationMillis: 65000 }] }; } },
  };
  const file = new URL('../src/features/paid-rides/maps/google-map-provider.ts', import.meta.url);
  const module = new Module(file.pathname), baseRequire = Module.createRequire(file);
  module.require = (name) => name === './google-maps-loader' ? { loadGoogleLibrary: async () => library } : baseRequire(name);
  module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file.pathname);
  return { provider: module.exports.googleMapProvider, calls, fail: () => { reject = true; } };
}

test('Google suggestions favour FCT and Nigeria without inventing bookable coordinates', async () => {
  const { provider, calls } = fixture();
  const suggestions = await provider.searchPlaces('Jabi', {});
  assert.equal(suggestions[0].point, null);
  assert.deepEqual(calls.autocomplete[0].includedRegionCodes, ['ng']);
  assert.deepEqual(calls.autocomplete[0].locationBias, { north: 9.5, south: 8.3, west: 6.6, east: 7.9 });
  assert.equal(calls.details.length, 0);
  const place = await resolvePlaceSelection(provider, suggestions[0]);
  assert.deepEqual(place.point, { lat: 9.07, lng: 7.42 });
  assert.equal(calls.details.length, 1);
});

test('autocomplete shares a session while typing and starts a new token after selection', async () => {
  const { provider, calls } = fixture();
  const first = await provider.searchPlaces('Jab', {});
  await provider.searchPlaces('Jabi', { near: { lat: 9, lng: 7 } });
  assert.equal(calls.tokens, 1);
  assert.deepEqual(calls.autocomplete[1].locationBias, { center: { lat: 9, lng: 7 }, radius: 50000 });
  await provider.resolvePlace(first[0]);
  await provider.searchPlaces('Utako', {});
  assert.equal(calls.tokens, 2);
});

test('reverse geocoding keeps the exact user pin and route duration uses seconds', async () => {
  const { provider, calls } = fixture();
  const point = { lat: 9.123, lng: 7.321 };
  assert.deepEqual((await provider.reverseGeocode(point)).point, point);
  const route = await provider.calculateRoute([point, { lat: 9.2, lng: 7.4 }, { lat: 9.3, lng: 7.5 }]);
  assert.equal(route.durationSeconds, 65);
  assert.equal(route.source, 'road');
  assert.deepEqual(calls.routes[0].intermediates, [{ location: { lat: 9.2, lng: 7.4 } }]);
});

test('cancelled selection and Google configuration errors never fall back to fake locations', async () => {
  const { provider, fail } = fixture();
  fail(); await assert.rejects(provider.searchPlaces('Jabi', {}), /Billing/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(resolvePlaceSelection(provider, { id: 'google:jabi', point: null }, controller.signal), { name: 'AbortError' });
  await assert.rejects(resolvePlaceSelection({}, { point: null }), /could not be confirmed/);
});
