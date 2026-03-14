import * as HttpApiEndpoint from '@effect/platform/HttpApiEndpoint';
import * as HttpApiGroup from '@effect/platform/HttpApiGroup';
import * as HttpApiSchema from '@effect/platform/HttpApiSchema';
import * as Schema from 'effect/Schema';

import {
	CreateInvestmentAccountInputSchema,
	CreateInvestmentHoldingInputSchema,
	InvestmentAccountSchema,
	InvestmentHoldingSchema,
	InvestmentRefreshReportSchema,
	ListInvestmentHoldingsQuerySchema,
	UpdateInvestmentAccountInputSchema,
	UpdateInvestmentHoldingInputSchema
} from '$lib/schema/investments';

export const investmentsApiGroup = HttpApiGroup.make('investments')
	.add(HttpApiEndpoint.get('listInvestmentAccounts', '/investments/accounts').addSuccess(Schema.Array(InvestmentAccountSchema)))
	.add(
		HttpApiEndpoint.post('createInvestmentAccount', '/investments/accounts')
			.setPayload(CreateInvestmentAccountInputSchema)
			.addSuccess(InvestmentAccountSchema, { status: 201 })
	)
	.add(
		HttpApiEndpoint.patch('updateInvestmentAccount')`/investments/accounts/${HttpApiSchema.param('accountId', Schema.String)}`
			.setPayload(UpdateInvestmentAccountInputSchema)
			.addSuccess(InvestmentAccountSchema)
	)
	.add(
		HttpApiEndpoint.del('deleteInvestmentAccount')`/investments/accounts/${HttpApiSchema.param('accountId', Schema.String)}`
			.addSuccess(HttpApiSchema.NoContent)
	)
	.add(
		HttpApiEndpoint.get('listInvestmentHoldings', '/investments/holdings')
			.setUrlParams(ListInvestmentHoldingsQuerySchema)
			.addSuccess(Schema.Array(InvestmentHoldingSchema))
	)
	.add(
		HttpApiEndpoint.post('createInvestmentHolding', '/investments/holdings')
			.setPayload(CreateInvestmentHoldingInputSchema)
			.addSuccess(InvestmentHoldingSchema, { status: 201 })
	)
	.add(
		HttpApiEndpoint.patch('updateInvestmentHolding')`/investments/holdings/${HttpApiSchema.param('holdingId', Schema.String)}`
			.setPayload(UpdateInvestmentHoldingInputSchema)
			.addSuccess(InvestmentHoldingSchema)
	)
	.add(
		HttpApiEndpoint.del('deleteInvestmentHolding')`/investments/holdings/${HttpApiSchema.param('holdingId', Schema.String)}`
			.addSuccess(HttpApiSchema.NoContent)
	)
	.add(HttpApiEndpoint.post('refreshTrackedInvestmentHoldings', '/investments/refresh').addSuccess(InvestmentRefreshReportSchema));
