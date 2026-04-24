import * as HttpApiEndpoint from '@effect/platform/HttpApiEndpoint';
import * as HttpApiGroup from '@effect/platform/HttpApiGroup';

import { FinancialProfileSchema, UpdateFinancialProfileInputSchema } from '$lib/schema/finance';

// Paths match the Rust handler in
// `backend/src/routes/budget/income/profile.rs`. The SvelteKit proxy
// forwards every `/api/budget/*` request to Rust, so the TS stub handlers
// in `$lib/server/api.ts` are unreachable by design. Group name stays
// `finance` so existing call sites keep their typed method names
// (`client.finance.getFinancialProfile(...)`, etc.).
export const financeApiGroup = HttpApiGroup.make('finance')
	.add(
		HttpApiEndpoint.get('getFinancialProfile', '/budget/income').addSuccess(
			FinancialProfileSchema,
		),
	)
	.add(
		HttpApiEndpoint.put('updateFinancialProfile', '/budget/income')
			.setPayload(UpdateFinancialProfileInputSchema)
			.addSuccess(FinancialProfileSchema),
	);
