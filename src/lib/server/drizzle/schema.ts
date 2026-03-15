import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const schemaMigrations = sqliteTable('schema_migrations', {
	id: text('id').primaryKey(),
	description: text('description').notNull(),
	appliedAt: text('applied_at').notNull(),
});

export const budgetCategories = sqliteTable('budget_categories', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description'),
	color: text('color'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
});

export const recurringCosts = sqliteTable(
	'recurring_costs',
	{
		id: text('id').primaryKey(),
		categoryId: text('category_id')
			.notNull()
			.references(() => budgetCategories.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		amount: real('amount').notNull(),
		period: text('period').$type<'weekly' | 'monthly' | 'yearly'>().notNull(),
		startDate: text('start_date'),
		endDate: text('end_date'),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		isEssential: integer('is_essential', { mode: 'boolean' }).notNull().default(false),
		kind: text('kind').$type<'expense' | 'investment'>().notNull().default('expense'),
	},
	(table) => [
		index('idx_recurring_costs_category_id').on(table.categoryId),
		index('idx_recurring_costs_is_active').on(table.isActive),
		index('idx_recurring_costs_kind').on(table.kind),
	],
);

export const financialProfile = sqliteTable('financial_profile', {
	id: text('id').primaryKey(),
	monthlySalary: real('monthly_salary').notNull().default(40000),
	salaryGrowth: real('salary_growth').notNull().default(6),
	municipalTaxRate: real('municipal_tax_rate').notNull().default(32.41),
	savingsShareOfRaise: real('savings_share_of_raise').notNull().default(50),
	currency: text('currency').notNull().default('SEK'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
});

export const investmentAccounts = sqliteTable('investment_accounts', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	institution: text('institution'),
	currency: text('currency').notNull().default('SEK'),
	totalValue: real('total_value').notNull(),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
});

export const investmentHoldings = sqliteTable(
	'investment_holdings',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id')
			.notNull()
			.references(() => investmentAccounts.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		allocationPercent: real('allocation_percent').notNull(),
		currentValue: real('current_value').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		units: real('units'),
		latestUnitPrice: real('latest_unit_price'),
		trackerSource: text('tracker_source')
			.$type<'manual' | 'nordea' | 'avanza'>()
			.notNull()
			.default('manual'),
		trackerUrl: text('tracker_url'),
		latestPriceDate: text('latest_price_date'),
		lastSyncedAt: text('last_synced_at'),
	},
	(table) => [index('idx_investment_holdings_account_id').on(table.accountId)],
);

export const investmentHoldingSnapshots = sqliteTable(
	'investment_holding_snapshots',
	{
		id: text('id').primaryKey(),
		holdingId: text('holding_id')
			.notNull()
			.references(() => investmentHoldings.id, { onDelete: 'cascade' }),
		currentValue: real('current_value').notNull(),
		unitPrice: real('unit_price'),
		units: real('units'),
		capturedAt: text('captured_at').notNull(),
	},
	(table) => [
		index('idx_investment_holding_snapshots_holding_id').on(table.holdingId, table.capturedAt),
	],
);

export const loans = sqliteTable(
	'loans',
	{
		id: text('id').primaryKey(),
		direction: text('direction').$type<'lent' | 'borrowed'>().notNull(),
		counterparty: text('counterparty').notNull(),
		principalAmount: real('principal_amount').notNull(),
		outstandingAmount: real('outstanding_amount').notNull(),
		currency: text('currency').notNull().default('SEK'),
		issueDate: text('issue_date').notNull(),
		dueDate: text('due_date'),
		status: text('status').$type<'open' | 'paid' | 'overdue'>().notNull(),
		notes: text('notes'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
	},
	(table) => [
		index('idx_loans_direction').on(table.direction),
		index('idx_loans_status').on(table.status),
		index('idx_loans_due_date').on(table.dueDate),
	],
);

export const wishlistCategories = sqliteTable(
	'wishlist_categories',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		description: text('description'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
	},
	(table) => [uniqueIndex('wishlist_categories_name_unique').on(table.name)],
);

export const wishlistItems = sqliteTable(
	'wishlist_items',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		targetAmount: real('target_amount').notNull(),
		targetAmountType: text('target_amount_type')
			.$type<'exact' | 'estimate'>()
			.notNull()
			.default('exact'),
		targetDate: text('target_date'),
		priority: integer('priority').notNull().default(5),
		categoryId: text('category_id').references(() => wishlistCategories.id, {
			onDelete: 'set null',
		}),
		fundingStrategy: text('funding_strategy')
			.$type<'save' | 'loan' | 'mixed' | 'buy_outright'>()
			.notNull(),
		linkedLoanId: text('linked_loan_id').references(() => loans.id, { onDelete: 'set null' }),
		currency: text('currency').notNull().default('SEK'),
		notes: text('notes'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
	},
	(table) => [
		index('idx_wishlist_priority').on(table.priority),
		index('idx_wishlist_funding_strategy').on(table.fundingStrategy),
		index('idx_wishlist_linked_loan_id').on(table.linkedLoanId),
		index('idx_wishlist_category_id').on(table.categoryId),
	],
);

export const importBatches = sqliteTable('import_batches', {
	id: text('id').primaryKey(),
	sourceName: text('source_name').notNull(),
	importedAt: text('imported_at').notNull(),
	rowCount: integer('row_count').notNull().default(0),
	status: text('status').$type<'processing' | 'completed' | 'failed'>().notNull(),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
});

export const transactions = sqliteTable(
	'transactions',
	{
		id: text('id').primaryKey(),
		bookingDate: text('booking_date').notNull(),
		description: text('description').notNull(),
		normalizedDescription: text('normalized_description').notNull(),
		amount: real('amount').notNull(),
		currency: text('currency').notNull().default('SEK'),
		categoryId: text('category_id').references(() => budgetCategories.id, { onDelete: 'set null' }),
		matchMethod: text('match_method')
			.$type<'rule_exact' | 'history_exact' | 'manual' | 'needs_review'>()
			.notNull(),
		importBatchId: text('import_batch_id')
			.notNull()
			.references(() => importBatches.id, { onDelete: 'cascade' }),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
	},
	(table) => [
		index('idx_transactions_import_batch_id').on(table.importBatchId),
		index('idx_transactions_normalized_description').on(table.normalizedDescription),
		index('idx_transactions_category_id').on(table.categoryId),
		index('idx_transactions_match_method').on(table.matchMethod),
		index('idx_transactions_booking_date').on(table.bookingDate),
	],
);

export const merchantCategoryRules = sqliteTable(
	'merchant_category_rules',
	{
		id: text('id').primaryKey(),
		normalizedDescription: text('normalized_description').notNull(),
		categoryId: text('category_id')
			.notNull()
			.references(() => budgetCategories.id, { onDelete: 'cascade' }),
		confidence: real('confidence').notNull().default(1),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
	},
	(table) => [
		uniqueIndex('merchant_category_rules_normalized_description_unique').on(
			table.normalizedDescription,
		),
		index('idx_merchant_category_rules_category_id').on(table.categoryId),
	],
);
