import * as Effect from 'effect/Effect';

import { notFoundError, persistenceError, validationError } from '$lib/effect/errors';
import { roundToCurrencyCents, toMonthlyAmount } from '$lib/finance/recurrence';
import type { UpdateCategoryInput, UpdateRecurringCostInput } from '$lib/schema/budget';
import {
	createCategory as createCategoryRow,
	createRecurringCost as createRecurringCostRow,
	deleteCategory as deleteCategoryRow,
	deleteRecurringCost as deleteRecurringCostRow,
	getCategoryById,
	getRecurringCostById,
	listCategories,
	listRecurringCosts,
	updateCategory as updateCategoryRow,
	updateRecurringCost as updateRecurringCostRow,
} from '$lib/server/budget/repository';
import type {
	BudgetSummary,
	BudgetSummaryCategory,
	CreateCategoryInput,
	CreateRecurringCostInput,
	ListRecurringCostsQuery,
	SummaryQuery,
} from '$lib/server/budget/types';
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

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
	if (value === undefined || value === null) {
		return value;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

function assertDateRange(startDate: string | null, endDate: string | null): void {
	if (startDate && endDate && endDate < startDate) {
		throw validationError('endDate must be greater than or equal to startDate');
	}
}

export const listCategoriesEffect = () =>
	Effect.try({
		try: () => listCategories(),
		catch: () => persistenceError('Failed to load budget categories'),
	});

export const createCategoryEffect = (input: CreateCategoryInput) =>
	Effect.try({
		try: () =>
			createCategoryRow({
				name: input.name.trim(),
				description: normalizeNullableText(input.description) ?? null,
				color: normalizeNullableText(input.color) ?? null,
			}),
		catch: () => persistenceError('Failed to create budget category'),
	});

export const updateCategoryEffect = (categoryId: string, input: UpdateCategoryInput) =>
	Effect.try({
		try: () => {
			if (!getCategoryById(categoryId)) {
				throw notFoundError('Budget category was not found', 'CATEGORY_NOT_FOUND');
			}

			if (Object.keys(input).length === 0) {
				throw validationError('At least one category field must be provided');
			}

			const category = updateCategoryRow(categoryId, {
				name: input.name?.trim(),
				description: normalizeNullableText(input.description),
				color: normalizeNullableText(input.color),
			});

			if (!category) {
				throw notFoundError('Budget category was not found', 'CATEGORY_NOT_FOUND');
			}

			return category;
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to update budget category'),
	});

export const deleteCategoryEffect = (categoryId: string) =>
	Effect.try({
		try: () => {
			if (!deleteCategoryRow(categoryId)) {
				throw notFoundError('Budget category was not found', 'CATEGORY_NOT_FOUND');
			}
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to delete budget category'),
	});

export const listRecurringCostsEffect = (query: ListRecurringCostsQuery = {}) =>
	Effect.try({
		try: () => listRecurringCosts(query),
		catch: () => persistenceError('Failed to load recurring costs'),
	});

export const createRecurringCostEffect = (input: CreateRecurringCostInput) =>
	Effect.try({
		try: () => {
			const startDate = input.startDate ?? null;
			const endDate = input.endDate ?? null;
			const kind = input.kind ?? 'expense';
			assertDateRange(startDate, endDate);

			return createRecurringCostRow({
				categoryId: input.categoryId,
				name: input.name.trim(),
				amount: input.amount,
				period: input.period,
				kind,
				isEssential: kind === 'investment' ? false : (input.isEssential ?? false),
				startDate,
				endDate,
				isActive: input.isActive ?? true,
			});
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to create recurring cost'),
	});

export const updateRecurringCostEffect = (costId: string, input: UpdateRecurringCostInput) =>
	Effect.try({
		try: () => {
			if (!getRecurringCostById(costId)) {
				throw notFoundError('Recurring cost was not found', 'COST_NOT_FOUND');
			}

			if (Object.keys(input).length === 0) {
				throw validationError('At least one recurring cost field must be provided');
			}

			assertDateRange(input.startDate ?? null, input.endDate ?? null);

			const nextInput = {
				...input,
				name: input.name?.trim(),
			};
			if (nextInput.kind === 'investment') {
				nextInput.isEssential = false;
			}

			const updated = updateRecurringCostRow(costId, nextInput);
			if (!updated) {
				throw notFoundError('Recurring cost was not found', 'COST_NOT_FOUND');
			}

			return updated;
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to update recurring cost'),
	});

export const deleteRecurringCostEffect = (costId: string) =>
	Effect.try({
		try: () => {
			if (!deleteRecurringCostRow(costId)) {
				throw notFoundError('Recurring cost was not found', 'COST_NOT_FOUND');
			}
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to delete recurring cost'),
	});

export const buildBudgetSummaryEffect = (query: SummaryQuery = {}) =>
	Effect.try({
		try: () => buildBudgetSummary(query),
		catch: () => persistenceError('Failed to build budget summary'),
	});
