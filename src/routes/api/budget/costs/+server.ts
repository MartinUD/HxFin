import type { RequestHandler } from './$types';

import {
	createRecurringCost,
	getCategoryById,
	listRecurringCosts
} from '$lib/server/budget/repository';
import {
	parseCreateRecurringCostInput,
	parseListRecurringCostsQuery
} from '$lib/server/budget/validation';
import {
	ApiError,
	created,
	handleApiError,
	ok,
	readJsonBody
} from '$lib/server/http';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const query = parseListRecurringCostsQuery(url.searchParams);
		const costs = listRecurringCosts(query);

		return ok({ costs });
	} catch (error) {
		return handleApiError(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const payload = await readJsonBody(request);
		const input = parseCreateRecurringCostInput(payload);

		if (!getCategoryById(input.categoryId)) {
			throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category was not found');
		}

		const cost = createRecurringCost(input);
		return created({ cost });
	} catch (error) {
		return handleApiError(error);
	}
};
