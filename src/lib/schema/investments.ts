import * as Schema from 'effect/Schema';

import {
	CurrencySchema,
	IsoDateSchema,
	IsoDateTimeSchema,
	NullableIsoDateSchema,
	NullableNumberSchema,
	NullableStringSchema,
	PercentageSchema,
	PositiveAmountSchema,
	SortOrderSchema,
} from '$lib/schema/common';

export const InvestmentTrackerSourceSchema = Schema.Literal('manual', 'nordea', 'avanza');
export type InvestmentTrackerSource = Schema.Schema.Type<typeof InvestmentTrackerSourceSchema>;

export const InvestmentAccountSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	institution: NullableStringSchema,
	currency: CurrencySchema,
	totalValue: PositiveAmountSchema,
	createdAt: IsoDateTimeSchema,
	updatedAt: IsoDateTimeSchema,
});

export type InvestmentAccount = Schema.Schema.Type<typeof InvestmentAccountSchema>;

export const InvestmentHoldingSchema = Schema.Struct({
	id: Schema.String,
	accountId: Schema.String,
	name: Schema.String,
	allocationPercent: PercentageSchema,
	currentValue: PositiveAmountSchema,
	units: NullableNumberSchema,
	latestUnitPrice: NullableNumberSchema,
	trackerSource: InvestmentTrackerSourceSchema,
	trackerUrl: NullableStringSchema,
	latestPriceDate: NullableIsoDateSchema,
	lastSyncedAt: NullableStringSchema,
	changeAmountSinceLastSnapshot: NullableNumberSchema,
	changePercentSinceLastSnapshot: NullableNumberSchema,
	sortOrder: SortOrderSchema,
	createdAt: IsoDateTimeSchema,
	updatedAt: IsoDateTimeSchema,
});

export type InvestmentHolding = Schema.Schema.Type<typeof InvestmentHoldingSchema>;

export const CreateInvestmentAccountInputSchema = Schema.Struct({
	name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(120)),
	institution: NullableStringSchema,
	currency: Schema.optional(CurrencySchema),
	totalValue: PositiveAmountSchema,
});

export type CreateInvestmentAccountInput = Schema.Schema.Type<
	typeof CreateInvestmentAccountInputSchema
>;

export const UpdateInvestmentAccountInputSchema = Schema.Struct({
	name: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(120))),
	institution: Schema.optional(NullableStringSchema),
	currency: Schema.optional(CurrencySchema),
	totalValue: Schema.optional(PositiveAmountSchema),
});

export type UpdateInvestmentAccountInput = Schema.Schema.Type<
	typeof UpdateInvestmentAccountInputSchema
>;

export const CreateInvestmentHoldingInputSchema = Schema.Struct({
	accountId: Schema.String.pipe(Schema.minLength(1)),
	name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(120)),
	allocationPercent: PercentageSchema,
	currentValue: PositiveAmountSchema,
	units: Schema.optional(NullableNumberSchema),
	latestUnitPrice: Schema.optional(NullableNumberSchema),
	trackerSource: Schema.optional(InvestmentTrackerSourceSchema),
	trackerUrl: Schema.optional(NullableStringSchema),
	sortOrder: Schema.optional(SortOrderSchema),
});

export type CreateInvestmentHoldingInput = Schema.Schema.Type<
	typeof CreateInvestmentHoldingInputSchema
>;

export const UpdateInvestmentHoldingInputSchema = Schema.Struct({
	accountId: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
	name: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(120))),
	allocationPercent: Schema.optional(PercentageSchema),
	currentValue: Schema.optional(PositiveAmountSchema),
	units: Schema.optional(NullableNumberSchema),
	latestUnitPrice: Schema.optional(NullableNumberSchema),
	trackerSource: Schema.optional(InvestmentTrackerSourceSchema),
	trackerUrl: Schema.optional(NullableStringSchema),
	latestPriceDate: Schema.optional(NullableIsoDateSchema),
	lastSyncedAt: Schema.optional(NullableStringSchema),
	sortOrder: Schema.optional(SortOrderSchema),
});

export type UpdateInvestmentHoldingInput = Schema.Schema.Type<
	typeof UpdateInvestmentHoldingInputSchema
>;

export const ListInvestmentHoldingsQuerySchema = Schema.Struct({
	accountId: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
});

export type ListInvestmentHoldingsQuery = Schema.Schema.Type<
	typeof ListInvestmentHoldingsQuerySchema
>;

export const InvestmentRefreshOutcomeSchema = Schema.Struct({
	holdingId: Schema.String,
	name: Schema.String,
	status: Schema.Literal('refreshed', 'skipped', 'failed'),
	message: NullableStringSchema,
	currentValue: Schema.optional(PositiveAmountSchema),
	unitPrice: Schema.optional(PositiveAmountSchema),
	priceDate: Schema.optional(IsoDateSchema),
});

export type InvestmentRefreshOutcome = Schema.Schema.Type<typeof InvestmentRefreshOutcomeSchema>;

export const InvestmentRefreshReportSchema = Schema.Struct({
	holdings: Schema.Array(InvestmentHoldingSchema),
	outcomes: Schema.Array(InvestmentRefreshOutcomeSchema),
});

export type InvestmentRefreshReport = Schema.Schema.Type<typeof InvestmentRefreshReportSchema>;
