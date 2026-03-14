import { randomUUID } from 'node:crypto';

import db, { type SqlParams } from '$lib/server/db';
import { ensureSchema } from '$lib/server/schema';
import type {
	CreateInvestmentAccountInput,
	CreateInvestmentHoldingInput,
	InvestmentAccount,
	InvestmentHolding,
	ListInvestmentHoldingsQuery,
	UpdateInvestmentAccountInput,
	UpdateInvestmentHoldingInput
} from '$lib/server/investments/types';

interface InvestmentAccountRow {
	id: string;
	name: string;
	institution: string | null;
	currency: string;
	total_value: number;
	created_at: string;
	updated_at: string;
}

interface InvestmentHoldingRow {
	id: string;
	account_id: string;
	name: string;
	allocation_percent: number;
	current_value: number;
	units: number | null;
	latest_unit_price: number | null;
	tracker_source: 'manual' | 'nordea' | 'avanza';
	tracker_url: string | null;
	latest_price_date: string | null;
	last_synced_at: string | null;
	sort_order: number;
	created_at: string;
	updated_at: string;
}

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

function mapAccount(row: InvestmentAccountRow): InvestmentAccount {
	return {
		id: row.id,
		name: row.name,
		institution: row.institution,
		currency: row.currency,
		totalValue: row.total_value,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function mapHolding(row: InvestmentHoldingRow): InvestmentHolding {
	const snapshotPair = db
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
			 )`
		)
		.get(row.id) as HoldingSnapshotPairRow | undefined;

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
		id: row.id,
		accountId: row.account_id,
		name: row.name,
		allocationPercent: row.allocation_percent,
		currentValue: row.current_value,
		units: row.units,
		latestUnitPrice: row.latest_unit_price,
		trackerSource: row.tracker_source,
		trackerUrl: row.tracker_url,
		latestPriceDate: row.latest_price_date,
		lastSyncedAt: row.last_synced_at,
		changeAmountSinceLastSnapshot: changeAmount,
		changePercentSinceLastSnapshot: changePercent,
		sortOrder: row.sort_order,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export function listInvestmentAccounts(): InvestmentAccount[] {
	ensureReady();

	const rows = db
		.prepare(
			`SELECT id, name, institution, currency, total_value, created_at, updated_at
			 FROM investment_accounts
			 ORDER BY created_at ASC`
		)
		.all() as InvestmentAccountRow[];

	return rows.map(mapAccount);
}

export function getInvestmentAccountById(accountId: string): InvestmentAccount | null {
	ensureReady();

	const row = db
		.prepare(
			`SELECT id, name, institution, currency, total_value, created_at, updated_at
			 FROM investment_accounts
			 WHERE id = ?`
		)
		.get(accountId) as InvestmentAccountRow | undefined;

	return row ? mapAccount(row) : null;
}

export function createInvestmentAccount(input: CreateInvestmentAccountInput): InvestmentAccount {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	db.prepare(
		`INSERT INTO investment_accounts (
			id, name, institution, currency, total_value, created_at, updated_at
		) VALUES (
			@id, @name, @institution, @currency, @totalValue, @createdAt, @updatedAt
		)`
	).run({
		id,
		name: input.name,
		institution: input.institution,
		currency: input.currency,
		totalValue: input.totalValue,
		createdAt: timestamp,
		updatedAt: timestamp
	});

	const created = getInvestmentAccountById(id);
	if (!created) {
		throw new Error('Failed to read created investment account');
	}

	return created;
}

export function updateInvestmentAccount(
	accountId: string,
	input: UpdateInvestmentAccountInput
): InvestmentAccount | null {
	ensureReady();

	if (!getInvestmentAccountById(accountId)) {
		return null;
	}

	const fields: string[] = [];
	const params: SqlParams = { id: accountId };

	if (input.name !== undefined) {
		fields.push('name = @name');
		params.name = input.name;
	}

	if (input.institution !== undefined) {
		fields.push('institution = @institution');
		params.institution = input.institution;
	}

	if (input.currency !== undefined) {
		fields.push('currency = @currency');
		params.currency = input.currency;
	}

	if (input.totalValue !== undefined) {
		fields.push('total_value = @totalValue');
		params.totalValue = input.totalValue;
	}

	fields.push('updated_at = @updatedAt');
	params.updatedAt = nowIso();

	db.prepare(
		`UPDATE investment_accounts
		 SET ${fields.join(', ')}
		 WHERE id = @id`
	).run(params);

	return getInvestmentAccountById(accountId);
}

export function deleteInvestmentAccount(accountId: string): boolean {
	ensureReady();

	const result = db.prepare(`DELETE FROM investment_accounts WHERE id = ?`).run(accountId);
	return result.changes > 0;
}

export function listInvestmentHoldings(query: ListInvestmentHoldingsQuery = {}): InvestmentHolding[] {
	ensureReady();

	const whereClauses: string[] = [];
	const params: SqlParams = {};

	if (query.accountId) {
		whereClauses.push('account_id = @accountId');
		params.accountId = query.accountId;
	}

	const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

	const rows = db
		.prepare(
			`SELECT
				id,
				account_id,
				name,
				allocation_percent,
				current_value,
				units,
				latest_unit_price,
				tracker_source,
				tracker_url,
				latest_price_date,
				last_synced_at,
				sort_order,
				created_at,
				updated_at
			 FROM investment_holdings
			 ${whereSql}
			 ORDER BY account_id ASC, sort_order ASC, created_at ASC`
		)
		.all(params) as InvestmentHoldingRow[];

	return rows.map(mapHolding);
}

export function getInvestmentHoldingById(holdingId: string): InvestmentHolding | null {
	ensureReady();

	const row = db
		.prepare(
			`SELECT
				id,
				account_id,
				name,
				allocation_percent,
				current_value,
				units,
				latest_unit_price,
				tracker_source,
				tracker_url,
				latest_price_date,
				last_synced_at,
				sort_order,
				created_at,
				updated_at
			 FROM investment_holdings
			 WHERE id = ?`
		)
		.get(holdingId) as InvestmentHoldingRow | undefined;

	return row ? mapHolding(row) : null;
}

export function createInvestmentHolding(input: CreateInvestmentHoldingInput): InvestmentHolding {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	db.prepare(
		`INSERT INTO investment_holdings (
			id, account_id, name, allocation_percent, current_value, units, latest_unit_price,
			tracker_source, tracker_url, latest_price_date, last_synced_at, sort_order, created_at, updated_at
		) VALUES (
			@id, @accountId, @name, @allocationPercent, @currentValue, @units, @latestUnitPrice,
			@trackerSource, @trackerUrl, @latestPriceDate, @lastSyncedAt, @sortOrder, @createdAt, @updatedAt
		)`
	).run({
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
		updatedAt: timestamp
	});

	const created = getInvestmentHoldingById(id);
	if (!created) {
		throw new Error('Failed to read created investment holding');
	}

	return created;
}

export function updateInvestmentHolding(
	holdingId: string,
	input: UpdateInvestmentHoldingInput
): InvestmentHolding | null {
	ensureReady();

	if (!getInvestmentHoldingById(holdingId)) {
		return null;
	}

	const fields: string[] = [];
	const params: SqlParams = { id: holdingId };

	if (input.accountId !== undefined) {
		fields.push('account_id = @accountId');
		params.accountId = input.accountId;
	}

	if (input.name !== undefined) {
		fields.push('name = @name');
		params.name = input.name;
	}

	if (input.allocationPercent !== undefined) {
		fields.push('allocation_percent = @allocationPercent');
		params.allocationPercent = input.allocationPercent;
	}

	if (input.currentValue !== undefined) {
		fields.push('current_value = @currentValue');
		params.currentValue = input.currentValue;
	}

	if (input.units !== undefined) {
		fields.push('units = @units');
		params.units = input.units;
	}

	if (input.latestUnitPrice !== undefined) {
		fields.push('latest_unit_price = @latestUnitPrice');
		params.latestUnitPrice = input.latestUnitPrice;
	}

	if (input.trackerSource !== undefined) {
		fields.push('tracker_source = @trackerSource');
		params.trackerSource = input.trackerSource;
	}

	if (input.trackerUrl !== undefined) {
		fields.push('tracker_url = @trackerUrl');
		params.trackerUrl = input.trackerUrl;
	}

	if (input.latestPriceDate !== undefined) {
		fields.push('latest_price_date = @latestPriceDate');
		params.latestPriceDate = input.latestPriceDate;
	}

	if (input.lastSyncedAt !== undefined) {
		fields.push('last_synced_at = @lastSyncedAt');
		params.lastSyncedAt = input.lastSyncedAt;
	}

	if (input.sortOrder !== undefined) {
		fields.push('sort_order = @sortOrder');
		params.sortOrder = input.sortOrder;
	}

	fields.push('updated_at = @updatedAt');
	params.updatedAt = nowIso();

	db.prepare(
		`UPDATE investment_holdings
		 SET ${fields.join(', ')}
		 WHERE id = @id`
	).run(params);

	return getInvestmentHoldingById(holdingId);
}

export function deleteInvestmentHolding(holdingId: string): boolean {
	ensureReady();

	const result = db.prepare(`DELETE FROM investment_holdings WHERE id = ?`).run(holdingId);
	return result.changes > 0;
}

export function createInvestmentHoldingSnapshot(input: {
	holdingId: string;
	currentValue: number;
	unitPrice: number | null;
	units: number | null;
	capturedAt?: string;
}): void {
	ensureReady();

	db.prepare(
		`INSERT INTO investment_holding_snapshots (
			id, holding_id, current_value, unit_price, units, captured_at
		) VALUES (
			@id, @holdingId, @currentValue, @unitPrice, @units, @capturedAt
		)`
	).run({
		id: randomUUID(),
		holdingId: input.holdingId,
		currentValue: input.currentValue,
		unitPrice: input.unitPrice,
		units: input.units,
		capturedAt: input.capturedAt ?? nowIso()
	});
}
