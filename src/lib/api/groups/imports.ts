import * as HttpApiEndpoint from '@effect/platform/HttpApiEndpoint';
import * as HttpApiGroup from '@effect/platform/HttpApiGroup';
import * as HttpApiSchema from '@effect/platform/HttpApiSchema';
import * as Schema from 'effect/Schema';

import {
	AssignTransactionCategoryInputSchema,
	ImportBatchSchema,
	ImportCsvInputSchema,
	ImportedTransactionSchema,
	ListImportBatchesQuerySchema,
	ListReviewTransactionsQuerySchema,
	ReprocessImportTransactionsInputSchema,
	ReprocessImportTransactionsResultSchema,
	SuggestTransactionCategoryWithAiInputSchema,
	SuggestTransactionCategoryWithAiResultSchema,
	UploadCsvResultSchema,
} from '$lib/schema/imports';

export const importsApiGroup = HttpApiGroup.make('imports')
	.add(
		HttpApiEndpoint.get('listImportBatches', '/imports/batches')
			.setUrlParams(ListImportBatchesQuerySchema)
			.addSuccess(Schema.Array(ImportBatchSchema)),
	)
	.add(
		HttpApiEndpoint.get('listImportTransactions', '/imports/transactions')
			.setUrlParams(ListReviewTransactionsQuerySchema)
			.addSuccess(Schema.Array(ImportedTransactionSchema)),
	)
	.add(
		HttpApiEndpoint.get('listReviewTransactions', '/imports/review')
			.setUrlParams(ListReviewTransactionsQuerySchema)
			.addSuccess(Schema.Array(ImportedTransactionSchema)),
	)
	.add(
		HttpApiEndpoint.post('uploadImportCsv', '/imports/upload')
			.setPayload(ImportCsvInputSchema)
			.addSuccess(UploadCsvResultSchema),
	)
	.add(
		HttpApiEndpoint.post('reprocessImportTransactions', '/imports/reprocess')
			.setPayload(ReprocessImportTransactionsInputSchema)
			.addSuccess(ReprocessImportTransactionsResultSchema),
	)
	.add(
		HttpApiEndpoint.patch(
			'assignImportTransactionCategory',
		)`/imports/transactions/${HttpApiSchema.param('transactionId', Schema.String)}/category`
			.setPayload(AssignTransactionCategoryInputSchema)
			.addSuccess(ImportedTransactionSchema),
	)
	.add(
		HttpApiEndpoint.post(
			'suggestImportTransactionCategoryWithAi',
		)`/imports/transactions/${HttpApiSchema.param('transactionId', Schema.String)}/ai-suggest`
			.setPayload(SuggestTransactionCategoryWithAiInputSchema)
			.addSuccess(SuggestTransactionCategoryWithAiResultSchema),
	);
