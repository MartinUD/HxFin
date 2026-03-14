import type { RequestHandler } from './$types';

import {
	deleteRecurringCost,
	getCategoryById,
	getRecurringCostById,
	updateRecurringCost
} from '$lib/server/budget/repository';
import { parseUpdateRecurringCostInput } from '$lib/server/budget/validation';
import {
	ApiError,
	handleApiError,
	noContent,
	ok,
	readJsonBody
} from '$lib/server/http';

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const existingCost = getRecurringCostById(params.costId);
		if (!existingCost) {
			throw new ApiError(404, 'COST_NOT_FOUND', 'Recurring cost was not found');
		}

		const payload = await readJsonBody(request);
		const input = parseUpdateRecurringCostInput(payload);
		const effectiveStartDate =
			input.startDate !== undefined ? input.startDate : existingCost.startDate;
		const effectiveEndDate = input.endDate !== undefined ? input.endDate : existingCost.endDate;

		if (effectiveStartDate && effectiveEndDate && effectiveEndDate < effectiveStartDate) {
			throw new ApiError(
				400,
				'VALIDATION_ERROR',
				'endDate must be greater than or equal to startDate'
			);
		}

		if (input.categoryId && !getCategoryById(input.categoryId)) {
			throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category was not found');
		}

		const updated = updateRecurringCost(params.costId, input);
		if (!updated) {
			throw new ApiError(404, 'COST_NOT_FOUND', 'Recurring cost was not found');
		}

		return ok({ cost: updated });
	} catch (error) {
		return handleApiError(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const deleted = deleteRecurringCost(params.costId);
		if (!deleted) {
			throw new ApiError(404, 'COST_NOT_FOUND', 'Recurring cost was not found');
		}

		return noContent();
	} catch (error) {
		return handleApiError(error);
	}
};
