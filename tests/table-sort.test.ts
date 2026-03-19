import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	sortAlphabetical,
	sortValue,
	toggleSort,
	type SortState,
} from '../src/lib/components/ui/table/sort.ts';

type SortKey = 'name' | 'amount';

describe('table sort helpers', () => {
	it('switches direction when toggling the active sort key', () => {
		const current: SortState<SortKey> = { key: 'name', direction: 'asc' };
		assert.deepEqual(toggleSort(current, 'name'), {
			key: 'name',
			direction: 'desc',
		});
	});

	it('starts new columns in ascending order', () => {
		const current: SortState<SortKey> = { key: 'amount', direction: 'desc' };
		assert.deepEqual(toggleSort(current, 'name'), {
			key: 'name',
			direction: 'asc',
		});
	});

	it('sorts alphabetical and numeric values in both directions', () => {
		assert.equal(sortAlphabetical('Alpha', 'beta', 'asc'), -1);
		assert.equal(sortAlphabetical('Alpha', 'beta', 'desc'), 1);
		assert.equal(sortValue(10, 20, 'asc'), -10);
		assert.equal(sortValue(10, 20, 'desc'), 10);
	});
});
