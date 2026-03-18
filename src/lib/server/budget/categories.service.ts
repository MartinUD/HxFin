import * as Effect from 'effect/Effect';

import { notFoundError, validationError } from '$lib/effect/errors';
import type { CreateCategoryInput, UpdateCategoryInput } from '$lib/schema/budget';
import { BudgetCategoriesRepository } from '$lib/server/budget/categories.repository';

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
	if (value === undefined || value === null) {
		return value;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export const listCategoriesEffect = () =>
	Effect.gen(function* () {
		const repository = yield* BudgetCategoriesRepository;
		return yield* repository.listCategories();
	});

export const createCategoryEffect = (input: CreateCategoryInput) =>
	Effect.gen(function* () {
		const repository = yield* BudgetCategoriesRepository;

		return yield* repository.createCategory({
			name: input.name.trim(),
			description: normalizeNullableText(input.description) ?? null,
			color: normalizeNullableText(input.color) ?? null,
		});
	});

export const updateCategoryEffect = (categoryId: string, input: UpdateCategoryInput) =>
	Effect.gen(function* () {
		const repository = yield* BudgetCategoriesRepository;
		const existing = yield* repository.getCategoryById(categoryId);

		if (!existing) {
			return yield* Effect.fail(
				notFoundError('Budget category was not found', 'CATEGORY_NOT_FOUND'),
			);
		}

		if (Object.keys(input).length === 0) {
			return yield* Effect.fail(validationError('At least one category field must be provided'));
		}

		const category = yield* repository.updateCategory(categoryId, {
			name: input.name?.trim(),
			description: normalizeNullableText(input.description),
			color: normalizeNullableText(input.color),
		});

		if (!category) {
			return yield* Effect.fail(
				notFoundError('Budget category was not found', 'CATEGORY_NOT_FOUND'),
			);
		}

		return category;
	});

export const deleteCategoryEffect = (categoryId: string) =>
	Effect.gen(function* () {
		const repository = yield* BudgetCategoriesRepository;
		const deleted = yield* repository.deleteCategory(categoryId);

		if (!deleted) {
			return yield* Effect.fail(
				notFoundError('Budget category was not found', 'CATEGORY_NOT_FOUND'),
			);
		}
	});
