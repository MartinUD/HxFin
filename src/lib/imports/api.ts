import { requestJson, type ApiFetcher } from '$lib/api/http';
import type {
	AssignTransactionCategoryInput,
	ImportBatch,
	ImportedTransaction,
	UploadCsvResult
} from '$lib/contracts/imports';

export type { ImportBatch, ImportedTransaction, UploadCsvResult };

export interface ImportsApiClient {
	fetchBatches(query?: { limit?: number }): Promise<ImportBatch[]>;
	fetchReviewTransactions(query?: { batchId?: string; limit?: number }): Promise<ImportedTransaction[]>;
	uploadCsv(file: File): Promise<UploadCsvResult>;
	assignTransactionCategory(
		transactionId: string,
		input: AssignTransactionCategoryInput
	): Promise<ImportedTransaction>;
}

export function createImportsApi(fetcher: ApiFetcher): ImportsApiClient {
	return {
		async fetchBatches(query): Promise<ImportBatch[]> {
			const params = new URLSearchParams();
			if (query?.limit !== undefined) {
				params.set('limit', String(query.limit));
			}
			const qs = params.toString();
			const data = await requestJson<{ batches: ImportBatch[] }>(
				fetcher,
				`/api/imports/batches${qs ? `?${qs}` : ''}`
			);
			return data.batches;
		},
		async fetchReviewTransactions(query): Promise<ImportedTransaction[]> {
			const params = new URLSearchParams();
			if (query?.batchId) {
				params.set('batchId', query.batchId);
			}
			if (query?.limit !== undefined) {
				params.set('limit', String(query.limit));
			}
			const qs = params.toString();
			const data = await requestJson<{ transactions: ImportedTransaction[] }>(
				fetcher,
				`/api/imports/review${qs ? `?${qs}` : ''}`
			);
			return data.transactions;
		},
		async uploadCsv(file: File): Promise<UploadCsvResult> {
			const formData = new FormData();
			formData.append('file', file);
			return requestJson<UploadCsvResult>(fetcher, '/api/imports/upload', {
				method: 'POST',
				body: formData
			});
		},
		async assignTransactionCategory(
			transactionId: string,
			input: AssignTransactionCategoryInput
		): Promise<ImportedTransaction> {
			const data = await requestJson<{ transaction: ImportedTransaction }>(
				fetcher,
				`/api/imports/transactions/${transactionId}/category`,
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(input)
				}
			);
			return data.transaction;
		}
	};
}

const defaultClient = createImportsApi((input, init) => fetch(input, init));

export const fetchImportBatches = (query?: { limit?: number }) => defaultClient.fetchBatches(query);
export const fetchReviewTransactions = (query?: { batchId?: string; limit?: number }) =>
	defaultClient.fetchReviewTransactions(query);
export const uploadImportCsv = (file: File) => defaultClient.uploadCsv(file);
export const assignImportTransactionCategory = (
	transactionId: string,
	input: AssignTransactionCategoryInput
) => defaultClient.assignTransactionCategory(transactionId, input);
