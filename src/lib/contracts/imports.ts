export type TransactionMatchMethod = 'rule_exact' | 'history_exact' | 'manual' | 'needs_review';
export type ImportBatchStatus = 'processing' | 'completed' | 'failed';

export interface ImportBatch {
	id: string;
	sourceName: string;
	importedAt: string;
	rowCount: number;
	status: ImportBatchStatus;
	createdAt: string;
	updatedAt: string;
}

export interface ImportedTransaction {
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
}

export interface MerchantCategoryRule {
	id: string;
	normalizedDescription: string;
	categoryId: string;
	categoryName: string | null;
	confidence: number;
	createdAt: string;
	updatedAt: string;
}

export interface UploadCsvResult {
	batch: ImportBatch;
	summary: {
		inserted: number;
		categorizedByRule: number;
		categorizedByHistory: number;
		needsReview: number;
	};
}

export interface ListImportBatchesQuery {
	limit?: number;
}

export interface ListReviewTransactionsQuery {
	batchId?: string;
	limit?: number;
}

export interface AssignTransactionCategoryInput {
	categoryId: string | null;
	saveRule: boolean;
}
