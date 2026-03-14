export type InvestmentTrackerSource = 'manual' | 'nordea' | 'avanza';

export interface InvestmentAccount {
	id: string;
	name: string;
	institution: string | null;
	currency: string;
	totalValue: number;
	createdAt: string;
	updatedAt: string;
}

export interface InvestmentHolding {
	id: string;
	accountId: string;
	name: string;
	allocationPercent: number;
	currentValue: number;
	units: number | null;
	latestUnitPrice: number | null;
	trackerSource: InvestmentTrackerSource;
	trackerUrl: string | null;
	latestPriceDate: string | null;
	lastSyncedAt: string | null;
	changeAmountSinceLastSnapshot: number | null;
	changePercentSinceLastSnapshot: number | null;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface CreateInvestmentAccountInput {
	name: string;
	institution: string | null;
	currency: string;
	totalValue: number;
}

export interface UpdateInvestmentAccountInput {
	name?: string;
	institution?: string | null;
	currency?: string;
	totalValue?: number;
}

export interface CreateInvestmentHoldingInput {
	accountId: string;
	name: string;
	allocationPercent: number;
	currentValue: number;
	units?: number | null;
	latestUnitPrice?: number | null;
	trackerSource?: InvestmentTrackerSource;
	trackerUrl?: string | null;
	sortOrder: number;
}

export interface UpdateInvestmentHoldingInput {
	accountId?: string;
	name?: string;
	allocationPercent?: number;
	currentValue?: number;
	units?: number | null;
	latestUnitPrice?: number | null;
	trackerSource?: InvestmentTrackerSource;
	trackerUrl?: string | null;
	latestPriceDate?: string | null;
	lastSyncedAt?: string | null;
	sortOrder?: number;
}

export interface ListInvestmentHoldingsQuery {
	accountId?: string;
}
