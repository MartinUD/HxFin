import { z } from 'zod';

import { ApiError, validateWithSchema } from '$lib/server/http';
import type {
	CreateLoanInput,
	ListLoansQuery,
	LoanDirection,
	LoanStatus,
	UpdateLoanInput
} from '$lib/server/loans/types';

const directionSchema = z.enum(['lent', 'borrowed']);
const statusSchema = z.enum(['open', 'paid', 'overdue']);
const counterpartySchema = z.string().trim().min(1).max(160);
const amountSchema = z.number().min(0).max(1_000_000_000);
const currencySchema = z.string().trim().toUpperCase().length(3);
const notesSchema = z.string().trim().max(1000).optional().nullable();
const isoDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const createLoanSchema = z
	.object({
		direction: directionSchema,
		counterparty: counterpartySchema,
		principalAmount: amountSchema,
		outstandingAmount: amountSchema.optional(),
		currency: currencySchema.optional(),
		issueDate: isoDateSchema,
		dueDate: isoDateSchema.optional().nullable(),
		status: statusSchema.optional(),
		notes: notesSchema
	})
	.strict();

const updateLoanSchema = z
	.object({
		direction: directionSchema.optional(),
		counterparty: counterpartySchema.optional(),
		principalAmount: amountSchema.optional(),
		outstandingAmount: amountSchema.optional(),
		currency: currencySchema.optional(),
		issueDate: isoDateSchema.optional(),
		dueDate: isoDateSchema.optional().nullable(),
		status: statusSchema.optional(),
		notes: notesSchema
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: 'At least one loan field must be provided'
	});

const listLoansQuerySchema = z
	.object({
		direction: directionSchema.optional(),
		status: statusSchema.optional()
	})
	.strict();

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
	if (value === undefined || value === null) {
		return value;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

function assertDateRange(issueDate: string, dueDate: string | null): void {
	if (dueDate && dueDate < issueDate) {
		throw new ApiError(
			400,
			'VALIDATION_ERROR',
			'dueDate must be greater than or equal to issueDate'
		);
	}
}

function assertStatusAmount(status: LoanStatus, outstandingAmount: number): void {
	if (status === 'paid' && outstandingAmount !== 0) {
		throw new ApiError(
			400,
			'VALIDATION_ERROR',
			'outstandingAmount must be 0 when status is paid'
		);
	}
}

export function parseCreateLoanInput(payload: unknown): CreateLoanInput {
	const parsed = validateWithSchema(createLoanSchema, payload);
	const status = (parsed.status ?? 'open') as LoanStatus;
	const outstandingAmount = parsed.outstandingAmount ?? parsed.principalAmount;
	assertDateRange(parsed.issueDate, parsed.dueDate ?? null);
	assertStatusAmount(status, outstandingAmount);

	return {
		direction: parsed.direction as LoanDirection,
		counterparty: parsed.counterparty,
		principalAmount: parsed.principalAmount,
		outstandingAmount,
		currency: parsed.currency ?? 'SEK',
		issueDate: parsed.issueDate,
		dueDate: parsed.dueDate ?? null,
		status,
		notes: normalizeNullableText(parsed.notes) ?? null
	};
}

export function parseUpdateLoanInput(payload: unknown): UpdateLoanInput {
	const parsed = validateWithSchema(updateLoanSchema, payload);
	const output: UpdateLoanInput = {};

	if ('direction' in parsed) {
		output.direction = parsed.direction as LoanDirection;
	}

	if ('counterparty' in parsed) {
		output.counterparty = parsed.counterparty;
	}

	if ('principalAmount' in parsed) {
		output.principalAmount = parsed.principalAmount;
	}

	if ('outstandingAmount' in parsed) {
		output.outstandingAmount = parsed.outstandingAmount;
	}

	if ('currency' in parsed) {
		output.currency = parsed.currency;
	}

	if ('issueDate' in parsed) {
		output.issueDate = parsed.issueDate;
	}

	if ('dueDate' in parsed) {
		output.dueDate = parsed.dueDate ?? null;
	}

	if ('status' in parsed) {
		output.status = parsed.status as LoanStatus;
	}

	if ('notes' in parsed) {
		output.notes = normalizeNullableText(parsed.notes) ?? null;
	}

	if (output.issueDate !== undefined && output.dueDate !== undefined) {
		assertDateRange(output.issueDate, output.dueDate);
	}

	if (output.status !== undefined && output.outstandingAmount !== undefined) {
		assertStatusAmount(output.status, output.outstandingAmount);
	}

	return output;
}

export function parseListLoansQuery(searchParams: URLSearchParams): ListLoansQuery {
	const parsed = validateWithSchema(listLoansQuerySchema, {
		direction: searchParams.get('direction') ?? undefined,
		status: searchParams.get('status') ?? undefined
	});

	return {
		direction: parsed.direction as LoanDirection | undefined,
		status: parsed.status as LoanStatus | undefined
	};
}
