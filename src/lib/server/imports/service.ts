import * as Effect from 'effect/Effect';

import { notFoundError, persistenceError } from '$lib/effect/errors';
import { getCategoryById } from '$lib/server/budget/categories.repository';
import { parseNordeaTransactionsCsv } from '$lib/server/imports/csv';
import { normalizeMerchantDescription } from '$lib/server/imports/normalization';
import {
	createImportBatch,
	findMostRecentCategorizedTransactionByNormalizedDescription,
	getMerchantCategoryRuleByNormalizedDescription,
	getTransactionById,
	insertImportedTransaction,
	listImportBatches,
	listReviewTransactions,
	updateImportBatchStatus,
	updateTransactionCategory,
	upsertMerchantCategoryRule,
	withDatabaseTransaction,
} from '$lib/server/imports/repository';
import type {
	AssignTransactionCategoryInput,
	ListImportBatchesQuery,
	ListReviewTransactionsQuery,
	UploadCsvResult,
} from '$lib/server/imports/types';

export function importNordeaCsv(input: {
	sourceName: string;
	csvText: string;
	importedAt?: string;
}): UploadCsvResult {
	const rows = parseNordeaTransactionsCsv(input.csvText);
	if (rows.length === 0) {
		throw persistenceError('CSV file did not include any transactions', 'INVALID_CSV_FORMAT');
	}

	const importedAt = input.importedAt ?? new Date().toISOString();
	const batch = createImportBatch({
		sourceName: input.sourceName,
		importedAt,
		rowCount: rows.length,
		status: 'processing',
	});

	const summary = {
		inserted: 0,
		categorizedByRule: 0,
		categorizedByHistory: 0,
		needsReview: 0,
	};

	try {
		const ruleCategoryCache = new Map<string, string | null>();
		const historyCategoryCache = new Map<string, string | null>();

		withDatabaseTransaction(() => {
			for (const row of rows) {
				const normalizedDescription = normalizeMerchantDescription(row.description);
				let categoryId: string | null = null;
				let matchMethod: 'rule_exact' | 'history_exact' | 'needs_review' = 'needs_review';

				if (ruleCategoryCache.has(normalizedDescription)) {
					categoryId = ruleCategoryCache.get(normalizedDescription) ?? null;
				} else {
					const rule = getMerchantCategoryRuleByNormalizedDescription(normalizedDescription);
					const ruleCategoryId = rule?.categoryId ?? null;
					ruleCategoryCache.set(normalizedDescription, ruleCategoryId);
					categoryId = ruleCategoryId;
				}

				if (categoryId) {
					matchMethod = 'rule_exact';
					summary.categorizedByRule += 1;
				} else {
					if (historyCategoryCache.has(normalizedDescription)) {
						categoryId = historyCategoryCache.get(normalizedDescription) ?? null;
					} else {
						const history =
							findMostRecentCategorizedTransactionByNormalizedDescription(normalizedDescription);
						const historyCategoryId = history?.categoryId ?? null;
						historyCategoryCache.set(normalizedDescription, historyCategoryId);
						categoryId = historyCategoryId;
					}

					if (categoryId) {
						matchMethod = 'history_exact';
						summary.categorizedByHistory += 1;
					} else {
						summary.needsReview += 1;
					}
				}

				insertImportedTransaction({
					bookingDate: row.bookingDate,
					description: row.description,
					normalizedDescription,
					amount: row.amount,
					currency: row.currency,
					categoryId,
					matchMethod,
					importBatchId: batch.id,
				});

				summary.inserted += 1;
			}
		});

		const completedBatch = updateImportBatchStatus(batch.id, 'completed');
		if (!completedBatch) {
			throw persistenceError('Failed to update import batch status');
		}

		return {
			batch: completedBatch,
			summary,
		};
	} catch (error) {
		updateImportBatchStatus(batch.id, 'failed');
		throw error;
	}
}

export const listImportBatchesEffect = (query: ListImportBatchesQuery = {}) =>
	Effect.try({
		try: () => listImportBatches(query),
		catch: () => persistenceError('Failed to load import batches'),
	});

export const listReviewTransactionsEffect = (query: ListReviewTransactionsQuery = {}) =>
	Effect.try({
		try: () => listReviewTransactions(query),
		catch: () => persistenceError('Failed to load review transactions'),
	});

export const uploadImportCsvEffect = (input: {
	sourceName: string;
	csvText: string;
	importedAt?: string;
}) =>
	Effect.try({
		try: () => importNordeaCsv(input),
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to import CSV'),
	});

export const assignTransactionCategoryEffect = (
	transactionId: string,
	input: AssignTransactionCategoryInput,
) =>
	Effect.try({
		try: () => {
			const existing = getTransactionById(transactionId);
			if (!existing) {
				throw notFoundError('Transaction was not found', 'TRANSACTION_NOT_FOUND');
			}

			if (input.categoryId && !getCategoryById(input.categoryId)) {
				throw notFoundError('Category was not found', 'CATEGORY_NOT_FOUND');
			}

			const updated = updateTransactionCategory(transactionId, {
				categoryId: input.categoryId,
				matchMethod: input.categoryId ? 'manual' : 'needs_review',
			});
			if (!updated) {
				throw notFoundError('Transaction was not found', 'TRANSACTION_NOT_FOUND');
			}

			if (input.saveRule && input.categoryId) {
				upsertMerchantCategoryRule({
					normalizedDescription: updated.normalizedDescription,
					categoryId: input.categoryId,
					confidence: 1,
				});
			}

			return updated;
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to assign transaction category'),
	});
