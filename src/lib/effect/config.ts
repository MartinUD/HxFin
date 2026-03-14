export const appConfig = {
	dbPath: process.env.BUDGET_DB_PATH ?? 'data/budget.db',
	investmentRefreshTimeoutMs: 5_000,
	investmentRefreshRetries: 1
} as const;
