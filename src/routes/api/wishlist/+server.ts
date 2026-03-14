import type { RequestHandler } from './$types';

import { getLoanById } from '$lib/server/loans/repository';
import {
	createWishlistItem,
	getWishlistCategoryById,
	listWishlistItems
} from '$lib/server/wishlist/repository';
import {
	parseCreateWishlistItemInput,
	parseListWishlistItemsQuery
} from '$lib/server/wishlist/validation';
import {
	ApiError,
	created,
	handleApiError,
	ok,
	readJsonBody
} from '$lib/server/http';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const query = parseListWishlistItemsQuery(url.searchParams);
		const items = listWishlistItems(query);

		return ok({ items });
	} catch (error) {
		return handleApiError(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const payload = await readJsonBody(request);
		const input = parseCreateWishlistItemInput(payload);

		if (input.categoryId && !getWishlistCategoryById(input.categoryId)) {
			throw new ApiError(404, 'WISHLIST_CATEGORY_NOT_FOUND', 'Wishlist category was not found');
		}

		if (input.linkedLoanId && !getLoanById(input.linkedLoanId)) {
			throw new ApiError(404, 'LOAN_NOT_FOUND', 'Linked loan was not found');
		}

		const item = createWishlistItem(input);
		return created({ item });
	} catch (error) {
		return handleApiError(error);
	}
};
