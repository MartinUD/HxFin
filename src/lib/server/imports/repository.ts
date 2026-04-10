import { randomUUID } from 'node:crypto';

import { and, desc, eq, inArray, isNotNull, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import sqlite from '$lib/server/db';
import { orm } from '$lib/server/drizzle/client';
import {
	budgetCategories,
	importBatches,
	merchantCategoryCodexCache,
	merchantCategoryRules,
	transactions,
} from '$lib/server/drizzle/schema';
import type {
	ImportBatch,
	ImportBatchStatus,
	ImportedTransaction,
	ListImportBatchesQuery,
	ListReviewTransactionsQuery,
	MerchantCategoryRule,
	TransactionCategorizationSource,
	TransactionCategorizationStatus,
	TransactionMatchMethod,
} from '$lib/server/imports/types';
import { ensureSchema } from '$lib/server/schema';

type ImportBatchInsert = typeof importBatches.$inferInsert;

export interface MerchantCategoryCodexCacheEntry {
	id: string;
	normalizedDescription: string;
	sampleDescription: string;
	suggestedCategoryId: string | null;
	suggestedCategoryName: string | null;
	confidence: number;
	reason: string | null;
	modelLabel: string;
	promptVersion: string;
	categoriesHash: string;
	createdAt: string;
	updatedAt: string;
}

function ensureReady(): void {
	ensureSchema();
}

function nowIso(): string {
	return new Date().toISOString();
}

const suggestedBudgetCategories = alias(budgetCategories, 'suggested_budget_categories');

function mapImportedTransaction(row: {
	id: string;
	bookingDate: string;
	description: string;
	normalizedDescription: string;
	amount: number;
	currency: string;
	categoryId: string | null;
	categoryName: string | null;
	matchMethod: TransactionMatchMethod;
	categorizationStatus: TransactionCategorizationStatus;
	categorizationSource: TransactionCategorizationSource;
	suggestedCategoryId: string | null;
	suggestedCategoryName: string | null;
	suggestedConfidence: number | null;
	suggestedReason: string | null;
	suggestedByModel: string | null;
	suggestedAt: string | null;
	importBatchId: string;
	importBatchSourceName: string;
	createdAt: string;
	updatedAt: string;
}): ImportedTransaction {
	return row;
}

function mapMerchantCategoryRule(row: {
	id: string;
	normalizedDescription: string;
	categoryId: string;
	categoryName: string | null;
	confidence: number;
	createdAt: string;
	updatedAt: string;
}): MerchantCategoryRule {
	return row;
}

function mapMerchantCategoryCodexCacheEntry(row: {
	id: string;
	normalizedDescription: string;
	sampleDescription: string;
	suggestedCategoryId: string | null;
	suggestedCategoryName: string | null;
	confidence: number;
	reason: string | null;
	modelLabel: string;
	promptVersion: string;
	categoriesHash: string;
	createdAt: string;
	updatedAt: string;
}): MerchantCategoryCodexCacheEntry {
	return row;
}

function legacyMatchMethodForCategorization(input: {
	status: TransactionCategorizationStatus;
	source: TransactionCategorizationSource;
}): TransactionMatchMethod {
	switch (input.source) {
		case 'rule_exact':
			return 'rule_exact';
		case 'history_exact':
			return 'history_exact';
		case 'manual':
			return 'manual';
		default:
			return input.status === 'categorized' ? 'manual' : 'needs_review';
	}
}

function transactionSelectFields() {
	return {
		id: transactions.id,
		bookingDate: transactions.bookingDate,
		description: transactions.description,
		normalizedDescription: transactions.normalizedDescription,
		amount: transactions.amount,
		currency: transactions.currency,
		categoryId: transactions.categoryId,
		categoryName: budgetCategories.name,
		matchMethod: transactions.matchMethod,
		categorizationStatus: transactions.categorizationStatus,
		categorizationSource: transactions.categorizationSource,
		suggestedCategoryId: transactions.suggestedCategoryId,
		suggestedCategoryName: suggestedBudgetCategories.name,
		suggestedConfidence: transactions.suggestedConfidence,
		suggestedReason: transactions.suggestedReason,
		suggestedByModel: transactions.suggestedByModel,
		suggestedAt: transactions.suggestedAt,
		importBatchId: transactions.importBatchId,
		importBatchSourceName: importBatches.sourceName,
		createdAt: transactions.createdAt,
		updatedAt: transactions.updatedAt,
	};
}

export function createImportBatch(input: {
	sourceName: string;
	importedAt: string;
	rowCount: number;
	status: ImportBatchStatus;
}): ImportBatch {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	orm
		.insert(importBatches)
		.values({
			id,
			sourceName: input.sourceName,
			importedAt: input.importedAt,
			rowCount: input.rowCount,
			status: input.status,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
		.run();

	const batch = getImportBatchById(id);
	if (!batch) {
		throw new Error('Failed to read created import batch');
	}

	return batch;
}

export function getImportBatchById(batchId: string): ImportBatch | null {
	ensureReady();

	const row = orm.select().from(importBatches).where(eq(importBatches.id, batchId)).get();

	return row ?? null;
}

export function updateImportBatchStatus(
	batchId: string,
	status: ImportBatchStatus,
): ImportBatch | null {
	ensureReady();

	const updates: Partial<ImportBatchInsert> = {
		status,
		updatedAt: nowIso(),
	};

	orm.update(importBatches).set(updates).where(eq(importBatches.id, batchId)).run();

	return getImportBatchById(batchId);
}

export function listImportBatches(query: ListImportBatchesQuery = {}): ImportBatch[] {
	ensureReady();

	return orm
		.select()
		.from(importBatches)
		.orderBy(desc(importBatches.importedAt), desc(importBatches.createdAt))
		.limit(query.limit ?? 20)
		.all();
}

export function insertImportedTransaction(input: {
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
	importBatchId: string;
}): ImportedTransaction {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	orm
		.insert(transactions)
		.values({
			id,
			bookingDate: input.bookingDate,
			description: input.description,
			normalizedDescription: input.normalizedDescription,
			amount: input.amount,
			currency: input.currency,
			importFingerprint: input.importFingerprint,
			categoryId: input.categoryId,
			matchMethod: legacyMatchMethodForCategorization({
				status: input.categorizationStatus,
				source: input.categorizationSource,
			}),
			categorizationStatus: input.categorizationStatus,
			categorizationSource: input.categorizationSource,
			suggestedCategoryId: input.suggestedCategoryId ?? null,
			suggestedConfidence: input.suggestedConfidence ?? null,
			suggestedReason: input.suggestedReason ?? null,
			suggestedByModel: input.suggestedByModel ?? null,
			suggestedAt: input.suggestedAt ?? null,
			importBatchId: input.importBatchId,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
		.run();

	const inserted = getTransactionById(id);
	if (!inserted) {
		throw new Error('Failed to read created transaction');
	}

	return inserted;
}

export function getTransactionById(transactionId: string): ImportedTransaction | null {
	ensureReady();

	const row = orm
		.select(transactionSelectFields())
		.from(transactions)
		.innerJoin(importBatches, eq(importBatches.id, transactions.importBatchId))
		.leftJoin(budgetCategories, eq(budgetCategories.id, transactions.categoryId))
		.leftJoin(
			suggestedBudgetCategories,
			eq(suggestedBudgetCategories.id, transactions.suggestedCategoryId),
		)
		.where(eq(transactions.id, transactionId))
		.get();

	return row ? mapImportedTransaction(row) : null;
}

export function listReviewTransactions(
	query: ListReviewTransactionsQuery = {},
): ImportedTransaction[] {
	ensureReady();

	const conditions = [
		or(
			eq(transactions.categorizationStatus, 'suggested'),
			eq(transactions.categorizationStatus, 'needs_review'),
		),
	];

	if (query.batchId) {
		conditions.push(eq(transactions.importBatchId, query.batchId));
	}

	const rows = orm
		.select(transactionSelectFields())
		.from(transactions)
		.innerJoin(importBatches, eq(importBatches.id, transactions.importBatchId))
		.leftJoin(budgetCategories, eq(budgetCategories.id, transactions.categoryId))
		.leftJoin(
			suggestedBudgetCategories,
			eq(suggestedBudgetCategories.id, transactions.suggestedCategoryId),
		)
		.where(and(...conditions))
		.orderBy(desc(transactions.bookingDate), desc(transactions.createdAt))
		.limit(query.limit ?? 200)
		.all();

	return rows.map(mapImportedTransaction);
}

export function getTransactionByImportFingerprint(importFingerprint: string): ImportedTransaction | null {
	ensureReady();

	const row = orm
		.select(transactionSelectFields())
		.from(transactions)
		.innerJoin(importBatches, eq(importBatches.id, transactions.importBatchId))
		.leftJoin(budgetCategories, eq(budgetCategories.id, transactions.categoryId))
		.leftJoin(
			suggestedBudgetCategories,
			eq(suggestedBudgetCategories.id, transactions.suggestedCategoryId),
		)
		.where(eq(transactions.importFingerprint, importFingerprint))
		.get();

	return row ? mapImportedTransaction(row) : null;
}

export function listTransactionsByImportFingerprints(
	importFingerprints: string[],
): ImportedTransaction[] {
	ensureReady();

	if (importFingerprints.length === 0) {
		return [];
	}

	const rows = orm
		.select(transactionSelectFields())
		.from(transactions)
		.innerJoin(importBatches, eq(importBatches.id, transactions.importBatchId))
		.leftJoin(budgetCategories, eq(budgetCategories.id, transactions.categoryId))
		.leftJoin(
			suggestedBudgetCategories,
			eq(suggestedBudgetCategories.id, transactions.suggestedCategoryId),
		)
		.where(inArray(transactions.importFingerprint, importFingerprints))
		.all();

	return rows.map(mapImportedTransaction);
}

export function listImportTransactions(
	query: ListReviewTransactionsQuery = {},
): ImportedTransaction[] {
	ensureReady();

	const conditions = [];

	if (query.batchId) {
		conditions.push(eq(transactions.importBatchId, query.batchId));
	}

	const rows = orm
		.select(transactionSelectFields())
		.from(transactions)
		.innerJoin(importBatches, eq(importBatches.id, transactions.importBatchId))
		.leftJoin(budgetCategories, eq(budgetCategories.id, transactions.categoryId))
		.leftJoin(
			suggestedBudgetCategories,
			eq(suggestedBudgetCategories.id, transactions.suggestedCategoryId),
		)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(transactions.bookingDate), desc(transactions.createdAt))
		.limit(query.limit ?? 300)
		.all();

	return rows.map(mapImportedTransaction);
}

export function updateTransactionCategory(
	transactionId: string,
	input: {
		categoryId: string | null;
		categorizationStatus: TransactionCategorizationStatus;
		categorizationSource: TransactionCategorizationSource;
	},
): ImportedTransaction | null {
	ensureReady();

	orm
		.update(transactions)
		.set({
			categoryId: input.categoryId,
			matchMethod: legacyMatchMethodForCategorization({
				status: input.categorizationStatus,
				source: input.categorizationSource,
			}),
			categorizationStatus: input.categorizationStatus,
			categorizationSource: input.categorizationSource,
			suggestedCategoryId: null,
			suggestedConfidence: null,
			suggestedReason: null,
			suggestedByModel: null,
			suggestedAt: null,
			updatedAt: nowIso(),
		})
		.where(eq(transactions.id, transactionId))
		.run();

	return getTransactionById(transactionId);
}

export function updateTransactionCategorization(
	transactionId: string,
	input: {
		categoryId: string | null;
		categorizationStatus: TransactionCategorizationStatus;
		categorizationSource: TransactionCategorizationSource;
		suggestedCategoryId?: string | null;
		suggestedConfidence?: number | null;
		suggestedReason?: string | null;
		suggestedByModel?: string | null;
		suggestedAt?: string | null;
	},
): ImportedTransaction | null {
	ensureReady();

	orm
		.update(transactions)
		.set({
			categoryId: input.categoryId,
			matchMethod: legacyMatchMethodForCategorization({
				status: input.categorizationStatus,
				source: input.categorizationSource,
			}),
			categorizationStatus: input.categorizationStatus,
			categorizationSource: input.categorizationSource,
			suggestedCategoryId: input.suggestedCategoryId ?? null,
			suggestedConfidence: input.suggestedConfidence ?? null,
			suggestedReason: input.suggestedReason ?? null,
			suggestedByModel: input.suggestedByModel ?? null,
			suggestedAt: input.suggestedAt ?? null,
			updatedAt: nowIso(),
		})
		.where(eq(transactions.id, transactionId))
		.run();

	return getTransactionById(transactionId);
}

export function getMerchantCategoryRuleByNormalizedDescription(
	normalizedDescription: string,
): MerchantCategoryRule | null {
	ensureReady();

	const row = orm
		.select({
			id: merchantCategoryRules.id,
			normalizedDescription: merchantCategoryRules.normalizedDescription,
			categoryId: merchantCategoryRules.categoryId,
			categoryName: budgetCategories.name,
			confidence: merchantCategoryRules.confidence,
			createdAt: merchantCategoryRules.createdAt,
			updatedAt: merchantCategoryRules.updatedAt,
		})
		.from(merchantCategoryRules)
		.leftJoin(budgetCategories, eq(budgetCategories.id, merchantCategoryRules.categoryId))
		.where(eq(merchantCategoryRules.normalizedDescription, normalizedDescription))
		.get();

	return row ? mapMerchantCategoryRule(row) : null;
}

export function upsertMerchantCategoryRule(input: {
	normalizedDescription: string;
	categoryId: string;
	confidence?: number;
}): MerchantCategoryRule {
	ensureReady();

	const existing = getMerchantCategoryRuleByNormalizedDescription(input.normalizedDescription);
	const timestamp = nowIso();
	const confidence = input.confidence ?? 1;

	if (existing) {
		orm
			.update(merchantCategoryRules)
			.set({
				categoryId: input.categoryId,
				confidence,
				updatedAt: timestamp,
			})
			.where(eq(merchantCategoryRules.normalizedDescription, input.normalizedDescription))
			.run();
	} else {
		orm
			.insert(merchantCategoryRules)
			.values({
				id: randomUUID(),
				normalizedDescription: input.normalizedDescription,
				categoryId: input.categoryId,
				confidence,
				createdAt: timestamp,
				updatedAt: timestamp,
			})
			.run();
	}

	const rule = getMerchantCategoryRuleByNormalizedDescription(input.normalizedDescription);
	if (!rule) {
		throw new Error('Failed to read upserted merchant category rule');
	}

	return rule;
}

export function findMostRecentCategorizedTransactionByNormalizedDescription(
	normalizedDescription: string,
): ImportedTransaction | null {
	ensureReady();

	const row = orm
		.select(transactionSelectFields())
		.from(transactions)
		.innerJoin(importBatches, eq(importBatches.id, transactions.importBatchId))
		.leftJoin(budgetCategories, eq(budgetCategories.id, transactions.categoryId))
		.leftJoin(
			suggestedBudgetCategories,
			eq(suggestedBudgetCategories.id, transactions.suggestedCategoryId),
		)
		.where(
			and(
				eq(transactions.normalizedDescription, normalizedDescription),
				isNotNull(transactions.categoryId),
				eq(transactions.categorizationStatus, 'categorized'),
			),
		)
		.orderBy(desc(transactions.bookingDate), desc(transactions.createdAt))
		.limit(1)
		.get();

	return row ? mapImportedTransaction(row) : null;
}

export function getMerchantCategoryCodexCacheByLookup(input: {
	normalizedDescription: string;
	promptVersion: string;
	categoriesHash: string;
}): MerchantCategoryCodexCacheEntry | null {
	ensureReady();

	const row = orm
		.select({
			id: merchantCategoryCodexCache.id,
			normalizedDescription: merchantCategoryCodexCache.normalizedDescription,
			sampleDescription: merchantCategoryCodexCache.sampleDescription,
			suggestedCategoryId: merchantCategoryCodexCache.suggestedCategoryId,
			suggestedCategoryName: budgetCategories.name,
			confidence: merchantCategoryCodexCache.confidence,
			reason: merchantCategoryCodexCache.reason,
			modelLabel: merchantCategoryCodexCache.modelLabel,
			promptVersion: merchantCategoryCodexCache.promptVersion,
			categoriesHash: merchantCategoryCodexCache.categoriesHash,
			createdAt: merchantCategoryCodexCache.createdAt,
			updatedAt: merchantCategoryCodexCache.updatedAt,
		})
		.from(merchantCategoryCodexCache)
		.leftJoin(
			budgetCategories,
			eq(budgetCategories.id, merchantCategoryCodexCache.suggestedCategoryId),
		)
		.where(
			and(
				eq(merchantCategoryCodexCache.normalizedDescription, input.normalizedDescription),
				eq(merchantCategoryCodexCache.promptVersion, input.promptVersion),
				eq(merchantCategoryCodexCache.categoriesHash, input.categoriesHash),
			),
		)
		.get();

	return row ? mapMerchantCategoryCodexCacheEntry(row) : null;
}

export function upsertMerchantCategoryCodexCache(input: {
	normalizedDescription: string;
	sampleDescription: string;
	suggestedCategoryId: string | null;
	confidence: number;
	reason?: string | null;
	modelLabel: string;
	promptVersion: string;
	categoriesHash: string;
}): MerchantCategoryCodexCacheEntry {
	ensureReady();

	const existing = getMerchantCategoryCodexCacheByLookup({
		normalizedDescription: input.normalizedDescription,
		promptVersion: input.promptVersion,
		categoriesHash: input.categoriesHash,
	});
	const timestamp = nowIso();

	if (existing) {
		orm
			.update(merchantCategoryCodexCache)
			.set({
				sampleDescription: input.sampleDescription,
				suggestedCategoryId: input.suggestedCategoryId,
				confidence: input.confidence,
				reason: input.reason ?? null,
				modelLabel: input.modelLabel,
				updatedAt: timestamp,
			})
			.where(eq(merchantCategoryCodexCache.id, existing.id))
			.run();
	} else {
		orm
			.insert(merchantCategoryCodexCache)
			.values({
				id: randomUUID(),
				normalizedDescription: input.normalizedDescription,
				sampleDescription: input.sampleDescription,
				suggestedCategoryId: input.suggestedCategoryId,
				confidence: input.confidence,
				reason: input.reason ?? null,
				modelLabel: input.modelLabel,
				promptVersion: input.promptVersion,
				categoriesHash: input.categoriesHash,
				createdAt: timestamp,
				updatedAt: timestamp,
			})
			.run();
	}

	const entry = getMerchantCategoryCodexCacheByLookup({
		normalizedDescription: input.normalizedDescription,
		promptVersion: input.promptVersion,
		categoriesHash: input.categoriesHash,
	});
	if (!entry) {
		throw new Error('Failed to read upserted merchant category codex cache entry');
	}

	return entry;
}

export function listTransactionsByIds(transactionIds: string[]): ImportedTransaction[] {
	ensureReady();
	if (transactionIds.length === 0) {
		return [];
	}

	const rows = orm
		.select(transactionSelectFields())
		.from(transactions)
		.innerJoin(importBatches, eq(importBatches.id, transactions.importBatchId))
		.leftJoin(budgetCategories, eq(budgetCategories.id, transactions.categoryId))
		.leftJoin(
			suggestedBudgetCategories,
			eq(suggestedBudgetCategories.id, transactions.suggestedCategoryId),
		)
		.where(inArray(transactions.id, transactionIds))
		.all();

	return rows.map(mapImportedTransaction);
}

export function listTransactionsByImportBatchId(importBatchId: string): ImportedTransaction[] {
	ensureReady();

	const rows = orm
		.select(transactionSelectFields())
		.from(transactions)
		.innerJoin(importBatches, eq(importBatches.id, transactions.importBatchId))
		.leftJoin(budgetCategories, eq(budgetCategories.id, transactions.categoryId))
		.leftJoin(
			suggestedBudgetCategories,
			eq(suggestedBudgetCategories.id, transactions.suggestedCategoryId),
		)
		.where(eq(transactions.importBatchId, importBatchId))
		.orderBy(desc(transactions.bookingDate), desc(transactions.createdAt))
		.all();

	return rows.map(mapImportedTransaction);
}

export function withDatabaseTransaction<T>(action: () => T): T {
	ensureReady();
	const txn = sqlite.transaction(action);
	return txn();
}
