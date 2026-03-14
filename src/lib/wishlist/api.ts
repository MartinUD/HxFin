import { requestJson, type ApiFetcher } from '$lib/api/http';
import type {
	CreateWishlistCategoryInput,
	CreateWishlistItemInput,
	UpdateWishlistCategoryInput,
	UpdateWishlistItemInput,
	WishlistCategory,
	WishlistFundingStrategy,
	WishlistItem
} from '$lib/contracts/wishlist';

export type { WishlistItem };

export interface WishlistApiClient {
	fetchCategories(): Promise<WishlistCategory[]>;
	createCategory(input: CreateWishlistCategoryInput): Promise<WishlistCategory>;
	updateCategory(id: string, input: UpdateWishlistCategoryInput): Promise<WishlistCategory>;
	deleteCategory(id: string): Promise<void>;
	fetchItems(query?: { fundingStrategy?: WishlistFundingStrategy }): Promise<WishlistItem[]>;
	createItem(input: CreateWishlistItemInput): Promise<WishlistItem>;
	updateItem(id: string, input: UpdateWishlistItemInput): Promise<WishlistItem>;
	deleteItem(id: string): Promise<void>;
}

export function createWishlistApi(fetcher: ApiFetcher): WishlistApiClient {
	return {
		async fetchCategories(): Promise<WishlistCategory[]> {
			const data = await requestJson<{ categories: WishlistCategory[] }>(fetcher, '/api/wishlist/categories');
			return data.categories;
		},
		async createCategory(input: CreateWishlistCategoryInput): Promise<WishlistCategory> {
			const data = await requestJson<{ category: WishlistCategory }>(fetcher, '/api/wishlist/categories', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			return data.category;
		},
		async updateCategory(id: string, input: UpdateWishlistCategoryInput): Promise<WishlistCategory> {
			const data = await requestJson<{ category: WishlistCategory }>(fetcher, `/api/wishlist/categories/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			return data.category;
		},
		async deleteCategory(id: string): Promise<void> {
			await requestJson<void>(fetcher, `/api/wishlist/categories/${id}`, { method: 'DELETE' });
		},
		async fetchItems(query): Promise<WishlistItem[]> {
			const params = new URLSearchParams();
			if (query?.fundingStrategy) {
				params.set('fundingStrategy', query.fundingStrategy);
			}

			const qs = params.toString();
			const data = await requestJson<{ items: WishlistItem[] }>(
				fetcher,
				`/api/wishlist${qs ? `?${qs}` : ''}`
			);
			return data.items;
		},
		async createItem(input: CreateWishlistItemInput): Promise<WishlistItem> {
			const data = await requestJson<{ item: WishlistItem }>(fetcher, '/api/wishlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			return data.item;
		},
		async updateItem(id: string, input: UpdateWishlistItemInput): Promise<WishlistItem> {
			const data = await requestJson<{ item: WishlistItem }>(fetcher, `/api/wishlist/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			return data.item;
		},
		async deleteItem(id: string): Promise<void> {
			await requestJson<void>(fetcher, `/api/wishlist/${id}`, {
				method: 'DELETE'
			});
		}
	};
}

const defaultClient = createWishlistApi((input, init) => fetch(input, init));

export const fetchWishlistCategories = () => defaultClient.fetchCategories();
export const createWishlistCategory = (input: CreateWishlistCategoryInput) => defaultClient.createCategory(input);
export const updateWishlistCategory = (id: string, input: UpdateWishlistCategoryInput) =>
	defaultClient.updateCategory(id, input);
export const deleteWishlistCategory = (id: string) => defaultClient.deleteCategory(id);
export const fetchWishlistItems = (query?: { fundingStrategy?: WishlistFundingStrategy }) =>
	defaultClient.fetchItems(query);
export const createWishlistItem = (input: CreateWishlistItemInput) => defaultClient.createItem(input);
export const updateWishlistItem = (id: string, input: UpdateWishlistItemInput) =>
	defaultClient.updateItem(id, input);
export const deleteWishlistItem = (id: string) => defaultClient.deleteItem(id);
