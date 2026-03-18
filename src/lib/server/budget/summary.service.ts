import * as Effect from 'effect/Effect';

import { persistenceError } from '$lib/effect/errors';
import { roundToCurrencyCents, toMonthlyAmount } from '$lib/finance/recurrence';
import type { BudgetSummary, BudgetSummaryCategory, SummaryQuery } from '$lib/schema/budget';
import { BudgetCategoriesRepository } from '$lib/server/budget/categories.repository';
import { BudgetRecurringCostsRepository } from '$lib/server/budget/costs.repository';
import { getFinancialProfile } from '$lib/server/finance/repository';
import type { FinancialProfile } from '$lib/server/finance/types';
import { calculateSwedishTax } from '$lib/tax';

function buildBudgetSummary(input: {
	categories: Array<{ id: string; name: string }>;
	costs: Array<{
		categoryId: string;
		amount: number;
		period: 'weekly' | 'monthly' | 'yearly';
		kind: 'expense' | 'investment';
		isEssential: boolean;
	}>;
	profile: Pick<FinancialProfile, 'monthlySalary' | 'municipalTaxRate'>;
}): BudgetSummary {
	const { categories, costs, profile } = input;
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
	Effect.gen(function* () {
		const categoriesRepository = yield* BudgetCategoriesRepository;
		const costsRepository = yield* BudgetRecurringCostsRepository;
		const categories = yield* categoriesRepository.listCategories();
		const costs = yield* costsRepository.listRecurringCosts({
			includeInactive: query.includeInactive,
		});
		const profile = yield* Effect.try({
			try: () => getFinancialProfile(),
			catch: () => persistenceError('Failed to load financial profile'),
		});

		return buildBudgetSummary({
			categories,
			costs,
			profile,
		});
	});
