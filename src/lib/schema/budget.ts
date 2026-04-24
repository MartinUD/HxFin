import * as Schema from 'effect/Schema';

import {
	IsoDateTimeSchema,
	NullableIsoDateSchema,
	NullableStringSchema,
	PercentageSchema,
	PositiveAmountSchema,
} from '$lib/schema/common';

export const RecurrencePeriodSchema = Schema.Literal('weekly', 'monthly', 'yearly');
export type RecurrencePeriod = Schema.Schema.Type<typeof RecurrencePeriodSchema>;

export const RecurringCostKindSchema = Schema.Literal('expense', 'investment');
export type RecurringCostKind = Schema.Schema.Type<typeof RecurringCostKindSchema>;

export const BudgetCategorySchema = Schema.Struct({
	id: Schema.Number,
	name: Schema.String,
	description: NullableStringSchema,
	color: NullableStringSchema,
	createdAt: IsoDateTimeSchema,
	updatedAt: IsoDateTimeSchema,
});

export type BudgetCategory = Schema.Schema.Type<typeof BudgetCategorySchema>;

export const RecurringCostSchema = Schema.Struct({
	id: Schema.Number,
	categoryId: Schema.Number,
	name: Schema.String,
	amount: PositiveAmountSchema,
	period: RecurrencePeriodSchema,
	kind: RecurringCostKindSchema,
	isEssential: Schema.Boolean,
	startDate: NullableIsoDateSchema,
	endDate: NullableIsoDateSchema,
	createdAt: IsoDateTimeSchema,
	updatedAt: IsoDateTimeSchema,
});

export type RecurringCost = Schema.Schema.Type<typeof RecurringCostSchema>;

export const BudgetSummaryCategorySchema = Schema.Struct({
	categoryId: Schema.Number,
	categoryName: Schema.String,
	monthlyTotal: PositiveAmountSchema,
	yearlyTotal: PositiveAmountSchema,
});

export type BudgetSummaryCategory = Schema.Schema.Type<typeof BudgetSummaryCategorySchema>;

export const BudgetSummarySchema = Schema.Struct({
	totalMonthlyRecurring: PositiveAmountSchema,
	totalYearlyRecurring: PositiveAmountSchema,
	monthlyEssential: PositiveAmountSchema,
	monthlyNonEssential: PositiveAmountSchema,
	monthlyInvesting: PositiveAmountSchema,
	monthlyNetIncome: PositiveAmountSchema,
	monthlyUnallocated: Schema.Number,
	savingsRate: PercentageSchema,
	categories: Schema.Array(BudgetSummaryCategorySchema),
});

export type BudgetSummary = Schema.Schema.Type<typeof BudgetSummarySchema>;

export const CreateCategoryInputSchema = Schema.Struct({
	name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
	description: NullableStringSchema,
	color: NullableStringSchema,
});

export type CreateCategoryInput = Schema.Schema.Type<typeof CreateCategoryInputSchema>;

export const UpdateCategoryInputSchema = Schema.Struct({
	name: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100))),
	description: Schema.optional(NullableStringSchema),
	color: Schema.optional(NullableStringSchema),
});

export type UpdateCategoryInput = Schema.Schema.Type<typeof UpdateCategoryInputSchema>;

export const CreateRecurringCostInputSchema = Schema.Struct({
	categoryId: Schema.Number,
	name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
	amount: PositiveAmountSchema,
	period: RecurrencePeriodSchema,
	kind: Schema.optional(RecurringCostKindSchema),
	isEssential: Schema.optional(Schema.Boolean),
	startDate: Schema.optional(NullableIsoDateSchema),
	endDate: Schema.optional(NullableIsoDateSchema),
});

export type CreateRecurringCostInput = Schema.Schema.Type<typeof CreateRecurringCostInputSchema>;

export const UpdateRecurringCostInputSchema = Schema.Struct({
	categoryId: Schema.optional(Schema.Number),
	name: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100))),
	amount: Schema.optional(PositiveAmountSchema),
	period: Schema.optional(RecurrencePeriodSchema),
	kind: Schema.optional(RecurringCostKindSchema),
	isEssential: Schema.optional(Schema.Boolean),
	startDate: Schema.optional(NullableIsoDateSchema),
	endDate: Schema.optional(NullableIsoDateSchema),
});

export type UpdateRecurringCostInput = Schema.Schema.Type<typeof UpdateRecurringCostInputSchema>;

export const ListRecurringCostsQuerySchema = Schema.Struct({
	// Repeated query params decode to an array; single value also accepted.
	categoryIds: Schema.optional(Schema.Array(Schema.NumberFromString)),
});

export type ListRecurringCostsQuery = Schema.Schema.Type<typeof ListRecurringCostsQuerySchema>;

export const SummaryQuerySchema = Schema.Struct({});

export type SummaryQuery = Schema.Schema.Type<typeof SummaryQuerySchema>;
