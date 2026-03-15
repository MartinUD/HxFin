import { randomUUID } from 'node:crypto';

import { and, desc, eq, sql } from 'drizzle-orm';
import type {
	BudgetCategory,
	CreateCategoryInput,
	CreateRecurringCostInput,
	ListRecurringCostsQuery,
	RecurringCost,
	UpdateCategoryInput,
	UpdateRecurringCostInput,
} from '$lib/server/budget/types';
import { orm } from '$lib/server/drizzle/client';
import { budgetCategories, recurringCosts } from '$lib/server/drizzle/schema';
import { ensureSchema } from '$lib/server/schema';

type BudgetCategoryInsert = typeof budgetCategories.$inferInsert;
type RecurringCostInsert = typeof recurringCosts.$inferInsert;

function ensureReady(): void {
	ensureSchema();
}

function nowIso(): string {
	return new Date().toISOString();
}

export function listCategories(): BudgetCategory[] {
	ensureReady();

	return orm
		.select()
		.from(budgetCategories)
		.orderBy(sql`${budgetCategories.name} collate nocase asc`)
		.all();
}

export function getCategoryById(categoryId: string): BudgetCategory | null {
	ensureReady();

	const row = orm.select().from(budgetCategories).where(eq(budgetCategories.id, categoryId)).get();

	return row ?? null;
}

export function createCategory(input: CreateCategoryInput): BudgetCategory {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	orm
		.insert(budgetCategories)
		.values({
			id,
			name: input.name,
			description: input.description,
			color: input.color,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
		.run();

	const created = getCategoryById(id);
	if (!created) {
		throw new Error('Failed to read created category');
	}

	return created;
}

export function updateCategory(
	categoryId: string,
	input: UpdateCategoryInput,
): BudgetCategory | null {
	ensureReady();

	if (!getCategoryById(categoryId)) {
		return null;
	}

	const updates: Partial<BudgetCategoryInsert> = {};

	if (input.name !== undefined) {
		updates.name = input.name;
	}

	if (input.description !== undefined) {
		updates.description = input.description;
	}

	if (input.color !== undefined) {
		updates.color = input.color;
	}

	updates.updatedAt = nowIso();

	orm.update(budgetCategories).set(updates).where(eq(budgetCategories.id, categoryId)).run();

	return getCategoryById(categoryId);
}

export function deleteCategory(categoryId: string): boolean {
	ensureReady();

	if (!getCategoryById(categoryId)) {
		return false;
	}

	orm.delete(budgetCategories).where(eq(budgetCategories.id, categoryId)).run();
	return true;
}

export function listRecurringCosts(query: ListRecurringCostsQuery = {}): RecurringCost[] {
	ensureReady();

	const conditions = [];

	if (!query.includeInactive) {
		conditions.push(eq(recurringCosts.isActive, true));
	}

	if (query.categoryId) {
		conditions.push(eq(recurringCosts.categoryId, query.categoryId));
	}

	return orm
		.select()
		.from(recurringCosts)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(recurringCosts.createdAt))
		.all();
}

export function getRecurringCostById(costId: string): RecurringCost | null {
	ensureReady();

	const row = orm.select().from(recurringCosts).where(eq(recurringCosts.id, costId)).get();

	return row ?? null;
}

export function createRecurringCost(input: CreateRecurringCostInput): RecurringCost {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	orm
		.insert(recurringCosts)
		.values({
			id,
			categoryId: input.categoryId,
			name: input.name,
			amount: input.amount,
			period: input.period,
			kind: input.kind,
			isEssential: input.isEssential,
			startDate: input.startDate,
			endDate: input.endDate,
			isActive: input.isActive,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
		.run();

	const created = getRecurringCostById(id);
	if (!created) {
		throw new Error('Failed to read created recurring cost');
	}

	return created;
}

export function updateRecurringCost(
	costId: string,
	input: UpdateRecurringCostInput,
): RecurringCost | null {
	ensureReady();

	if (!getRecurringCostById(costId)) {
		return null;
	}

	const updates: Partial<RecurringCostInsert> = {};

	if (input.categoryId !== undefined) {
		updates.categoryId = input.categoryId;
	}

	if (input.name !== undefined) {
		updates.name = input.name;
	}

	if (input.amount !== undefined) {
		updates.amount = input.amount;
	}

	if (input.period !== undefined) {
		updates.period = input.period;
	}

	if (input.kind !== undefined) {
		updates.kind = input.kind;
	}

	if (input.isEssential !== undefined) {
		updates.isEssential = input.isEssential;
	}

	if (input.startDate !== undefined) {
		updates.startDate = input.startDate;
	}

	if (input.endDate !== undefined) {
		updates.endDate = input.endDate;
	}

	if (input.isActive !== undefined) {
		updates.isActive = input.isActive;
	}

	updates.updatedAt = nowIso();

	orm.update(recurringCosts).set(updates).where(eq(recurringCosts.id, costId)).run();

	return getRecurringCostById(costId);
}

export function deleteRecurringCost(costId: string): boolean {
	ensureReady();

	if (!getRecurringCostById(costId)) {
		return false;
	}

	orm.delete(recurringCosts).where(eq(recurringCosts.id, costId)).run();
	return true;
}
