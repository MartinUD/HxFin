import type { PageLoad } from './$types';
import * as Effect from 'effect/Effect';

import { withApiClient } from '$lib/api/client';
import { runUiEffect } from '$lib/effect/runtime/browser';
import { DEFAULT_FINANCIAL_PROFILE_INPUT } from '$lib/schema/finance';

export const load: PageLoad = async ({ fetch, url }) => {
	return runUiEffect(
		withApiClient(fetch, url.origin, (client) =>
			Effect.all({
				profile: client.finance.getFinancialProfile().pipe(
					Effect.catchAll(() =>
						Effect.succeed({
							id: 'default',
							monthlySalary: DEFAULT_FINANCIAL_PROFILE_INPUT.monthlySalary,
							salaryGrowth: DEFAULT_FINANCIAL_PROFILE_INPUT.salaryGrowth,
							municipalTaxRate: DEFAULT_FINANCIAL_PROFILE_INPUT.municipalTaxRate,
							savingsShareOfRaise: DEFAULT_FINANCIAL_PROFILE_INPUT.savingsShareOfRaise,
							currency: DEFAULT_FINANCIAL_PROFILE_INPUT.currency,
							createdAt: '',
							updatedAt: ''
						})
					)
				),
				accounts: client.investments
					.listInvestmentAccounts()
					.pipe(Effect.catchAll(() => Effect.succeed([]))),
				holdings: client.investments
					.listInvestmentHoldings({ urlParams: {} })
					.pipe(Effect.catchAll(() => Effect.succeed([])))
			})
		),
		fetch
	);
};
