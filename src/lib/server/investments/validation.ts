import { z } from 'zod';

import { validateWithSchema } from '$lib/server/http';
import type {
	CreateInvestmentAccountInput,
	CreateInvestmentHoldingInput,
	ListInvestmentHoldingsQuery,
	UpdateInvestmentAccountInput,
	UpdateInvestmentHoldingInput
} from '$lib/server/investments/types';

const accountNameSchema = z.string().trim().min(1).max(120);
const optionalTextSchema = z.string().trim().max(200).optional().nullable();
const currencySchema = z.string().trim().toUpperCase().length(3);
const amountSchema = z.number().min(0).max(1_000_000_000);
const percentSchema = z.number().min(0).max(100);
const sortOrderSchema = z.number().int().min(0).max(10_000);
const nullableAmountSchema = amountSchema.nullable().optional();
const trackerSourceSchema = z.enum(['manual', 'nordea', 'avanza']);
const trackerUrlSchema = z.string().trim().url().optional().nullable();

const createAccountSchema = z
	.object({
		name: accountNameSchema,
		institution: optionalTextSchema,
		currency: currencySchema.optional(),
		totalValue: amountSchema
	})
	.strict();

const updateAccountSchema = z
	.object({
		name: accountNameSchema.optional(),
		institution: optionalTextSchema,
		currency: currencySchema.optional(),
		totalValue: amountSchema.optional()
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: 'At least one account field must be provided'
	});

const createHoldingSchema = z
	.object({
		accountId: z.string().trim().min(1),
		name: accountNameSchema,
		allocationPercent: percentSchema,
		currentValue: amountSchema,
		units: nullableAmountSchema,
		latestUnitPrice: nullableAmountSchema,
		trackerSource: trackerSourceSchema.optional(),
		trackerUrl: trackerUrlSchema,
		sortOrder: sortOrderSchema.optional()
	})
	.strict();

const updateHoldingSchema = z
	.object({
		accountId: z.string().trim().min(1).optional(),
		name: accountNameSchema.optional(),
		allocationPercent: percentSchema.optional(),
		currentValue: amountSchema.optional(),
		units: nullableAmountSchema,
		latestUnitPrice: nullableAmountSchema,
		trackerSource: trackerSourceSchema.optional(),
		trackerUrl: trackerUrlSchema,
		latestPriceDate: z.string().trim().min(1).optional().nullable(),
		lastSyncedAt: z.string().trim().min(1).optional().nullable(),
		sortOrder: sortOrderSchema.optional()
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: 'At least one holding field must be provided'
	});

const listHoldingsQuerySchema = z
	.object({
		accountId: z.string().trim().min(1).optional()
	})
	.strict();

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
	if (value === undefined || value === null) {
		return value;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export function parseCreateInvestmentAccountInput(payload: unknown): CreateInvestmentAccountInput {
	const parsed = validateWithSchema(createAccountSchema, payload);

	return {
		name: parsed.name,
		institution: normalizeNullableText(parsed.institution) ?? null,
		currency: parsed.currency ?? 'SEK',
		totalValue: parsed.totalValue
	};
}

export function parseUpdateInvestmentAccountInput(payload: unknown): UpdateInvestmentAccountInput {
	const parsed = validateWithSchema(updateAccountSchema, payload);
	const output: UpdateInvestmentAccountInput = {};

	if ('name' in parsed) {
		output.name = parsed.name;
	}

	if ('institution' in parsed) {
		output.institution = normalizeNullableText(parsed.institution) ?? null;
	}

	if ('currency' in parsed) {
		output.currency = parsed.currency;
	}

	if ('totalValue' in parsed) {
		output.totalValue = parsed.totalValue;
	}

	return output;
}

export function parseCreateInvestmentHoldingInput(payload: unknown): CreateInvestmentHoldingInput {
	const parsed = validateWithSchema(createHoldingSchema, payload);

	return {
		accountId: parsed.accountId,
		name: parsed.name,
		allocationPercent: parsed.allocationPercent,
		currentValue: parsed.currentValue,
		units: parsed.units ?? null,
		latestUnitPrice: parsed.latestUnitPrice ?? null,
		trackerSource: parsed.trackerSource ?? 'manual',
		trackerUrl: normalizeNullableText(parsed.trackerUrl) ?? null,
		sortOrder: parsed.sortOrder ?? 0
	};
}

export function parseUpdateInvestmentHoldingInput(payload: unknown): UpdateInvestmentHoldingInput {
	const parsed = validateWithSchema(updateHoldingSchema, payload);
	const output: UpdateInvestmentHoldingInput = {};

	if ('accountId' in parsed) {
		output.accountId = parsed.accountId;
	}

	if ('name' in parsed) {
		output.name = parsed.name;
	}

	if ('allocationPercent' in parsed) {
		output.allocationPercent = parsed.allocationPercent;
	}

	if ('currentValue' in parsed) {
		output.currentValue = parsed.currentValue;
	}

	if ('units' in parsed) {
		output.units = parsed.units ?? null;
	}

	if ('latestUnitPrice' in parsed) {
		output.latestUnitPrice = parsed.latestUnitPrice ?? null;
	}

	if ('trackerSource' in parsed) {
		output.trackerSource = parsed.trackerSource;
	}

	if ('trackerUrl' in parsed) {
		output.trackerUrl = normalizeNullableText(parsed.trackerUrl) ?? null;
	}

	if ('latestPriceDate' in parsed) {
		output.latestPriceDate = normalizeNullableText(parsed.latestPriceDate) ?? null;
	}

	if ('lastSyncedAt' in parsed) {
		output.lastSyncedAt = normalizeNullableText(parsed.lastSyncedAt) ?? null;
	}

	if ('sortOrder' in parsed) {
		output.sortOrder = parsed.sortOrder;
	}

	return output;
}

export function parseListInvestmentHoldingsQuery(
	searchParams: URLSearchParams
): ListInvestmentHoldingsQuery {
	const parsed = validateWithSchema(listHoldingsQuerySchema, {
		accountId: searchParams.get('accountId') ?? undefined
	});

	return {
		accountId: parsed.accountId
	};
}
