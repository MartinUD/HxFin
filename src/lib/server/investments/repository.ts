import { randomUUID } from 'node:crypto';

import { and, asc, eq } from 'drizzle-orm';

import sqlite from '$lib/server/db';
import { orm } from '$lib/server/drizzle/client';
import {
	investmentAccounts,
	investmentHoldingSnapshots,
	investmentHoldings,
} from '$lib/server/drizzle/schema';
import type {
	CreateInvestmentAccountInput,
	CreateInvestmentHoldingInput,
	InvestmentAccount,
	InvestmentHolding,
	ListInvestmentHoldingsQuery,
	UpdateInvestmentAccountInput,
	UpdateInvestmentHoldingInput,
} from '$lib/server/investments/types';
import { ensureSchema } from '$lib/server/schema';

type InvestmentAccountInsert = typeof investmentAccounts.$inferInsert;
type InvestmentHoldingInsert = typeof investmentHoldings.$inferInsert;

interface HoldingSnapshotPairRow {
	latest_value: number;
	previous_value: number | null;
}

function ensureReady(): void {
	ensureSchema();
}

function nowIso(): string {
	return new Date().toISOString();
}

function getHoldingSnapshotPair(holdingId: string): HoldingSnapshotPairRow | undefined {
	return sqlite
		.prepare(
			`SELECT
				MAX(CASE WHEN snapshot_rank = 1 THEN current_value END) AS latest_value,
				MAX(CASE WHEN snapshot_rank = 2 THEN current_value END) AS previous_value
			 FROM (
				SELECT current_value,
					ROW_NUMBER() OVER (ORDER BY captured_at DESC) AS snapshot_rank
				FROM investment_holding_snapshots
				WHERE holding_id = ?
				LIMIT 2
			 )`,
		)
		.get(holdingId) as HoldingSnapshotPairRow | undefined;
}

function mapHolding(row: typeof investmentHoldings.$inferSelect): InvestmentHolding {
	const snapshotPair = getHoldingSnapshotPair(row.id);
	const latestSnapshotValue = snapshotPair?.latest_value ?? null;
	const previousSnapshotValue = snapshotPair?.previous_value ?? null;
	const changeAmount =
		latestSnapshotValue !== null && previousSnapshotValue !== null
			? latestSnapshotValue - previousSnapshotValue
			: null;
	const changePercent =
		changeAmount !== null && previousSnapshotValue && previousSnapshotValue !== 0
			? (changeAmount / previousSnapshotValue) * 100
			: null;

	return {
		...row,
		changeAmountSinceLastSnapshot: changeAmount,
		changePercentSinceLastSnapshot: changePercent,
	};
}

export function listInvestmentAccounts(): InvestmentAccount[] {
	ensureReady();

	return orm.select().from(investmentAccounts).orderBy(asc(investmentAccounts.createdAt)).all();
}

export function getInvestmentAccountById(accountId: string): InvestmentAccount | null {
	ensureReady();

	const row = orm
		.select()
		.from(investmentAccounts)
		.where(eq(investmentAccounts.id, accountId))
		.get();

	return row ?? null;
}

