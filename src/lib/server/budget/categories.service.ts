import * as Effect from 'effect/Effect';

import { notFoundError, persistenceError, validationError } from '$lib/effect/errors';
import type { CreateCategoryInput, UpdateCategoryInput } from '$lib/schema/budget';
import {
	createCategory as createCategoryRow,
	deleteCategory as deleteCategoryRow,
	getCategoryById,
	listCategories,
	updateCategory as updateCategoryRow,
} from '$lib/server/budget/categories.repository';

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
	if (value === undefined || value === null) {
		return value;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export const listCategoriesEffect = () =>
	Effect.try({
		try: () => listCategories(),
		catch: () => persistenceError('Failed to load budget categories'),
	});

export const createCategoryEffect = (input: CreateCategoryInput) =>
	Effect.try({
		try: () =>
			createCategoryRow({
				name: input.name.trim(),
				description: normalizeNullableText(input.description) ?? null,
				color: normalizeNullableText(input.color) ?? null,
			}),
		catch: () => persistenceError('Failed to create budget category'),
	});

export const updateCategoryEffect = (categoryId: string, input: UpdateCategoryInput) =>
	Effect.try({
		try: () => {
			if (!getCategoryById(categoryId)) {
				throw notFoundError('Budget category was not found', 'CATEGORY_NOT_FOUND');
			}

			if (Object.keys(input).length === 0) {
				throw validationError('At least one category field must be provided');
			}

			const category = updateCategoryRow(categoryId, {
				name: input.name?.trim(),
				description: normalizeNullableText(input.description),
				color: normalizeNullableText(input.color),
			});

			if (!category) {
				throw notFoundError('Budget category was not found', 'CATEGORY_NOT_FOUND');
			}

			return category;
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to update budget category'),
	});

export const deleteCategoryEffect = (categoryId: string) =>
	Effect.try({
		try: () => {
			if (!deleteCategoryRow(categoryId)) {
				throw notFoundError('Budget category was not found', 'CATEGORY_NOT_FOUND');
			}
		},
		catch: (error) =>
			error && typeof error === 'object' && '_tag' in error
				? (error as never)
				: persistenceError('Failed to delete budget category'),
	});
