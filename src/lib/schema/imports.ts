import * as Schema from 'effect/Schema';

import { IsoDateSchema, IsoDateTimeSchema, NullableStringSchema } from '$lib/schema/common';

export const TransactionMatchMethodSchema = Schema.Literal(
	'rule_exact',
	'history_exact',
	'manual',
	'needs_review',
);
export type TransactionMatchMethod = Schema.Schema.Type<typeof TransactionMatchMethodSchema>;

export const ImportBatchStatusSchema = Schema.Literal('processing', 'completed', 'failed');
export type ImportBatchStatus = Schema.Schema.Type<typeof ImportBatchStatusSchema>;

export const ImportBatchSchema = Schema.Struct({
	id: Schema.String,
	sourceName: Schema.String,
	importedAt: IsoDateTimeSchema,
	rowCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
	status: ImportBatchStatusSchema,
	createdAt: IsoDateTimeSchema,
	updatedAt: IsoDateTimeSchema,
});

export type ImportBatch = Schema.Schema.Type<typeof ImportBatchSchema>;

export const ImportedTransactionSchema = Schema.Struct({
	id: Schema.String,
	bookingDate: IsoDateSchema,
	description: Schema.String,
	normalizedDescription: Schema.String,
	amount: Schema.Number,
	currency: Schema.String,
	categoryId: NullableStringSchema,
	categoryName: NullableStringSchema,
	matchMethod: TransactionMatchMethodSchema,
	importBatchId: Schema.String,
	importBatchSourceName: Schema.String,
	createdAt: IsoDateTimeSchema,
	updatedAt: IsoDateTimeSchema,
});

export type ImportedTransaction = Schema.Schema.Type<typeof ImportedTransactionSchema>;

export const MerchantCategoryRuleSchema = Schema.Struct({
	id: Schema.String,
	normalizedDescription: Schema.String,
	categoryId: Schema.String,
	categoryName: NullableStringSchema,
	confidence: Schema.Number,
	createdAt: IsoDateTimeSchema,
	updatedAt: IsoDateTimeSchema,
});

export type MerchantCategoryRule = Schema.Schema.Type<typeof MerchantCategoryRuleSchema>;

export const UploadCsvResultSchema = Schema.Struct({
	batch: ImportBatchSchema,
	summary: Schema.Struct({
		inserted: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
		categorizedByRule: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
		categorizedByHistory: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
		needsReview: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
	}),
});

export type UploadCsvResult = Schema.Schema.Type<typeof UploadCsvResultSchema>;

export const ImportCsvInputSchema = Schema.Struct({
	sourceName: Schema.String.pipe(Schema.minLength(1)),
	csvText: Schema.String.pipe(Schema.minLength(1)),
	importedAt: Schema.optional(IsoDateTimeSchema),
});

export type ImportCsvInput = Schema.Schema.Type<typeof ImportCsvInputSchema>;

export const ListImportBatchesQuerySchema = Schema.Struct({
	limit: Schema.optional(
		Schema.NumberFromString.pipe(
			Schema.int(),
			Schema.greaterThanOrEqualTo(1),
			Schema.lessThanOrEqualTo(200),
		),
	),
});

export type ListImportBatchesQuery = Schema.Schema.Type<typeof ListImportBatchesQuerySchema>;

export const ListReviewTransactionsQuerySchema = Schema.Struct({
	batchId: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
	limit: Schema.optional(
		Schema.NumberFromString.pipe(
			Schema.int(),
			Schema.greaterThanOrEqualTo(1),
			Schema.lessThanOrEqualTo(500),
		),
	),
});

export type ListReviewTransactionsQuery = Schema.Schema.Type<
	typeof ListReviewTransactionsQuerySchema
>;

export const AssignTransactionCategoryInputSchema = Schema.Struct({
	categoryId: NullableStringSchema,
	saveRule: Schema.optional(Schema.Boolean),
});

export type AssignTransactionCategoryInput = Schema.Schema.Type<
	typeof AssignTransactionCategoryInputSchema
>;
