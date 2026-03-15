import * as Effect from 'effect/Effect';

import { notFoundError, persistenceError, validationError } from '$lib/effect/errors';
import type {
	CreateRecurringCostInput,
	ListRecurringCostsQuery,
	UpdateRecurringCostInput,
} from '$lib/schema/budget';
import {
	createRecurringCost as createRecurringCostRow,
	deleteRecurringCost as deleteRecurringCostRow,
	getRecurringCostById,
	listRecurringCosts,
	updateRecurringCost as updateRecurringCostRow,
} from '$lib/server/budget/costs.repository';

function assertDateRange(startDate: string | null, endDate: string | null): void {
	if (startDate && endDate && endDate < startDate) {
		throw validationError('endDate must be greater than or equal to startDate');
	}
}

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
