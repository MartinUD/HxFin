import type { RequestHandler } from './$types';

import { getCategoryById } from '$lib/server/budget/repository';
import { ApiError, handleApiError, ok, readJsonBody } from '$lib/server/http';
import {
	getTransactionById,
	updateTransactionCategory,
	upsertMerchantCategoryRule
} from '$lib/server/imports/repository';
import { parseAssignTransactionCategoryInput } from '$lib/server/imports/validation';

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const existing = getTransactionById(params.transactionId);
		if (!existing) {
			throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'Transaction was not found');
		}

		const payload = await readJsonBody(request);
		const input = parseAssignTransactionCategoryInput(payload);

		if (input.categoryId && !getCategoryById(input.categoryId)) {
			throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category was not found');
		}

		const updated = updateTransactionCategory(params.transactionId, {
			categoryId: input.categoryId,
			matchMethod: input.categoryId ? 'manual' : 'needs_review'
		});
		if (!updated) {
			throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'Transaction was not found');
		}

		if (input.saveRule && input.categoryId) {
			upsertMerchantCategoryRule({
				normalizedDescription: updated.normalizedDescription,
				categoryId: input.categoryId,
				confidence: 1
			});
		}

		return ok({ transaction: updated });
	} catch (error) {
		return handleApiError(error);
	}
};
