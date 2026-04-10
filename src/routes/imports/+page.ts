import * as Effect from 'effect/Effect';
import { withApiClient } from '$lib/api/client';
import { runUiEffect } from '$lib/effect/runtime/browser';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	return runUiEffect(
		withApiClient(fetch, url.origin, (client) =>
			Effect.all({
				categories: client.budget
					.listBudgetCategories()
					.pipe(Effect.catchAll(() => Effect.succeed([]))),
				batches: client.imports
					.listImportBatches({ urlParams: { limit: 30 } })
					.pipe(Effect.catchAll(() => Effect.succeed([]))),
				reviewTransactions: client.imports
					.listImportTransactions({ urlParams: { limit: 300 } })
					.pipe(Effect.catchAll(() => Effect.succeed([]))),
			}),
		),
		fetch,
	);
};
