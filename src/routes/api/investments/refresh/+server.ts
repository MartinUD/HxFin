import type { RequestHandler } from './$types';

import { refreshTrackedInvestmentHoldings } from '$lib/server/investments/tracking';
import { handleApiError, ok } from '$lib/server/http';

export const POST: RequestHandler = async () => {
	try {
		const refreshed = await refreshTrackedInvestmentHoldings();
		return ok({ refreshed });
	} catch (error) {
		return handleApiError(error);
	}
};
