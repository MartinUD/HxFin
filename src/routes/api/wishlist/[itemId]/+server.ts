import type { RequestHandler } from './$types';

import { ApiError, handleApiError, noContent, ok, readJsonBody } from '$lib/server/http';
import { getLoanById } from '$lib/server/loans/repository';
import {
	deleteWishlistItem,
	getWishlistCategoryById,
	getWishlistItemById,
	updateWishlistItem
} from '$lib/server/wishlist/repository';
import { parseUpdateWishlistItemInput } from '$lib/server/wishlist/validation';

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const existingItem = getWishlistItemById(params.itemId);
		if (!existingItem) {
			throw new ApiError(404, 'WISHLIST_ITEM_NOT_FOUND', 'Wishlist item was not found');
		}

		const payload = await readJsonBody(request);
		const input = parseUpdateWishlistItemInput(payload);

		const effectiveFundingStrategy = input.fundingStrategy ?? existingItem.fundingStrategy;
		const effectiveLinkedLoanId =
			input.linkedLoanId !== undefined ? input.linkedLoanId : existingItem.linkedLoanId;
		const effectiveCategoryId =
			input.categoryId !== undefined ? input.categoryId : existingItem.categoryId;

		if ((effectiveFundingStrategy === 'save' || effectiveFundingStrategy === 'buy_outright') && effectiveLinkedLoanId !== null) {
			throw new ApiError(
				400,
				'VALIDATION_ERROR',
				'linkedLoanId must be null when fundingStrategy does not use a loan'
			);
		}

		if (effectiveCategoryId && !getWishlistCategoryById(effectiveCategoryId)) {
			throw new ApiError(404, 'WISHLIST_CATEGORY_NOT_FOUND', 'Wishlist category was not found');
		}

		if (effectiveLinkedLoanId && !getLoanById(effectiveLinkedLoanId)) {
			throw new ApiError(404, 'LOAN_NOT_FOUND', 'Linked loan was not found');
		}

		const item = updateWishlistItem(params.itemId, input);
		if (!item) {
			throw new ApiError(404, 'WISHLIST_ITEM_NOT_FOUND', 'Wishlist item was not found');
		}

		return ok({ item });
	} catch (error) {
		return handleApiError(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const deleted = deleteWishlistItem(params.itemId);
		if (!deleted) {
			throw new ApiError(404, 'WISHLIST_ITEM_NOT_FOUND', 'Wishlist item was not found');
		}

		return noContent();
	} catch (error) {
		return handleApiError(error);
	}
};