export function createInvestmentAccount(input: CreateInvestmentAccountInput): InvestmentAccount {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	orm
		.insert(investmentAccounts)
		.values({
			id,
			name: input.name,
			institution: input.institution,
			currency: input.currency,
			totalValue: input.totalValue,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
		.run();

	const created = getInvestmentAccountById(id);
	if (!created) {
		throw new Error('Failed to read created investment account');
	}

	return created;
}

export function updateInvestmentAccount(
	accountId: string,
	input: UpdateInvestmentAccountInput,
): InvestmentAccount | null {
	ensureReady();

	if (!getInvestmentAccountById(accountId)) {
		return null;
	}

	const updates: Partial<InvestmentAccountInsert> = {};

	if (input.name !== undefined) {
		updates.name = input.name;
	}

	if (input.institution !== undefined) {
		updates.institution = input.institution;
	}

	if (input.currency !== undefined) {
		updates.currency = input.currency;
	}

	if (input.totalValue !== undefined) {
		updates.totalValue = input.totalValue;
	}

	updates.updatedAt = nowIso();

	orm.update(investmentAccounts).set(updates).where(eq(investmentAccounts.id, accountId)).run();

	return getInvestmentAccountById(accountId);
}

export function deleteInvestmentAccount(accountId: string): boolean {
	ensureReady();

	if (!getInvestmentAccountById(accountId)) {
		return false;
	}

	orm.delete(investmentAccounts).where(eq(investmentAccounts.id, accountId)).run();
	return true;
}

export function listInvestmentHoldings(
	query: ListInvestmentHoldingsQuery = {},
): InvestmentHolding[] {
	ensureReady();

	const conditions = [];

	if (query.accountId) {
		conditions.push(eq(investmentHoldings.accountId, query.accountId));
	}

	const rows = orm
		.select()
		.from(investmentHoldings)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(
			asc(investmentHoldings.accountId),
			asc(investmentHoldings.sortOrder),
			asc(investmentHoldings.createdAt),
		)
		.all();

	return rows.map(mapHolding);
}

export function getInvestmentHoldingById(holdingId: string): InvestmentHolding | null {
	ensureReady();

	const row = orm
		.select()
		.from(investmentHoldings)
		.where(eq(investmentHoldings.id, holdingId))
		.get();

	return row ? mapHolding(row) : null;
}

export function createInvestmentHolding(input: CreateInvestmentHoldingInput): InvestmentHolding {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	orm
		.insert(investmentHoldings)
		.values({
			id,
			accountId: input.accountId,
			name: input.name,
			allocationPercent: input.allocationPercent,
			currentValue: input.currentValue,
			units: input.units ?? null,
			latestUnitPrice: input.latestUnitPrice ?? null,
			trackerSource: input.trackerSource ?? 'manual',
			trackerUrl: input.trackerUrl ?? null,
			latestPriceDate: null,
			lastSyncedAt: null,
			sortOrder: input.sortOrder,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
		.run();

	const created = getInvestmentHoldingById(id);
	if (!created) {
		throw new Error('Failed to read created investment holding');
	}

	return created;
}

export function updateInvestmentHolding(
	holdingId: string,
	input: UpdateInvestmentHoldingInput,
): InvestmentHolding | null {
	ensureReady();

	if (!getInvestmentHoldingById(holdingId)) {
		return null;
	}

	const updates: Partial<InvestmentHoldingInsert> = {};

	if (input.accountId !== undefined) {
		updates.accountId = input.accountId;
	}

	if (input.name !== undefined) {
		updates.name = input.name;
	}

	if (input.allocationPercent !== undefined) {
		updates.allocationPercent = input.allocationPercent;
	}

	if (input.currentValue !== undefined) {
		updates.currentValue = input.currentValue;
	}

	if (input.units !== undefined) {
		updates.units = input.units;
	}

	if (input.latestUnitPrice !== undefined) {
		updates.latestUnitPrice = input.latestUnitPrice;
	}

	if (input.trackerSource !== undefined) {
		updates.trackerSource = input.trackerSource;
	}

	if (input.trackerUrl !== undefined) {
		updates.trackerUrl = input.trackerUrl;
	}

	if (input.latestPriceDate !== undefined) {
		updates.latestPriceDate = input.latestPriceDate;
	}

	if (input.lastSyncedAt !== undefined) {
		updates.lastSyncedAt = input.lastSyncedAt;
	}

	if (input.sortOrder !== undefined) {
		updates.sortOrder = input.sortOrder;
	}

	updates.updatedAt = nowIso();

	orm.update(investmentHoldings).set(updates).where(eq(investmentHoldings.id, holdingId)).run();

	return getInvestmentHoldingById(holdingId);
}

export function deleteInvestmentHolding(holdingId: string): boolean {
	ensureReady();

	if (!getInvestmentHoldingById(holdingId)) {
		return false;
	}

	orm.delete(investmentHoldings).where(eq(investmentHoldings.id, holdingId)).run();
	return true;
}

export function createInvestmentHoldingSnapshot(input: {
	holdingId: string;
	currentValue: number;
	unitPrice: number | null;
	units: number | null;
	capturedAt?: string;
}): void {
	ensureReady();

	orm
		.insert(investmentHoldingSnapshots)
		.values({
			id: randomUUID(),
			holdingId: input.holdingId,
			currentValue: input.currentValue,
			unitPrice: input.unitPrice,
			units: input.units,
			capturedAt: input.capturedAt ?? nowIso(),
		})
		.run();
}
