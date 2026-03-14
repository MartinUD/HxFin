import type { RequestHandler } from './$types';

import { createLoan, listLoans } from '$lib/server/loans/repository';
import { parseCreateLoanInput, parseListLoansQuery } from '$lib/server/loans/validation';
import { created, handleApiError, ok, readJsonBody } from '$lib/server/http';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const query = parseListLoansQuery(url.searchParams);
		const loans = listLoans(query);

		return ok({ loans });
	} catch (error) {
		return handleApiError(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const payload = await readJsonBody(request);
		const input = parseCreateLoanInput(payload);
		const loan = createLoan(input);

		return created({ loan });
	} catch (error) {
		return handleApiError(error);
	}
};
