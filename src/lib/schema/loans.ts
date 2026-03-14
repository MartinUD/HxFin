import * as Schema from 'effect/Schema';

import {
	CurrencySchema,
	IsoDateSchema,
	IsoDateTimeSchema,
	NullableIsoDateSchema,
	NullableStringSchema,
	PositiveAmountSchema
} from '$lib/schema/common';

export const LoanDirectionSchema = Schema.Literal('lent', 'borrowed');
export type LoanDirection = Schema.Schema.Type<typeof LoanDirectionSchema>;

export const LoanStatusSchema = Schema.Literal('open', 'paid', 'overdue');
export type LoanStatus = Schema.Schema.Type<typeof LoanStatusSchema>;

export const LoanSchema = Schema.Struct({
	id: Schema.String,
	direction: LoanDirectionSchema,
	counterparty: Schema.String,
	principalAmount: PositiveAmountSchema,
	outstandingAmount: PositiveAmountSchema,
	currency: CurrencySchema,
	issueDate: IsoDateSchema,
	dueDate: NullableIsoDateSchema,
	status: LoanStatusSchema,
	notes: NullableStringSchema,
	createdAt: IsoDateTimeSchema,
	updatedAt: IsoDateTimeSchema
});

export type Loan = Schema.Schema.Type<typeof LoanSchema>;

export const CreateLoanInputSchema = Schema.Struct({
	direction: LoanDirectionSchema,
	counterparty: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(160)),
	principalAmount: PositiveAmountSchema,
	outstandingAmount: Schema.optional(PositiveAmountSchema),
	currency: Schema.optional(CurrencySchema),
	issueDate: IsoDateSchema,
	dueDate: Schema.optional(NullableIsoDateSchema),
	status: Schema.optional(LoanStatusSchema),
	notes: Schema.optional(NullableStringSchema)
});

export type CreateLoanInput = Schema.Schema.Type<typeof CreateLoanInputSchema>;

export const UpdateLoanInputSchema = Schema.Struct({
	direction: Schema.optional(LoanDirectionSchema),
	counterparty: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(160))),
	principalAmount: Schema.optional(PositiveAmountSchema),
	outstandingAmount: Schema.optional(PositiveAmountSchema),
	currency: Schema.optional(CurrencySchema),
	issueDate: Schema.optional(IsoDateSchema),
	dueDate: Schema.optional(NullableIsoDateSchema),
	status: Schema.optional(LoanStatusSchema),
	notes: Schema.optional(NullableStringSchema)
});

export type UpdateLoanInput = Schema.Schema.Type<typeof UpdateLoanInputSchema>;

export const ListLoansQuerySchema = Schema.Struct({
	direction: Schema.optional(LoanDirectionSchema),
	status: Schema.optional(LoanStatusSchema)
});

export type ListLoansQuery = Schema.Schema.Type<typeof ListLoansQuerySchema>;
