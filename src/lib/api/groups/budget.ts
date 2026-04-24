import * as HttpApiEndpoint from '@effect/platform/HttpApiEndpoint';
import * as HttpApiGroup from '@effect/platform/HttpApiGroup';
import * as HttpApiSchema from '@effect/platform/HttpApiSchema';
import * as Schema from 'effect/Schema';

import {
	BudgetCategorySchema,
	BudgetSummarySchema,
	CreateCategoryInputSchema,
	CreateRecurringCostInputSchema,
	ListRecurringCostsQuerySchema,
	RecurringCostSchema,
	SummaryQuerySchema,
	UpdateCategoryInputSchema,
	UpdateRecurringCostInputSchema,
} from '$lib/schema/budget';

export const budgetApiGroup = HttpApiGroup.make('budget')
	.add(
		HttpApiEndpoint.get('listBudgetCategories', '/budget/categories').addSuccess(
			Schema.Array(BudgetCategorySchema),
		),
	)
	.add(
		HttpApiEndpoint.post('createBudgetCategory', '/budget/categories')
			.setPayload(CreateCategoryInputSchema)
			.addSuccess(BudgetCategorySchema, { status: 201 }),
	)
	.add(
		HttpApiEndpoint.patch(
			'updateBudgetCategory',
		)`/budget/categories/${HttpApiSchema.param('categoryId', Schema.NumberFromString)}`
			.setPayload(UpdateCategoryInputSchema)
			.addSuccess(BudgetCategorySchema),
	)
	.add(
		HttpApiEndpoint.del(
			'deleteBudgetCategory',
		)`/budget/categories/${HttpApiSchema.param('categoryId', Schema.NumberFromString)}`.addSuccess(
			HttpApiSchema.NoContent,
		),
	)
	.add(
		HttpApiEndpoint.get('listRecurringCosts', '/budget/costs')
			.setUrlParams(ListRecurringCostsQuerySchema)
			.addSuccess(Schema.Array(RecurringCostSchema)),
	)
	.add(
		HttpApiEndpoint.post('createRecurringCost', '/budget/costs')
			.setPayload(CreateRecurringCostInputSchema)
			.addSuccess(RecurringCostSchema, { status: 201 }),
	)
	.add(
		HttpApiEndpoint.patch(
			'updateRecurringCost',
		)`/budget/costs/${HttpApiSchema.param('costId', Schema.NumberFromString)}`
			.setPayload(UpdateRecurringCostInputSchema)
			.addSuccess(RecurringCostSchema),
	)
	.add(
		HttpApiEndpoint.del(
			'deleteRecurringCost',
		)`/budget/costs/${HttpApiSchema.param('costId', Schema.NumberFromString)}`.addSuccess(
			HttpApiSchema.NoContent,
		),
	)
	.add(
		HttpApiEndpoint.get('getBudgetSummary', '/budget/summary')
			.setUrlParams(SummaryQuerySchema)
			.addSuccess(BudgetSummarySchema),
	);
