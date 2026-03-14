import { randomUUID } from 'node:crypto';

import db from '$lib/server/db';
import { ensureSchema } from '$lib/server/schema';
import type {
	CreateWishlistCategoryInput,
	CreateWishlistItemInput,
	ListWishlistItemsQuery,
	UpdateWishlistCategoryInput,
	UpdateWishlistItemInput,
	WishlistCategory,
	WishlistItem
} from '$lib/server/wishlist/types';

interface WishlistCategoryRow {
	id: string;
	name: string;
	description: string | null;
	created_at: string;
	updated_at: string;
}

interface WishlistItemRow {
	id: string;
	name: string;
	target_amount: number;
	target_amount_type: 'exact' | 'estimate';
	target_date: string | null;
	priority: number;
	category_id: string | null;
	funding_strategy: 'save' | 'loan' | 'mixed' | 'buy_outright';
	linked_loan_id: string | null;
	currency: string;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

function ensureReady(): void {
	ensureSchema();
}

function nowIso(): string {
	return new Date().toISOString();
}

function mapWishlistCategory(row: WishlistCategoryRow): WishlistCategory {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function mapWishlistItem(row: WishlistItemRow): WishlistItem {
	return {
		id: row.id,
		name: row.name,
		targetAmount: row.target_amount,
		targetAmountType: row.target_amount_type,
		targetDate: row.target_date,
		priority: row.priority,
		categoryId: row.category_id,
		fundingStrategy: row.funding_strategy,
		linkedLoanId: row.linked_loan_id,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export function listWishlistCategories(): WishlistCategory[] {
	ensureReady();

	const rows = db
		.prepare(
			`SELECT id, name, description, created_at, updated_at
			 FROM wishlist_categories
			 ORDER BY name COLLATE NOCASE ASC`
		)
		.all() as WishlistCategoryRow[];

	return rows.map(mapWishlistCategory);
}

export function getWishlistCategoryById(categoryId: string): WishlistCategory | null {
	ensureReady();

	const row = db
		.prepare(
			`SELECT id, name, description, created_at, updated_at
			 FROM wishlist_categories
			 WHERE id = ?`
		)
		.get(categoryId) as WishlistCategoryRow | undefined;

	return row ? mapWishlistCategory(row) : null;
}

export function createWishlistCategory(input: CreateWishlistCategoryInput): WishlistCategory {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	db.prepare(
		`INSERT INTO wishlist_categories (
			id, name, description, created_at, updated_at
		) VALUES (
			@id, @name, @description, @createdAt, @updatedAt
		)`
	).run({
		id,
		name: input.name,
		description: input.description,
		createdAt: timestamp,
		updatedAt: timestamp
	});

	const created = getWishlistCategoryById(id);
	if (!created) {
		throw new Error('Failed to read created wishlist category');
	}

	return created;
}

export function updateWishlistCategory(
	categoryId: string,
	input: UpdateWishlistCategoryInput
): WishlistCategory | null {
	ensureReady();

	if (!getWishlistCategoryById(categoryId)) {
		return null;
	}

	const fields: string[] = [];
	const params: Record<string, unknown> = { id: categoryId };

	if (input.name !== undefined) {
		fields.push('name = @name');
		params.name = input.name;
	}

	if (input.description !== undefined) {
		fields.push('description = @description');
		params.description = input.description;
	}

	fields.push('updated_at = @updatedAt');
	params.updatedAt = nowIso();

	db.prepare(
		`UPDATE wishlist_categories
		 SET ${fields.join(', ')}
		 WHERE id = @id`
	).run(params);

	return getWishlistCategoryById(categoryId);
}

export function deleteWishlistCategory(categoryId: string): boolean {
	ensureReady();

	const result = db.prepare(`DELETE FROM wishlist_categories WHERE id = ?`).run(categoryId);
	return result.changes > 0;
}

export function listWishlistItems(query: ListWishlistItemsQuery = {}): WishlistItem[] {
	ensureReady();

	const whereClauses: string[] = [];
	const params: Record<string, unknown> = {};

	if (query.fundingStrategy) {
		whereClauses.push('funding_strategy = @fundingStrategy');
		params.fundingStrategy = query.fundingStrategy;
	}

	const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

	const rows = db
		.prepare(
			`SELECT
				id,
				name,
				target_amount,
				target_amount_type,
				target_date,
				priority,
				category_id,
				funding_strategy,
				linked_loan_id,
				currency,
				notes,
				created_at,
				updated_at
			FROM wishlist_items
			${whereSql}
			ORDER BY
				priority DESC,
				target_date IS NULL ASC,
				target_date ASC,
				created_at DESC`
		)
		.all(params) as WishlistItemRow[];

	return rows.map(mapWishlistItem);
}

export function getWishlistItemById(itemId: string): WishlistItem | null {
	ensureReady();

	const row = db
		.prepare(
			`SELECT
				id,
				name,
				target_amount,
				target_amount_type,
				target_date,
				priority,
				category_id,
				funding_strategy,
				linked_loan_id,
				currency,
				notes,
				created_at,
				updated_at
			FROM wishlist_items
			WHERE id = ?`
		)
		.get(itemId) as WishlistItemRow | undefined;

	return row ? mapWishlistItem(row) : null;
}

export function createWishlistItem(input: CreateWishlistItemInput): WishlistItem {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	db.prepare(
		`INSERT INTO wishlist_items (
			id,
			name,
			target_amount,
			target_amount_type,
			target_date,
			priority,
			category_id,
			funding_strategy,
			linked_loan_id,
			currency,
			notes,
			created_at,
			updated_at
		) VALUES (
			@id,
			@name,
			@targetAmount,
			@targetAmountType,
			@targetDate,
			@priority,
			@categoryId,
			@fundingStrategy,
			@linkedLoanId,
			@currency,
			@notes,
			@createdAt,
			@updatedAt
		)`
	).run({
		id,
		name: input.name,
		targetAmount: input.targetAmount,
		targetAmountType: input.targetAmountType,
		targetDate: input.targetDate,
		priority: input.priority,
		categoryId: input.categoryId,
		fundingStrategy: input.fundingStrategy,
		linkedLoanId: input.linkedLoanId,
		currency: 'SEK',
		notes: input.notes,
		createdAt: timestamp,
		updatedAt: timestamp
	});

	const created = getWishlistItemById(id);
	if (!created) {
		throw new Error('Failed to read created wishlist item');
	}

	return created;
}

export function updateWishlistItem(
	itemId: string,
	input: UpdateWishlistItemInput
): WishlistItem | null {
	ensureReady();

	if (!getWishlistItemById(itemId)) {
		return null;
	}

	const fields: string[] = [];
	const params: Record<string, unknown> = { id: itemId };

	if (input.name !== undefined) {
		fields.push('name = @name');
		params.name = input.name;
	}

	if (input.targetAmount !== undefined) {
		fields.push('target_amount = @targetAmount');
		params.targetAmount = input.targetAmount;
	}

	if (input.targetAmountType !== undefined) {
		fields.push('target_amount_type = @targetAmountType');
		params.targetAmountType = input.targetAmountType;
	}

	if (input.targetDate !== undefined) {
		fields.push('target_date = @targetDate');
		params.targetDate = input.targetDate;
	}

	if (input.categoryId !== undefined) {
		fields.push('category_id = @categoryId');
		params.categoryId = input.categoryId;
	}

	if (input.priority !== undefined) {
		fields.push('priority = @priority');
		params.priority = input.priority;
	}

	if (input.fundingStrategy !== undefined) {
		fields.push('funding_strategy = @fundingStrategy');
		params.fundingStrategy = input.fundingStrategy;
	}

	if (input.linkedLoanId !== undefined) {
		fields.push('linked_loan_id = @linkedLoanId');
		params.linkedLoanId = input.linkedLoanId;
	}

	if (input.notes !== undefined) {
		fields.push('notes = @notes');
		params.notes = input.notes;
	}

	fields.push('updated_at = @updatedAt');
	params.updatedAt = nowIso();

	db.prepare(
		`UPDATE wishlist_items
		 SET ${fields.join(', ')}
		 WHERE id = @id`
	).run(params);

	return getWishlistItemById(itemId);
}

export function deleteWishlistItem(itemId: string): boolean {
	ensureReady();

	const result = db.prepare(`DELETE FROM wishlist_items WHERE id = ?`).run(itemId);
	return result.changes > 0;
}
