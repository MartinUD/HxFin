import type { RequestHandler } from './$types';

import { deleteCategory, updateCategory } from '$lib/server/budget/repository';
import { parseUpdateCategoryInput } from '$lib/server/budget/validation';
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
		const input = parseUpdateCategoryInput(payload);
		const category = updateCategory(params.categoryId, input);

		if (!category) {
			throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category was not found');
		}

		return ok({ category });
	} catch (error) {
		return handleApiError(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const deleted = deleteCategory(params.categoryId);

		if (!deleted) {
			throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category was not found');
		}

		return noContent();
	} catch (error) {
		return handleApiError(error);
	}
};
