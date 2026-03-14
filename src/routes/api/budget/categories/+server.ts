import type { RequestHandler } from './$types';

import {
	createCategory,
	listCategories
} from '$lib/server/budget/repository';
import { parseCreateCategoryInput } from '$lib/server/budget/validation';
import {
	created,
	handleApiError,
	ok,
	readJsonBody
} from '$lib/server/http';

export const GET: RequestHandler = async () => {
	try {
		return ok({
			categories: listCategories()
		});
	} catch (error) {
		return handleApiError(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const payload = await readJsonBody(request);
		const input = parseCreateCategoryInput(payload);
		const category = createCategory(input);

		return created({ category });
	} catch (error) {
		return handleApiError(error);
	}
};
