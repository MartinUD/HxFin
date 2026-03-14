import { randomUUID } from 'node:crypto';

import { and, desc, eq, isNotNull } from 'drizzle-orm';

import sqlite from '$lib/server/db';
import { orm } from '$lib/server/drizzle/client';
import {
	budgetCategories,
	importBatches,
	merchantCategoryRules,
	transactions
} from '$lib/server/drizzle/schema';
import { ensureSchema } from '$lib/server/schema';
import type {
	ImportBatch,
	ImportBatchStatus,
	ImportedTransaction,
	ListImportBatchesQuery,
	ListReviewTransactionsQuery,
	MerchantCategoryRule,
	TransactionMatchMethod
} from '$lib/server/imports/types';

type ImportBatchInsert = typeof importBatches.$inferInsert;

function ensureReady(): void {
	ensureSchema();
}

function nowIso(): string {
	return new Date().toISOString();
}

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
			updatedAt: timestamp
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

	const row = orm
		.select()
		.from(importBatches)
		.where(eq(importBatches.id, batchId))
		.get();

	return row ?? null;
}

export function updateImportBatchStatus(
	batchId: string,
	status: ImportBatchStatus
): ImportBatch | null {
	ensureReady();

	const updates: Partial<ImportBatchInsert> = {
		status,
		updatedAt: nowIso()
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
	categoryId: string | null;
	matchMethod: TransactionMatchMethod;
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
			categoryId: input.categoryId,
			matchMethod: input.matchMethod,
			importBatchId: input.importBatchId,
			createdAt: timestamp,
			updatedAt: timestamp
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
		.select({
			id: transactions.id,
			bookingDate: transactions.bookingDate,
			description: transactions.description,
			normalizedDescription: transactions.normalizedDescription,
			amount: transactions.amount,
			currency: transactions.currency,
			categoryId: transactions.categoryId,
			categoryName: budgetCategories.name,
			matchMethod: transactions.matchMethod,
			importBatchId: transactions.importBatchId,
			importBatchSourceName: importBatches.sourceName,
			createdAt: transactions.createdAt,
			updatedAt: transactions.updatedAt
		})
		.from(transactions)
		.innerJoin(importBatches, eq(importBatches.id, transactions.importBatchId))
		.leftJoin(budgetCategories, eq(budgetCategories.id, transactions.categoryId))
		.where(eq(transactions.id, transactionId))
		.get();

	return row ? mapImportedTransaction(row) : null;
}

export function listReviewTransactions(
	query: ListReviewTransactionsQuery = {}
): ImportedTransaction[] {
	ensureReady();

	const conditions = [eq(transactions.matchMethod, 'needs_review')];

	if (query.batchId) {
		conditions.push(eq(transactions.importBatchId, query.batchId));
	}

	const rows = orm
		.select({
			id: transactions.id,
			bookingDate: transactions.bookingDate,
			description: transactions.description,
			normalizedDescription: transactions.normalizedDescription,
			amount: transactions.amount,
			currency: transactions.currency,
			categoryId: transactions.categoryId,
			categoryName: budgetCategories.name,
			matchMethod: transactions.matchMethod,
			importBatchId: transactions.importBatchId,
			importBatchSourceName: importBatches.sourceName,
			createdAt: transactions.createdAt,
			updatedAt: transactions.updatedAt
		})
		.from(transactions)
		.innerJoin(importBatches, eq(importBatches.id, transactions.importBatchId))
		.leftJoin(budgetCategories, eq(budgetCategories.id, transactions.categoryId))
		.where(and(...conditions))
		.orderBy(desc(transactions.bookingDate), desc(transactions.createdAt))
		.limit(query.limit ?? 200)
		.all();

	return rows.map(mapImportedTransaction);
}

export function updateTransactionCategory(
	transactionId: string,
	input: {
		categoryId: string | null;
		matchMethod: TransactionMatchMethod;
	}
): ImportedTransaction | null {
	ensureReady();

	orm
		.update(transactions)
		.set({
			categoryId: input.categoryId,
			matchMethod: input.matchMethod,
			updatedAt: nowIso()
		})
		.where(eq(transactions.id, transactionId))
		.run();

	return getTransactionById(transactionId);
}

export function getMerchantCategoryRuleByNormalizedDescription(
	normalizedDescription: string
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
			updatedAt: merchantCategoryRules.updatedAt
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
				updatedAt: timestamp
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
				updatedAt: timestamp
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
	normalizedDescription: string
): ImportedTransaction | null {
	ensureReady();

	const row = orm
		.select({
			id: transactions.id,
			bookingDate: transactions.bookingDate,
			description: transactions.description,
			normalizedDescription: transactions.normalizedDescription,
			amount: transactions.amount,
			currency: transactions.currency,
			categoryId: transactions.categoryId,
			categoryName: budgetCategories.name,
			matchMethod: transactions.matchMethod,
			importBatchId: transactions.importBatchId,
			importBatchSourceName: importBatches.sourceName,
			createdAt: transactions.createdAt,
			updatedAt: transactions.updatedAt
		})
		.from(transactions)
		.innerJoin(importBatches, eq(importBatches.id, transactions.importBatchId))
		.leftJoin(budgetCategories, eq(budgetCategories.id, transactions.categoryId))
		.where(
			and(
				eq(transactions.normalizedDescription, normalizedDescription),
				isNotNull(transactions.categoryId)
			)
		)
		.orderBy(desc(transactions.bookingDate), desc(transactions.createdAt))
		.limit(1)
		.get();

	return row ? mapImportedTransaction(row) : null;
}

export function withDatabaseTransaction<T>(action: () => T): T {
	ensureReady();
	const txn = sqlite.transaction(action);
	return txn();
}
