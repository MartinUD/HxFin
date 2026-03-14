export type LoanDirection = 'lent' | 'borrowed';
export type LoanStatus = 'open' | 'paid' | 'overdue';

export interface Loan {
	id: string;
	direction: LoanDirection;
	counterparty: string;
	principalAmount: number;
	outstandingAmount: number;
	currency: string;
	issueDate: string;
	dueDate: string | null;
	status: LoanStatus;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateLoanInput {
	direction: LoanDirection;
	counterparty: string;
	principalAmount: number;
	outstandingAmount: number;
	currency: string;
	issueDate: string;
	dueDate: string | null;
	status: LoanStatus;
	notes: string | null;
}

export interface UpdateLoanInput {
	direction?: LoanDirection;
	counterparty?: string;
	principalAmount?: number;
	outstandingAmount?: number;
	currency?: string;
	issueDate?: string;
	dueDate?: string | null;
	status?: LoanStatus;
	notes?: string | null;
}

export interface ListLoansQuery {
	direction?: LoanDirection;
	status?: LoanStatus;
}
