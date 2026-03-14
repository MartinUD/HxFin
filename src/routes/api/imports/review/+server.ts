import type { RequestHandler } from './$types';

import { handleApiError, ok } from '$lib/server/http';
import { listReviewTransactions } from '$lib/server/imports/repository';
import { parseListReviewTransactionsQuery } from '$lib/server/imports/validation';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const query = parseListReviewTransactionsQuery(url.searchParams);
		const transactions = listReviewTransactions(query);

		return ok({ transactions });
	} catch (error) {
		return handleApiError(error);
	}
};
