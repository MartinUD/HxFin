import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder';
import * as BunHttpServer from '@effect/platform-bun/BunHttpServer';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import { FinApi } from '$lib/api/definition';
import {
	buildBudgetSummaryEffect,
	createCategoryEffect,
	createRecurringCostEffect,
	deleteCategoryEffect,
	deleteRecurringCostEffect,
	listCategoriesEffect,
	listRecurringCostsEffect,
	updateCategoryEffect,
	updateRecurringCostEffect,
} from '$lib/server/budget/service';
import {
	getFinancialProfileEffect,
	updateFinancialProfileEffect,
} from '$lib/server/finance/service';
import {
	assignTransactionCategoryEffect,
	listImportBatchesEffect,
	listReviewTransactionsEffect,
	uploadImportCsvEffect,
} from '$lib/server/imports/service';
import {
	createInvestmentAccountEffect,
	createInvestmentHoldingEffect,
	deleteInvestmentAccountEffect,
	deleteInvestmentHoldingEffect,
	listInvestmentAccountsEffect,
	listInvestmentHoldingsEffect,
	refreshTrackedInvestmentHoldingsEffect,
	updateInvestmentAccountEffect,
	updateInvestmentHoldingEffect,
} from '$lib/server/investments/service';
import {
	createLoanEffect,
	deleteLoanEffect,
	listLoansEffect,
	updateLoanEffect,
} from '$lib/server/loans/service';
import {
	createWishlistCategoryEffect,
	createWishlistItemEffect,
	deleteWishlistCategoryEffect,
	deleteWishlistItemEffect,
	listWishlistCategoriesEffect,
	listWishlistItemsEffect,
	updateWishlistCategoryEffect,
	updateWishlistItemEffect,
} from '$lib/server/wishlist/service';

const financeHandlers = HttpApiBuilder.group(FinApi, 'finance', (handlers) =>
	handlers
		.handle('getFinancialProfile', () => getFinancialProfileEffect())
		.handle('updateFinancialProfile', ({ payload }) => updateFinancialProfileEffect(payload)),
);

const budgetHandlers = HttpApiBuilder.group(FinApi, 'budget', (handlers) =>
	handlers
		.handle('listBudgetCategories', () => listCategoriesEffect())
		.handle('createBudgetCategory', ({ payload }) => createCategoryEffect(payload))
		.handle('updateBudgetCategory', ({ path, payload }) =>
			updateCategoryEffect(path.categoryId, payload),
		)
		.handle('deleteBudgetCategory', ({ path }) =>
			deleteCategoryEffect(path.categoryId).pipe(Effect.asVoid),
		)
		.handle('listRecurringCosts', ({ urlParams }) => listRecurringCostsEffect(urlParams ?? {}))
		.handle('createRecurringCost', ({ payload }) => createRecurringCostEffect(payload))
		.handle('updateRecurringCost', ({ path, payload }) =>
			updateRecurringCostEffect(path.costId, payload),
		)
		.handle('deleteRecurringCost', ({ path }) =>
			deleteRecurringCostEffect(path.costId).pipe(Effect.asVoid),
		)
		.handle('getBudgetSummary', ({ urlParams }) => buildBudgetSummaryEffect(urlParams ?? {})),
);

const loansHandlers = HttpApiBuilder.group(FinApi, 'loans', (handlers) =>
	handlers
		.handle('listLoans', ({ urlParams }) => listLoansEffect(urlParams ?? {}))
		.handle('createLoan', ({ payload }) => createLoanEffect(payload))
		.handle('updateLoan', ({ path, payload }) => updateLoanEffect(path.loanId, payload))
		.handle('deleteLoan', ({ path }) => deleteLoanEffect(path.loanId).pipe(Effect.asVoid)),
);

const wishlistHandlers = HttpApiBuilder.group(FinApi, 'wishlist', (handlers) =>
	handlers
		.handle('listWishlistItems', ({ urlParams }) => listWishlistItemsEffect(urlParams ?? {}))
		.handle('createWishlistItem', ({ payload }) => createWishlistItemEffect(payload))
		.handle('updateWishlistItem', ({ path, payload }) =>
			updateWishlistItemEffect(path.itemId, payload),
		)
		.handle('deleteWishlistItem', ({ path }) =>
			deleteWishlistItemEffect(path.itemId).pipe(Effect.asVoid),
		)
		.handle('listWishlistCategories', () => listWishlistCategoriesEffect())
		.handle('createWishlistCategory', ({ payload }) => createWishlistCategoryEffect(payload))
		.handle('updateWishlistCategory', ({ path, payload }) =>
			updateWishlistCategoryEffect(path.categoryId, payload),
		)
		.handle('deleteWishlistCategory', ({ path }) =>
			deleteWishlistCategoryEffect(path.categoryId).pipe(Effect.asVoid),
		),
);

const importsHandlers = HttpApiBuilder.group(FinApi, 'imports', (handlers) =>
	handlers
		.handle('listImportBatches', ({ urlParams }) => listImportBatchesEffect(urlParams ?? {}))
		.handle('listReviewTransactions', ({ urlParams }) =>
			listReviewTransactionsEffect(urlParams ?? {}),
		)
		.handle('uploadImportCsv', ({ payload }) => uploadImportCsvEffect(payload))
		.handle('assignImportTransactionCategory', ({ path, payload }) =>
			assignTransactionCategoryEffect(path.transactionId, payload),
		),
);

const investmentsHandlers = HttpApiBuilder.group(FinApi, 'investments', (handlers) =>
	handlers
		.handle('listInvestmentAccounts', () => listInvestmentAccountsEffect())
		.handle('createInvestmentAccount', ({ payload }) => createInvestmentAccountEffect(payload))
		.handle('updateInvestmentAccount', ({ path, payload }) =>
			updateInvestmentAccountEffect(path.accountId, payload),
		)
		.handle('deleteInvestmentAccount', ({ path }) =>
			deleteInvestmentAccountEffect(path.accountId).pipe(Effect.asVoid),
		)
		.handle('listInvestmentHoldings', ({ urlParams }) =>
			listInvestmentHoldingsEffect(urlParams ?? {}),
		)
		.handle('createInvestmentHolding', ({ payload }) => createInvestmentHoldingEffect(payload))
		.handle('updateInvestmentHolding', ({ path, payload }) =>
			updateInvestmentHoldingEffect(path.holdingId, payload),
		)
		.handle('deleteInvestmentHolding', ({ path }) =>
			deleteInvestmentHoldingEffect(path.holdingId).pipe(Effect.asVoid),
		)
		.handle('refreshTrackedInvestmentHoldings', () => refreshTrackedInvestmentHoldingsEffect()),
);

const handlerLayer = Layer.mergeAll(
	financeHandlers,
	budgetHandlers,
	loansHandlers,
	wishlistHandlers,
	importsHandlers,
	investmentsHandlers,
);

const apiLayer = HttpApiBuilder.api(FinApi).pipe(Layer.provide(handlerLayer));

const webHandlerLayer = Layer.mergeAll(apiLayer, BunHttpServer.layerContext);

let cachedHandler:
	| Promise<{
			handler: (request: Request) => Promise<Response>;
			dispose: () => Promise<void>;
	  }>
	| undefined;

function getHandler() {
	if (!cachedHandler) {
		cachedHandler = Promise.resolve(HttpApiBuilder.toWebHandler(webHandlerLayer));
	}

	return cachedHandler;
}

export async function handleApiRequest(request: Request): Promise<Response> {
	const web = await getHandler();
	return web.handler(request);
}
