import * as Schema from 'effect/Schema';

import {
	IsoDateTimeSchema,
	NullableIsoDateSchema,
	NullableStringSchema,
	PositiveAmountSchema,
} from '$lib/schema/common';

export const WishlistFundingStrategySchema = Schema.Literal(
	'save',
	'loan',
	'mixed',
	'buy_outright',
);
export type WishlistFundingStrategy = Schema.Schema.Type<typeof WishlistFundingStrategySchema>;

export const WishlistTargetAmountTypeSchema = Schema.Literal('exact', 'estimate');
export type WishlistTargetAmountType = Schema.Schema.Type<typeof WishlistTargetAmountTypeSchema>;

export const WishlistCategorySchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	description: NullableStringSchema,
	createdAt: Schema.String,
	updatedAt: Schema.String,
});

export type WishlistCategory = Schema.Schema.Type<typeof WishlistCategorySchema>;

export const WishlistItemSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	targetAmount: PositiveAmountSchema,
	targetDate: NullableIsoDateSchema,
	targetAmountType: WishlistTargetAmountTypeSchema,
	priority: Schema.Number.pipe(
		Schema.int(),
		Schema.greaterThanOrEqualTo(0),
		Schema.lessThanOrEqualTo(10),
	),
	categoryId: NullableStringSchema,
	fundingStrategy: WishlistFundingStrategySchema,
	linkedLoanId: NullableStringSchema,
	notes: NullableStringSchema,
	createdAt: IsoDateTimeSchema,
	updatedAt: IsoDateTimeSchema,
});

export type WishlistItem = Schema.Schema.Type<typeof WishlistItemSchema>;

export const CreateWishlistCategoryInputSchema = Schema.Struct({
	name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(80)),
	description: NullableStringSchema,
});

export type CreateWishlistCategoryInput = Schema.Schema.Type<
	typeof CreateWishlistCategoryInputSchema
>;

export const UpdateWishlistCategoryInputSchema = Schema.Struct({
	name: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(80))),
	description: Schema.optional(NullableStringSchema),
});

export type UpdateWishlistCategoryInput = Schema.Schema.Type<
	typeof UpdateWishlistCategoryInputSchema
>;

export const CreateWishlistItemInputSchema = Schema.Struct({
	name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(160)),
	targetAmount: PositiveAmountSchema,
	targetDate: Schema.optional(NullableIsoDateSchema),
	targetAmountType: Schema.optional(WishlistTargetAmountTypeSchema),
	priority: Schema.optional(
		Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(10)),
	),
	categoryId: Schema.optional(NullableStringSchema),
	fundingStrategy: Schema.optional(WishlistFundingStrategySchema),
	linkedLoanId: Schema.optional(NullableStringSchema),
	notes: Schema.optional(NullableStringSchema),
});

export type CreateWishlistItemInput = Schema.Schema.Type<typeof CreateWishlistItemInputSchema>;

export const UpdateWishlistItemInputSchema = Schema.Struct({
	name: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(160))),
	targetAmount: Schema.optional(PositiveAmountSchema),
	targetDate: Schema.optional(NullableIsoDateSchema),
	targetAmountType: Schema.optional(WishlistTargetAmountTypeSchema),
	priority: Schema.optional(
		Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(10)),
	),
	categoryId: Schema.optional(NullableStringSchema),
	fundingStrategy: Schema.optional(WishlistFundingStrategySchema),
	linkedLoanId: Schema.optional(NullableStringSchema),
	notes: Schema.optional(NullableStringSchema),
});

export type UpdateWishlistItemInput = Schema.Schema.Type<typeof UpdateWishlistItemInputSchema>;

export const ListWishlistItemsQuerySchema = Schema.Struct({
	fundingStrategy: Schema.optional(WishlistFundingStrategySchema),
});

export type ListWishlistItemsQuery = Schema.Schema.Type<typeof ListWishlistItemsQuerySchema>;
