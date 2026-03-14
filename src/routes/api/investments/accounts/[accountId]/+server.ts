import type { RequestHandler } from './$types';

import {
	deleteInvestmentAccount,
	updateInvestmentAccount
} from '$lib/server/investments/repository';
import { parseUpdateInvestmentAccountInput } from '$lib/server/investments/validation';
import {
	ApiError,
	handleApiError,
	noContent,
	ok,
	readJsonBody
} from '$lib/server/http';

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const payload = await readJsonBody(request);
		const input = parseUpdateInvestmentAccountInput(payload);
		const account = updateInvestmentAccount(params.accountId, input);

		if (!account) {
			throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Investment account was not found');
		}

		return ok({ account });
	} catch (error) {
		return handleApiError(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const deleted = deleteInvestmentAccount(params.accountId);

		if (!deleted) {
			throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Investment account was not found');
		}

		return noContent();
	} catch (error) {
		return handleApiError(error);
	}
};
