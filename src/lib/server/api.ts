import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder';
import * as BunHttpServer from '@effect/platform-bun/BunHttpServer';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import { FinApi } from '$lib/api/definition';
import {
	assignTransactionCategoryEffect,
	listImportBatchesEffect,
	listImportTransactionsEffect,
	listReviewTransactionsEffect,
	reprocessImportTransactionsEffect,
	suggestTransactionCategoryWithAiEffect,
	uploadImportCsvEffect,
} from '$lib/server/imports/service';
// The `budget`, `wishlist`, `finance`, `loans`, and `investments` API groups are now
// served by the Rust backend (see `backend/src/routes/...`). The SvelteKit
// proxy in `src/routes/api/[...path]/+server.ts` forwards their paths to
// Rust before `handleApiRequest` runs, so the stub handlers below are
// unreachable by design. They exist only to satisfy the FinApi type
// contract (which still declares these groups for the typed client). If a
// request ever reaches one it means the proxy regressed — fail loudly.
const unreachable = (name: string) =>
	Effect.die(
		`Handler ${name} is served by the Rust backend; the SvelteKit proxy should have forwarded this request. Check src/routes/api/[...path]/+server.ts.`,
	);

const financeHandlers = HttpApiBuilder.group(FinApi, 'finance', (handlers) =>
	handlers
		.handle('getFinancialProfile', () => unreachable('getFinancialProfile'))
		.handle('updateFinancialProfile', () => unreachable('updateFinancialProfile')),
);

const budgetHandlers = HttpApiBuilder.group(FinApi, 'budget', (handlers) =>
	handlers
		.handle('listBudgetCategories', () => unreachable('listBudgetCategories'))
		.handle('createBudgetCategory', () => unreachable('createBudgetCategory'))
		.handle('updateBudgetCategory', () => unreachable('updateBudgetCategory'))
		.handle('deleteBudgetCategory', () => unreachable('deleteBudgetCategory'))
		.handle('listRecurringCosts', () => unreachable('listRecurringCosts'))
		.handle('createRecurringCost', () => unreachable('createRecurringCost'))
		.handle('updateRecurringCost', () => unreachable('updateRecurringCost'))
		.handle('deleteRecurringCost', () => unreachable('deleteRecurringCost'))
		.handle('getBudgetSummary', () => unreachable('getBudgetSummary')),
);

const loansHandlers = HttpApiBuilder.group(FinApi, 'loans', (handlers) =>
	handlers
		.handle('listLoans', () => unreachable('listLoans'))
		.handle('createLoan', () => unreachable('createLoan'))
		.handle('updateLoan', () => unreachable('updateLoan'))
		.handle('deleteLoan', () => unreachable('deleteLoan')),
);

const wishlistHandlers = HttpApiBuilder.group(FinApi, 'wishlist', (handlers) =>
	handlers
		.handle('listWishlistItems', () => unreachable('listWishlistItems'))
		.handle('createWishlistItem', () => unreachable('createWishlistItem'))
		.handle('updateWishlistItem', () => unreachable('updateWishlistItem'))
		.handle('deleteWishlistItem', () => unreachable('deleteWishlistItem'))
		.handle('listWishlistCategories', () => unreachable('listWishlistCategories'))
		.handle('createWishlistCategory', () => unreachable('createWishlistCategory'))
		.handle('updateWishlistCategory', () => unreachable('updateWishlistCategory'))
		.handle('deleteWishlistCategory', () => unreachable('deleteWishlistCategory')),
);

const importsHandlers = HttpApiBuilder.group(FinApi, 'imports', (handlers) =>
	handlers
		.handle('listImportBatches', ({ urlParams }) => listImportBatchesEffect(urlParams ?? {}))
		.handle('listImportTransactions', ({ urlParams }) =>
			listImportTransactionsEffect(urlParams ?? {}),
		)
		.handle('listReviewTransactions', ({ urlParams }) =>
			listReviewTransactionsEffect(urlParams ?? {}),
		)
		.handle('uploadImportCsv', ({ payload }) => uploadImportCsvEffect(payload))
		.handle('reprocessImportTransactions', ({ payload }) =>
			reprocessImportTransactionsEffect(payload),
		)
		.handle('suggestImportTransactionCategoryWithAi', ({ path, payload }) =>
			suggestTransactionCategoryWithAiEffect(path.transactionId, payload),
		)
		.handle('assignImportTransactionCategory', ({ path, payload }) =>
			assignTransactionCategoryEffect(path.transactionId, payload),
		),
);

const investmentsHandlers = HttpApiBuilder.group(FinApi, 'investments', (handlers) =>
	handlers
		.handle('listInvestmentAccounts', () => unreachable('listInvestmentAccounts'))
		.handle('createInvestmentAccount', () => unreachable('createInvestmentAccount'))
		.handle('updateInvestmentAccount', () => unreachable('updateInvestmentAccount'))
		.handle('deleteInvestmentAccount', () => unreachable('deleteInvestmentAccount'))
		.handle('listInvestmentHoldings', () => unreachable('listInvestmentHoldings'))
		.handle('createInvestmentHolding', () => unreachable('createInvestmentHolding'))
		.handle('updateInvestmentHolding', () => unreachable('updateInvestmentHolding'))
		.handle('deleteInvestmentHolding', () => unreachable('deleteInvestmentHolding'))
		.handle('refreshTrackedInvestmentHoldings', () =>
			unreachable('refreshTrackedInvestmentHoldings'),
		),
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
