import test from 'node:test';
import assert from 'node:assert/strict';
import { retryEstimate, ESTIMATE_RETRY_DELAY_MS } from '../src/features/paid-rides/domain/estimate-retry.ts';
import { RideServiceError } from '../src/features/paid-rides/domain/errors.ts';
test('fare retries wait five seconds and stop after one transient retry', () => {
 assert.equal(ESTIMATE_RETRY_DELAY_MS, 5000);
 for (const code of ['network','timeout','unavailable']) {
  assert.equal(retryEstimate(0, new RideServiceError(code)), true);
  assert.equal(retryEstimate(1, new RideServiceError(code)), false);
 }
 for (const code of ['validation','forbidden','unauthorized']) assert.equal(retryEstimate(0, new RideServiceError(code)), false);
});
