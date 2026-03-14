export type WishlistFundingStrategy = 'save' | 'loan' | 'mixed' | 'buy_outright';
export type WishlistTargetAmountType = 'exact' | 'estimate';

export interface WishlistCategory {
	id: string;
	name: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface WishlistItem {
	id: string;
	name: string;
	targetAmount: number;
	targetDate: string | null;
	targetAmountType: WishlistTargetAmountType;
	priority: number;
	categoryId: string | null;
	fundingStrategy: WishlistFundingStrategy;
	linkedLoanId: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateWishlistCategoryInput {
	name: string;
	description: string | null;
}

export interface UpdateWishlistCategoryInput {
	name?: string;
	description?: string | null;
}

export interface CreateWishlistItemInput {
	name: string;
	targetAmount: number;
	targetDate: string | null;
	targetAmountType: WishlistTargetAmountType;
	priority: number;
	categoryId: string | null;
	fundingStrategy: WishlistFundingStrategy;
	linkedLoanId: string | null;
	notes: string | null;
}

export interface UpdateWishlistItemInput {
	name?: string;
	targetAmount?: number;
	targetDate?: string | null;
	targetAmountType?: WishlistTargetAmountType;
	priority?: number;
	categoryId?: string | null;
	fundingStrategy?: WishlistFundingStrategy;
	linkedLoanId?: string | null;
	notes?: string | null;
}

export interface ListWishlistItemsQuery {
	fundingStrategy?: WishlistFundingStrategy;
}
