import { z } from 'zod';

import { ApiError, validateWithSchema } from '$lib/server/http';
import type {
	CreateWishlistCategoryInput,
	CreateWishlistItemInput,
	ListWishlistItemsQuery,
	UpdateWishlistCategoryInput,
	UpdateWishlistItemInput,
	WishlistFundingStrategy
} from '$lib/server/wishlist/types';

const nameSchema = z.string().trim().min(1).max(160);
const categoryNameSchema = z.string().trim().min(1).max(80);
const categoryDescriptionSchema = z.string().trim().max(240).optional().nullable();
const amountSchema = z.number().min(0).max(1_000_000_000);
const amountTypeSchema = z.enum(['exact', 'estimate']);
const prioritySchema = z.number().int().min(0).max(10);
const fundingStrategySchema = z.enum(['save', 'loan', 'mixed', 'buy_outright']);
const notesSchema = z.string().trim().max(1000).optional().nullable();
const optionalLoanIdSchema = z.string().trim().min(1).optional().nullable();
const optionalCategoryIdSchema = z.string().trim().min(1).optional().nullable();
const isoDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const createWishlistCategorySchema = z
	.object({
		name: categoryNameSchema,
		description: categoryDescriptionSchema
	})
	.strict();

const updateWishlistCategorySchema = z
	.object({
		name: categoryNameSchema.optional(),
		description: categoryDescriptionSchema
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: 'At least one wishlist category field must be provided'
	});

const createWishlistItemSchema = z
	.object({
		name: nameSchema,
		targetAmount: amountSchema,
		targetAmountType: amountTypeSchema.optional(),
		targetDate: isoDateSchema.optional().nullable(),
		categoryId: optionalCategoryIdSchema,
		priority: prioritySchema.optional(),
		fundingStrategy: fundingStrategySchema.optional(),
		linkedLoanId: optionalLoanIdSchema,
		notes: notesSchema
	})
	.strict();

const updateWishlistItemSchema = z
	.object({
		name: nameSchema.optional(),
		targetAmount: amountSchema.optional(),
		targetAmountType: amountTypeSchema.optional(),
		targetDate: isoDateSchema.optional().nullable(),
		categoryId: optionalCategoryIdSchema,
		priority: prioritySchema.optional(),
		fundingStrategy: fundingStrategySchema.optional(),
		linkedLoanId: optionalLoanIdSchema,
		notes: notesSchema
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: 'At least one wishlist field must be provided'
	});

const listWishlistItemsQuerySchema = z
	.object({
		fundingStrategy: fundingStrategySchema.optional()
	})
	.strict();

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
	if (value === undefined || value === null) {
		return value;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export function parseCreateWishlistCategoryInput(payload: unknown): CreateWishlistCategoryInput {
	const parsed = validateWithSchema(createWishlistCategorySchema, payload);
	return {
		name: parsed.name,
		description: normalizeNullableText(parsed.description) ?? null
	};
}

export function parseUpdateWishlistCategoryInput(payload: unknown): UpdateWishlistCategoryInput {
	const parsed = validateWithSchema(updateWishlistCategorySchema, payload);
	const output: UpdateWishlistCategoryInput = {};

	if ('name' in parsed) {
		output.name = parsed.name;
	}

	if ('description' in parsed) {
		output.description = normalizeNullableText(parsed.description) ?? null;
	}

	return output;
}

function assertFundingLoanCombination(
	fundingStrategy: WishlistFundingStrategy,
	linkedLoanId: string | null
): void {
	if ((fundingStrategy === 'save' || fundingStrategy === 'buy_outright') && linkedLoanId !== null) {
		throw new ApiError(
			400,
			'VALIDATION_ERROR',
			'linkedLoanId must be null when fundingStrategy does not use a loan'
		);
	}
}

export function parseCreateWishlistItemInput(payload: unknown): CreateWishlistItemInput {
	const parsed = validateWithSchema(createWishlistItemSchema, payload);
	const fundingStrategy = (parsed.fundingStrategy ?? 'save') as WishlistFundingStrategy;
	const linkedLoanId = normalizeNullableText(parsed.linkedLoanId) ?? null;
	assertFundingLoanCombination(fundingStrategy, linkedLoanId);

	return {
		name: parsed.name,
		targetAmount: parsed.targetAmount,
		targetAmountType: parsed.targetAmountType ?? 'exact',
		targetDate: parsed.targetDate ?? null,
		categoryId: normalizeNullableText(parsed.categoryId) ?? null,
		priority: parsed.priority ?? 5,
		fundingStrategy,
		linkedLoanId,
		notes: normalizeNullableText(parsed.notes) ?? null
	};
}

export function parseUpdateWishlistItemInput(payload: unknown): UpdateWishlistItemInput {
	const parsed = validateWithSchema(updateWishlistItemSchema, payload);
	const output: UpdateWishlistItemInput = {};

	if ('name' in parsed) {
		output.name = parsed.name;
	}

	if ('targetAmount' in parsed) {
		output.targetAmount = parsed.targetAmount;
	}

	if ('targetAmountType' in parsed) {
		output.targetAmountType = parsed.targetAmountType;
	}

	if ('targetDate' in parsed) {
		output.targetDate = parsed.targetDate ?? null;
	}

	if ('categoryId' in parsed) {
		output.categoryId = normalizeNullableText(parsed.categoryId) ?? null;
	}

	if ('priority' in parsed) {
		output.priority = parsed.priority;
	}

	if ('fundingStrategy' in parsed) {
		output.fundingStrategy = parsed.fundingStrategy as WishlistFundingStrategy;
	}

	if ('linkedLoanId' in parsed) {
		output.linkedLoanId = normalizeNullableText(parsed.linkedLoanId) ?? null;
	}

	if ('notes' in parsed) {
		output.notes = normalizeNullableText(parsed.notes) ?? null;
	}

	if (output.fundingStrategy !== undefined && output.linkedLoanId !== undefined) {
		assertFundingLoanCombination(output.fundingStrategy, output.linkedLoanId);
	}

	return output;
}

export function parseListWishlistItemsQuery(searchParams: URLSearchParams): ListWishlistItemsQuery {
	const parsed = validateWithSchema(listWishlistItemsQuerySchema, {
		fundingStrategy: searchParams.get('fundingStrategy') ?? undefined
	});

	return {
		fundingStrategy: parsed.fundingStrategy as WishlistFundingStrategy | undefined
	};
}
