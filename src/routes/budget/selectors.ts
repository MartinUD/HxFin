import { toMonthlyAmount } from '$lib/budget';
import type { BudgetCategory, BudgetSummary, RecurringCost } from '$lib/schema/budget';

export function filterActiveCosts(
	costs: readonly RecurringCost[],
	selectedCategoryFilter: string,
): RecurringCost[] {
	return costs
		.filter(
			(cost) => selectedCategoryFilter === 'all' || cost.categoryId === selectedCategoryFilter,
		)
		.filter((cost) => cost.isActive);
}

export function buildCategoryMap(
	categories: readonly BudgetCategory[],
): Map<string, BudgetCategory> {
	return new Map(categories.map((category) => [category.id, category]));
}

export function buildSummaryByCategory(summary: BudgetSummary): Map<string, number> {
	return new Map(
		summary.categories.map((category) => [category.categoryId, category.monthlyTotal]),
	);
}

export function getFilteredMonthlyTotal(costs: readonly RecurringCost[]): number {
	return costs.reduce((sum, cost) => sum + toMonthlyAmount(cost.amount, cost.period), 0);
}

export function getActiveCostCount(costs: readonly RecurringCost[]): number {
	return costs.filter((cost) => cost.isActive).length;
}
