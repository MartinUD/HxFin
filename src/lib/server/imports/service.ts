import { createHash } from 'node:crypto';

import * as Effect from 'effect/Effect';

import { notFoundError, persistenceError } from '$lib/effect/errors';
import { listCategories, getCategoryById } from '$lib/server/budget/categories.repository';
import {
	type AiCategorizationResult,
	type AiCategorizer,
	DEFAULT_AI_MODEL_LABEL,
	DEFAULT_AI_PROMPT_VERSION,
	buildSingleTransactionAiUserPayload,
	categorizeMerchantsWithAi,
	type SingleTransactionAiCategorizer,
	suggestSingleTransactionCategoryWithAi,
	suggestSingleTransactionCategoryWithAiDebug,
} from '$lib/server/imports/ai-categorization';
import { resolveDeterministicCategorization } from '$lib/server/imports/deterministic-categorization';
import { buildImportFingerprint } from '$lib/server/imports/fingerprint';
import { parseNordeaTransactionsCsv } from '$lib/server/imports/csv';
import { findHeuristicCategoryMatch } from '$lib/server/imports/heuristic-categorization';
import { normalizeMerchantDescription } from '$lib/server/imports/normalization';
import {
	createImportBatch,
	findMostRecentCategorizedTransactionByNormalizedDescription,
	getMerchantCategoryCodexCacheByLookup,
	getMerchantCategoryRuleByNormalizedDescription,
	getTransactionById,
	listTransactionsByImportFingerprints,
	insertImportedTransaction,
	listImportBatches,
	listImportTransactions,
	listReviewTransactions,
	updateTransactionCategorization,
	updateImportBatchStatus,
	updateTransactionCategory,
	upsertMerchantCategoryCodexCache,
	upsertMerchantCategoryRule,
	withDatabaseTransaction,
} from '$lib/server/imports/repository';
import type {
	AssignTransactionCategoryInput,
	ListImportBatchesQuery,
	ListReviewTransactionsQuery,
	ReprocessImportTransactionsInput,
	ReprocessImportTransactionsResult,
	SuggestTransactionCategoryWithAiInput,
	SuggestTransactionCategoryWithAiResult,
	TransactionCategorizationSource,
	TransactionCategorizationStatus,
	UploadCsvResult,
} from '$lib/server/imports/types';
import type { BudgetCategory } from '$lib/schema/budget';

interface StagedTransaction {
	bookingDate: string;
	description: string;
	normalizedDescription: string;
	amount: number;
	currency: string;
	importFingerprint: string;
	categoryId: string | null;
	categorizationStatus: TransactionCategorizationStatus;
	categorizationSource: TransactionCategorizationSource;
	suggestedCategoryId?: string | null;
	suggestedConfidence?: number | null;
	suggestedReason?: string | null;
	suggestedByModel?: string | null;
	suggestedAt?: string | null;
}

interface UploadSummaryMutable {
	inserted: number;
	skippedDuplicates: number;
	categorizedByRule: number;
	categorizedByHistory: number;
	categorizedByHeuristic: number;
	categorizedByAi: number;
	suggestedByAi: number;
	categorizedByCodex: number;
	suggestedByCodex: number;
	needsReview: number;
	skippedNonExpense: number;
}

interface ReprocessSummaryMutable {
	processed: number;
	categorizedByAi: number;
	suggestedByAi: number;
	categorizedByCodex: number;
	suggestedByCodex: number;
	needsReview: number;
}

interface ImportDependencies {
	aiCategorizer: AiCategorizer;
	singleTransactionAiCategorizer: SingleTransactionAiCategorizer;
	now: () => string;
	aiAutoApplyThreshold: number;
	aiPromptVersion: string;
	aiModelLabel: string;
}

