import type { PageLoad } from './$types';
import * as Effect from 'effect/Effect';

import { withApiClient } from '$lib/api/client';
import { runUiEffect } from '$lib/effect/runtime/browser';

export const load: PageLoad = async ({ fetch, url }) => {
	return runUiEffect(
		withApiClient(fetch, url.origin, (client) =>
			Effect.all({
				items: client.wishlist
					.listWishlistItems({ urlParams: {} })
					.pipe(Effect.catchAll(() => Effect.succeed([]))),
				loans: client.loans
					.listLoans({ urlParams: {} })
					.pipe(Effect.catchAll(() => Effect.succeed([]))),
				categories: client.wishlist
					.listWishlistCategories()
					.pipe(Effect.catchAll(() => Effect.succeed([])))
			})
		),
		fetch
	);
};
