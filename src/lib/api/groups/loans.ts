import * as HttpApiEndpoint from '@effect/platform/HttpApiEndpoint';
import * as HttpApiGroup from '@effect/platform/HttpApiGroup';
import * as HttpApiSchema from '@effect/platform/HttpApiSchema';
import * as Schema from 'effect/Schema';

import {
	CreateLoanInputSchema,
	ListLoansQuerySchema,
	LoanSchema,
	UpdateLoanInputSchema,
} from '$lib/schema/loans';

export const loansApiGroup = HttpApiGroup.make('loans')
	.add(
		HttpApiEndpoint.get('listLoans', '/loans')
			.setUrlParams(ListLoansQuerySchema)
			.addSuccess(Schema.Array(LoanSchema)),
	)
	.add(
		HttpApiEndpoint.post('createLoan', '/loans')
			.setPayload(CreateLoanInputSchema)
			.addSuccess(LoanSchema, { status: 201 }),
	)
	.add(
		HttpApiEndpoint.patch('updateLoan')`/loans/${HttpApiSchema.param('loanId', Schema.NumberFromString)}`
			.setPayload(UpdateLoanInputSchema)
			.addSuccess(LoanSchema),
	)
	.add(
		HttpApiEndpoint.del(
			'deleteLoan',
		)`/loans/${HttpApiSchema.param('loanId', Schema.NumberFromString)}`.addSuccess(HttpApiSchema.NoContent),
	);
