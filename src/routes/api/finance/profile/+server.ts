import type { RequestHandler } from './$types';

import {
	getFinancialProfile,
	updateFinancialProfile
} from '$lib/server/finance/repository';
import { parseUpdateFinancialProfileInput } from '$lib/server/finance/validation';
import {
	handleApiError,
	ok,
	readJsonBody
} from '$lib/server/http';

export const GET: RequestHandler = async () => {
	try {
		return ok({
			profile: getFinancialProfile()
		});
	} catch (error) {
		return handleApiError(error);
	}
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const payload = await readJsonBody(request);
		const input = parseUpdateFinancialProfileInput(payload);
		const profile = updateFinancialProfile(input);

		return ok({ profile });
	} catch (error) {
		return handleApiError(error);
	}
};
