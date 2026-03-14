import { z } from 'zod';

import { validateWithSchema } from '$lib/server/http';
import type {
	AssignTransactionCategoryInput,
	ListImportBatchesQuery,
	ListReviewTransactionsQuery
} from '$lib/server/imports/types';

const batchQuerySchema = z
	.object({
		limit: z.coerce.number().int().min(1).max(200).optional()
	})
	.strict();

const reviewQuerySchema = z
	.object({
		batchId: z.string().trim().min(1).optional(),
		limit: z.coerce.number().int().min(1).max(500).optional()
	})
	.strict();

const assignTransactionCategorySchema = z
	.object({
		categoryId: z.string().trim().min(1).nullable(),
		saveRule: z.boolean().optional()
	})
	.strict();

export function parseListImportBatchesQuery(searchParams: URLSearchParams): ListImportBatchesQuery {
	const parsed = validateWithSchema(batchQuerySchema, {
		limit: searchParams.get('limit') ?? undefined
	});

	return {
		limit: parsed.limit
	};
}

export function parseListReviewTransactionsQuery(
	searchParams: URLSearchParams
): ListReviewTransactionsQuery {
	const parsed = validateWithSchema(reviewQuerySchema, {
		batchId: searchParams.get('batchId') ?? undefined,
		limit: searchParams.get('limit') ?? undefined
	});

	return {
		batchId: parsed.batchId,
		limit: parsed.limit
	};
}

export function parseAssignTransactionCategoryInput(
	payload: unknown
): AssignTransactionCategoryInput {
	const parsed = validateWithSchema(assignTransactionCategorySchema, payload);

	return {
		categoryId: parsed.categoryId,
		saveRule: parsed.saveRule ?? false
	};
}
