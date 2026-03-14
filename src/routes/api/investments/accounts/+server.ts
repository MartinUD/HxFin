import type { RequestHandler } from './$types';

import {
	createInvestmentAccount,
	listInvestmentAccounts
} from '$lib/server/investments/repository';
import { parseCreateInvestmentAccountInput } from '$lib/server/investments/validation';
import {
	created,
	handleApiError,
	ok,
	readJsonBody
} from '$lib/server/http';

export const GET: RequestHandler = async () => {
	try {
		return ok({
			accounts: listInvestmentAccounts()
		});
	} catch (error) {
		return handleApiError(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const payload = await readJsonBody(request);
		const input = parseCreateInvestmentAccountInput(payload);
		const account = createInvestmentAccount(input);

		return created({ account });
	} catch (error) {
		return handleApiError(error);
	}
};
