import * as Effect from 'effect/Effect';

import { persistenceError, validationError } from '$lib/effect/errors';
import type { FinancialProfile, UpdateFinancialProfileInput } from '$lib/schema/finance';
import {
	getFinancialProfile,
	updateFinancialProfile as updateFinancialProfileRow
} from '$lib/server/finance/repository';

function normalizeUpdate(input: UpdateFinancialProfileInput): UpdateFinancialProfileInput {
	return {
		monthlySalary: input.monthlySalary,
		salaryGrowth: input.salaryGrowth,
		municipalTaxRate: input.municipalTaxRate,
		savingsShareOfRaise: input.savingsShareOfRaise,
		currency: input.currency?.trim().toUpperCase()
	};
}

function ensureNonEmpty(input: UpdateFinancialProfileInput): void {
	if (Object.values(input).every((value) => value === undefined)) {
		throw validationError('At least one financial profile field must be provided');
	}
}

export const getFinancialProfileEffect = () =>
	Effect.try({
		try: () => getFinancialProfile(),
		catch: () => persistenceError('Failed to load financial profile')
	});

export const updateFinancialProfileEffect = (input: UpdateFinancialProfileInput) =>
	Effect.try({
		try: () => {
			const normalized = normalizeUpdate(input);
			ensureNonEmpty(normalized);
			return updateFinancialProfileRow(normalized);
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to update financial profile')
	});
