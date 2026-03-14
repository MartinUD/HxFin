import type { RequestHandler } from './$types';

import {
	createInvestmentHolding,
	getInvestmentAccountById,
	listInvestmentHoldings
} from '$lib/server/investments/repository';
import {
	parseCreateInvestmentHoldingInput,
	parseListInvestmentHoldingsQuery
} from '$lib/server/investments/validation';
import {
	ApiError,
	created,
	handleApiError,
	ok,
	readJsonBody
} from '$lib/server/http';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const query = parseListInvestmentHoldingsQuery(url.searchParams);
		const holdings = listInvestmentHoldings(query);

		return ok({ holdings });
	} catch (error) {
		return handleApiError(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const payload = await readJsonBody(request);
		const input = parseCreateInvestmentHoldingInput(payload);

		if (!getInvestmentAccountById(input.accountId)) {
			throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Investment account was not found');
		}

		const holding = createInvestmentHolding(input);
		return created({ holding });
	} catch (error) {
		return handleApiError(error);
	}
};
