import * as Schema from 'effect/Schema';

export const IsoDateSchema = Schema.String.pipe(
	Schema.pattern(/^\d{4}-\d{2}-\d{2}$/, {
		message: () => 'Date must be in YYYY-MM-DD format'
	})
);

export const IsoDateTimeSchema = Schema.String.pipe(Schema.minLength(1));

export const NullableStringSchema = Schema.NullOr(Schema.String);

export const NullableIsoDateSchema = Schema.NullOr(IsoDateSchema);

export const CurrencySchema = Schema.String.pipe(Schema.minLength(3), Schema.maxLength(3));

export const NonEmptyTrimmedStringSchema = Schema.String.pipe(
	Schema.minLength(1),
	Schema.maxLength(1000)
);

export const NullableNumberSchema = Schema.NullOr(Schema.Number);

export const PositiveAmountSchema = Schema.Number.pipe(
	Schema.greaterThanOrEqualTo(0),
	Schema.lessThanOrEqualTo(1_000_000_000)
);

export const PercentageSchema = Schema.Number.pipe(
	Schema.greaterThanOrEqualTo(0),
	Schema.lessThanOrEqualTo(100)
);

export const SortOrderSchema = Schema.Number.pipe(
	Schema.int(),
	Schema.greaterThanOrEqualTo(0),
	Schema.lessThanOrEqualTo(10_000)
);
