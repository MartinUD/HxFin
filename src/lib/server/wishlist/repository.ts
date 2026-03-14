import { randomUUID } from 'node:crypto';

import { and, asc, desc, eq, sql } from 'drizzle-orm';

import { orm } from '$lib/server/drizzle/client';
import { wishlistCategories, wishlistItems } from '$lib/server/drizzle/schema';
import { ensureSchema } from '$lib/server/schema';
import type {
	CreateWishlistCategoryInput,
	ListWishlistItemsQuery,
	UpdateWishlistCategoryInput,
	UpdateWishlistItemInput,
	WishlistCategory,
	WishlistItem
} from '$lib/server/wishlist/types';

type WishlistCategoryInsert = typeof wishlistCategories.$inferInsert;
type WishlistItemInsert = typeof wishlistItems.$inferInsert;

function ensureReady(): void {
	ensureSchema();
}

function nowIso(): string {
	return new Date().toISOString();
}

export function listWishlistCategories(): WishlistCategory[] {
	ensureReady();

	return orm
		.select()
		.from(wishlistCategories)
		.orderBy(sql`${wishlistCategories.name} collate nocase asc`)
		.all();
}

export function getWishlistCategoryById(categoryId: string): WishlistCategory | null {
	ensureReady();

	const row = orm
		.select()
		.from(wishlistCategories)
		.where(eq(wishlistCategories.id, categoryId))
		.get();

	return row ?? null;
}

export function createWishlistCategory(input: CreateWishlistCategoryInput): WishlistCategory {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	orm
		.insert(wishlistCategories)
		.values({
			id,
			name: input.name,
			description: input.description,
			createdAt: timestamp,
			updatedAt: timestamp
		})
		.run();

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

	const updates: Partial<WishlistCategoryInsert> = {};

	if (input.name !== undefined) {
		updates.name = input.name;
	}

	if (input.description !== undefined) {
		updates.description = input.description;
	}

	updates.updatedAt = nowIso();

	orm
		.update(wishlistCategories)
		.set(updates)
		.where(eq(wishlistCategories.id, categoryId))
		.run();

	return getWishlistCategoryById(categoryId);
}

export function deleteWishlistCategory(categoryId: string): boolean {
	ensureReady();

	if (!getWishlistCategoryById(categoryId)) {
		return false;
	}

	orm.delete(wishlistCategories).where(eq(wishlistCategories.id, categoryId)).run();
	return true;
}

export function listWishlistItems(query: ListWishlistItemsQuery = {}): WishlistItem[] {
	ensureReady();

	const conditions = [];

	if (query.fundingStrategy) {
		conditions.push(eq(wishlistItems.fundingStrategy, query.fundingStrategy));
	}

	return orm
		.select()
		.from(wishlistItems)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(
			desc(wishlistItems.priority),
			sql`${wishlistItems.targetDate} is null`,
			asc(wishlistItems.targetDate),
			desc(wishlistItems.createdAt)
		)
		.all();
}

export function getWishlistItemById(itemId: string): WishlistItem | null {
	ensureReady();

	const row = orm.select().from(wishlistItems).where(eq(wishlistItems.id, itemId)).get();
	return row ?? null;
}

export function createWishlistItem(
	input: Omit<WishlistItem, 'id' | 'createdAt' | 'updatedAt'>
): WishlistItem {
	ensureReady();

	const id = randomUUID();
	const timestamp = nowIso();

	orm
		.insert(wishlistItems)
		.values({
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
		})
		.run();

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

	const updates: Partial<WishlistItemInsert> = {};

	if (input.name !== undefined) {
		updates.name = input.name;
	}

	if (input.targetAmount !== undefined) {
		updates.targetAmount = input.targetAmount;
	}

	if (input.targetAmountType !== undefined) {
		updates.targetAmountType = input.targetAmountType;
	}

	if (input.targetDate !== undefined) {
		updates.targetDate = input.targetDate;
	}

	if (input.categoryId !== undefined) {
		updates.categoryId = input.categoryId;
	}

	if (input.priority !== undefined) {
		updates.priority = input.priority;
	}

	if (input.fundingStrategy !== undefined) {
		updates.fundingStrategy = input.fundingStrategy;
	}

	if (input.linkedLoanId !== undefined) {
		updates.linkedLoanId = input.linkedLoanId;
	}

	if (input.notes !== undefined) {
		updates.notes = input.notes;
	}

	updates.updatedAt = nowIso();

	orm.update(wishlistItems).set(updates).where(eq(wishlistItems.id, itemId)).run();

	return getWishlistItemById(itemId);
}

export function deleteWishlistItem(itemId: string): boolean {
	ensureReady();

	if (!getWishlistItemById(itemId)) {
		return false;
	}

	orm.delete(wishlistItems).where(eq(wishlistItems.id, itemId)).run();
	return true;
}
