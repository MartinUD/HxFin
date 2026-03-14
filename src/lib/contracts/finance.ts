export interface FinancialProfile {
	id: string;
	monthlySalary: number;
	salaryGrowth: number;
	municipalTaxRate: number;
	savingsShareOfRaise: number;
	currency: string;
	createdAt: string;
	updatedAt: string;
}

export interface UpdateFinancialProfileInput {
	monthlySalary?: number;
	salaryGrowth?: number;
	municipalTaxRate?: number;
	savingsShareOfRaise?: number;
	currency?: string;
}

export const DEFAULT_FINANCIAL_PROFILE_INPUT = {
	monthlySalary: 40000,
	salaryGrowth: 6,
	municipalTaxRate: 32.41,
	savingsShareOfRaise: 50,
	currency: 'SEK'
} as const;
