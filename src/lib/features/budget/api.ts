import { withApiClient } from '$lib/api/client';
import { runUiEffect } from '$lib/effect/runtime/browser';
import type {
	CreateCategoryInput,
	CreateRecurringCostInput,
	UpdateCategoryInput,
	UpdateRecurringCostInput,
} from '$lib/schema/budget';

export function createBudgetCategory(
	fetcher: typeof fetch,
	payload: CreateCategoryInput,
) {
	return runUiEffect(
		withApiClient(fetcher, (client) => client.budget.createBudgetCategory({ payload })),
	);
}

export function updateBudgetCategory(
	fetcher: typeof fetch,
	categoryId: number,
	payload: UpdateCategoryInput,
) {
	return runUiEffect(
		withApiClient(fetcher, (client) =>
			client.budget.updateBudgetCategory({
				path: { categoryId },
				payload,
			}),
		),
	);
}

export function deleteBudgetCategory(fetcher: typeof fetch, categoryId: number) {
	return runUiEffect(
		withApiClient(fetcher, (client) =>
			client.budget.deleteBudgetCategory({
				path: { categoryId },
			}),
		),
	);
}

export function createRecurringCost(
	fetcher: typeof fetch,
	payload: CreateRecurringCostInput,
) {
	return runUiEffect(
		withApiClient(fetcher, (client) => client.budget.createRecurringCost({ payload })),
	);
}

export function updateRecurringCost(
	fetcher: typeof fetch,
	costId: number,
	payload: UpdateRecurringCostInput,
) {
	return runUiEffect(
		withApiClient(fetcher, (client) =>
			client.budget.updateRecurringCost({
				path: { costId },
				payload,
			}),
		),
	);
}

export function deleteRecurringCost(fetcher: typeof fetch, costId: number) {
	return runUiEffect(
		withApiClient(fetcher, (client) =>
			client.budget.deleteRecurringCost({
				path: { costId },
			}),
		),
	);
}
