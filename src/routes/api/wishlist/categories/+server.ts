import type { RequestHandler } from './$types';

import {
	createWishlistCategory,
	listWishlistCategories
} from '$lib/server/wishlist/repository';
import { parseCreateWishlistCategoryInput } from '$lib/server/wishlist/validation';
import {
	created,
	handleApiError,
	ok,
	readJsonBody
} from '$lib/server/http';

export const GET: RequestHandler = async () => {
	try {
		return ok({
			categories: listWishlistCategories()
		});
	} catch (error) {
		return handleApiError(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const payload = await readJsonBody(request);
		const input = parseCreateWishlistCategoryInput(payload);
		const category = createWishlistCategory(input);

		return created({ category });
	} catch (error) {
		return handleApiError(error);
	}
};
