import { randomUUID } from 'node:crypto';

import db from '$lib/server/db';
import { ensureSchema } from '$lib/server/schema';
import type {
	BudgetCategory,
	CreateCategoryInput,
	CreateRecurringCostInput,
	ListRecurringCostsQuery,
	RecurringCost,
	UpdateCategoryInput,
	UpdateRecurringCostInput
} from '$lib/server/budget/types';

interface BudgetCategoryRow {
	id: string;
	name: string;
	description: string | null;
	color: string | null;
	created_at: string;
	updated_at: string;
}

interface RecurringCostRow {
	id: string;
	category_id: string;
	name: string;
	amount: number;
	period: 'weekly' | 'monthly' | 'yearly';
	kind: 'expense' | 'investment';
	is_essential: number;
	start_date: string | null;
	end_date: string | null;
	is_active: number;
	created_at: string;
	updated_at: string;
}

function ensureReady(): void {
	ensureSchema();
}

function nowIso(): string {
	return new Date().toISOString();
}

function mapCategory(row: BudgetCategoryRow): BudgetCategory {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		color: row.color,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function mapRecurringCost(row: RecurringCostRow): RecurringCost {
	return {
		id: row.id,
		categoryId: row.category_id,
		name: row.name,
		amount: row.amount,
		period: row.period,
		kind: row.kind,
		isEssential: row.is_essential === 1,
		startDate: row.start_date,
		endDate: row.end_date,
		isActive: row.is_active === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export function listCategories(): BudgetCategory[] {
	ensureReady();

	const rows = db
		.prepare(
			`SELECT id, name, description, color, created_at, updated_at
			 FROM budget_categories
			 ORDER BY name COLLATE NOCASE ASC`
		)
		.all() as BudgetCategoryRow[];

	return rows.map(mapCategory);
}

export function getCategoryById(categoryId: string): BudgetCategory | null {
	ensureReady();

	const row = db
		.prepare(
			`SELECT id, name, description, color, created_at, updated_at
			 FROM budget_categories
			 WHERE id = ?`
		)
		.get(categoryId) as BudgetCategoryRow | undefined;

	return row ? mapCategory(row) : null;
}

export function createCategory(input: CreateCategoryInput): BudgetCategory {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	db.prepare(
		`INSERT INTO budget_categories (
			id, name, description, color, created_at, updated_at
		) VALUES (
			@id, @name, @description, @color, @createdAt, @updatedAt
		)`
	).run({
		id,
		name: input.name,
		description: input.description,
		color: input.color,
		createdAt: timestamp,
		updatedAt: timestamp
	});

	const created = getCategoryById(id);
	if (!created) {
		throw new Error('Failed to read created category');
	}

	return created;
}

export function updateCategory(
	categoryId: string,
	input: UpdateCategoryInput
): BudgetCategory | null {
	ensureReady();

	if (!getCategoryById(categoryId)) {
		return null;
	}

	const fields: string[] = [];
	const params: Record<string, unknown> = {
		id: categoryId
	};

	if (input.name !== undefined) {
		fields.push('name = @name');
		params.name = input.name;
	}

	if (input.description !== undefined) {
		fields.push('description = @description');
		params.description = input.description;
	}

	if (input.color !== undefined) {
		fields.push('color = @color');
		params.color = input.color;
	}

	fields.push('updated_at = @updatedAt');
	params.updatedAt = nowIso();

	db.prepare(
		`UPDATE budget_categories
		 SET ${fields.join(', ')}
		 WHERE id = @id`
	).run(params);

	return getCategoryById(categoryId);
}

export function deleteCategory(categoryId: string): boolean {
	ensureReady();

	const result = db.prepare(`DELETE FROM budget_categories WHERE id = ?`).run(categoryId);
	return result.changes > 0;
}

export function listRecurringCosts(query: ListRecurringCostsQuery = {}): RecurringCost[] {
	ensureReady();

	const whereClauses: string[] = [];
	const params: Record<string, unknown> = {};

	if (!query.includeInactive) {
		whereClauses.push('is_active = 1');
	}

	if (query.categoryId) {
		whereClauses.push('category_id = @categoryId');
		params.categoryId = query.categoryId;
	}

	const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

	const rows = db
		.prepare(
			`SELECT id, category_id, name, amount, period, kind, is_essential, start_date, end_date, is_active, created_at, updated_at
			 FROM recurring_costs
			 ${whereSql}
			 ORDER BY created_at DESC`
		)
		.all(params) as RecurringCostRow[];

	return rows.map(mapRecurringCost);
}

export function getRecurringCostById(costId: string): RecurringCost | null {
	ensureReady();

	const row = db
		.prepare(
			`SELECT id, category_id, name, amount, period, kind, is_essential, start_date, end_date, is_active, created_at, updated_at
			 FROM recurring_costs
			 WHERE id = ?`
		)
		.get(costId) as RecurringCostRow | undefined;

	return row ? mapRecurringCost(row) : null;
}

export function createRecurringCost(input: CreateRecurringCostInput): RecurringCost {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	db.prepare(
		`INSERT INTO recurring_costs (
			id,
			category_id,
			name,
			amount,
			period,
			kind,
			is_essential,
			start_date,
			end_date,
			is_active,
			created_at,
			updated_at
		) VALUES (
			@id,
			@categoryId,
			@name,
			@amount,
			@period,
			@kind,
			@isEssential,
			@startDate,
			@endDate,
			@isActive,
			@createdAt,
			@updatedAt
		)`
	).run({
		id,
		categoryId: input.categoryId,
		name: input.name,
		amount: input.amount,
		period: input.period,
		kind: input.kind,
		isEssential: input.isEssential ? 1 : 0,
		startDate: input.startDate,
		endDate: input.endDate,
		isActive: input.isActive ? 1 : 0,
		createdAt: timestamp,
		updatedAt: timestamp
	});

	const created = getRecurringCostById(id);
	if (!created) {
		throw new Error('Failed to read created recurring cost');
	}

	return created;
}

export function updateRecurringCost(
	costId: string,
	input: UpdateRecurringCostInput
): RecurringCost | null {
	ensureReady();

	if (!getRecurringCostById(costId)) {
		return null;
	}

	const fields: string[] = [];
	const params: Record<string, unknown> = {
		id: costId
	};

	if (input.categoryId !== undefined) {
		fields.push('category_id = @categoryId');
		params.categoryId = input.categoryId;
	}

	if (input.name !== undefined) {
		fields.push('name = @name');
		params.name = input.name;
	}

	if (input.amount !== undefined) {
		fields.push('amount = @amount');
		params.amount = input.amount;
	}

	if (input.period !== undefined) {
		fields.push('period = @period');
		params.period = input.period;
	}

	if (input.kind !== undefined) {
		fields.push('kind = @kind');
		params.kind = input.kind;
	}

	if (input.isEssential !== undefined) {
		fields.push('is_essential = @isEssential');
		params.isEssential = input.isEssential ? 1 : 0;
	}

	if (input.startDate !== undefined) {
		fields.push('start_date = @startDate');
		params.startDate = input.startDate;
	}

	if (input.endDate !== undefined) {
		fields.push('end_date = @endDate');
		params.endDate = input.endDate;
	}

	if (input.isActive !== undefined) {
		fields.push('is_active = @isActive');
		params.isActive = input.isActive ? 1 : 0;
	}

	fields.push('updated_at = @updatedAt');
	params.updatedAt = nowIso();

	db.prepare(
		`UPDATE recurring_costs
		 SET ${fields.join(', ')}
		 WHERE id = @id`
	).run(params);

	return getRecurringCostById(costId);
}

export function deleteRecurringCost(costId: string): boolean {
	ensureReady();

	const result = db.prepare(`DELETE FROM recurring_costs WHERE id = ?`).run(costId);
	return result.changes > 0;
}
