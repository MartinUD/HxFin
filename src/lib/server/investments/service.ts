import * as Effect from 'effect/Effect';

import { notFoundError, persistenceError, validationError } from '$lib/effect/errors';
import type {
	CreateInvestmentAccountInput,
	CreateInvestmentHoldingInput,
	ListInvestmentHoldingsQuery,
	UpdateInvestmentAccountInput,
	UpdateInvestmentHoldingInput,
} from '$lib/schema/investments';
import {
	createInvestmentAccount,
	createInvestmentHolding,
	deleteInvestmentAccount,
	deleteInvestmentHolding,
	getInvestmentAccountById,
	listInvestmentAccounts,
	listInvestmentHoldings,
	updateInvestmentAccount,
	updateInvestmentHolding,
} from '$lib/server/investments/repository';
import { refreshTrackedInvestmentHoldings } from '$lib/server/investments/tracking';

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
	if (value === undefined || value === null) {
		return value;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export const listInvestmentAccountsEffect = () =>
	Effect.try({
		try: () => listInvestmentAccounts(),
		catch: () => persistenceError('Failed to load investment accounts'),
	});

export const createInvestmentAccountEffect = (input: CreateInvestmentAccountInput) =>
	Effect.try({
		try: () =>
			createInvestmentAccount({
				name: input.name.trim(),
				institution: normalizeNullableText(input.institution) ?? null,
				currency: input.currency?.trim().toUpperCase() || 'SEK',
				totalValue: input.totalValue,
			}),
		catch: () => persistenceError('Failed to create investment account'),
	});

export const updateInvestmentAccountEffect = (
	accountId: string,
	input: UpdateInvestmentAccountInput,
) =>
	Effect.try({
		try: () => {
			if (Object.keys(input).length === 0) {
				throw validationError('At least one account field must be provided');
			}

			const account = updateInvestmentAccount(accountId, {
				name: input.name?.trim(),
				institution:
					input.institution === undefined
						? undefined
						: (normalizeNullableText(input.institution) ?? null),
				currency: input.currency?.trim().toUpperCase(),
				totalValue: input.totalValue,
			});
			if (!account) {
				throw notFoundError('Investment account was not found', 'ACCOUNT_NOT_FOUND');
			}
			return account;
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to update investment account'),
	});

export const deleteInvestmentAccountEffect = (accountId: string) =>
	Effect.try({
		try: () => {
			if (!deleteInvestmentAccount(accountId)) {
				throw notFoundError('Investment account was not found', 'ACCOUNT_NOT_FOUND');
			}
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to delete investment account'),
	});

export const listInvestmentHoldingsEffect = (query: ListInvestmentHoldingsQuery = {}) =>
	Effect.try({
		try: () => listInvestmentHoldings(query),
		catch: () => persistenceError('Failed to load investment holdings'),
	});

export const createInvestmentHoldingEffect = (input: CreateInvestmentHoldingInput) =>
	Effect.try({
		try: () => {
			if (!getInvestmentAccountById(input.accountId)) {
				throw notFoundError('Investment account was not found', 'ACCOUNT_NOT_FOUND');
			}

			return createInvestmentHolding({
				accountId: input.accountId,
				name: input.name.trim(),
				allocationPercent: input.allocationPercent,
				currentValue: input.currentValue,
				units: input.units ?? null,
				latestUnitPrice: input.latestUnitPrice ?? null,
				trackerSource: input.trackerSource ?? 'manual',
				trackerUrl: normalizeNullableText(input.trackerUrl) ?? null,
				sortOrder: input.sortOrder ?? 0,
			});
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to create investment holding'),
	});

export const updateInvestmentHoldingEffect = (
	holdingId: string,
	input: UpdateInvestmentHoldingInput,
) =>
	Effect.try({
		try: () => {
			if (Object.keys(input).length === 0) {
				throw validationError('At least one holding field must be provided');
			}

			if (input.accountId && !getInvestmentAccountById(input.accountId)) {
				throw notFoundError('Investment account was not found', 'ACCOUNT_NOT_FOUND');
			}

			const holding = updateInvestmentHolding(holdingId, {
				...input,
				name: input.name?.trim(),
				trackerUrl:
					input.trackerUrl === undefined
						? undefined
						: (normalizeNullableText(input.trackerUrl) ?? null),
				latestPriceDate:
					input.latestPriceDate === undefined
						? undefined
						: (normalizeNullableText(input.latestPriceDate) ?? null),
				lastSyncedAt:
					input.lastSyncedAt === undefined
						? undefined
						: (normalizeNullableText(input.lastSyncedAt) ?? null),
			});
			if (!holding) {
				throw notFoundError('Investment holding was not found', 'HOLDING_NOT_FOUND');
			}
			return holding;
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to update investment holding'),
	});

export const deleteInvestmentHoldingEffect = (holdingId: string) =>
	Effect.try({
		try: () => {
			if (!deleteInvestmentHolding(holdingId)) {
				throw notFoundError('Investment holding was not found', 'HOLDING_NOT_FOUND');
			}
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to delete investment holding'),
	});

export const refreshTrackedInvestmentHoldingsEffect = () =>
	Effect.tryPromise({
		try: async () => {
			const refreshed = await refreshTrackedInvestmentHoldings();
			return {
				holdings: listInvestmentHoldings(),
				outcomes: refreshed.map((result) => ({
					holdingId: result.holdingId,
					name: result.name,
					status: 'refreshed' as const,
					message: null,
					currentValue: result.currentValue,
					unitPrice: result.unitPrice,
					priceDate: result.priceDate,
				})),
			};
		},
		catch: () => persistenceError('Failed to refresh tracked investment holdings'),
	});
