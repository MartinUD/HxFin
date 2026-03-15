import { randomUUID } from 'node:crypto';

import { and, asc, desc, eq, sql } from 'drizzle-orm';

import { orm } from '$lib/server/drizzle/client';
import { loans } from '$lib/server/drizzle/schema';
import type { ListLoansQuery, Loan, LoanStatus, UpdateLoanInput } from '$lib/server/loans/types';
import { ensureSchema } from '$lib/server/schema';

type LoanInsert = typeof loans.$inferInsert;

function ensureReady(): void {
	ensureSchema();
}

function nowIso(): string {
	return new Date().toISOString();
}

export function listLoans(query: ListLoansQuery = {}): Loan[] {
	ensureReady();

	const conditions = [];

	if (query.direction) {
		conditions.push(eq(loans.direction, query.direction));
	}

	if (query.status) {
		conditions.push(eq(loans.status, query.status));
	}

	return orm
		.select()
		.from(loans)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(sql`${loans.dueDate} is null`, asc(loans.dueDate), desc(loans.createdAt))
		.all();
}

export function getLoanById(loanId: string): Loan | null {
	ensureReady();

	const row = orm.select().from(loans).where(eq(loans.id, loanId)).get();
	return row ?? null;
}

export function createLoan(
	input: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'> & {
		status: LoanStatus;
	},
): Loan {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	orm
		.insert(loans)
		.values({
			id,
			direction: input.direction,
			counterparty: input.counterparty,
			principalAmount: input.principalAmount,
			outstandingAmount: input.outstandingAmount,
			currency: input.currency,
			issueDate: input.issueDate,
			dueDate: input.dueDate,
			status: input.status,
			notes: input.notes,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
		.run();

	const created = getLoanById(id);
	if (!created) {
		throw new Error('Failed to read created loan');
	}

	return created;
}

export function updateLoan(loanId: string, input: UpdateLoanInput): Loan | null {
	ensureReady();

	if (!getLoanById(loanId)) {
		return null;
	}

	const updates: Partial<LoanInsert> = {};

	if (input.direction !== undefined) {
		updates.direction = input.direction;
	}

	if (input.counterparty !== undefined) {
		updates.counterparty = input.counterparty;
	}

	if (input.principalAmount !== undefined) {
		updates.principalAmount = input.principalAmount;
	}

	if (input.outstandingAmount !== undefined) {
		updates.outstandingAmount = input.outstandingAmount;
	}

	if (input.currency !== undefined) {
		updates.currency = input.currency;
	}

	if (input.issueDate !== undefined) {
		updates.issueDate = input.issueDate;
	}

	if (input.dueDate !== undefined) {
		updates.dueDate = input.dueDate;
	}

	if (input.status !== undefined) {
		updates.status = input.status;
	}

	if (input.notes !== undefined) {
		updates.notes = input.notes;
	}

	updates.updatedAt = nowIso();

	orm.update(loans).set(updates).where(eq(loans.id, loanId)).run();

	return getLoanById(loanId);
}

export function deleteLoan(loanId: string): boolean {
	ensureReady();

	if (!getLoanById(loanId)) {
		return false;
	}

	orm.delete(loans).where(eq(loans.id, loanId)).run();
	return true;
}
