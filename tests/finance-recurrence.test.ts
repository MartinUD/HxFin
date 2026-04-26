import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { roundToCurrencyCents, toMonthlyAmount } from '../src/lib/shared/recurrence.ts';

describe('toMonthlyAmount', () => {
	it('converts weekly to monthly using 52/12', () => {
		assert.equal(toMonthlyAmount(1200, 'weekly'), 5200);
	});

	it('keeps monthly values unchanged', () => {
		assert.equal(toMonthlyAmount(3500, 'monthly'), 3500);
	});

	it('converts yearly values to monthly', () => {
		assert.equal(toMonthlyAmount(12000, 'yearly'), 1000);
	});
});

describe('roundToCurrencyCents', () => {
	it('rounds numbers to 2 decimals', () => {
		assert.equal(roundToCurrencyCents(99.999), 100);
		assert.equal(roundToCurrencyCents(10.005), 10.01);
	});
});
