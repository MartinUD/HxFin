import { requestJson, type ApiFetcher } from '$lib/api/http';
import type {
	FinancialProfile,
	UpdateFinancialProfileInput
} from '$lib/contracts/finance';

export type { FinancialProfile, UpdateFinancialProfileInput };

export interface FinanceApiClient {
	fetchFinancialProfile(): Promise<FinancialProfile>;
	updateFinancialProfile(input: UpdateFinancialProfileInput): Promise<FinancialProfile>;
}

export function createFinanceApi(fetcher: ApiFetcher): FinanceApiClient {
	return {
		async fetchFinancialProfile(): Promise<FinancialProfile> {
			const data = await requestJson<{ profile: FinancialProfile }>(fetcher, '/api/finance/profile');
			return data.profile;
		},
		async updateFinancialProfile(input: UpdateFinancialProfileInput): Promise<FinancialProfile> {
			const data = await requestJson<{ profile: FinancialProfile }>(fetcher, '/api/finance/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			return data.profile;
		}
	};
}

const defaultClient = createFinanceApi((input, init) => fetch(input, init));

export const fetchFinancialProfile = () => defaultClient.fetchFinancialProfile();
export const updateFinancialProfile = (input: UpdateFinancialProfileInput) =>
	defaultClient.updateFinancialProfile(input);
