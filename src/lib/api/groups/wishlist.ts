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
	WishlistItemSchema
} from '$lib/schema/wishlist';

export const wishlistApiGroup = HttpApiGroup.make('wishlist')
	.add(
		HttpApiEndpoint.get('listWishlistItems', '/wishlist')
			.setUrlParams(ListWishlistItemsQuerySchema)
			.addSuccess(Schema.Array(WishlistItemSchema))
	)
	.add(
		HttpApiEndpoint.post('createWishlistItem', '/wishlist')
			.setPayload(CreateWishlistItemInputSchema)
			.addSuccess(WishlistItemSchema, { status: 201 })
	)
	.add(
		HttpApiEndpoint.patch('updateWishlistItem')`/wishlist/${HttpApiSchema.param('itemId', Schema.String)}`
			.setPayload(UpdateWishlistItemInputSchema)
			.addSuccess(WishlistItemSchema)
	)
	.add(
		HttpApiEndpoint.del('deleteWishlistItem')`/wishlist/${HttpApiSchema.param('itemId', Schema.String)}`
			.addSuccess(HttpApiSchema.NoContent)
	)
	.add(HttpApiEndpoint.get('listWishlistCategories', '/wishlist/categories').addSuccess(Schema.Array(WishlistCategorySchema)))
	.add(
		HttpApiEndpoint.post('createWishlistCategory', '/wishlist/categories')
			.setPayload(CreateWishlistCategoryInputSchema)
			.addSuccess(WishlistCategorySchema, { status: 201 })
	)
	.add(
		HttpApiEndpoint.patch('updateWishlistCategory')`/wishlist/categories/${HttpApiSchema.param('categoryId', Schema.String)}`
			.setPayload(UpdateWishlistCategoryInputSchema)
			.addSuccess(WishlistCategorySchema)
	)
	.add(
		HttpApiEndpoint.del('deleteWishlistCategory')`/wishlist/categories/${HttpApiSchema.param('categoryId', Schema.String)}`
			.addSuccess(HttpApiSchema.NoContent)
	);
