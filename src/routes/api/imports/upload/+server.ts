import type { RequestHandler } from './$types';

import { ApiError, handleApiError, ok } from '$lib/server/http';
import { importNordeaCsv } from '$lib/server/imports/service';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File)) {
			throw new ApiError(400, 'VALIDATION_ERROR', 'A CSV file is required');
		}

		const text = await file.text();
		const result = importNordeaCsv({
			sourceName: file.name,
			csvText: text,
			importedAt: new Date().toISOString()
		});

		return ok(result);
	} catch (error) {
		return handleApiError(error);
	}
};
