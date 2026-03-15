import * as Effect from 'effect/Effect';

import { notFoundError, persistenceError, validationError } from '$lib/effect/errors';
import type {
	CreateWishlistCategoryInput,
	CreateWishlistItemInput,
	ListWishlistItemsQuery,
	UpdateWishlistCategoryInput,
	UpdateWishlistItemInput,
	WishlistFundingStrategy,
} from '$lib/schema/wishlist';
import { getLoanById } from '$lib/server/loans/repository';
import {
	createWishlistCategory,
	createWishlistItem,
	deleteWishlistCategory,
	deleteWishlistItem,
	getWishlistCategoryById,
	getWishlistItemById,
	listWishlistCategories,
	listWishlistItems,
	updateWishlistCategory,
	updateWishlistItem,
} from '$lib/server/wishlist/repository';

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
	if (value === undefined || value === null) {
		return value;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

function assertFundingLoanCombination(
	fundingStrategy: WishlistFundingStrategy,
	linkedLoanId: string | null,
): void {
	if ((fundingStrategy === 'save' || fundingStrategy === 'buy_outright') && linkedLoanId !== null) {
		throw validationError('linkedLoanId must be null when fundingStrategy does not use a loan');
	}
}

export const listWishlistItemsEffect = (query: ListWishlistItemsQuery = {}) =>
	Effect.try({
		try: () => listWishlistItems(query),
		catch: () => persistenceError('Failed to load wishlist items'),
	});

export const listWishlistCategoriesEffect = () =>
	Effect.try({
		try: () => listWishlistCategories(),
		catch: () => persistenceError('Failed to load wishlist categories'),
	});

export const createWishlistCategoryEffect = (input: CreateWishlistCategoryInput) =>
	Effect.try({
		try: () =>
			createWishlistCategory({
				name: input.name.trim(),
				description: normalizeNullableText(input.description) ?? null,
			}),
		catch: () => persistenceError('Failed to create wishlist category'),
	});

export const updateWishlistCategoryEffect = (
	categoryId: string,
	input: UpdateWishlistCategoryInput,
) =>
	Effect.try({
		try: () => {
			if (Object.keys(input).length === 0) {
				throw validationError('At least one wishlist category field must be provided');
			}

			const category = updateWishlistCategory(categoryId, {
				name: input.name?.trim(),
				description: normalizeNullableText(input.description),
			});
			if (!category) {
				throw notFoundError('Wishlist category was not found', 'WISHLIST_CATEGORY_NOT_FOUND');
			}
			return category;
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to update wishlist category'),
	});

export const deleteWishlistCategoryEffect = (categoryId: string) =>
	Effect.try({
		try: () => {
			if (!deleteWishlistCategory(categoryId)) {
				throw notFoundError('Wishlist category was not found', 'WISHLIST_CATEGORY_NOT_FOUND');
			}
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to delete wishlist category'),
	});

export const createWishlistItemEffect = (input: CreateWishlistItemInput) =>
	Effect.try({
		try: () => {
			const fundingStrategy = input.fundingStrategy ?? 'save';
			const linkedLoanId = normalizeNullableText(input.linkedLoanId) ?? null;
			const categoryId = normalizeNullableText(input.categoryId) ?? null;
			assertFundingLoanCombination(fundingStrategy, linkedLoanId);

			if (categoryId && !getWishlistCategoryById(categoryId)) {
				throw notFoundError('Wishlist category was not found', 'WISHLIST_CATEGORY_NOT_FOUND');
			}

			if (linkedLoanId && !getLoanById(linkedLoanId)) {
				throw notFoundError('Linked loan was not found', 'LOAN_NOT_FOUND');
			}

			return createWishlistItem({
				name: input.name.trim(),
				targetAmount: input.targetAmount,
				targetAmountType: input.targetAmountType ?? 'exact',
				targetDate: input.targetDate ?? null,
				priority: input.priority ?? 5,
				categoryId,
				fundingStrategy,
				linkedLoanId,
				notes: normalizeNullableText(input.notes) ?? null,
			});
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to create wishlist item'),
	});

export const updateWishlistItemEffect = (itemId: string, input: UpdateWishlistItemInput) =>
	Effect.try({
		try: () => {
			const existingItem = getWishlistItemById(itemId);
			if (!existingItem) {
				throw notFoundError('Wishlist item was not found', 'WISHLIST_ITEM_NOT_FOUND');
			}

			if (Object.keys(input).length === 0) {
				throw validationError('At least one wishlist field must be provided');
			}

			const effectiveFundingStrategy = input.fundingStrategy ?? existingItem.fundingStrategy;
			const effectiveLinkedLoanId =
				input.linkedLoanId !== undefined
					? (normalizeNullableText(input.linkedLoanId) ?? null)
					: existingItem.linkedLoanId;
			const effectiveCategoryId =
				input.categoryId !== undefined
					? (normalizeNullableText(input.categoryId) ?? null)
					: existingItem.categoryId;

			assertFundingLoanCombination(effectiveFundingStrategy, effectiveLinkedLoanId);

			if (effectiveCategoryId && !getWishlistCategoryById(effectiveCategoryId)) {
				throw notFoundError('Wishlist category was not found', 'WISHLIST_CATEGORY_NOT_FOUND');
			}

			if (effectiveLinkedLoanId && !getLoanById(effectiveLinkedLoanId)) {
				throw notFoundError('Linked loan was not found', 'LOAN_NOT_FOUND');
			}

			const item = updateWishlistItem(itemId, {
				...input,
				name: input.name?.trim(),
				categoryId:
					input.categoryId === undefined
						? undefined
						: (normalizeNullableText(input.categoryId) ?? null),
				linkedLoanId:
					input.linkedLoanId === undefined
						? undefined
						: (normalizeNullableText(input.linkedLoanId) ?? null),
				notes: input.notes === undefined ? undefined : (normalizeNullableText(input.notes) ?? null),
			});

			if (!item) {
				throw notFoundError('Wishlist item was not found', 'WISHLIST_ITEM_NOT_FOUND');
			}

			return item;
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to update wishlist item'),
	});

export const deleteWishlistItemEffect = (itemId: string) =>
	Effect.try({
		try: () => {
			if (!deleteWishlistItem(itemId)) {
				throw notFoundError('Wishlist item was not found', 'WISHLIST_ITEM_NOT_FOUND');
			}
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to delete wishlist item'),
	});
