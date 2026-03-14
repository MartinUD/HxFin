import type { RequestHandler } from './$types';

import {
	deleteWishlistCategory,
	updateWishlistCategory
} from '$lib/server/wishlist/repository';
import { parseUpdateWishlistCategoryInput } from '$lib/server/wishlist/validation';
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
		const input = parseUpdateWishlistCategoryInput(payload);
		const category = updateWishlistCategory(params.categoryId, input);

		if (!category) {
			throw new ApiError(404, 'WISHLIST_CATEGORY_NOT_FOUND', 'Wishlist category was not found');
		}

		return ok({ category });
	} catch (error) {
		return handleApiError(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const deleted = deleteWishlistCategory(params.categoryId);
		if (!deleted) {
			throw new ApiError(404, 'WISHLIST_CATEGORY_NOT_FOUND', 'Wishlist category was not found');
		}

		return noContent();
	} catch (error) {
		return handleApiError(error);
	}
};
