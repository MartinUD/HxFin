import type { RequestHandler } from './$types';

import { deleteLoan, getLoanById, updateLoan } from '$lib/server/loans/repository';
import { parseUpdateLoanInput } from '$lib/server/loans/validation';
import {
	ApiError,
	handleApiError,
	noContent,
	ok,
	readJsonBody
} from '$lib/server/http';

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const existingLoan = getLoanById(params.loanId);
		if (!existingLoan) {
			throw new ApiError(404, 'LOAN_NOT_FOUND', 'Loan was not found');
		}

		const payload = await readJsonBody(request);
		const input = parseUpdateLoanInput(payload);

		const effectiveIssueDate = input.issueDate ?? existingLoan.issueDate;
		const effectiveDueDate = input.dueDate !== undefined ? input.dueDate : existingLoan.dueDate;
		if (effectiveDueDate && effectiveDueDate < effectiveIssueDate) {
			throw new ApiError(
				400,
				'VALIDATION_ERROR',
				'dueDate must be greater than or equal to issueDate'
			);
		}

		const effectiveStatus = input.status ?? existingLoan.status;
		const effectiveOutstandingAmount = input.outstandingAmount ?? existingLoan.outstandingAmount;
		if (effectiveStatus === 'paid' && effectiveOutstandingAmount !== 0) {
			throw new ApiError(
				400,
				'VALIDATION_ERROR',
				'outstandingAmount must be 0 when status is paid'
			);
		}

		const loan = updateLoan(params.loanId, input);
		if (!loan) {
			throw new ApiError(404, 'LOAN_NOT_FOUND', 'Loan was not found');
		}

		return ok({ loan });
	} catch (error) {
		return handleApiError(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const deleted = deleteLoan(params.loanId);
		if (!deleted) {
			throw new ApiError(404, 'LOAN_NOT_FOUND', 'Loan was not found');
		}

		return noContent();
	} catch (error) {
		return handleApiError(error);
	}
};
