import type { PageLoad } from './$types';

import { createLoansApi } from '$lib/loans/api';

export const load: PageLoad = async ({ fetch }) => {
	const api = createLoansApi(fetch);
	const loans = await api.fetchLoans().catch(() => []);

	return { loans };
};
