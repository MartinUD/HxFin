import * as HttpApiEndpoint from '@effect/platform/HttpApiEndpoint';
import * as HttpApiGroup from '@effect/platform/HttpApiGroup';

import { FinancialProfileSchema, UpdateFinancialProfileInputSchema } from '$lib/schema/finance';

export const financeApiGroup = HttpApiGroup.make('finance')
	.add(
		HttpApiEndpoint.get('getFinancialProfile', '/finance/profile').addSuccess(
			FinancialProfileSchema,
		),
	)
	.add(
		HttpApiEndpoint.put('updateFinancialProfile', '/finance/profile')
			.setPayload(UpdateFinancialProfileInputSchema)
			.addSuccess(FinancialProfileSchema),
	);