interface LegacyImportDependencies {
	codexCategorizer: (input: {
		categories: BudgetCategory[];
		merchants: Array<{ normalizedDescription: string; description: string; amount: number }>;
		promptVersion?: string;
	}) => Promise<
		Array<{
			normalizedDescription: string;
			suggestedCategoryId: string | null;
			confidence: number;
			reason?: string | null;
			isCertain?: boolean;
		}>
	>;
	singleTransactionCodexCategorizer: (input: {
		categories: BudgetCategory[];
		description: string;
		amount: number;
	}) => Promise<{
		suggestedCategoryId: string | null;
		confidence: number;
		reason?: string | null;
	}>;
	codexConfidenceThreshold: number;
	codexPromptVersion: string;
	codexModelLabel: string;
}

function toExistingCategoryId(
	categoryId: string | null | undefined,
	existingCategoryIds: Set<string>,
): string | null {
	if (!categoryId) {
		return null;
	}

	return existingCategoryIds.has(categoryId) ? categoryId : null;
}

function toExistingAiResult(
	result: AiCategorizationResult | null | undefined,
	existingCategoryIds: Set<string>,
): AiCategorizationResult | null {
	if (!result) {
		return null;
	}

	return {
		...result,
		suggestedCategoryId: toExistingCategoryId(result.suggestedCategoryId, existingCategoryIds),
	};
}

const defaultDependencies: ImportDependencies = {
	aiCategorizer: categorizeMerchantsWithAi,
	singleTransactionAiCategorizer: suggestSingleTransactionCategoryWithAi,
	now: () => new Date().toISOString(),
	aiAutoApplyThreshold: Number(process.env.OPENROUTER_AUTO_APPLY_THRESHOLD ?? '90'),
	aiPromptVersion: process.env.AI_IMPORTS_PROMPT_VERSION ?? DEFAULT_AI_PROMPT_VERSION,
	aiModelLabel: process.env.OPENROUTER_MODEL?.trim() || DEFAULT_AI_MODEL_LABEL,
};

function resolveImportDependencies(
	dependencies: Partial<ImportDependencies & LegacyImportDependencies>,
): ImportDependencies {
	const aiCategorizer =
		dependencies.aiCategorizer ??
		(dependencies.codexCategorizer
			? async (input) => {
					const results = await dependencies.codexCategorizer!(input);
					return results.map((result) => ({
						normalizedDescription: result.normalizedDescription,
						suggestedCategoryId: result.suggestedCategoryId,
						certainty: result.suggestedCategoryId
							? result.isCertain
								? 100
								: Math.round(result.confidence * 100)
							: 0,
					}));
				}
			: defaultDependencies.aiCategorizer);

	const singleTransactionAiCategorizer =
		dependencies.singleTransactionAiCategorizer ??
		(dependencies.singleTransactionCodexCategorizer
			? async (input) => {
					const result = await dependencies.singleTransactionCodexCategorizer!(input);
					return {
						suggestedCategoryId: result.suggestedCategoryId,
						certainty: result.suggestedCategoryId ? Math.round(result.confidence * 100) : 0,
					};
				}
			: defaultDependencies.singleTransactionAiCategorizer);

	return {
		aiCategorizer,
		singleTransactionAiCategorizer,
		now: dependencies.now ?? defaultDependencies.now,
		aiAutoApplyThreshold:
			dependencies.aiAutoApplyThreshold ??
			dependencies.codexConfidenceThreshold ??
			defaultDependencies.aiAutoApplyThreshold,
		aiPromptVersion:
			dependencies.aiPromptVersion ??
			dependencies.codexPromptVersion ??
			defaultDependencies.aiPromptVersion,
		aiModelLabel:
			dependencies.aiModelLabel ??
			dependencies.codexModelLabel ??
			defaultDependencies.aiModelLabel,
	};
}

function hashCategories(categories: BudgetCategory[]): string {
	return createHash('sha256')
		.update(
			JSON.stringify(
				categories
					.map((category) => ({
						id: category.id,
						name: category.name,
						description: category.description,
					}))
					.sort((left, right) => left.id.localeCompare(right.id)),
			),
		)
		.digest('hex');
}

