import type { PageLoad } from './$types';
import { createBudgetApi } from '$lib/budget';

export const load: PageLoad = async ({ fetch }) => {
	const api = createBudgetApi(fetch);
	const [categories, costs, summary] = await Promise.all([
		api.fetchCategories(),
		api.fetchCosts({ includeInactive: true }),
		api.fetchSummary()
	]);

	return {
		categories,
		costs,
		summary
	};
};
