import type { PageLoad } from './$types';

import { createBudgetApi } from '$lib/budget';
import { createImportsApi } from '$lib/imports/api';

export const load: PageLoad = async ({ fetch }) => {
	const budgetApi = createBudgetApi(fetch);
	const importsApi = createImportsApi(fetch);

	const [categories, batches, reviewTransactions] = await Promise.all([
		budgetApi.fetchCategories().catch(() => []),
		importsApi.fetchBatches({ limit: 30 }).catch(() => []),
		importsApi.fetchReviewTransactions({ limit: 300 }).catch(() => [])
	]);

	return {
		categories,
		batches,
		reviewTransactions
	};
};
