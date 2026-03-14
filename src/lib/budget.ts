import { requestJson, type ApiFetcher } from '$lib/api/http';
import { formatSekAmount } from '$lib/finance/format';
import { toMonthlyAmount } from '$lib/finance/recurrence';
import type {
	BudgetCategory,
	BudgetSummary,
	CreateCategoryInput,
	CreateRecurringCostInput,
	RecurringCostKind,
	RecurringCost,
	UpdateCategoryInput,
	UpdateRecurringCostInput
} from '$lib/contracts/budget';

export type { BudgetCategory, BudgetSummary, RecurringCost };
export { ApiClientError as BudgetApiError } from '$lib/api/http';
export { toMonthlyAmount };

export const COLOR_PALETTE: string[] = [
	'#22c55e',
	'#06b6d4',
	'#f59e0b',
	'#ef4444',
	'#ec4899',
	'#8b5cf6',
	'#f97316',
	'#a78bfa'
];

export const DEFAULT_COLOR = '#22c55e';

export const PERIOD_OPTIONS = [
	{ value: 'weekly', label: 'Weekly' },
	{ value: 'monthly', label: 'Monthly' },
	{ value: 'yearly', label: 'Yearly' }
] as const;

export const COST_KIND_OPTIONS = [
	{ value: 'expense', label: 'Expense' },
	{ value: 'investment', label: 'Investment' }
] as const satisfies ReadonlyArray<{ value: RecurringCostKind; label: string }>;

export function formatCurrency(value: number): string {
	return formatSekAmount(value);
}

export interface BudgetApiClient {
	fetchCategories(): Promise<BudgetCategory[]>;
	createCategory(input: CreateCategoryInput): Promise<BudgetCategory>;
	updateCategory(id: string, input: UpdateCategoryInput): Promise<BudgetCategory>;
	deleteCategory(id: string): Promise<void>;
	fetchCosts(query?: { includeInactive?: boolean }): Promise<RecurringCost[]>;
	createCost(input: CreateRecurringCostInput): Promise<RecurringCost>;
	updateCost(id: string, input: UpdateRecurringCostInput): Promise<RecurringCost>;
	deleteCost(id: string): Promise<void>;
	fetchSummary(query?: { includeInactive?: boolean }): Promise<BudgetSummary>;
}

export function createBudgetApi(fetcher: ApiFetcher): BudgetApiClient {
	return {
		async fetchCategories(): Promise<BudgetCategory[]> {
			const data = await requestJson<{ categories: BudgetCategory[] }>(fetcher, '/api/budget/categories');
			return data.categories;
		},
		async createCategory(input: CreateCategoryInput): Promise<BudgetCategory> {
			const data = await requestJson<{ category: BudgetCategory }>(fetcher, '/api/budget/categories', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			return data.category;
		},
		async updateCategory(id: string, input: UpdateCategoryInput): Promise<BudgetCategory> {
			const data = await requestJson<{ category: BudgetCategory }>(fetcher, `/api/budget/categories/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			return data.category;
		},
		async deleteCategory(id: string): Promise<void> {
			await requestJson<void>(fetcher, `/api/budget/categories/${id}`, { method: 'DELETE' });
		},
		async fetchCosts(query?: { includeInactive?: boolean }): Promise<RecurringCost[]> {
			const params = new URLSearchParams();
			if (query?.includeInactive) {
				params.set('includeInactive', 'true');
			}

			const qs = params.toString();
			const data = await requestJson<{ costs: RecurringCost[] }>(
				fetcher,
				`/api/budget/costs${qs ? `?${qs}` : ''}`
			);
			return data.costs;
		},
		async createCost(input: CreateRecurringCostInput): Promise<RecurringCost> {
			const data = await requestJson<{ cost: RecurringCost }>(fetcher, '/api/budget/costs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			return data.cost;
		},
		async updateCost(id: string, input: UpdateRecurringCostInput): Promise<RecurringCost> {
			const data = await requestJson<{ cost: RecurringCost }>(fetcher, `/api/budget/costs/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			return data.cost;
		},
		async deleteCost(id: string): Promise<void> {
			await requestJson<void>(fetcher, `/api/budget/costs/${id}`, { method: 'DELETE' });
		},
		async fetchSummary(query?: { includeInactive?: boolean }): Promise<BudgetSummary> {
			const params = new URLSearchParams();
			if (query?.includeInactive) {
				params.set('includeInactive', 'true');
			}

			const qs = params.toString();
			const data = await requestJson<{ summary: BudgetSummary }>(
				fetcher,
				`/api/budget/summary${qs ? `?${qs}` : ''}`
			);
			return data.summary;
		}
	};
}

const defaultClient = createBudgetApi((input, init) => fetch(input, init));

export const fetchCategories = () => defaultClient.fetchCategories();
export const createCategory = (input: CreateCategoryInput) => defaultClient.createCategory(input);
export const updateCategory = (id: string, input: UpdateCategoryInput) =>
	defaultClient.updateCategory(id, input);
export const deleteCategory = (id: string) => defaultClient.deleteCategory(id);
export const fetchCosts = (query?: { includeInactive?: boolean }) => defaultClient.fetchCosts(query);
export const createCost = (input: CreateRecurringCostInput) => defaultClient.createCost(input);
export const updateCost = (id: string, input: UpdateRecurringCostInput) =>
	defaultClient.updateCost(id, input);
export const deleteCost = (id: string) => defaultClient.deleteCost(id);
export const fetchSummary = (query?: { includeInactive?: boolean }) => defaultClient.fetchSummary(query);
