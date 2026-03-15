import { formatSekAmount } from '$lib/finance/format';
import { toMonthlyAmount } from '$lib/finance/recurrence';
import type {
	BudgetCategory,
	BudgetSummary,
	RecurringCost,
	RecurringCostKind,
} from '$lib/schema/budget';

export type { BudgetCategory, BudgetSummary, RecurringCost };
export { toMonthlyAmount };

export const COLOR_PALETTE: string[] = [
	'#22c55e',
	'#06b6d4',
	'#f59e0b',
	'#ef4444',
	'#ec4899',
	'#8b5cf6',
	'#f97316',
	'#a78bfa',
];

export const DEFAULT_COLOR = '#22c55e';

export const PERIOD_OPTIONS = [
	{ value: 'weekly', label: 'Weekly' },
	{ value: 'monthly', label: 'Monthly' },
	{ value: 'yearly', label: 'Yearly' },
] as const;

export const COST_KIND_OPTIONS = [
	{ value: 'expense', label: 'Expense' },
	{ value: 'investment', label: 'Investment' },
] as const satisfies ReadonlyArray<{ value: RecurringCostKind; label: string }>;

export function formatCurrency(value: number): string {
	return formatSekAmount(value);
}
