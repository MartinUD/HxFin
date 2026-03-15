import * as Effect from 'effect/Effect';

import { persistenceError } from '$lib/effect/errors';
import { roundToCurrencyCents, toMonthlyAmount } from '$lib/finance/recurrence';
import type { BudgetSummary, BudgetSummaryCategory, SummaryQuery } from '$lib/schema/budget';
import { listCategories } from '$lib/server/budget/categories.repository';
import { listRecurringCosts } from '$lib/server/budget/costs.repository';
import { getFinancialProfile } from '$lib/server/finance/repository';
import { calculateSwedishTax } from '$lib/tax';

export function buildBudgetSummary(query: SummaryQuery = {}): BudgetSummary {
	const categories = listCategories();
	const costs = listRecurringCosts({ includeInactive: query.includeInactive });
	const profile = getFinancialProfile();
	const taxResult = calculateSwedishTax(profile.monthlySalary, profile.municipalTaxRate);
	const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
	const monthlyTotalByCategory = new Map<string, number>();
	let monthlyEssential = 0;
	let monthlyNonEssential = 0;
	let monthlyInvesting = 0;

	for (const cost of costs) {
		const monthlyAmount = toMonthlyAmount(cost.amount, cost.period);
		const currentTotal = monthlyTotalByCategory.get(cost.categoryId) ?? 0;
		monthlyTotalByCategory.set(cost.categoryId, currentTotal + monthlyAmount);

		if (cost.kind === 'investment') {
			monthlyInvesting += monthlyAmount;
		} else if (cost.isEssential) {
			monthlyEssential += monthlyAmount;
		} else {
			monthlyNonEssential += monthlyAmount;
		}
	}

	const categoryBreakdown: BudgetSummaryCategory[] = Array.from(monthlyTotalByCategory.entries())
		.map(([categoryId, monthlyTotal]) => {
			const roundedMonthly = roundToCurrencyCents(monthlyTotal);

			return {
				categoryId,
				categoryName: categoryNameById.get(categoryId) ?? 'Uncategorized',
				monthlyTotal: roundedMonthly,
				yearlyTotal: roundToCurrencyCents(roundedMonthly * 12),
			};
		})
		.sort((left, right) => right.monthlyTotal - left.monthlyTotal);

	const totalMonthlyRecurring = roundToCurrencyCents(
		categoryBreakdown.reduce((accumulator, category) => accumulator + category.monthlyTotal, 0),
	);
	const roundedMonthlyEssential = roundToCurrencyCents(monthlyEssential);
	const roundedMonthlyNonEssential = roundToCurrencyCents(monthlyNonEssential);
	const roundedMonthlyInvesting = roundToCurrencyCents(monthlyInvesting);
	const monthlyNetIncome = roundToCurrencyCents(taxResult.netMonthly);
	const monthlyUnallocated = roundToCurrencyCents(monthlyNetIncome - totalMonthlyRecurring);
	const savingsRate =
		monthlyNetIncome > 0
			? roundToCurrencyCents((roundedMonthlyInvesting / monthlyNetIncome) * 100)
			: 0;

	return {
		totalMonthlyRecurring,
		totalYearlyRecurring: roundToCurrencyCents(totalMonthlyRecurring * 12),
		monthlyEssential: roundedMonthlyEssential,
		monthlyNonEssential: roundedMonthlyNonEssential,
		monthlyInvesting: roundedMonthlyInvesting,
		monthlyNetIncome,
		monthlyUnallocated,
		savingsRate,
		categories: categoryBreakdown,
	};
}

export const buildBudgetSummaryEffect = (query: SummaryQuery = {}) =>
	Effect.try({
		try: () => buildBudgetSummary(query),
		catch: () => persistenceError('Failed to build budget summary'),
	});
