import { randomUUID } from 'node:crypto';

import db, { type SqlParams } from '$lib/server/db';
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

interface ImportBatchRow {
	id: string;
	source_name: string;
	imported_at: string;
	row_count: number;
	status: ImportBatchStatus;
	created_at: string;
	updated_at: string;
}

interface ImportedTransactionRow {
	id: string;
	booking_date: string;
	description: string;
	normalized_description: string;
	amount: number;
	currency: string;
	category_id: string | null;
	category_name: string | null;
	match_method: TransactionMatchMethod;
	import_batch_id: string;
	import_batch_source_name: string;
	created_at: string;
	updated_at: string;
}

interface MerchantCategoryRuleRow {
	id: string;
	normalized_description: string;
	category_id: string;
	category_name: string | null;
	confidence: number;
	created_at: string;
	updated_at: string;
}

function ensureReady(): void {
	ensureSchema();
}

function nowIso(): string {
	return new Date().toISOString();
}

function mapImportBatch(row: ImportBatchRow): ImportBatch {
	return {
		id: row.id,
		sourceName: row.source_name,
		importedAt: row.imported_at,
		rowCount: row.row_count,
		status: row.status,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function mapImportedTransaction(row: ImportedTransactionRow): ImportedTransaction {
	return {
		id: row.id,
		bookingDate: row.booking_date,
		description: row.description,
		normalizedDescription: row.normalized_description,
		amount: row.amount,
		currency: row.currency,
		categoryId: row.category_id,
		categoryName: row.category_name,
		matchMethod: row.match_method,
		importBatchId: row.import_batch_id,
		importBatchSourceName: row.import_batch_source_name,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function mapMerchantCategoryRule(row: MerchantCategoryRuleRow): MerchantCategoryRule {
	return {
		id: row.id,
		normalizedDescription: row.normalized_description,
		categoryId: row.category_id,
		categoryName: row.category_name,
		confidence: row.confidence,
		createdAt: row.created_at,
		updatedAt: row.updated_at
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

	db.prepare(
		`INSERT INTO import_batches (
			id,
			source_name,
			imported_at,
			row_count,
			status,
			created_at,
			updated_at
		) VALUES (
			@id,
			@sourceName,
			@importedAt,
			@rowCount,
			@status,
			@createdAt,
			@updatedAt
		)`
	).run({
		id,
		sourceName: input.sourceName,
		importedAt: input.importedAt,
		rowCount: input.rowCount,
		status: input.status,
		createdAt: timestamp,
		updatedAt: timestamp
	});

	const batch = getImportBatchById(id);
	if (!batch) {
		throw new Error('Failed to read created import batch');
	}

	return batch;
}

export function getImportBatchById(batchId: string): ImportBatch | null {
	ensureReady();

	const row = db
		.prepare(
			`SELECT id, source_name, imported_at, row_count, status, created_at, updated_at
			 FROM import_batches
			 WHERE id = ?`
		)
		.get(batchId) as ImportBatchRow | undefined;

	return row ? mapImportBatch(row) : null;
}

export function updateImportBatchStatus(
	batchId: string,
	status: ImportBatchStatus
): ImportBatch | null {
	ensureReady();

	db.prepare(
		`UPDATE import_batches
		 SET status = ?, updated_at = ?
		 WHERE id = ?`
	).run(status, nowIso(), batchId);

	return getImportBatchById(batchId);
}

export function listImportBatches(query: ListImportBatchesQuery = {}): ImportBatch[] {
	ensureReady();

	const limit = query.limit ?? 20;
	const rows = db
		.prepare(
			`SELECT id, source_name, imported_at, row_count, status, created_at, updated_at
			 FROM import_batches
			 ORDER BY imported_at DESC, created_at DESC
			 LIMIT ?`
		)
		.all(limit) as ImportBatchRow[];

	return rows.map(mapImportBatch);
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

	db.prepare(
		`INSERT INTO transactions (
			id,
			booking_date,
			description,
			normalized_description,
			amount,
			currency,
			category_id,
			match_method,
			import_batch_id,
			created_at,
			updated_at
		) VALUES (
			@id,
			@bookingDate,
			@description,
			@normalizedDescription,
			@amount,
			@currency,
			@categoryId,
			@matchMethod,
			@importBatchId,
			@createdAt,
			@updatedAt
		)`
	).run({
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
	});

	const inserted = getTransactionById(id);
	if (!inserted) {
		throw new Error('Failed to read created transaction');
	}

	return inserted;
}

export function getTransactionById(transactionId: string): ImportedTransaction | null {
	ensureReady();

	const row = db
		.prepare(
			`SELECT
				t.id,
				t.booking_date,
				t.description,
				t.normalized_description,
				t.amount,
				t.currency,
				t.category_id,
				c.name AS category_name,
				t.match_method,
				t.import_batch_id,
				b.source_name AS import_batch_source_name,
				t.created_at,
				t.updated_at
			FROM transactions t
			JOIN import_batches b ON b.id = t.import_batch_id
			LEFT JOIN budget_categories c ON c.id = t.category_id
			WHERE t.id = ?`
		)
		.get(transactionId) as ImportedTransactionRow | undefined;

	return row ? mapImportedTransaction(row) : null;
}

export function listReviewTransactions(
	query: ListReviewTransactionsQuery = {}
): ImportedTransaction[] {
	ensureReady();

	const whereClauses = [`t.match_method = 'needs_review'`];
	const params: SqlParams = {
		limit: query.limit ?? 200
	};

	if (query.batchId) {
		whereClauses.push('t.import_batch_id = @batchId');
		params.batchId = query.batchId;
	}

	const rows = db
		.prepare(
			`SELECT
				t.id,
				t.booking_date,
				t.description,
				t.normalized_description,
				t.amount,
				t.currency,
				t.category_id,
				c.name AS category_name,
				t.match_method,
				t.import_batch_id,
				b.source_name AS import_batch_source_name,
				t.created_at,
				t.updated_at
			FROM transactions t
			JOIN import_batches b ON b.id = t.import_batch_id
			LEFT JOIN budget_categories c ON c.id = t.category_id
			WHERE ${whereClauses.join(' AND ')}
			ORDER BY t.booking_date DESC, t.created_at DESC
			LIMIT @limit`
		)
		.all(params) as ImportedTransactionRow[];

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

	db.prepare(
		`UPDATE transactions
		 SET category_id = @categoryId, match_method = @matchMethod, updated_at = @updatedAt
		 WHERE id = @id`
	).run({
		id: transactionId,
		categoryId: input.categoryId,
		matchMethod: input.matchMethod,
		updatedAt: nowIso()
	});

	return getTransactionById(transactionId);
}

export function getMerchantCategoryRuleByNormalizedDescription(
	normalizedDescription: string
): MerchantCategoryRule | null {
	ensureReady();

	const row = db
		.prepare(
			`SELECT
				r.id,
				r.normalized_description,
				r.category_id,
				c.name AS category_name,
				r.confidence,
				r.created_at,
				r.updated_at
			FROM merchant_category_rules r
			LEFT JOIN budget_categories c ON c.id = r.category_id
			WHERE r.normalized_description = ?`
		)
		.get(normalizedDescription) as MerchantCategoryRuleRow | undefined;

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
		db.prepare(
			`UPDATE merchant_category_rules
			 SET category_id = @categoryId, confidence = @confidence, updated_at = @updatedAt
			 WHERE normalized_description = @normalizedDescription`
		).run({
			normalizedDescription: input.normalizedDescription,
			categoryId: input.categoryId,
			confidence,
			updatedAt: timestamp
		});
	} else {
		db.prepare(
			`INSERT INTO merchant_category_rules (
				id,
				normalized_description,
				category_id,
				confidence,
				created_at,
				updated_at
			) VALUES (
				@id,
				@normalizedDescription,
				@categoryId,
				@confidence,
				@createdAt,
				@updatedAt
			)`
		).run({
			id: randomUUID(),
			normalizedDescription: input.normalizedDescription,
			categoryId: input.categoryId,
			confidence,
			createdAt: timestamp,
			updatedAt: timestamp
		});
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

	const row = db
		.prepare(
			`SELECT
				t.id,
				t.booking_date,
				t.description,
				t.normalized_description,
				t.amount,
				t.currency,
				t.category_id,
				c.name AS category_name,
				t.match_method,
				t.import_batch_id,
				b.source_name AS import_batch_source_name,
				t.created_at,
				t.updated_at
			FROM transactions t
			JOIN import_batches b ON b.id = t.import_batch_id
			LEFT JOIN budget_categories c ON c.id = t.category_id
			WHERE t.normalized_description = ?
			  AND t.category_id IS NOT NULL
			ORDER BY t.booking_date DESC, t.created_at DESC
			LIMIT 1`
		)
		.get(normalizedDescription) as ImportedTransactionRow | undefined;

	return row ? mapImportedTransaction(row) : null;
}

export function withDatabaseTransaction<T>(action: () => T): T {
	ensureReady();
	const txn = db.transaction(action);
	return txn();
}
