export type RecurrencePeriod = 'weekly' | 'monthly' | 'yearly';
export type RecurringCostKind = 'expense' | 'investment';

export interface BudgetCategory {
	id: string;
	name: string;
	description: string | null;
	color: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface RecurringCost {
	id: string;
	categoryId: string;
	name: string;
	amount: number;
	period: RecurrencePeriod;
	kind: RecurringCostKind;
	isEssential: boolean;
	startDate: string | null;
	endDate: string | null;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface BudgetSummaryCategory {
	categoryId: string;
	categoryName: string;
	monthlyTotal: number;
	yearlyTotal: number;
}

export interface BudgetSummary {
	totalMonthlyRecurring: number;
	totalYearlyRecurring: number;
	monthlyEssential: number;
	monthlyNonEssential: number;
	monthlyInvesting: number;
	monthlyNetIncome: number;
	monthlyUnallocated: number;
	savingsRate: number;
	categories: BudgetSummaryCategory[];
}

export interface CreateCategoryInput {
	name: string;
	description: string | null;
	color: string | null;
}

export interface UpdateCategoryInput {
	name?: string;
	description?: string | null;
	color?: string | null;
}

export interface CreateRecurringCostInput {
	categoryId: string;
	name: string;
	amount: number;
	period: RecurrencePeriod;
	kind: RecurringCostKind;
	isEssential: boolean;
	startDate: string | null;
	endDate: string | null;
	isActive: boolean;
}

export interface UpdateRecurringCostInput {
	categoryId?: string;
	name?: string;
	amount?: number;
	period?: RecurrencePeriod;
	kind?: RecurringCostKind;
	isEssential?: boolean;
	startDate?: string | null;
	endDate?: string | null;
	isActive?: boolean;
}

export interface ListRecurringCostsQuery {
	categoryId?: string;
	includeInactive?: boolean;
}

export interface SummaryQuery {
	includeInactive?: boolean;
}
