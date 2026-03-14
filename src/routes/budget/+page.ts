import type { PageLoad } from './$types';
import * as Effect from 'effect/Effect';

import { withApiClient } from '$lib/api/client';
import { runUiEffect } from '$lib/effect/runtime/browser';

export const load: PageLoad = async ({ fetch, url }) => {
	return runUiEffect(
		withApiClient(fetch, url.origin, (client) =>
			Effect.all({
				categories: client.budget.listBudgetCategories(),
				costs: client.budget.listRecurringCosts({ urlParams: { includeInactive: true } }),
				summary: client.budget.getBudgetSummary({ urlParams: {} })
			})
		),
		fetch
	);
};
