import type { RequestHandler } from './$types';

import {
	deleteInvestmentHolding,
	getInvestmentAccountById,
	updateInvestmentHolding
} from '$lib/server/investments/repository';
import { parseUpdateInvestmentHoldingInput } from '$lib/server/investments/validation';
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
		const input = parseUpdateInvestmentHoldingInput(payload);

		if (input.accountId && !getInvestmentAccountById(input.accountId)) {
			throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Investment account was not found');
		}

		const holding = updateInvestmentHolding(params.holdingId, input);
		if (!holding) {
			throw new ApiError(404, 'HOLDING_NOT_FOUND', 'Investment holding was not found');
		}

		return ok({ holding });
	} catch (error) {
		return handleApiError(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const deleted = deleteInvestmentHolding(params.holdingId);

		if (!deleted) {
			throw new ApiError(404, 'HOLDING_NOT_FOUND', 'Investment holding was not found');
		}

		return noContent();
	} catch (error) {
		return handleApiError(error);
	}
};
