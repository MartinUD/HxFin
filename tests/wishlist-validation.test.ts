import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseListWishlistItemsQuery } from '../src/lib/server/wishlist/validation.ts';

describe('parseListWishlistItemsQuery', () => {
	it('accepts an empty query without self-invalidating', () => {
		const result = parseListWishlistItemsQuery(new URLSearchParams());

		assert.deepEqual(result, {
			fundingStrategy: undefined
		});
	});

	it('parses fundingStrategy when provided', () => {
		const result = parseListWishlistItemsQuery(
			new URLSearchParams([['fundingStrategy', 'loan']])
		);

		assert.deepEqual(result, {
			fundingStrategy: 'loan'
		});
	});
});
