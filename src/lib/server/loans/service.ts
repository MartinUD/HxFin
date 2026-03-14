import * as Effect from 'effect/Effect';

import { notFoundError, persistenceError, validationError } from '$lib/effect/errors';
import {
	createLoan,
	deleteLoan,
	getLoanById,
	listLoans,
	updateLoan
} from '$lib/server/loans/repository';
import type {
	CreateLoanInput,
	ListLoansQuery,
	Loan,
	LoanStatus,
	UpdateLoanInput
} from '$lib/schema/loans';

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
	if (value === undefined || value === null) {
		return value;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

function assertDateRange(issueDate: string, dueDate: string | null): void {
	if (dueDate && dueDate < issueDate) {
		throw validationError('dueDate must be greater than or equal to issueDate');
	}
}

function assertStatusAmount(status: LoanStatus, outstandingAmount: number): void {
	if (status === 'paid' && outstandingAmount !== 0) {
		throw validationError('outstandingAmount must be 0 when status is paid');
	}
}

export const listLoansEffect = (query: ListLoansQuery = {}) =>
	Effect.try({
		try: () => listLoans(query),
		catch: () => persistenceError('Failed to load loans')
	});

export const createLoanEffect = (input: CreateLoanInput) =>
	Effect.try({
		try: () => {
			const status = input.status ?? 'open';
			const outstandingAmount = input.outstandingAmount ?? input.principalAmount;
			assertDateRange(input.issueDate, input.dueDate ?? null);
			assertStatusAmount(status, outstandingAmount);

			return createLoan({
				direction: input.direction,
				counterparty: input.counterparty.trim(),
				principalAmount: input.principalAmount,
				outstandingAmount,
				currency: input.currency?.trim().toUpperCase() || 'SEK',
				issueDate: input.issueDate,
				dueDate: input.dueDate ?? null,
				status,
				notes: normalizeNullableText(input.notes) ?? null
			});
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to create loan')
	});

export const updateLoanEffect = (loanId: string, input: UpdateLoanInput) =>
	Effect.try({
		try: () => {
			const existingLoan = getLoanById(loanId);
			if (!existingLoan) {
				throw notFoundError('Loan was not found', 'LOAN_NOT_FOUND');
			}

			if (Object.keys(input).length === 0) {
				throw validationError('At least one loan field must be provided');
			}

			const effectiveIssueDate = input.issueDate ?? existingLoan.issueDate;
			const effectiveDueDate = input.dueDate !== undefined ? input.dueDate : existingLoan.dueDate;
			const effectiveStatus = input.status ?? existingLoan.status;
			const effectiveOutstandingAmount = input.outstandingAmount ?? existingLoan.outstandingAmount;

			assertDateRange(effectiveIssueDate, effectiveDueDate);
			assertStatusAmount(effectiveStatus, effectiveOutstandingAmount);

			const updated = updateLoan(loanId, {
				...input,
				counterparty: input.counterparty?.trim(),
				currency: input.currency?.trim().toUpperCase(),
				notes: normalizeNullableText(input.notes)
			});

			if (!updated) {
				throw notFoundError('Loan was not found', 'LOAN_NOT_FOUND');
			}

			return updated;
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to update loan')
	});

export const deleteLoanEffect = (loanId: string) =>
	Effect.try({
		try: () => {
			if (!deleteLoan(loanId)) {
				throw notFoundError('Loan was not found', 'LOAN_NOT_FOUND');
			}
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to delete loan')
	});
