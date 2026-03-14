import type { PageLoad } from './$types';

import { DEFAULT_FINANCIAL_PROFILE_INPUT } from '$lib/contracts/finance';
import { createFinanceApi } from '$lib/finance/api';
import { createInvestmentsApi } from '$lib/investments/api';

export const load: PageLoad = async ({ fetch }) => {
	const financeApi = createFinanceApi(fetch);
	const investmentsApi = createInvestmentsApi(fetch);

	const [profile, accounts, holdings] = await Promise.all([
		financeApi.fetchFinancialProfile().catch(() => ({
			id: 'default',
			monthlySalary: DEFAULT_FINANCIAL_PROFILE_INPUT.monthlySalary,
			salaryGrowth: DEFAULT_FINANCIAL_PROFILE_INPUT.salaryGrowth,
			municipalTaxRate: DEFAULT_FINANCIAL_PROFILE_INPUT.municipalTaxRate,
			savingsShareOfRaise: DEFAULT_FINANCIAL_PROFILE_INPUT.savingsShareOfRaise,
			currency: DEFAULT_FINANCIAL_PROFILE_INPUT.currency,
			createdAt: '',
			updatedAt: ''
		})),
		investmentsApi.fetchAccounts().catch(() => []),
		investmentsApi.fetchHoldings().catch(() => [])
	]);

	return {
		profile,
		accounts,
		holdings
	};
};
