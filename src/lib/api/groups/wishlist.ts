import * as HttpApiEndpoint from '@effect/platform/HttpApiEndpoint';
import * as HttpApiGroup from '@effect/platform/HttpApiGroup';
import * as HttpApiSchema from '@effect/platform/HttpApiSchema';
import * as Schema from 'effect/Schema';

import {
	CreateWishlistCategoryInputSchema,
	CreateWishlistItemInputSchema,
	ListWishlistItemsQuerySchema,
	UpdateWishlistCategoryInputSchema,
	UpdateWishlistItemInputSchema,
	WishlistCategorySchema,
	WishlistItemSchema,
} from '$lib/schema/wishlist';

// Paths match the Rust handlers in
// `backend/src/routes/budget/planned_purchases/{items,categories}.rs`.
// The SvelteKit proxy forwards every `/api/budget/*` request to Rust, so
// the TS stub handlers in `$lib/server/api.ts` are unreachable by design.
// Path params use `NumberFromString` because the Rust backend uses integer
// ids (see migration 0020).
export const wishlistApiGroup = HttpApiGroup.make('wishlist')
	.add(
		HttpApiEndpoint.get('listWishlistItems', '/budget/planned-purchases')
			.setUrlParams(ListWishlistItemsQuerySchema)
			.addSuccess(Schema.Array(WishlistItemSchema)),
	)
	.add(
		HttpApiEndpoint.post('createWishlistItem', '/budget/planned-purchases')
			.setPayload(CreateWishlistItemInputSchema)
			.addSuccess(WishlistItemSchema, { status: 201 }),
	)
	.add(
		HttpApiEndpoint.patch(
			'updateWishlistItem',
		)`/budget/planned-purchases/${HttpApiSchema.param('itemId', Schema.NumberFromString)}`
			.setPayload(UpdateWishlistItemInputSchema)
			.addSuccess(WishlistItemSchema),
	)
	.add(
		HttpApiEndpoint.del(
			'deleteWishlistItem',
		)`/budget/planned-purchases/${HttpApiSchema.param('itemId', Schema.NumberFromString)}`.addSuccess(
			HttpApiSchema.NoContent,
		),
	)
	.add(
		HttpApiEndpoint.get(
			'listWishlistCategories',
			'/budget/planned-purchases/categories',
		).addSuccess(Schema.Array(WishlistCategorySchema)),
	)
	.add(
		HttpApiEndpoint.post('createWishlistCategory', '/budget/planned-purchases/categories')
			.setPayload(CreateWishlistCategoryInputSchema)
			.addSuccess(WishlistCategorySchema, { status: 201 }),
	)
	.add(
		HttpApiEndpoint.patch(
			'updateWishlistCategory',
		)`/budget/planned-purchases/categories/${HttpApiSchema.param('categoryId', Schema.NumberFromString)}`
			.setPayload(UpdateWishlistCategoryInputSchema)
			.addSuccess(WishlistCategorySchema),
	)
	.add(
		HttpApiEndpoint.del(
			'deleteWishlistCategory',
		)`/budget/planned-purchases/categories/${HttpApiSchema.param('categoryId', Schema.NumberFromString)}`.addSuccess(
			HttpApiSchema.NoContent,
		),
	);
