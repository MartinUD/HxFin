import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	buildCategoryMap,
	buildSummaryByCategory,
	filterActiveCosts,
	getActiveCostCount,
	getFilteredMonthlyTotal,
} from '../src/routes/budget/selectors.ts';

const categories = [
	{
		id: 'cat-housing',
		name: 'Housing',
		description: null,
		color: '#22c55e',
		createdAt: '2026-03-01T00:00:00.000Z',
		updatedAt: '2026-03-01T00:00:00.000Z',
	},
	{
		id: 'cat-saving',
		name: 'Saving',
		description: null,
		color: '#06b6d4',
		createdAt: '2026-03-01T00:00:00.000Z',
		updatedAt: '2026-03-01T00:00:00.000Z',
	},
] as const;

const costs = [
	{
		id: 'cost-rent',
		categoryId: 'cat-housing',
		name: 'Rent',
		amount: 9000,
		period: 'monthly',
		kind: 'expense',
		isEssential: true,
		startDate: '2026-03-01',
		endDate: null,
		isActive: true,
		createdAt: '2026-03-01T00:00:00.000Z',
		updatedAt: '2026-03-01T00:00:00.000Z',
	},
	{
		id: 'cost-gym',
		categoryId: 'cat-housing',
		name: 'Gym',
		amount: 1200,
		period: 'yearly',
		kind: 'expense',
		isEssential: false,
		startDate: '2026-03-01',
		endDate: null,
		isActive: false,
		createdAt: '2026-03-01T00:00:00.000Z',
		updatedAt: '2026-03-01T00:00:00.000Z',
	},
	{
		id: 'cost-index',
		categoryId: 'cat-saving',
		name: 'Index Fund',
		amount: 500,
		period: 'weekly',
		kind: 'investment',
		isEssential: false,
		startDate: '2026-03-01',
		endDate: null,
		isActive: true,
		createdAt: '2026-03-01T00:00:00.000Z',
		updatedAt: '2026-03-01T00:00:00.000Z',
	},
] as const;

describe('budget selectors', () => {
	it('filters to active costs and respects the category filter', () => {
		assert.equal(filterActiveCosts(costs, 'all').length, 2);
		assert.equal(filterActiveCosts(costs, 'cat-housing').length, 1);
		assert.equal(filterActiveCosts(costs, 'cat-saving')[0]?.id, 'cost-index');
	});

	it('builds category and summary lookup maps', () => {
		const categoryMap = buildCategoryMap(categories);
		assert.equal(categoryMap.get('cat-housing')?.name, 'Housing');

		const summaryByCategory = buildSummaryByCategory({
			totalMonthlyRecurring: 11166.67,
			totalYearlyRecurring: 134000.04,
			monthlyEssential: 9000,
			monthlyNonEssential: 0,
			monthlyInvesting: 2166.67,
			monthlyNetIncome: 25000,
			monthlyUnallocated: 13833.33,
			savingsRate: 8.67,
			categories: [
				{
					categoryId: 'cat-housing',
					categoryName: 'Housing',
					monthlyTotal: 9000,
					yearlyTotal: 108000,
				},
			],
		});

		assert.equal(summaryByCategory.get('cat-housing'), 9000);
	});

	it('computes monthly totals and active counts from active costs', () => {
		assert.equal(getActiveCostCount(costs), 2);
		assert.equal(
			Number(getFilteredMonthlyTotal(filterActiveCosts(costs, 'all')).toFixed(2)),
			11166.67,
		);
	});
});
