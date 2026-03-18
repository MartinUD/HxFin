import * as Effect from 'effect/Effect';

import { notFoundError, validationError } from '$lib/effect/errors';
import type {
	CreateRecurringCostInput,
	ListRecurringCostsQuery,
	UpdateRecurringCostInput,
} from '$lib/schema/budget';
import { BudgetRecurringCostsRepository } from '$lib/server/budget/costs.repository';

function assertDateRange(startDate: string | null, endDate: string | null): void {
	if (startDate && endDate && endDate < startDate) {
		throw validationError('endDate must be greater than or equal to startDate');
	}
}

export const listRecurringCostsEffect = (query: ListRecurringCostsQuery = {}) =>
	Effect.gen(function* () {
		const repository = yield* BudgetRecurringCostsRepository;
		return yield* repository.listRecurringCosts(query);
	});

export const createRecurringCostEffect = (input: CreateRecurringCostInput) =>
	Effect.gen(function* () {
		const repository = yield* BudgetRecurringCostsRepository;
		const startDate = input.startDate ?? null;
		const endDate = input.endDate ?? null;
		const kind = input.kind ?? 'expense';

		assertDateRange(startDate, endDate);

		return yield* repository.createRecurringCost({
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
	});

export const updateRecurringCostEffect = (costId: string, input: UpdateRecurringCostInput) =>
	Effect.gen(function* () {
		const repository = yield* BudgetRecurringCostsRepository;
		const existing = yield* repository.getRecurringCostById(costId);

		if (!existing) {
			return yield* Effect.fail(notFoundError('Recurring cost was not found', 'COST_NOT_FOUND'));
		}

		if (Object.keys(input).length === 0) {
			return yield* Effect.fail(
				validationError('At least one recurring cost field must be provided'),
			);
		}

		assertDateRange(input.startDate ?? null, input.endDate ?? null);

		const nextInput = {
			...input,
			name: input.name?.trim(),
		};
		if (nextInput.kind === 'investment') {
			nextInput.isEssential = false;
		}

		const updated = yield* repository.updateRecurringCost(costId, nextInput);
		if (!updated) {
			return yield* Effect.fail(notFoundError('Recurring cost was not found', 'COST_NOT_FOUND'));
		}

		return updated;
	});

export const deleteRecurringCostEffect = (costId: string) =>
	Effect.gen(function* () {
		const repository = yield* BudgetRecurringCostsRepository;
		const deleted = yield* repository.deleteRecurringCost(costId);

		if (!deleted) {
			return yield* Effect.fail(notFoundError('Recurring cost was not found', 'COST_NOT_FOUND'));
		}
	});
