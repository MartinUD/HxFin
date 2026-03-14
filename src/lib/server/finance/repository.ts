import { eq } from 'drizzle-orm';

import { DEFAULT_FINANCIAL_PROFILE_INPUT } from '$lib/schema/finance';
import { orm } from '$lib/server/drizzle/client';
import { financialProfile } from '$lib/server/drizzle/schema';
import { ensureSchema } from '$lib/server/schema';
import type { FinancialProfile, UpdateFinancialProfileInput } from '$lib/server/finance/types';

const DEFAULT_PROFILE_ID = 'default';

type FinancialProfileInsert = typeof financialProfile.$inferInsert;

function ensureReady(): void {
	ensureSchema();
}

function nowIso(): string {
	return new Date().toISOString();
}

function getFinancialProfileRow(): FinancialProfile | null {
	const row = orm
		.select()
		.from(financialProfile)
		.where(eq(financialProfile.id, DEFAULT_PROFILE_ID))
		.get();

	return row ?? null;
}

function ensureProfileExists(): void {
	const existing = getFinancialProfileRow();
	if (existing) {
		return;
	}

	const timestamp = nowIso();
	orm
		.insert(financialProfile)
		.values({
			id: DEFAULT_PROFILE_ID,
			monthlySalary: DEFAULT_FINANCIAL_PROFILE_INPUT.monthlySalary,
			salaryGrowth: DEFAULT_FINANCIAL_PROFILE_INPUT.salaryGrowth,
			municipalTaxRate: DEFAULT_FINANCIAL_PROFILE_INPUT.municipalTaxRate,
			savingsShareOfRaise: DEFAULT_FINANCIAL_PROFILE_INPUT.savingsShareOfRaise,
			currency: DEFAULT_FINANCIAL_PROFILE_INPUT.currency,
			createdAt: timestamp,
			updatedAt: timestamp
		})
		.run();
}

export function getFinancialProfile(): FinancialProfile {
	ensureReady();
	ensureProfileExists();

	const row = getFinancialProfileRow();
	if (!row) {
		throw new Error('Failed to load financial profile');
	}

	return row;
}

export function updateFinancialProfile(input: UpdateFinancialProfileInput): FinancialProfile {
	ensureReady();
	ensureProfileExists();

	const updates: Partial<FinancialProfileInsert> = {};

	if (input.monthlySalary !== undefined) {
		updates.monthlySalary = input.monthlySalary;
	}

	if (input.salaryGrowth !== undefined) {
		updates.salaryGrowth = input.salaryGrowth;
	}

	if (input.municipalTaxRate !== undefined) {
		updates.municipalTaxRate = input.municipalTaxRate;
	}

	if (input.savingsShareOfRaise !== undefined) {
		updates.savingsShareOfRaise = input.savingsShareOfRaise;
	}

	if (input.currency !== undefined) {
		updates.currency = input.currency;
	}

	updates.updatedAt = nowIso();

	orm
		.update(financialProfile)
		.set(updates)
		.where(eq(financialProfile.id, DEFAULT_PROFILE_ID))
		.run();

	return getFinancialProfile();
}
