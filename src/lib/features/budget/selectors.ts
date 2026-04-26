import { toMonthlyAmount } from '$lib/features/budget/helpers';
import type { BudgetCategory, BudgetSummary, RecurringCost } from '$lib/schema/budget';

export type CategoryFilter = 'all' | number;

export function filterCostsByCategory(
	costs: readonly RecurringCost[],
	selectedCategoryFilter: CategoryFilter | readonly CategoryFilter[],
): RecurringCost[] {
	const selectedFilters = Array.isArray(selectedCategoryFilter)
		? selectedCategoryFilter
		: [selectedCategoryFilter];

	return costs.filter(
		(cost) => selectedFilters.includes('all') || selectedFilters.includes(cost.categoryId),
	);
}

export function buildCategoryMap(
	categories: readonly BudgetCategory[],
): Map<number, BudgetCategory> {
	return new Map(categories.map((category) => [category.id, category]));
}

export function buildSummaryByCategory(summary: BudgetSummary): Map<number, number> {
	return new Map(
		summary.categories.map((category) => [category.categoryId, category.monthlyTotal]),
	);
}

export function getFilteredMonthlyTotal(costs: readonly RecurringCost[]): number {
	return costs.reduce((sum, cost) => sum + toMonthlyAmount(cost.amount, cost.period), 0);
}
