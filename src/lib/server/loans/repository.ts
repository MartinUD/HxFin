import { randomUUID } from 'node:crypto';

import db, { type SqlParams } from '$lib/server/db';
import { ensureSchema } from '$lib/server/schema';
import type {
	CreateLoanInput,
	ListLoansQuery,
	Loan,
	UpdateLoanInput
} from '$lib/server/loans/types';

interface LoanRow {
	id: string;
	direction: 'lent' | 'borrowed';
	counterparty: string;
	principal_amount: number;
	outstanding_amount: number;
	currency: string;
	issue_date: string;
	due_date: string | null;
	status: 'open' | 'paid' | 'overdue';
	notes: string | null;
	created_at: string;
	updated_at: string;
}

function ensureReady(): void {
	ensureSchema();
}

function nowIso(): string {
	return new Date().toISOString();
}

function mapLoan(row: LoanRow): Loan {
	return {
		id: row.id,
		direction: row.direction,
		counterparty: row.counterparty,
		principalAmount: row.principal_amount,
		outstandingAmount: row.outstanding_amount,
		currency: row.currency,
		issueDate: row.issue_date,
		dueDate: row.due_date,
		status: row.status,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export function listLoans(query: ListLoansQuery = {}): Loan[] {
	ensureReady();

	const whereClauses: string[] = [];
	const params: SqlParams = {};

	if (query.direction) {
		whereClauses.push('direction = @direction');
		params.direction = query.direction;
	}

	if (query.status) {
		whereClauses.push('status = @status');
		params.status = query.status;
	}

	const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

	const rows = db
		.prepare(
			`SELECT
				id,
				direction,
				counterparty,
				principal_amount,
				outstanding_amount,
				currency,
				issue_date,
				due_date,
				status,
				notes,
				created_at,
				updated_at
			FROM loans
			${whereSql}
			ORDER BY due_date IS NULL ASC, due_date ASC, created_at DESC`
		)
		.all(params) as LoanRow[];

	return rows.map(mapLoan);
}

export function getLoanById(loanId: string): Loan | null {
	ensureReady();

	const row = db
		.prepare(
			`SELECT
				id,
				direction,
				counterparty,
				principal_amount,
				outstanding_amount,
				currency,
				issue_date,
				due_date,
				status,
				notes,
				created_at,
				updated_at
			FROM loans
			WHERE id = ?`
		)
		.get(loanId) as LoanRow | undefined;

	return row ? mapLoan(row) : null;
}

export function createLoan(input: CreateLoanInput): Loan {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	db.prepare(
		`INSERT INTO loans (
			id,
			direction,
			counterparty,
			principal_amount,
			outstanding_amount,
			currency,
			issue_date,
			due_date,
			status,
			notes,
			created_at,
			updated_at
		) VALUES (
			@id,
			@direction,
			@counterparty,
			@principalAmount,
			@outstandingAmount,
			@currency,
			@issueDate,
			@dueDate,
			@status,
			@notes,
			@createdAt,
			@updatedAt
		)`
	).run({
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
		updatedAt: timestamp
	});

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

	const fields: string[] = [];
	const params: SqlParams = { id: loanId };

	if (input.direction !== undefined) {
		fields.push('direction = @direction');
		params.direction = input.direction;
	}

	if (input.counterparty !== undefined) {
		fields.push('counterparty = @counterparty');
		params.counterparty = input.counterparty;
	}

	if (input.principalAmount !== undefined) {
		fields.push('principal_amount = @principalAmount');
		params.principalAmount = input.principalAmount;
	}

	if (input.outstandingAmount !== undefined) {
		fields.push('outstanding_amount = @outstandingAmount');
		params.outstandingAmount = input.outstandingAmount;
	}

	if (input.currency !== undefined) {
		fields.push('currency = @currency');
		params.currency = input.currency;
	}

	if (input.issueDate !== undefined) {
		fields.push('issue_date = @issueDate');
		params.issueDate = input.issueDate;
	}

	if (input.dueDate !== undefined) {
		fields.push('due_date = @dueDate');
		params.dueDate = input.dueDate;
	}

	if (input.status !== undefined) {
		fields.push('status = @status');
		params.status = input.status;
	}

	if (input.notes !== undefined) {
		fields.push('notes = @notes');
		params.notes = input.notes;
	}

	fields.push('updated_at = @updatedAt');
	params.updatedAt = nowIso();

	db.prepare(
		`UPDATE loans
		 SET ${fields.join(', ')}
		 WHERE id = @id`
	).run(params);

	return getLoanById(loanId);
}

export function deleteLoan(loanId: string): boolean {
	ensureReady();

	const result = db.prepare(`DELETE FROM loans WHERE id = ?`).run(loanId);
	return result.changes > 0;
}
