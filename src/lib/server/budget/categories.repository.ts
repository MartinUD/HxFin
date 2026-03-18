import { randomUUID } from 'node:crypto';

import { eq, sql } from 'drizzle-orm';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import { type PersistenceError, persistenceError } from '$lib/effect/errors';
import type { BudgetCategory, CreateCategoryInput, UpdateCategoryInput } from '$lib/schema/budget';
import { ensureReady, nowIso } from '$lib/server/budget/budget-repository-helpers';
import { orm } from '$lib/server/drizzle/client';
import { budgetCategories } from '$lib/server/drizzle/schema';

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

function tryPersistence<A>(message: string, evaluate: () => A): Effect.Effect<A, PersistenceError> {
	return Effect.try({
		try: evaluate,
		catch: () => persistenceError(message),
	});
}

export class BudgetCategoriesRepository extends Context.Tag('BudgetCategoriesRepository')<
	BudgetCategoriesRepository,
	{
		readonly listCategories: () => Effect.Effect<BudgetCategory[], PersistenceError>;
		readonly getCategoryById: (
			categoryId: string,
		) => Effect.Effect<BudgetCategory | null, PersistenceError>;
		readonly createCategory: (
			input: CreateCategoryInput,
		) => Effect.Effect<BudgetCategory, PersistenceError>;
		readonly updateCategory: (
			categoryId: string,
			input: UpdateCategoryInput,
		) => Effect.Effect<BudgetCategory | null, PersistenceError>;
		readonly deleteCategory: (categoryId: string) => Effect.Effect<boolean, PersistenceError>;
	}
>() {
	static readonly Live = Layer.succeed(this, {
		listCategories: () =>
			tryPersistence('Failed to load budget categories', () => listCategories()),
		getCategoryById: (categoryId: string) =>
			tryPersistence('Failed to load budget category', () => getCategoryById(categoryId)),
		createCategory: (input: CreateCategoryInput) =>
			tryPersistence('Failed to create budget category', () => createCategory(input)),
		updateCategory: (categoryId: string, input: UpdateCategoryInput) =>
			tryPersistence('Failed to update budget category', () => updateCategory(categoryId, input)),
		deleteCategory: (categoryId: string) =>
			tryPersistence('Failed to delete budget category', () => deleteCategory(categoryId)),
	});
}