function applyAiOutcome(input: {
	row: {
		bookingDate: string;
		description: string;
		normalizedDescription: string;
		amount: number;
		currency: string;
		importFingerprint: string;
	};
	result: AiCategorizationResult | null;
	modelLabel: string;
	certaintyThreshold: number;
	timestamp: string;
}): StagedTransaction {
	if (input.result?.suggestedCategoryId) {
		if (input.result.certainty >= input.certaintyThreshold) {
			return {
				...input.row,
				categoryId: input.result.suggestedCategoryId,
				categorizationStatus: 'categorized',
				categorizationSource: 'codex_auto',
				suggestedCategoryId: null,
				suggestedConfidence: null,
				suggestedReason: null,
				suggestedByModel: input.modelLabel,
				suggestedAt: input.timestamp,
			};
		}

		return {
			...input.row,
			categoryId: null,
			categorizationStatus: 'suggested',
			categorizationSource: 'codex_suggested',
			suggestedCategoryId: input.result.suggestedCategoryId,
			suggestedConfidence: input.result.certainty / 100,
			suggestedReason: null,
			suggestedByModel: input.modelLabel,
			suggestedAt: input.timestamp,
		};
	}

	return {
		...input.row,
		categoryId: null,
		categorizationStatus: 'needs_review',
		categorizationSource: 'codex_suggested',
		suggestedCategoryId: null,
		suggestedConfidence: input.result ? input.result.certainty / 100 : null,
		suggestedReason: null,
		suggestedByModel: input.result ? input.modelLabel : null,
		suggestedAt: input.result ? input.timestamp : null,
	};
}

function incrementSummary(summary: UploadSummaryMutable, transaction: StagedTransaction): void {
	summary.inserted += 1;

	if (transaction.categorizationStatus === 'skipped') {
		summary.skippedNonExpense += 1;
		return;
	}

	switch (transaction.categorizationSource) {
		case 'rule_exact':
			summary.categorizedByRule += 1;
			return;
		case 'history_exact':
			summary.categorizedByHistory += 1;
			return;
		case 'heuristic_keyword':
			summary.categorizedByHeuristic += 1;
			return;
		case 'codex_auto':
			summary.categorizedByAi += 1;
			summary.categorizedByCodex += 1;
			return;
		case 'codex_suggested':
			if (transaction.categorizationStatus === 'suggested') {
				summary.suggestedByAi += 1;
				summary.suggestedByCodex += 1;
			} else {
				summary.needsReview += 1;
			}
			return;
		default:
			if (transaction.categorizationStatus === 'needs_review') {
				summary.needsReview += 1;
			}
	}
}

function isDuplicateFingerprintError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	return (
		error.message.includes('transactions_import_fingerprint_unique') ||
		error.message.includes('UNIQUE constraint failed: transactions.import_fingerprint')
	);
}

