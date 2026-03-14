import type { PageLoad } from './$types';

import { createLoansApi } from '$lib/loans/api';
import { createWishlistApi } from '$lib/wishlist/api';

export const load: PageLoad = async ({ fetch }) => {
	const wishlistApi = createWishlistApi(fetch);
	const loansApi = createLoansApi(fetch);

	const [items, loans, categories] = await Promise.all([
		wishlistApi.fetchItems().catch(() => []),
		loansApi.fetchLoans().catch(() => []),
		wishlistApi.fetchCategories().catch(() => [])
	]);

	return {
		items,
		loans,
		categories
	};
};
