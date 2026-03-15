import { randomUUID } from 'node:crypto';

import { eq, sql } from 'drizzle-orm';
import type { BudgetCategory, CreateCategoryInput, UpdateCategoryInput } from '$lib/schema/budget';
import { orm } from '$lib/server/drizzle/client';
import { budgetCategories } from '$lib/server/drizzle/schema';
import { ensureReady, nowIso } from '$lib/server/budget/budget-repository-helpers';

type BudgetCategoryInsert = typeof budgetCategories.$inferInsert;

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
