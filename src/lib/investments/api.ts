import { requestJson, type ApiFetcher } from '$lib/api/http';
import type {
	CreateInvestmentAccountInput,
	CreateInvestmentHoldingInput,
	InvestmentAccount,
	InvestmentHolding,
	UpdateInvestmentAccountInput,
	UpdateInvestmentHoldingInput
} from '$lib/contracts/investments';

export type { InvestmentAccount, InvestmentHolding };

export interface InvestmentsApiClient {
	fetchAccounts(): Promise<InvestmentAccount[]>;
	createAccount(input: CreateInvestmentAccountInput): Promise<InvestmentAccount>;
	updateAccount(id: string, input: UpdateInvestmentAccountInput): Promise<InvestmentAccount>;
	deleteAccount(id: string): Promise<void>;
	fetchHoldings(query?: { accountId?: string }): Promise<InvestmentHolding[]>;
	refreshTrackedHoldings(): Promise<InvestmentHolding[]>;
	createHolding(input: CreateInvestmentHoldingInput): Promise<InvestmentHolding>;
	updateHolding(id: string, input: UpdateInvestmentHoldingInput): Promise<InvestmentHolding>;
	deleteHolding(id: string): Promise<void>;
}

export function createInvestmentsApi(fetcher: ApiFetcher): InvestmentsApiClient {
	return {
		async fetchAccounts(): Promise<InvestmentAccount[]> {
			const data = await requestJson<{ accounts: InvestmentAccount[] }>(fetcher, '/api/investments/accounts');
			return data.accounts;
		},
		async createAccount(input: CreateInvestmentAccountInput): Promise<InvestmentAccount> {
			const data = await requestJson<{ account: InvestmentAccount }>(fetcher, '/api/investments/accounts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			return data.account;
		},
		async updateAccount(id: string, input: UpdateInvestmentAccountInput): Promise<InvestmentAccount> {
			const data = await requestJson<{ account: InvestmentAccount }>(
				fetcher,
				`/api/investments/accounts/${id}`,
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(input)
				}
			);
			return data.account;
		},
		async deleteAccount(id: string): Promise<void> {
			await requestJson<void>(fetcher, `/api/investments/accounts/${id}`, {
				method: 'DELETE'
			});
		},
		async fetchHoldings(query?: { accountId?: string }): Promise<InvestmentHolding[]> {
			const params = new URLSearchParams();
			if (query?.accountId) {
				params.set('accountId', query.accountId);
			}

			const qs = params.toString();
			const data = await requestJson<{ holdings: InvestmentHolding[] }>(
				fetcher,
				`/api/investments/holdings${qs ? `?${qs}` : ''}`
			);
			return data.holdings;
		},
		async refreshTrackedHoldings(): Promise<InvestmentHolding[]> {
			await requestJson<{ refreshed: Array<{ holdingId: string }> }>(fetcher, '/api/investments/refresh', {
				method: 'POST'
			});
			const data = await requestJson<{ holdings: InvestmentHolding[] }>(fetcher, '/api/investments/holdings');
			return data.holdings;
		},
		async createHolding(input: CreateInvestmentHoldingInput): Promise<InvestmentHolding> {
			const data = await requestJson<{ holding: InvestmentHolding }>(fetcher, '/api/investments/holdings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			return data.holding;
		},
		async updateHolding(id: string, input: UpdateInvestmentHoldingInput): Promise<InvestmentHolding> {
			const data = await requestJson<{ holding: InvestmentHolding }>(
				fetcher,
				`/api/investments/holdings/${id}`,
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(input)
				}
			);
			return data.holding;
		},
		async deleteHolding(id: string): Promise<void> {
			await requestJson<void>(fetcher, `/api/investments/holdings/${id}`, {
				method: 'DELETE'
			});
		}
	};
}

const defaultClient = createInvestmentsApi((input, init) => fetch(input, init));

export const fetchInvestmentAccounts = () => defaultClient.fetchAccounts();
export const createInvestmentAccount = (input: CreateInvestmentAccountInput) =>
	defaultClient.createAccount(input);
export const updateInvestmentAccount = (id: string, input: UpdateInvestmentAccountInput) =>
	defaultClient.updateAccount(id, input);
export const deleteInvestmentAccount = (id: string) => defaultClient.deleteAccount(id);
export const fetchInvestmentHoldings = (query?: { accountId?: string }) =>
	defaultClient.fetchHoldings(query);
export const refreshTrackedInvestmentHoldings = () => defaultClient.refreshTrackedHoldings();
export const createInvestmentHolding = (input: CreateInvestmentHoldingInput) =>
	defaultClient.createHolding(input);
export const updateInvestmentHolding = (id: string, input: UpdateInvestmentHoldingInput) =>
	defaultClient.updateHolding(id, input);
export const deleteInvestmentHolding = (id: string) => defaultClient.deleteHolding(id);
