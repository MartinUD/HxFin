import { requestJson, type ApiFetcher } from '$lib/api/http';
import type { CreateLoanInput, Loan, UpdateLoanInput } from '$lib/contracts/loans';

export type { Loan };

export interface LoansApiClient {
	fetchLoans(query?: { direction?: 'lent' | 'borrowed'; status?: 'open' | 'paid' | 'overdue' }): Promise<Loan[]>;
	createLoan(input: CreateLoanInput): Promise<Loan>;
	updateLoan(id: string, input: UpdateLoanInput): Promise<Loan>;
	deleteLoan(id: string): Promise<void>;
}

export function createLoansApi(fetcher: ApiFetcher): LoansApiClient {
	return {
		async fetchLoans(query): Promise<Loan[]> {
			const params = new URLSearchParams();
			if (query?.direction) {
				params.set('direction', query.direction);
			}
			if (query?.status) {
				params.set('status', query.status);
			}

			const qs = params.toString();
			const data = await requestJson<{ loans: Loan[] }>(
				fetcher,
				`/api/loans${qs ? `?${qs}` : ''}`
			);
			return data.loans;
		},
		async createLoan(input: CreateLoanInput): Promise<Loan> {
			const data = await requestJson<{ loan: Loan }>(fetcher, '/api/loans', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			return data.loan;
		},
		async updateLoan(id: string, input: UpdateLoanInput): Promise<Loan> {
			const data = await requestJson<{ loan: Loan }>(fetcher, `/api/loans/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			return data.loan;
		},
		async deleteLoan(id: string): Promise<void> {
			await requestJson<void>(fetcher, `/api/loans/${id}`, {
				method: 'DELETE'
			});
		}
	};
}

const defaultClient = createLoansApi((input, init) => fetch(input, init));

export const fetchLoans = (query?: { direction?: 'lent' | 'borrowed'; status?: 'open' | 'paid' | 'overdue' }) =>
	defaultClient.fetchLoans(query);
export const createLoan = (input: CreateLoanInput) => defaultClient.createLoan(input);
export const updateLoan = (id: string, input: UpdateLoanInput) => defaultClient.updateLoan(id, input);
export const deleteLoan = (id: string) => defaultClient.deleteLoan(id);
