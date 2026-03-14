import { z } from 'zod';

import { ApiError, validateWithSchema } from '$lib/server/http';
import type {
	CreateCategoryInput,
	CreateRecurringCostInput,
	ListRecurringCostsQuery,
	RecurrencePeriod,
	SummaryQuery,
	UpdateCategoryInput,
	UpdateRecurringCostInput
} from '$lib/server/budget/types';

const categoryNameSchema = z.string().trim().min(1).max(100);
const costNameSchema = z.string().trim().min(1).max(100);
const optionalTextSchema = z.string().max(300).optional().nullable();
const optionalColorSchema = z.string().trim().max(50).optional().nullable();
const amountSchema = z.number().positive();
const recurrencePeriodSchema = z.enum(['weekly', 'monthly', 'yearly']);
const recurringCostKindSchema = z.enum(['expense', 'investment']);
const isoDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const createCategorySchema = z
	.object({
		name: categoryNameSchema,
		description: optionalTextSchema,
		color: optionalColorSchema
	})
	.strict();

const updateCategorySchema = z
	.object({
		name: categoryNameSchema.optional(),
		description: optionalTextSchema,
		color: optionalColorSchema
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: 'At least one category field must be provided'
	});

const createRecurringCostSchema = z
	.object({
		categoryId: z.string().trim().min(1),
		name: costNameSchema,
		amount: amountSchema,
		period: recurrencePeriodSchema,
		kind: recurringCostKindSchema.optional(),
		isEssential: z.boolean().optional(),
		startDate: isoDateSchema.optional().nullable(),
		endDate: isoDateSchema.optional().nullable(),
		isActive: z.boolean().optional()
	})
	.strict();

const updateRecurringCostSchema = z
	.object({
		categoryId: z.string().trim().min(1).optional(),
		name: costNameSchema.optional(),
		amount: amountSchema.optional(),
		period: recurrencePeriodSchema.optional(),
		kind: recurringCostKindSchema.optional(),
		isEssential: z.boolean().optional(),
		startDate: isoDateSchema.optional().nullable(),
		endDate: isoDateSchema.optional().nullable(),
		isActive: z.boolean().optional()
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: 'At least one recurring cost field must be provided'
	});

const listRecurringCostsQuerySchema = z
	.object({
		categoryId: z.string().trim().min(1).optional(),
		includeInactive: z.enum(['true', 'false']).optional()
	})
	.strict();

const summaryQuerySchema = z
	.object({
		includeInactive: z.enum(['true', 'false']).optional()
	})
	.strict();

function normalizeTextValue(value: string | null | undefined): string | null | undefined {
	if (value === undefined || value === null) {
		return value;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

function assertDateRange(startDate: string | null, endDate: string | null): void {
	if (startDate && endDate && endDate < startDate) {
		throw new ApiError(
			400,
			'VALIDATION_ERROR',
			'endDate must be greater than or equal to startDate'
		);
	}
}

export function parseCreateCategoryInput(payload: unknown): CreateCategoryInput {
	const parsed = validateWithSchema(createCategorySchema, payload);

	return {
		name: parsed.name,
		description: normalizeTextValue(parsed.description) ?? null,
		color: normalizeTextValue(parsed.color) ?? null
	};
}

export function parseUpdateCategoryInput(payload: unknown): UpdateCategoryInput {
	const parsed = validateWithSchema(updateCategorySchema, payload);
	const output: UpdateCategoryInput = {};

	if ('name' in parsed) {
		output.name = parsed.name;
	}

	if ('description' in parsed) {
		output.description = normalizeTextValue(parsed.description) ?? null;
	}

	if ('color' in parsed) {
		output.color = normalizeTextValue(parsed.color) ?? null;
	}

	return output;
}

export function parseCreateRecurringCostInput(payload: unknown): CreateRecurringCostInput {
	const parsed = validateWithSchema(createRecurringCostSchema, payload);
	const startDate = parsed.startDate ?? null;
	const endDate = parsed.endDate ?? null;
	const kind = parsed.kind ?? 'expense';
	assertDateRange(startDate, endDate);

	return {
		categoryId: parsed.categoryId,
		name: parsed.name,
		amount: parsed.amount,
		period: parsed.period as RecurrencePeriod,
		kind,
		isEssential: kind === 'investment' ? false : (parsed.isEssential ?? false),
		startDate,
		endDate,
		isActive: parsed.isActive ?? true
	};
}

export function parseUpdateRecurringCostInput(payload: unknown): UpdateRecurringCostInput {
	const parsed = validateWithSchema(updateRecurringCostSchema, payload);
	const output: UpdateRecurringCostInput = {};

	if ('categoryId' in parsed) {
		output.categoryId = parsed.categoryId;
	}

	if ('name' in parsed) {
		output.name = parsed.name;
	}

	if ('amount' in parsed) {
		output.amount = parsed.amount;
	}

	if ('period' in parsed) {
		output.period = parsed.period as RecurrencePeriod;
	}

	if ('kind' in parsed) {
		output.kind = parsed.kind;
		if (parsed.kind === 'investment') {
			output.isEssential = false;
		}
	}

	if ('isEssential' in parsed && output.isEssential === undefined) {
		output.isEssential = parsed.isEssential;
	}

	if ('startDate' in parsed) {
		output.startDate = parsed.startDate ?? null;
	}

	if ('endDate' in parsed) {
		output.endDate = parsed.endDate ?? null;
	}

	if ('isActive' in parsed) {
		output.isActive = parsed.isActive;
	}

	assertDateRange(output.startDate ?? null, output.endDate ?? null);
	return output;
}

export function parseListRecurringCostsQuery(searchParams: URLSearchParams): ListRecurringCostsQuery {
	const parsed = validateWithSchema(listRecurringCostsQuerySchema, {
		categoryId: searchParams.get('categoryId') ?? undefined,
		includeInactive: searchParams.get('includeInactive') ?? undefined
	});

	return {
		categoryId: parsed.categoryId,
		includeInactive: parsed.includeInactive === 'true'
	};
}

export function parseSummaryQuery(searchParams: URLSearchParams): SummaryQuery {
	const parsed = validateWithSchema(summaryQuerySchema, {
		includeInactive: searchParams.get('includeInactive') ?? undefined
	});

	return {
		includeInactive: parsed.includeInactive === 'true'
	};
}
