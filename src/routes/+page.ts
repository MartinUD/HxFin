import type { PageLoad } from './$types';

import { DEFAULT_FINANCIAL_PROFILE_INPUT } from '$lib/contracts/finance';
import { createFinanceApi } from '$lib/finance/api';

export const load: PageLoad = async ({ fetch }) => {
	const api = createFinanceApi(fetch);

	try {
		const profile = await api.fetchFinancialProfile();
		return { profile };
	} catch {
		// Keep the calculator usable even if profile fetch fails.
		return {
			profile: {
				id: 'default',
				monthlySalary: DEFAULT_FINANCIAL_PROFILE_INPUT.monthlySalary,
				salaryGrowth: DEFAULT_FINANCIAL_PROFILE_INPUT.salaryGrowth,
				municipalTaxRate: DEFAULT_FINANCIAL_PROFILE_INPUT.municipalTaxRate,
				savingsShareOfRaise: DEFAULT_FINANCIAL_PROFILE_INPUT.savingsShareOfRaise,
				currency: DEFAULT_FINANCIAL_PROFILE_INPUT.currency,
				createdAt: '',
				updatedAt: ''
			}
		};
	}
};