export async function importNordeaCsvWithDependencies(
	input: {
		sourceName: string;
		csvText: string;
		importedAt?: string;
	},
	dependencies: Partial<ImportDependencies & LegacyImportDependencies> = {},
): Promise<UploadCsvResult> {
	const rows = parseNordeaTransactionsCsv(input.csvText);
	if (rows.length === 0) {
		throw persistenceError('CSV file did not include any transactions', 'INVALID_CSV_FORMAT');
	}

	const resolvedDependencies = resolveImportDependencies(dependencies);

	const importedAt = input.importedAt ?? resolvedDependencies.now();
	const batch = createImportBatch({
		sourceName: input.sourceName,
		importedAt,
		rowCount: rows.length,
		status: 'processing',
	});

	const summary: UploadSummaryMutable = {
		inserted: 0,
		skippedDuplicates: 0,
		categorizedByRule: 0,
		categorizedByHistory: 0,
		categorizedByHeuristic: 0,
		categorizedByAi: 0,
		suggestedByAi: 0,
		categorizedByCodex: 0,
		suggestedByCodex: 0,
		needsReview: 0,
		skippedNonExpense: 0,
	};

	try {
		const categories = listCategories();
		const existingCategoryIds = new Set(categories.map((category) => category.id));
		const categoriesHash = hashCategories(categories);
		const importFingerprints = rows.map((row) =>
			buildImportFingerprint({
				bookingDate: row.bookingDate,
				description: row.description,
				amount: row.amount,
				currency: row.currency,
			}),
		);
		const existingFingerprints = new Set(
			listTransactionsByImportFingerprints(importFingerprints).map((transaction) =>
				buildImportFingerprint({
					bookingDate: transaction.bookingDate,
					description: transaction.description,
					amount: transaction.amount,
					currency: transaction.currency,
				}),
			),
		);
		const seenFingerprints = new Set<string>();
		const ruleCategoryCache = new Map<string, string | null>();
		const historyCategoryCache = new Map<string, string | null>();
		const stagedTransactions: StagedTransaction[] = [];
		const unresolvedMerchants = new Map<
			string,
			{ normalizedDescription: string; description: string; amount: number }
		>();
		const unresolvedRows: Array<{
			row: {
				bookingDate: string;
				description: string;
				normalizedDescription: string;
				amount: number;
				currency: string;
				importFingerprint: string;
			};
		}> = [];

		for (const row of rows) {
			const normalizedDescription = normalizeMerchantDescription(row.description);
			const importFingerprint = buildImportFingerprint({
				bookingDate: row.bookingDate,
				description: row.description,
				amount: row.amount,
				currency: row.currency,
			});
			if (existingFingerprints.has(importFingerprint) || seenFingerprints.has(importFingerprint)) {
				summary.skippedDuplicates += 1;
				continue;
			}
			seenFingerprints.add(importFingerprint);
			const baseRow = {
				bookingDate: row.bookingDate,
				description: row.description,
				normalizedDescription,
				amount: row.amount,
				currency: row.currency,
				importFingerprint,
			};

			if (row.amount >= 0) {
				stagedTransactions.push({
					...baseRow,
					categoryId: null,
					categorizationStatus: 'skipped',
					categorizationSource: 'skipped_non_expense',
				});
				continue;
			}

			let ruleCategoryId: string | null = null;
			if (ruleCategoryCache.has(normalizedDescription)) {
				ruleCategoryId = ruleCategoryCache.get(normalizedDescription) ?? null;
			} else {
				ruleCategoryId = toExistingCategoryId(
					getMerchantCategoryRuleByNormalizedDescription(normalizedDescription)?.categoryId ?? null,
					existingCategoryIds,
				);
				ruleCategoryCache.set(normalizedDescription, ruleCategoryId);
			}

			let historyCategoryId: string | null = null;
			if (!ruleCategoryId) {
				if (historyCategoryCache.has(normalizedDescription)) {
					historyCategoryId = historyCategoryCache.get(normalizedDescription) ?? null;
				} else {
					historyCategoryId = toExistingCategoryId(
						findMostRecentCategorizedTransactionByNormalizedDescription(normalizedDescription)
							?.categoryId ?? null,
						existingCategoryIds,
					);
					historyCategoryCache.set(normalizedDescription, historyCategoryId);
				}
			}

			const deterministicMatch = resolveDeterministicCategorization({
				ruleCategoryId,
				historyCategoryId,
			});
			if (deterministicMatch) {
				stagedTransactions.push({
					...baseRow,
					categoryId: deterministicMatch.categoryId,
					categorizationStatus: 'categorized',
					categorizationSource: deterministicMatch.source,
				});
				continue;
			}

			const heuristicMatch = findHeuristicCategoryMatch({
				normalizedDescription,
				categories,
			});
			if (heuristicMatch) {
				stagedTransactions.push({
					...baseRow,
					categoryId: heuristicMatch.categoryId,
					categorizationStatus: 'categorized',
					categorizationSource: heuristicMatch.source,
				});
				continue;
			}

			const cachedSuggestion = getMerchantCategoryCodexCacheByLookup({
				normalizedDescription,
					promptVersion: resolvedDependencies.aiPromptVersion,
				categoriesHash,
			});
			const cachedSuggestedCategoryId = toExistingCategoryId(
				cachedSuggestion?.suggestedCategoryId ?? null,
				existingCategoryIds,
			);
			if (cachedSuggestion && cachedSuggestedCategoryId) {
				stagedTransactions.push(
					applyAiOutcome({
						row: baseRow,
						result: {
							normalizedDescription,
							suggestedCategoryId: cachedSuggestedCategoryId,
							certainty: Math.round(cachedSuggestion.confidence * 100),
						},
						modelLabel: cachedSuggestion.modelLabel,
						certaintyThreshold: resolvedDependencies.aiAutoApplyThreshold,
						timestamp: resolvedDependencies.now(),
					}),
				);
				continue;
			}

			unresolvedMerchants.set(normalizedDescription, {
				normalizedDescription,
				description: row.description,
				amount: row.amount,
			});
			unresolvedRows.push({ row: baseRow });
		}

		let aiResultsByDescription = new Map<string, AiCategorizationResult>();
		if (unresolvedMerchants.size > 0) {
			try {
				const aiResults = await resolvedDependencies.aiCategorizer({
					categories,
					merchants: Array.from(unresolvedMerchants.values()),
					promptVersion: resolvedDependencies.aiPromptVersion,
				});
				aiResultsByDescription = new Map(
					aiResults.map((result) => [
						result.normalizedDescription,
						toExistingAiResult(result, existingCategoryIds) ?? result,
					]),
				);

				for (const merchant of unresolvedMerchants.values()) {
					const result = aiResultsByDescription.get(merchant.normalizedDescription) ?? {
						normalizedDescription: merchant.normalizedDescription,
						suggestedCategoryId: null,
						certainty: 0,
					};
					if (!result.suggestedCategoryId) {
						continue;
					}
					upsertMerchantCategoryCodexCache({
						normalizedDescription: merchant.normalizedDescription,
						sampleDescription: merchant.description,
						suggestedCategoryId: result.suggestedCategoryId,
						confidence: result.certainty / 100,
						reason: null,
						modelLabel: resolvedDependencies.aiModelLabel,
						promptVersion: resolvedDependencies.aiPromptVersion,
						categoriesHash,
					});
				}
			} catch (error) {
				console.warn('AI categorization failed; falling back to manual review.', error);
			}
		}

		for (const unresolved of unresolvedRows) {
			stagedTransactions.push(
				applyAiOutcome({
					row: unresolved.row,
					result: aiResultsByDescription.get(unresolved.row.normalizedDescription) ?? null,
					modelLabel: resolvedDependencies.aiModelLabel,
					certaintyThreshold: resolvedDependencies.aiAutoApplyThreshold,
					timestamp: resolvedDependencies.now(),
				}),
			);
		}

		withDatabaseTransaction(() => {
			for (const transaction of stagedTransactions) {
				try {
					insertImportedTransaction({
						bookingDate: transaction.bookingDate,
						description: transaction.description,
						normalizedDescription: transaction.normalizedDescription,
						amount: transaction.amount,
						currency: transaction.currency,
						importFingerprint: transaction.importFingerprint,
						categoryId: transaction.categoryId,
						categorizationStatus: transaction.categorizationStatus,
						categorizationSource: transaction.categorizationSource,
						suggestedCategoryId: transaction.suggestedCategoryId ?? null,
						suggestedConfidence: transaction.suggestedConfidence ?? null,
						suggestedReason: transaction.suggestedReason ?? null,
						suggestedByModel: transaction.suggestedByModel ?? null,
						suggestedAt: transaction.suggestedAt ?? null,
						importBatchId: batch.id,
					});
					incrementSummary(summary, transaction);
				} catch (error) {
					if (!isDuplicateFingerprintError(error)) {
						throw error;
					}

					summary.skippedDuplicates += 1;
				}
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

export function importNordeaCsv(input: {
	sourceName: string;
	csvText: string;
	importedAt?: string;
}): Promise<UploadCsvResult> {
	return importNordeaCsvWithDependencies(input);
}

export async function reprocessImportTransactionsWithDependencies(
	input: ReprocessImportTransactionsInput,
	dependencies: Partial<ImportDependencies & LegacyImportDependencies> = {},
): Promise<ReprocessImportTransactionsResult> {
	const resolvedDependencies = resolveImportDependencies(dependencies);
	const categories = listCategories();
	const existingCategoryIds = new Set(categories.map((category) => category.id));
	const categoriesHash = hashCategories(categories);
	const reviewTransactions = listReviewTransactions({
		batchId: input.batchId,
		limit: 500,
	}).filter((transaction) => transaction.amount < 0);

	if (reviewTransactions.length === 0) {
		return {
			processed: 0,
			categorizedByAi: 0,
			suggestedByAi: 0,
			categorizedByCodex: 0,
			suggestedByCodex: 0,
			needsReview: 0,
		};
	}

	const updates = new Map<
		string,
		ReturnType<typeof applyAiOutcome> & { transactionId: string }
	>();
	const unresolvedMerchants = new Map<
		string,
		{ normalizedDescription: string; description: string; amount: number }
	>();

	for (const transaction of reviewTransactions) {
		const deterministicMatch = resolveDeterministicCategorization({
			ruleCategoryId: toExistingCategoryId(
				getMerchantCategoryRuleByNormalizedDescription(transaction.normalizedDescription)?.categoryId ??
					null,
				existingCategoryIds,
			),
			historyCategoryId: toExistingCategoryId(
				findMostRecentCategorizedTransactionByNormalizedDescription(
					transaction.normalizedDescription,
				)?.categoryId ?? null,
				existingCategoryIds,
			),
		});
		if (deterministicMatch) {
			updates.set(transaction.id, {
				transactionId: transaction.id,
				bookingDate: transaction.bookingDate,
				description: transaction.description,
				normalizedDescription: transaction.normalizedDescription,
				amount: transaction.amount,
				currency: transaction.currency,
				importFingerprint: buildImportFingerprint({
					bookingDate: transaction.bookingDate,
					description: transaction.description,
					amount: transaction.amount,
					currency: transaction.currency,
				}),
				categoryId: deterministicMatch.categoryId,
				categorizationStatus: 'categorized',
				categorizationSource: deterministicMatch.source,
			});
			continue;
		}

		const heuristicMatch = findHeuristicCategoryMatch({
			normalizedDescription: transaction.normalizedDescription,
			categories,
		});
		if (heuristicMatch) {
			updates.set(transaction.id, {
				transactionId: transaction.id,
				bookingDate: transaction.bookingDate,
				description: transaction.description,
				normalizedDescription: transaction.normalizedDescription,
				amount: transaction.amount,
				currency: transaction.currency,
				importFingerprint: buildImportFingerprint({
					bookingDate: transaction.bookingDate,
					description: transaction.description,
					amount: transaction.amount,
					currency: transaction.currency,
				}),
				categoryId: heuristicMatch.categoryId,
				categorizationStatus: 'categorized',
				categorizationSource: heuristicMatch.source,
			});
			continue;
		}

		const cachedSuggestion = getMerchantCategoryCodexCacheByLookup({
			normalizedDescription: transaction.normalizedDescription,
			promptVersion: resolvedDependencies.aiPromptVersion,
			categoriesHash,
		});
		const cachedSuggestedCategoryId = toExistingCategoryId(
			cachedSuggestion?.suggestedCategoryId ?? null,
			existingCategoryIds,
		);
		if (cachedSuggestion && cachedSuggestedCategoryId) {
			updates.set(transaction.id, {
				transactionId: transaction.id,
				...applyAiOutcome({
					row: {
						bookingDate: transaction.bookingDate,
						description: transaction.description,
						normalizedDescription: transaction.normalizedDescription,
						amount: transaction.amount,
						currency: transaction.currency,
						importFingerprint: buildImportFingerprint({
							bookingDate: transaction.bookingDate,
							description: transaction.description,
							amount: transaction.amount,
							currency: transaction.currency,
						}),
					},
					result: {
						normalizedDescription: transaction.normalizedDescription,
						suggestedCategoryId: cachedSuggestedCategoryId,
						certainty: Math.round(cachedSuggestion.confidence * 100),
					},
					modelLabel: cachedSuggestion.modelLabel,
					certaintyThreshold: resolvedDependencies.aiAutoApplyThreshold,
					timestamp: resolvedDependencies.now(),
				}),
			});
			continue;
		}

		unresolvedMerchants.set(transaction.normalizedDescription, {
			normalizedDescription: transaction.normalizedDescription,
			description: transaction.description,
			amount: transaction.amount,
		});
	}

	let aiResultsByDescription = new Map<string, AiCategorizationResult>();
	let aiFailure: unknown = null;
	if (unresolvedMerchants.size > 0) {
		try {
			const aiResults = await resolvedDependencies.aiCategorizer({
				categories,
				merchants: Array.from(unresolvedMerchants.values()),
				promptVersion: resolvedDependencies.aiPromptVersion,
			});
			aiResultsByDescription = new Map(
				aiResults.map((result) => [
					result.normalizedDescription,
					toExistingAiResult(result, existingCategoryIds) ?? result,
				]),
			);

			for (const merchant of unresolvedMerchants.values()) {
				const result = aiResultsByDescription.get(merchant.normalizedDescription) ?? {
					normalizedDescription: merchant.normalizedDescription,
					suggestedCategoryId: null,
					certainty: 0,
				};
				if (!result.suggestedCategoryId) {
					continue;
				}
				upsertMerchantCategoryCodexCache({
					normalizedDescription: merchant.normalizedDescription,
					sampleDescription: merchant.description,
					suggestedCategoryId: result.suggestedCategoryId,
					confidence: result.certainty / 100,
					reason: null,
					modelLabel: resolvedDependencies.aiModelLabel,
					promptVersion: resolvedDependencies.aiPromptVersion,
					categoriesHash,
				});
			}
		} catch (error) {
			console.warn('AI reprocessing failed; leaving transactions in review.', error);
			aiFailure = error;
		}
	}

	if (aiFailure) {
		throw persistenceError(
			aiFailure instanceof Error ? aiFailure.message : String(aiFailure),
			'AI_REPROCESS_FAILED',
		);
	}

	for (const transaction of reviewTransactions) {
		if (updates.has(transaction.id)) {
			continue;
		}

		updates.set(transaction.id, {
			transactionId: transaction.id,
			...applyAiOutcome({
				row: {
					bookingDate: transaction.bookingDate,
					description: transaction.description,
					normalizedDescription: transaction.normalizedDescription,
					amount: transaction.amount,
					currency: transaction.currency,
					importFingerprint: buildImportFingerprint({
						bookingDate: transaction.bookingDate,
						description: transaction.description,
						amount: transaction.amount,
						currency: transaction.currency,
					}),
				},
				result: aiResultsByDescription.get(transaction.normalizedDescription) ?? null,
				modelLabel: resolvedDependencies.aiModelLabel,
				certaintyThreshold: resolvedDependencies.aiAutoApplyThreshold,
				timestamp: resolvedDependencies.now(),
			}),
		});
	}

	const resultSummary: ReprocessSummaryMutable = {
		processed: reviewTransactions.length,
		categorizedByAi: 0,
		suggestedByAi: 0,
		categorizedByCodex: 0,
		suggestedByCodex: 0,
		needsReview: 0,
	};

	withDatabaseTransaction(() => {
		for (const update of updates.values()) {
			const updated = updateTransactionCategorization(update.transactionId, {
				categoryId: update.categoryId,
				categorizationStatus: update.categorizationStatus,
				categorizationSource: update.categorizationSource,
				suggestedCategoryId: update.suggestedCategoryId ?? null,
				suggestedConfidence: update.suggestedConfidence ?? null,
				suggestedReason: update.suggestedReason ?? null,
				suggestedByModel: update.suggestedByModel ?? null,
				suggestedAt: update.suggestedAt ?? null,
			});
			if (!updated) {
				continue;
			}

			if (updated.categorizationSource === 'codex_auto') {
				resultSummary.categorizedByAi += 1;
				resultSummary.categorizedByCodex += 1;
			} else if (updated.categorizationStatus === 'suggested') {
				resultSummary.suggestedByAi += 1;
				resultSummary.suggestedByCodex += 1;
			} else if (updated.categorizationStatus === 'needs_review') {
				resultSummary.needsReview += 1;
			}
		}
	});

	return resultSummary;
}

export function reprocessImportTransactions(
	input: ReprocessImportTransactionsInput,
): Promise<ReprocessImportTransactionsResult> {
	return reprocessImportTransactionsWithDependencies(input);
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

export const listImportTransactionsEffect = (query: ListReviewTransactionsQuery = {}) =>
	Effect.try({
		try: () => listImportTransactions(query),
		catch: () => persistenceError('Failed to load imported transactions'),
	});

export const uploadImportCsvEffect = (input: {
	sourceName: string;
	csvText: string;
	importedAt?: string;
}) =>
	Effect.tryPromise({
		try: () => importNordeaCsv(input),
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to import CSV'),
	});

export const reprocessImportTransactionsEffect = (input: ReprocessImportTransactionsInput) =>
	Effect.tryPromise({
		try: () => reprocessImportTransactions(input),
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to reprocess import transactions'),
	});

export async function suggestTransactionCategoryWithAiWithDependencies(
	transactionId: string,
	_input: SuggestTransactionCategoryWithAiInput,
	dependencies: Partial<ImportDependencies & LegacyImportDependencies> = {},
): Promise<SuggestTransactionCategoryWithAiResult> {
	const resolvedDependencies = resolveImportDependencies(dependencies);
	const transaction = getTransactionById(transactionId);
	if (!transaction) {
		throw notFoundError('Transaction was not found', 'TRANSACTION_NOT_FOUND');
	}

	const categories = listCategories();
	const prompt = buildSingleTransactionAiUserPayload({
		categories,
		description: transaction.description,
		amount: transaction.amount,
	});
	let suggestion: {
		suggestedCategoryId: string | null;
		certainty: number;
	};
	let rawResponse: string | null = null;
	let debugError: string | null = null;
	try {
		const debugResult =
			resolvedDependencies.singleTransactionAiCategorizer === suggestSingleTransactionCategoryWithAi
				? await suggestSingleTransactionCategoryWithAiDebug({
						categories,
						description: transaction.description,
						amount: transaction.amount,
					})
				: null;

		if (debugResult) {
			suggestion = {
				suggestedCategoryId: debugResult.suggestedCategoryId,
				certainty: debugResult.certainty,
			};
			rawResponse = debugResult.rawResponse;
		} else {
			suggestion = await resolvedDependencies.singleTransactionAiCategorizer({
				categories,
				description: transaction.description,
				amount: transaction.amount,
			});
		}
	} catch (error) {
		console.warn('AI single-transaction suggestion failed; leaving transaction in review.', error);
		suggestion = {
			suggestedCategoryId: null,
			certainty: 0,
		};
		debugError = error instanceof Error ? error.message : String(error);
	}

	const updated = updateTransactionCategorization(transactionId, {
		categoryId: null,
		categorizationStatus: suggestion.suggestedCategoryId ? 'suggested' : 'needs_review',
		categorizationSource: 'codex_suggested',
		suggestedCategoryId: suggestion.suggestedCategoryId,
		suggestedConfidence: suggestion.suggestedCategoryId ? suggestion.certainty / 100 : null,
		suggestedReason: null,
		suggestedByModel: resolvedDependencies.aiModelLabel,
		suggestedAt: resolvedDependencies.now(),
	});

	if (!updated) {
		throw notFoundError('Transaction was not found', 'TRANSACTION_NOT_FOUND');
	}

	return {
		transaction: updated,
		debug: {
			prompt,
			rawResponse,
			error: debugError,
		},
	};
}

export const suggestTransactionCategoryWithAiEffect = (
	transactionId: string,
	input: SuggestTransactionCategoryWithAiInput,
) =>
	Effect.tryPromise({
		try: () => suggestTransactionCategoryWithAiWithDependencies(transactionId, input),
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to get AI category suggestion'),
	});

export const suggestTransactionCategoryWithCodexEffect = suggestTransactionCategoryWithAiEffect;
export const suggestTransactionCategoryWithCodexWithDependencies =
	suggestTransactionCategoryWithAiWithDependencies;

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
				categorizationStatus: input.categoryId ? 'categorized' : 'needs_review',
				categorizationSource: 'manual',
			});
			if (!updated) {
				throw notFoundError('Transaction was not found', 'TRANSACTION_NOT_FOUND');
			}

			if (input.categoryId && input.saveRule !== false) {
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
