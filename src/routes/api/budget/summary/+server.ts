import type { RequestHandler } from './$types';

import { buildBudgetSummary } from '$lib/server/budget/service';
import { parseSummaryQuery } from '$lib/server/budget/validation';
import { handleApiError, ok } from '$lib/server/http';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const query = parseSummaryQuery(url.searchParams);
		const summary = buildBudgetSummary(query);

		return ok({ summary });
	} catch (error) {
		return handleApiError(error);
	}
};
