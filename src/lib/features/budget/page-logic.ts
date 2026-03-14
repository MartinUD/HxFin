import type {
	BudgetCategory,
	BudgetSummary,
	CreateRecurringCostInput,
	RecurringCost,
	UpdateRecurringCostInput
} from '$lib/schema/budget';
import { toMonthlyAmount } from '$lib/budget';

export interface CostDialogFormState {
	id: string;
	name: string;
	amount: number;
	period: 'weekly' | 'monthly' | 'yearly';
	kind: 'expense' | 'investment';
	categoryId: string;
	isEssential: boolean;
	isActive: boolean;
}

export function filterActiveCosts(
	costs: RecurringCost[],
	selectedCategoryFilter: string
): RecurringCost[] {
	return costs
		.filter((cost) => selectedCategoryFilter === 'all' || cost.categoryId === selectedCategoryFilter)
		.filter((cost) => cost.isActive);
}

export function buildCategoryMap(categories: BudgetCategory[]): Map<string, BudgetCategory> {
	return new Map<string, BudgetCategory>(categories.map((category) => [category.id, category]));
}

export function buildSummaryByCategory(summary: BudgetSummary): Map<string, number> {
	return new Map<string, number>(
		summary.categories.map((category) => [category.categoryId, category.monthlyTotal])
	);
}

export function getFilteredMonthlyTotal(costs: RecurringCost[]): number {
	return costs.reduce((sum, cost) => sum + toMonthlyAmount(cost.amount, cost.period), 0);
}

export function createEmptyCostDialogState(defaultCategoryId = ''): CostDialogFormState {
	return {
		id: '',
		name: '',
		amount: 0,
		period: 'monthly',
		kind: 'expense',
		categoryId: defaultCategoryId,
		isEssential: false,
		isActive: true
	};
}

export function createCostDialogStateFromCost(cost: RecurringCost): CostDialogFormState {
	return {
		id: cost.id,
		name: cost.name,
		amount: cost.amount,
		period: cost.period,
		kind: cost.kind,
		categoryId: cost.categoryId,
		isEssential: cost.isEssential,
		isActive: cost.isActive
	};
}

export function buildCreateCostInput(dialog: CostDialogFormState): CreateRecurringCostInput {
	return {
		name: dialog.name.trim(),
		amount: dialog.amount,
		period: dialog.period,
		kind: dialog.kind,
		categoryId: dialog.categoryId,
		isEssential: dialog.isEssential,
		startDate: new Date().toISOString().split('T')[0],
		endDate: null,
		isActive: true
	};
}

export function buildUpdateCostInput(dialog: CostDialogFormState): UpdateRecurringCostInput {
	return {
		name: dialog.name.trim(),
		amount: dialog.amount,
		period: dialog.period,
		kind: dialog.kind,
		categoryId: dialog.categoryId,
		isEssential: dialog.isEssential,
		isActive: dialog.isActive
	};
}

export function toBudgetErrorMessage(
	error: unknown,
	fallbackMessage: string
): string {
	if (error instanceof Error) {
		const maybeHttpError = error as { code?: unknown; status?: unknown };
		if (typeof maybeHttpError.code === 'string' && typeof maybeHttpError.status === 'number') {
			return error.message;
		}
	}

	return fallbackMessage;
}
