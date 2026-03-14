import type { RequestHandler } from './$types';

import { handleApiError, ok } from '$lib/server/http';
import { listImportBatches } from '$lib/server/imports/repository';
import { parseListImportBatchesQuery } from '$lib/server/imports/validation';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const query = parseListImportBatchesQuery(url.searchParams);
		const batches = listImportBatches(query);

		return ok({ batches });
	} catch (error) {
		return handleApiError(error);
	}
};
