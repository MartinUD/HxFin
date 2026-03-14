export type RecurrencePeriodValue = 'weekly' | 'monthly' | 'yearly';

export function toMonthlyAmount(amount: number, period: RecurrencePeriodValue): number {
	switch (period) {
		case 'weekly':
			return (amount * 52) / 12;
		case 'monthly':
			return amount;
		case 'yearly':
			return amount / 12;
	}
}

export function roundToCurrencyCents(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}
