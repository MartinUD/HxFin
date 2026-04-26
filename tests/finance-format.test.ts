import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	formatLocalizedNumber,
	formatSekAmount,
	formatSekCurrency,
} from '../src/lib/shared/format.ts';

function normalizeSpaces(value: string): string {
	return value.replace(/\s/g, ' ');
}

describe('finance formatting', () => {
	it('formats localized numbers in sv-SE style', () => {
		assert.equal(normalizeSpaces(formatLocalizedNumber(1234567)), '1 234 567');
	});

	it('formats SEK currency display', () => {
		assert.equal(normalizeSpaces(formatSekCurrency(1200)), '1 200 kr');
	});

	it('formats SEK amount with explicit suffix', () => {
		assert.equal(normalizeSpaces(formatSekAmount(1200.2)), '1 200 kr');
	});
});
