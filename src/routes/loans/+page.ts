import type { PageLoad } from './$types';
import * as Effect from 'effect/Effect';

import { withApiClient } from '$lib/api/client';
import { runUiEffect } from '$lib/effect/runtime/browser';

export const load: PageLoad = async ({ fetch, url }) => {
	return runUiEffect(
		withApiClient(fetch, url.origin, (client) =>
			client.loans.listLoans({ urlParams: {} }).pipe(
				Effect.map((loans) => ({ loans })),
				Effect.catchAll(() => Effect.succeed({ loans: [] }))
			)
		),
		fetch
	);
};
