import { randomUUID } from 'node:crypto';

import { and, desc, eq } from 'drizzle-orm';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import { type PersistenceError, persistenceError } from '$lib/effect/errors';
import type {
	CreateRecurringCostInput,
	ListRecurringCostsQuery,
	RecurringCost,
	UpdateRecurringCostInput,
} from '$lib/schema/budget';
import { ensureReady, nowIso } from '$lib/server/budget/budget-repository-helpers';
import { orm } from '$lib/server/drizzle/client';
import { recurringCosts } from '$lib/server/drizzle/schema';

type RecurringCostInsert = typeof recurringCosts.$inferInsert;

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

function tryPersistence<A>(message: string, evaluate: () => A): Effect.Effect<A, PersistenceError> {
	return Effect.try({
		try: evaluate,
		catch: () => persistenceError(message),
	});
}

export class BudgetRecurringCostsRepository extends Context.Tag('BudgetRecurringCostsRepository')<
	BudgetRecurringCostsRepository,
	{
		readonly listRecurringCosts: (
			query?: ListRecurringCostsQuery,
		) => Effect.Effect<RecurringCost[], PersistenceError>;
		readonly getRecurringCostById: (
			costId: string,
		) => Effect.Effect<RecurringCost | null, PersistenceError>;
		readonly createRecurringCost: (
			input: CreateRecurringCostInput,
		) => Effect.Effect<RecurringCost, PersistenceError>;
		readonly updateRecurringCost: (
			costId: string,
			input: UpdateRecurringCostInput,
		) => Effect.Effect<RecurringCost | null, PersistenceError>;
		readonly deleteRecurringCost: (costId: string) => Effect.Effect<boolean, PersistenceError>;
	}
>() {
	static readonly Live = Layer.succeed(this, {
		listRecurringCosts: (query: ListRecurringCostsQuery = {}) =>
			tryPersistence('Failed to load recurring costs', () => listRecurringCosts(query)),
		getRecurringCostById: (costId: string) =>
			tryPersistence('Failed to load recurring cost', () => getRecurringCostById(costId)),
		createRecurringCost: (input: CreateRecurringCostInput) =>
			tryPersistence('Failed to create recurring cost', () => createRecurringCost(input)),
		updateRecurringCost: (costId: string, input: UpdateRecurringCostInput) =>
			tryPersistence('Failed to update recurring cost', () => updateRecurringCost(costId, input)),
		deleteRecurringCost: (costId: string) =>
			tryPersistence('Failed to delete recurring cost', () => deleteRecurringCost(costId)),
	});
}
