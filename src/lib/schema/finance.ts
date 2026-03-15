import * as Schema from 'effect/Schema';

import {
	CurrencySchema,
	IsoDateTimeSchema,
	PercentageSchema,
	PositiveAmountSchema,
} from '$lib/schema/common';

export const FinancialProfileSchema = Schema.Struct({
	id: Schema.String,
	monthlySalary: PositiveAmountSchema,
	salaryGrowth: PercentageSchema,
	municipalTaxRate: PercentageSchema,
	savingsShareOfRaise: PercentageSchema,
	currency: CurrencySchema,
	createdAt: IsoDateTimeSchema,
	updatedAt: IsoDateTimeSchema,
});

export type FinancialProfile = Schema.Schema.Type<typeof FinancialProfileSchema>;

export const UpdateFinancialProfileInputSchema = Schema.Struct({
	monthlySalary: Schema.optional(PositiveAmountSchema),
	salaryGrowth: Schema.optional(PercentageSchema),
	municipalTaxRate: Schema.optional(PercentageSchema),
	savingsShareOfRaise: Schema.optional(PercentageSchema),
	currency: Schema.optional(CurrencySchema),
});

export type UpdateFinancialProfileInput = Schema.Schema.Type<
	typeof UpdateFinancialProfileInputSchema
>;

export const DEFAULT_FINANCIAL_PROFILE_INPUT = {
	monthlySalary: 40000,
	salaryGrowth: 6,
	municipalTaxRate: 32.41,
	savingsShareOfRaise: 50,
	currency: 'SEK',
} as const;
