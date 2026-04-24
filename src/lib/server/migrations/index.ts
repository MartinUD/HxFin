import { createHash } from 'node:crypto';

import type { AppDatabase } from '$lib/server/db';

export interface Migration {
	id: string;
	description: string;
	up: (db: AppDatabase) => void;
}

export const migrations: Migration[] = [
	{
		id: '20260221_0001_initial_budget_schema',
		description: 'Create initial budget categories and recurring costs schema',
		up: (db) => {
			db.exec(`
				CREATE TABLE IF NOT EXISTS budget_categories (
					id TEXT PRIMARY KEY,
					name TEXT NOT NULL,
					description TEXT,
					color TEXT,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);

				CREATE TABLE IF NOT EXISTS recurring_costs (
					id TEXT PRIMARY KEY,
					category_id TEXT NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
					name TEXT NOT NULL,
					amount NUMERIC NOT NULL,
					period TEXT NOT NULL CHECK(period IN ('weekly', 'monthly', 'yearly')),
					start_date TEXT,
					end_date TEXT,
					is_active INTEGER NOT NULL DEFAULT 1,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);

				CREATE INDEX IF NOT EXISTS idx_recurring_costs_category_id
				ON recurring_costs (category_id);

				CREATE INDEX IF NOT EXISTS idx_recurring_costs_is_active
				ON recurring_costs (is_active);
			`);
		},
	},
	{
		id: '20260221_0002_financial_profile',
		description: 'Create financial profile table for persisted income settings',
		up: (db) => {
			db.exec(`
				CREATE TABLE IF NOT EXISTS financial_profile (
					id TEXT PRIMARY KEY,
					monthly_salary NUMERIC NOT NULL DEFAULT 40000,
					salary_growth NUMERIC NOT NULL DEFAULT 6,
					municipal_tax_rate NUMERIC NOT NULL DEFAULT 32.41,
					savings_share_of_raise NUMERIC NOT NULL DEFAULT 50,
					currency TEXT NOT NULL DEFAULT 'SEK',
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
			`);
		},
	},
	{
		id: '20260221_0003_investments_baseline',
		description: 'Create investment accounts/holdings and seed initial portfolio snapshot',
		up: (db) => {
			db.exec(`
				CREATE TABLE IF NOT EXISTS investment_accounts (
					id TEXT PRIMARY KEY,
					name TEXT NOT NULL,
					institution TEXT,
					currency TEXT NOT NULL DEFAULT 'SEK',
					total_value NUMERIC NOT NULL,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);

				CREATE TABLE IF NOT EXISTS investment_holdings (
					id TEXT PRIMARY KEY,
					account_id TEXT NOT NULL REFERENCES investment_accounts(id) ON DELETE CASCADE,
					name TEXT NOT NULL,
					allocation_percent NUMERIC NOT NULL,
					current_value NUMERIC NOT NULL,
					sort_order INTEGER NOT NULL DEFAULT 0,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);

				CREATE INDEX IF NOT EXISTS idx_investment_holdings_account_id
				ON investment_holdings (account_id);
			`);

			const accountCountRow = db
				.prepare(`SELECT COUNT(*) AS count FROM investment_accounts`)
				.get() as { count: number };
			if (accountCountRow.count > 0) {
				return;
			}

			const timestamp = new Date().toISOString();
			const accountId = 'seed-account-nordea-funds';
			db.prepare(
				`INSERT INTO investment_accounts (
					id, name, institution, currency, total_value, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			).run(accountId, 'Nordea funds', 'Nordea', 'SEK', 700000, timestamp, timestamp);

			const insertHolding = db.prepare(
				`INSERT INTO investment_holdings (
					id, account_id, name, allocation_percent, current_value, sort_order, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			);

			insertHolding.run(
				'seed-holding-global',
				accountId,
				'Global',
				40,
				280000,
				0,
				timestamp,
				timestamp,
			);
			insertHolding.run(
				'seed-holding-sweden',
				accountId,
				'Sweden',
				20,
				140000,
				1,
				timestamp,
				timestamp,
			);
			insertHolding.run(
				'seed-holding-europe',
				accountId,
				'Europe',
				20,
				140000,
				2,
				timestamp,
				timestamp,
			);
			insertHolding.run(
				'seed-holding-emerging-markets',
				accountId,
				'Emerging markets',
				20,
				140000,
				3,
				timestamp,
				timestamp,
			);
		},
	},
	{
		id: '20260221_0004_budget_is_essential',
		description: 'Add essential flag to recurring costs for expense classification',
		up: (db) => {
			const columnRows = db.prepare(`PRAGMA table_info(recurring_costs)`).all() as Array<{
				name: string;
			}>;
			const hasEssentialColumn = columnRows.some((column) => column.name === 'is_essential');

			if (!hasEssentialColumn) {
				db.exec(`
					ALTER TABLE recurring_costs
					ADD COLUMN is_essential INTEGER NOT NULL DEFAULT 0;
				`);
			}
		},
	},
	{
		id: '20260221_0005_budget_cost_kind',
		description: 'Add kind to recurring costs to separate expenses and investments',
		up: (db) => {
			const columnRows = db.prepare(`PRAGMA table_info(recurring_costs)`).all() as Array<{
				name: string;
			}>;
			const hasKindColumn = columnRows.some((column) => column.name === 'kind');

			if (!hasKindColumn) {
				db.exec(`
					ALTER TABLE recurring_costs
					ADD COLUMN kind TEXT NOT NULL DEFAULT 'expense' CHECK(kind IN ('expense', 'investment'));
				`);
			}

			db.exec(`
				CREATE INDEX IF NOT EXISTS idx_recurring_costs_kind
				ON recurring_costs (kind);
			`);
		},
	},
	{
		id: '20260221_0006_loans',
		description: 'Create loans table for money lent and borrowed tracking',
		up: (db) => {
			db.exec(`
				CREATE TABLE IF NOT EXISTS loans (
					id TEXT PRIMARY KEY,
					direction TEXT NOT NULL CHECK(direction IN ('lent', 'borrowed')),
					counterparty TEXT NOT NULL,
					principal_amount NUMERIC NOT NULL,
					outstanding_amount NUMERIC NOT NULL,
					currency TEXT NOT NULL DEFAULT 'SEK',
					issue_date TEXT NOT NULL,
					due_date TEXT,
					status TEXT NOT NULL CHECK(status IN ('open', 'paid', 'overdue')),
					notes TEXT,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);

				CREATE INDEX IF NOT EXISTS idx_loans_direction
				ON loans (direction);

				CREATE INDEX IF NOT EXISTS idx_loans_status
				ON loans (status);

				CREATE INDEX IF NOT EXISTS idx_loans_due_date
				ON loans (due_date);
			`);
		},
	},
	{
		id: '20260221_0007_wishlist',
		description: 'Create wishlist items table with optional loan linkage',
		up: (db) => {
			db.exec(`
				CREATE TABLE IF NOT EXISTS wishlist_items (
					id TEXT PRIMARY KEY,
					name TEXT NOT NULL,
					target_amount NUMERIC NOT NULL,
					target_date TEXT,
					priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')),
					funding_strategy TEXT NOT NULL CHECK(funding_strategy IN ('save', 'loan', 'mixed')),
					linked_loan_id TEXT REFERENCES loans(id) ON DELETE SET NULL,
					currency TEXT NOT NULL DEFAULT 'SEK',
					notes TEXT,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);

				CREATE INDEX IF NOT EXISTS idx_wishlist_priority
				ON wishlist_items (priority);

				CREATE INDEX IF NOT EXISTS idx_wishlist_funding_strategy
				ON wishlist_items (funding_strategy);

				CREATE INDEX IF NOT EXISTS idx_wishlist_linked_loan_id
				ON wishlist_items (linked_loan_id);
			`);
		},
	},
	{
		id: '20260221_0008_transaction_imports',
		description: 'Create import batches, transactions, and merchant category rules',
		up: (db) => {
			db.exec(`
				CREATE TABLE IF NOT EXISTS import_batches (
					id TEXT PRIMARY KEY,
					source_name TEXT NOT NULL,
					imported_at TEXT NOT NULL,
					row_count INTEGER NOT NULL DEFAULT 0,
					status TEXT NOT NULL CHECK(status IN ('processing', 'completed', 'failed')),
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);

				CREATE TABLE IF NOT EXISTS transactions (
					id TEXT PRIMARY KEY,
					booking_date TEXT NOT NULL,
					description TEXT NOT NULL,
					normalized_description TEXT NOT NULL,
					amount NUMERIC NOT NULL,
					currency TEXT NOT NULL DEFAULT 'SEK',
					category_id TEXT REFERENCES budget_categories(id) ON DELETE SET NULL,
					match_method TEXT NOT NULL CHECK(match_method IN ('rule_exact', 'history_exact', 'heuristic_keyword', 'codex_auto', 'codex_suggested', 'manual', 'needs_review', 'skipped_non_expense')),
					import_batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);

				CREATE TABLE IF NOT EXISTS merchant_category_rules (
					id TEXT PRIMARY KEY,
					normalized_description TEXT NOT NULL UNIQUE,
					category_id TEXT NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
					confidence NUMERIC NOT NULL DEFAULT 1,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);

				CREATE INDEX IF NOT EXISTS idx_transactions_import_batch_id
				ON transactions (import_batch_id);

				CREATE INDEX IF NOT EXISTS idx_transactions_normalized_description
				ON transactions (normalized_description);

				CREATE INDEX IF NOT EXISTS idx_transactions_category_id
				ON transactions (category_id);

				CREATE INDEX IF NOT EXISTS idx_transactions_match_method
				ON transactions (match_method);

				CREATE INDEX IF NOT EXISTS idx_transactions_booking_date
				ON transactions (booking_date);

				CREATE INDEX IF NOT EXISTS idx_merchant_category_rules_category_id
				ON merchant_category_rules (category_id);
			`);
		},
	},
	{
		id: '20260306_0009_investment_tracking',
		description: 'Add tracker metadata and snapshots for investment holdings',
		up: (db) => {
			const holdingColumns = db.prepare(`PRAGMA table_info(investment_holdings)`).all() as Array<{
				name: string;
			}>;

			const ensureHoldingColumn = (name: string, sql: string) => {
				if (!holdingColumns.some((column) => column.name === name)) {
					db.exec(sql);
				}
			};

			ensureHoldingColumn('units', `ALTER TABLE investment_holdings ADD COLUMN units NUMERIC;`);
			ensureHoldingColumn(
				'latest_unit_price',
				`ALTER TABLE investment_holdings ADD COLUMN latest_unit_price NUMERIC;`,
			);
			ensureHoldingColumn(
				'tracker_source',
				`ALTER TABLE investment_holdings ADD COLUMN tracker_source TEXT NOT NULL DEFAULT 'manual' CHECK(tracker_source IN ('manual', 'nordea', 'avanza'));`,
			);
			ensureHoldingColumn(
				'tracker_url',
				`ALTER TABLE investment_holdings ADD COLUMN tracker_url TEXT;`,
			);
			ensureHoldingColumn(
				'latest_price_date',
				`ALTER TABLE investment_holdings ADD COLUMN latest_price_date TEXT;`,
			);
			ensureHoldingColumn(
				'last_synced_at',
				`ALTER TABLE investment_holdings ADD COLUMN last_synced_at TEXT;`,
			);

			db.exec(`
				CREATE TABLE IF NOT EXISTS investment_holding_snapshots (
					id TEXT PRIMARY KEY,
					holding_id TEXT NOT NULL REFERENCES investment_holdings(id) ON DELETE CASCADE,
					current_value NUMERIC NOT NULL,
					unit_price NUMERIC,
					units NUMERIC,
					captured_at TEXT NOT NULL
				);

				CREATE INDEX IF NOT EXISTS idx_investment_holding_snapshots_holding_id
				ON investment_holding_snapshots (holding_id, captured_at DESC);
			`);

			const timestamp = '2026-03-06T12:00:00.000Z';
			const seedUpdates = [
				{
					id: 'seed-holding-emerging-markets',
					name: 'Nordea Emerging Markets Enhanced BP',
					currentValue: 76484.17,
					units: 40.28,
					unitPrice: 1898.67,
					url: 'https://www.nordeafunds.com/sv/fonder/emerging-markets-enhanced-bp',
				},
				{
					id: 'seed-holding-europe',
					name: 'Nordea Europa Index Select A',
					currentValue: 79800.31,
					units: 698.78,
					unitPrice: 114.2,
					url: 'https://www.nordeafunds.com/sv/fonder/europa-index-select-a',
				},
				{
					id: 'seed-holding-global',
					name: 'Nordea Global Index Select A',
					currentValue: 408176.23,
					units: 685.8,
					unitPrice: 595.19,
					url: 'https://www.nordeafunds.com/sv/fonder/global-index-select-a',
				},
				{
					id: 'seed-holding-sweden',
					name: 'Nordea Sverige Passiv',
					currentValue: 131513.44,
					units: 244.18,
					unitPrice: 538.59,
					url: 'https://www.nordeafunds.com/sv/fonder/sverige-passiv-a-a',
				},
			];

			const updateSeedHolding = db.prepare(`
				UPDATE investment_holdings
				SET name = @name,
					current_value = @currentValue,
					units = @units,
					latest_unit_price = @unitPrice,
					tracker_source = 'nordea',
					tracker_url = @url,
					latest_price_date = '2026-03-06',
					last_synced_at = @timestamp,
					updated_at = @timestamp
				WHERE id = @id
			`);

			const existingSnapshotCount = db.prepare(
				`SELECT COUNT(*) AS count FROM investment_holding_snapshots WHERE holding_id = ?`,
			);
			const insertSnapshot = db.prepare(`
				INSERT INTO investment_holding_snapshots (
					id, holding_id, current_value, unit_price, units, captured_at
				) VALUES (?, ?, ?, ?, ?, ?)
			`);

			for (const seed of seedUpdates) {
				updateSeedHolding.run({
					id: seed.id,
					name: seed.name,
					currentValue: seed.currentValue,
					units: seed.units,
					unitPrice: seed.unitPrice,
					url: seed.url,
					timestamp,
				});

				const snapshotCountRow = existingSnapshotCount.get(seed.id) as { count: number };
				if (snapshotCountRow.count === 0) {
					insertSnapshot.run(
						`${seed.id}-baseline-20260306`,
						seed.id,
						seed.currentValue,
						seed.unitPrice,
						seed.units,
						timestamp,
					);
				}
			}

			db.prepare(
				`UPDATE investment_accounts
				 SET total_value = ?, updated_at = ?
				 WHERE id = 'seed-account-nordea-funds'`,
			).run(695974.15, timestamp);
		},
	},
	{
		id: '20260306_0010_avanza_seed_holdings',
		description: 'Add initial Avanza holdings using provided SEK values',
		up: (db) => {
			const accountRow = db
				.prepare(
					`SELECT id
					 FROM investment_accounts
					 ORDER BY created_at ASC
					 LIMIT 1`,
				)
				.get() as { id: string } | undefined;

			if (!accountRow) {
				return;
			}

			const timestamp = '2026-03-06T13:00:00.000Z';
			const avanzaHoldings = [
				{
					id: 'seed-holding-avanza-global',
					name: 'Avanza Global',
					currentValue: 3023,
					units: 13.364279,
					unitPrice: 226.2,
					url: 'https://www.avanza.se/avanza-global',
					sortOrder: 10,
				},
				{
					id: 'seed-holding-avanza-emerging-markets',
					name: 'Avanza Emerging Markets',
					currentValue: 1018,
					units: 6.304186,
					unitPrice: 161.48,
					url: 'https://www.avanza.se/avanza-emerging-markets',
					sortOrder: 11,
				},
			];

			const existingHolding = db.prepare(`SELECT id FROM investment_holdings WHERE id = ?`);
			const insertHolding = db.prepare(`
				INSERT INTO investment_holdings (
					id, account_id, name, allocation_percent, current_value, units, latest_unit_price,
					tracker_source, tracker_url, latest_price_date, last_synced_at, sort_order, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, 'avanza', ?, '2026-03-05', ?, ?, ?, ?)
			`);
			const snapshotExists = db.prepare(
				`SELECT COUNT(*) AS count FROM investment_holding_snapshots WHERE holding_id = ?`,
			);
			const insertSnapshot = db.prepare(`
				INSERT INTO investment_holding_snapshots (
					id, holding_id, current_value, unit_price, units, captured_at
				) VALUES (?, ?, ?, ?, ?, ?)
			`);

			for (const holding of avanzaHoldings) {
				const alreadyExists = existingHolding.get(holding.id) as { id: string } | undefined;
				if (!alreadyExists) {
					insertHolding.run(
						holding.id,
						accountRow.id,
						holding.name,
						0,
						holding.currentValue,
						holding.units,
						holding.unitPrice,
						holding.url,
						timestamp,
						holding.sortOrder,
						timestamp,
						timestamp,
					);
				}

				const snapshotCountRow = snapshotExists.get(holding.id) as { count: number };
				if (snapshotCountRow.count === 0) {
					insertSnapshot.run(
						`${holding.id}-baseline-20260306`,
						holding.id,
						holding.currentValue,
						holding.unitPrice,
						holding.units,
						timestamp,
					);
				}
			}
		},
	},
	{
		id: '20260306_0011_rebalance_seed_weights',
		description: 'Update seed holding weights for Nordea and Avanza portfolios',
		up: (db) => {
			const updates = [
				['Nordea Global Index Select A', 60],
				['Nordea Sverige Passiv', 20],
				['Nordea Europa Index Select A', 10],
				['Nordea Emerging Markets Enhanced BP', 10],
				['Avanza Global', 70],
				['Avanza Emerging Markets', 30],
			] as const;

			const updateHolding = db.prepare(`
				UPDATE investment_holdings
				SET allocation_percent = ?,
					updated_at = ?
				WHERE name = ?
			`);
			const timestamp = new Date().toISOString();

			for (const [name, allocation] of updates) {
				updateHolding.run(allocation, timestamp, name);
			}
		},
	},
	{
		id: '20260306_0012_wishlist_item_shape',
		description: 'Add wishlist amount type, category, and numeric priority',
		up: (db) => {
			const wishlistColumns = db.prepare(`PRAGMA table_info(wishlist_items)`).all() as Array<{
				name: string;
			}>;

			const ensureColumn = (name: string, sql: string) => {
				if (!wishlistColumns.some((column) => column.name === name)) {
					db.exec(sql);
				}
			};

			ensureColumn(
				'target_amount_type',
				`ALTER TABLE wishlist_items ADD COLUMN target_amount_type TEXT NOT NULL DEFAULT 'exact' CHECK(target_amount_type IN ('exact', 'estimate'));`,
			);
			ensureColumn('category', `ALTER TABLE wishlist_items ADD COLUMN category TEXT;`);

			const priorityColumn = wishlistColumns.find((column) => column.name === 'priority');
			if (priorityColumn) {
				const priorityTypeRow = db
					.prepare(
						`SELECT typeof(priority) AS type FROM wishlist_items WHERE priority IS NOT NULL LIMIT 1`,
					)
					.get() as { type: string } | undefined;

				if (!priorityTypeRow || priorityTypeRow.type !== 'integer') {
					db.exec(`
						ALTER TABLE wishlist_items RENAME TO wishlist_items_legacy;

						CREATE TABLE wishlist_items (
							id TEXT PRIMARY KEY,
							name TEXT NOT NULL,
							target_amount NUMERIC NOT NULL,
							target_amount_type TEXT NOT NULL DEFAULT 'exact' CHECK(target_amount_type IN ('exact', 'estimate')),
							target_date TEXT,
							priority INTEGER NOT NULL DEFAULT 5 CHECK(priority >= 0 AND priority <= 10),
							category TEXT,
							funding_strategy TEXT NOT NULL CHECK(funding_strategy IN ('save', 'loan', 'mixed')),
							linked_loan_id TEXT REFERENCES loans(id) ON DELETE SET NULL,
							currency TEXT NOT NULL DEFAULT 'SEK',
							notes TEXT,
							created_at TEXT NOT NULL,
							updated_at TEXT NOT NULL
						);

						INSERT INTO wishlist_items (
							id,
							name,
							target_amount,
							target_amount_type,
							target_date,
							priority,
							category,
							funding_strategy,
							linked_loan_id,
							currency,
							notes,
							created_at,
							updated_at
						)
						SELECT
							id,
							name,
							target_amount,
							COALESCE(target_amount_type, 'exact'),
							target_date,
							CASE priority
								WHEN 'high' THEN 8
								WHEN 'medium' THEN 5
								WHEN 'low' THEN 2
								ELSE COALESCE(CAST(priority AS INTEGER), 5)
							END,
							category,
							funding_strategy,
							linked_loan_id,
							COALESCE(currency, 'SEK'),
							notes,
							created_at,
							updated_at
						FROM wishlist_items_legacy;

						DROP TABLE wishlist_items_legacy;
					`);
				}
			}

			db.exec(`
				CREATE INDEX IF NOT EXISTS idx_wishlist_priority
				ON wishlist_items (priority);

				CREATE INDEX IF NOT EXISTS idx_wishlist_funding_strategy
				ON wishlist_items (funding_strategy);

				CREATE INDEX IF NOT EXISTS idx_wishlist_linked_loan_id
				ON wishlist_items (linked_loan_id);

				CREATE INDEX IF NOT EXISTS idx_wishlist_category
				ON wishlist_items (category);
			`);
		},
	},
	{
		id: '20260306_0013_wishlist_categories_and_strategy',
		description: 'Normalize wishlist categories and add buy outright strategy',
		up: (db) => {
			db.exec(`
				CREATE TABLE IF NOT EXISTS wishlist_categories (
					id TEXT PRIMARY KEY,
					name TEXT NOT NULL UNIQUE,
					description TEXT,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
			`);

			const itemColumns = db.prepare(`PRAGMA table_info(wishlist_items)`).all() as Array<{
				name: string;
			}>;

			const hasCategoryId = itemColumns.some((column) => column.name === 'category_id');
			if (!hasCategoryId) {
				db.exec(
					`ALTER TABLE wishlist_items ADD COLUMN category_id TEXT REFERENCES wishlist_categories(id) ON DELETE SET NULL;`,
				);
			}

			const hasLegacyCategory = itemColumns.some((column) => column.name === 'category');
			if (hasLegacyCategory) {
				const legacyCategories = db
					.prepare(`
						SELECT DISTINCT TRIM(category) AS category
						FROM wishlist_items
						WHERE category IS NOT NULL AND TRIM(category) <> ''
					`)
					.all() as Array<{ category: string }>;

				const insertCategory = db.prepare(`
					INSERT OR IGNORE INTO wishlist_categories (id, name, description, created_at, updated_at)
					VALUES (?, ?, NULL, ?, ?)
				`);
				const findCategoryId = db.prepare(`SELECT id FROM wishlist_categories WHERE name = ?`);
				const updateItemCategory = db.prepare(`
					UPDATE wishlist_items
					SET category_id = ?
					WHERE category_id IS NULL AND category = ?
				`);

				for (const row of legacyCategories) {
					const timestamp = new Date().toISOString();
					const categoryId = `wishlist-category-${
						row.category
							.toLowerCase()
							.replace(/[^a-z0-9]+/g, '-')
							.replace(/^-|-$/g, '') || 'general'
					}`;
					insertCategory.run(categoryId, row.category, timestamp, timestamp);
					const found = findCategoryId.get(row.category) as { id: string } | undefined;
					if (found) {
						updateItemCategory.run(found.id, row.category);
					}
				}
			}

			db.exec(`
				ALTER TABLE wishlist_items RENAME TO wishlist_items_legacy_0013;

				CREATE TABLE wishlist_items (
					id TEXT PRIMARY KEY,
					name TEXT NOT NULL,
					target_amount NUMERIC NOT NULL,
					target_amount_type TEXT NOT NULL DEFAULT 'exact' CHECK(target_amount_type IN ('exact', 'estimate')),
					target_date TEXT,
					priority INTEGER NOT NULL DEFAULT 5 CHECK(priority >= 0 AND priority <= 10),
					category_id TEXT REFERENCES wishlist_categories(id) ON DELETE SET NULL,
					funding_strategy TEXT NOT NULL CHECK(funding_strategy IN ('save', 'loan', 'mixed', 'buy_outright')),
					linked_loan_id TEXT REFERENCES loans(id) ON DELETE SET NULL,
					currency TEXT NOT NULL DEFAULT 'SEK',
					notes TEXT,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);

				INSERT INTO wishlist_items (
					id,
					name,
					target_amount,
					target_amount_type,
					target_date,
					priority,
					category_id,
					funding_strategy,
					linked_loan_id,
					currency,
					notes,
					created_at,
					updated_at
				)
				SELECT
					id,
					name,
					target_amount,
					COALESCE(target_amount_type, 'exact'),
					target_date,
					COALESCE(priority, 5),
					category_id,
					funding_strategy,
					linked_loan_id,
					COALESCE(currency, 'SEK'),
					notes,
					created_at,
					updated_at
				FROM wishlist_items_legacy_0013;

				DROP TABLE wishlist_items_legacy_0013;

				CREATE INDEX IF NOT EXISTS idx_wishlist_priority
				ON wishlist_items (priority);

				CREATE INDEX IF NOT EXISTS idx_wishlist_funding_strategy
				ON wishlist_items (funding_strategy);

				CREATE INDEX IF NOT EXISTS idx_wishlist_linked_loan_id
				ON wishlist_items (linked_loan_id);

				CREATE INDEX IF NOT EXISTS idx_wishlist_category_id
				ON wishlist_items (category_id);
			`);
		},
	},
	{
		id: '20260320_0014_import_categorization_rework',
		description: 'Extend imported transactions with Codex categorization metadata and cache',
		up: (db) => {
			const transactionColumns = db.prepare(`PRAGMA table_info(transactions)`).all() as Array<{
				name: string;
			}>;

			const ensureTransactionColumn = (name: string, sql: string) => {
				if (!transactionColumns.some((column) => column.name === name)) {
					db.exec(sql);
				}
			};

			ensureTransactionColumn(
				'categorization_status',
				`ALTER TABLE transactions ADD COLUMN categorization_status TEXT NOT NULL DEFAULT 'needs_review' CHECK(categorization_status IN ('categorized', 'suggested', 'needs_review', 'skipped'));`,
			);
			ensureTransactionColumn(
				'categorization_source',
				`ALTER TABLE transactions ADD COLUMN categorization_source TEXT NOT NULL DEFAULT 'rule_exact' CHECK(categorization_source IN ('rule_exact', 'history_exact', 'heuristic_keyword', 'codex_auto', 'codex_suggested', 'manual', 'skipped_non_expense'));`,
			);
			ensureTransactionColumn(
				'suggested_category_id',
				`ALTER TABLE transactions ADD COLUMN suggested_category_id TEXT REFERENCES budget_categories(id) ON DELETE SET NULL;`,
			);
			ensureTransactionColumn(
				'suggested_confidence',
				`ALTER TABLE transactions ADD COLUMN suggested_confidence NUMERIC;`,
			);
			ensureTransactionColumn(
				'suggested_reason',
				`ALTER TABLE transactions ADD COLUMN suggested_reason TEXT;`,
			);
			ensureTransactionColumn(
				'suggested_by_model',
				`ALTER TABLE transactions ADD COLUMN suggested_by_model TEXT;`,
			);
			ensureTransactionColumn(
				'suggested_at',
				`ALTER TABLE transactions ADD COLUMN suggested_at TEXT;`,
			);

			db.exec(`
				UPDATE transactions
				SET categorization_status = CASE
					WHEN amount >= 0 THEN 'skipped'
					WHEN match_method IN ('rule_exact', 'history_exact', 'manual') THEN 'categorized'
					ELSE 'needs_review'
				END
				WHERE categorization_status IS NULL OR categorization_status = 'needs_review';

				UPDATE transactions
				SET categorization_source = CASE
					WHEN amount >= 0 THEN 'skipped_non_expense'
					WHEN match_method = 'rule_exact' THEN 'rule_exact'
					WHEN match_method = 'history_exact' THEN 'history_exact'
					WHEN match_method = 'manual' THEN 'manual'
					ELSE 'rule_exact'
				END
				WHERE categorization_source IS NULL OR categorization_source = 'rule_exact';

				CREATE INDEX IF NOT EXISTS idx_transactions_categorization_status
				ON transactions (categorization_status);

				CREATE INDEX IF NOT EXISTS idx_transactions_categorization_source
				ON transactions (categorization_source);

				CREATE INDEX IF NOT EXISTS idx_transactions_suggested_category_id
				ON transactions (suggested_category_id);

				CREATE TABLE IF NOT EXISTS merchant_category_codex_cache (
					id TEXT PRIMARY KEY,
					normalized_description TEXT NOT NULL,
					sample_description TEXT NOT NULL,
					suggested_category_id TEXT REFERENCES budget_categories(id) ON DELETE SET NULL,
					confidence NUMERIC NOT NULL,
					reason TEXT,
					model_label TEXT NOT NULL,
					prompt_version TEXT NOT NULL,
					categories_hash TEXT NOT NULL,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);

				CREATE UNIQUE INDEX IF NOT EXISTS merchant_category_codex_cache_lookup_unique
				ON merchant_category_codex_cache (
					normalized_description,
					prompt_version,
					categories_hash
				);

				CREATE INDEX IF NOT EXISTS idx_merchant_category_codex_cache_category_id
				ON merchant_category_codex_cache (suggested_category_id);
			`);
		},
	},
	{
		id: '20260320_0015_transactions_match_method_expansion',
		description: 'Expand imported transaction match methods for heuristic and Codex categorization',
		up: (db) => {
			const createTableRow = db
				.prepare(
					`SELECT sql
					 FROM sqlite_master
					 WHERE type = 'table' AND name = 'transactions'`,
				)
				.get() as { sql: string | null } | undefined;

			const createTableSql = createTableRow?.sql ?? '';
			if (
				createTableSql.includes('heuristic_keyword') &&
				createTableSql.includes('codex_auto') &&
				createTableSql.includes('codex_suggested') &&
				createTableSql.includes('skipped_non_expense')
			) {
				return;
			}

			db.exec(`
				ALTER TABLE transactions RENAME TO transactions_legacy_0015;

				CREATE TABLE transactions (
					id TEXT PRIMARY KEY,
					booking_date TEXT NOT NULL,
					description TEXT NOT NULL,
					normalized_description TEXT NOT NULL,
					amount NUMERIC NOT NULL,
					currency TEXT NOT NULL DEFAULT 'SEK',
					category_id TEXT REFERENCES budget_categories(id) ON DELETE SET NULL,
					match_method TEXT NOT NULL CHECK(match_method IN ('rule_exact', 'history_exact', 'heuristic_keyword', 'codex_auto', 'codex_suggested', 'manual', 'needs_review', 'skipped_non_expense')),
					categorization_status TEXT NOT NULL DEFAULT 'needs_review' CHECK(categorization_status IN ('categorized', 'suggested', 'needs_review', 'skipped')),
					categorization_source TEXT NOT NULL DEFAULT 'rule_exact' CHECK(categorization_source IN ('rule_exact', 'history_exact', 'heuristic_keyword', 'codex_auto', 'codex_suggested', 'manual', 'skipped_non_expense')),
					suggested_category_id TEXT REFERENCES budget_categories(id) ON DELETE SET NULL,
					suggested_confidence NUMERIC,
					suggested_reason TEXT,
					suggested_by_model TEXT,
					suggested_at TEXT,
					import_batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);

				INSERT INTO transactions (
					id,
					booking_date,
					description,
					normalized_description,
					amount,
					currency,
					category_id,
					match_method,
					categorization_status,
					categorization_source,
					suggested_category_id,
					suggested_confidence,
					suggested_reason,
					suggested_by_model,
					suggested_at,
					import_batch_id,
					created_at,
					updated_at
				)
				SELECT
					id,
					booking_date,
					description,
					normalized_description,
					amount,
					COALESCE(currency, 'SEK'),
					category_id,
					CASE
						WHEN categorization_source IN ('rule_exact', 'history_exact', 'heuristic_keyword', 'codex_auto', 'codex_suggested', 'manual', 'skipped_non_expense')
							THEN categorization_source
						WHEN match_method IN ('rule_exact', 'history_exact', 'manual', 'needs_review')
							THEN match_method
						WHEN amount >= 0
							THEN 'skipped_non_expense'
						ELSE 'needs_review'
					END,
					COALESCE(categorization_status, CASE
						WHEN amount >= 0 THEN 'skipped'
						WHEN category_id IS NOT NULL THEN 'categorized'
						ELSE 'needs_review'
					END),
					COALESCE(categorization_source, CASE
						WHEN amount >= 0 THEN 'skipped_non_expense'
						WHEN match_method = 'rule_exact' THEN 'rule_exact'
						WHEN match_method = 'history_exact' THEN 'history_exact'
						WHEN match_method = 'manual' THEN 'manual'
						ELSE 'rule_exact'
					END),
					suggested_category_id,
					suggested_confidence,
					suggested_reason,
					suggested_by_model,
					suggested_at,
					import_batch_id,
					created_at,
					updated_at
				FROM transactions_legacy_0015;

				DROP TABLE transactions_legacy_0015;

				CREATE INDEX IF NOT EXISTS idx_transactions_import_batch_id
				ON transactions (import_batch_id);

				CREATE INDEX IF NOT EXISTS idx_transactions_normalized_description
				ON transactions (normalized_description);

				CREATE INDEX IF NOT EXISTS idx_transactions_category_id
				ON transactions (category_id);

				CREATE INDEX IF NOT EXISTS idx_transactions_match_method
				ON transactions (match_method);

				CREATE INDEX IF NOT EXISTS idx_transactions_categorization_status
				ON transactions (categorization_status);

				CREATE INDEX IF NOT EXISTS idx_transactions_categorization_source
				ON transactions (categorization_source);

				CREATE INDEX IF NOT EXISTS idx_transactions_suggested_category_id
				ON transactions (suggested_category_id);

				CREATE INDEX IF NOT EXISTS idx_transactions_booking_date
				ON transactions (booking_date);
			`);
		},
	},
	{
		id: '20260329_0016_transaction_import_fingerprint',
		description: 'Add transaction import fingerprint uniqueness for duplicate import detection',
		up: (db) => {
			const transactionColumns = db.prepare(`PRAGMA table_info(transactions)`).all() as Array<{
				name: string;
			}>;
			const hasImportFingerprint = transactionColumns.some(
				(column) => column.name === 'import_fingerprint',
			);

			if (!hasImportFingerprint) {
				db.exec(`ALTER TABLE transactions ADD COLUMN import_fingerprint TEXT;`);
			}

			const rows = db
				.prepare(
					`SELECT id, booking_date, description, amount, currency
					 FROM transactions
					 WHERE import_fingerprint IS NULL OR TRIM(import_fingerprint) = ''`,
				)
				.all() as Array<{
					id: string;
					booking_date: string;
					description: string;
					amount: number;
					currency: string | null;
				}>;

			const updateFingerprint = db.prepare(`
				UPDATE transactions
				SET import_fingerprint = ?
				WHERE id = ?
			`);

			for (const row of rows) {
				const fingerprint = createHash('sha256')
					.update(
						[
							row.booking_date,
							row.description.trim(),
							Number(row.amount).toFixed(2),
							(row.currency ?? 'SEK').toUpperCase(),
						].join('|'),
					)
					.digest('hex');
				updateFingerprint.run(fingerprint, row.id);
			}

			const createTableRow = db
				.prepare(
					`SELECT sql
					 FROM sqlite_master
					 WHERE type = 'table' AND name = 'transactions'`,
				)
				.get() as { sql: string | null } | undefined;
			const createTableSql = createTableRow?.sql ?? '';
			if (!createTableSql.includes('import_fingerprint TEXT NOT NULL')) {
				db.exec(`
					ALTER TABLE transactions RENAME TO transactions_legacy_0016;

					CREATE TABLE transactions (
						id TEXT PRIMARY KEY,
						booking_date TEXT NOT NULL,
						description TEXT NOT NULL,
						normalized_description TEXT NOT NULL,
						amount NUMERIC NOT NULL,
						currency TEXT NOT NULL DEFAULT 'SEK',
						import_fingerprint TEXT NOT NULL,
						category_id TEXT REFERENCES budget_categories(id) ON DELETE SET NULL,
						match_method TEXT NOT NULL CHECK(match_method IN ('rule_exact', 'history_exact', 'heuristic_keyword', 'codex_auto', 'codex_suggested', 'manual', 'needs_review', 'skipped_non_expense')),
						categorization_status TEXT NOT NULL DEFAULT 'needs_review' CHECK(categorization_status IN ('categorized', 'suggested', 'needs_review', 'skipped')),
						categorization_source TEXT NOT NULL DEFAULT 'rule_exact' CHECK(categorization_source IN ('rule_exact', 'history_exact', 'heuristic_keyword', 'codex_auto', 'codex_suggested', 'manual', 'skipped_non_expense')),
						suggested_category_id TEXT REFERENCES budget_categories(id) ON DELETE SET NULL,
						suggested_confidence NUMERIC,
						suggested_reason TEXT,
						suggested_by_model TEXT,
						suggested_at TEXT,
						import_batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
						created_at TEXT NOT NULL,
						updated_at TEXT NOT NULL
					);

					INSERT INTO transactions (
						id,
						booking_date,
						description,
						normalized_description,
						amount,
						currency,
						import_fingerprint,
						category_id,
						match_method,
						categorization_status,
						categorization_source,
						suggested_category_id,
						suggested_confidence,
						suggested_reason,
						suggested_by_model,
						suggested_at,
						import_batch_id,
						created_at,
						updated_at
					)
					SELECT
						id,
						booking_date,
						description,
						normalized_description,
						amount,
						COALESCE(currency, 'SEK'),
						import_fingerprint,
						category_id,
						match_method,
						categorization_status,
						categorization_source,
						suggested_category_id,
						suggested_confidence,
						suggested_reason,
						suggested_by_model,
						suggested_at,
						import_batch_id,
						created_at,
						updated_at
					FROM transactions_legacy_0016;

					DROP TABLE transactions_legacy_0016;
				`);
			}

			db.exec(`
				CREATE INDEX IF NOT EXISTS idx_transactions_import_batch_id
				ON transactions (import_batch_id);

				CREATE INDEX IF NOT EXISTS idx_transactions_normalized_description
				ON transactions (normalized_description);

				CREATE INDEX IF NOT EXISTS idx_transactions_category_id
				ON transactions (category_id);

				CREATE INDEX IF NOT EXISTS idx_transactions_match_method
				ON transactions (match_method);

				CREATE INDEX IF NOT EXISTS idx_transactions_categorization_status
				ON transactions (categorization_status);

				CREATE INDEX IF NOT EXISTS idx_transactions_categorization_source
				ON transactions (categorization_source);

				CREATE INDEX IF NOT EXISTS idx_transactions_suggested_category_id
				ON transactions (suggested_category_id);

				CREATE INDEX IF NOT EXISTS idx_transactions_booking_date
				ON transactions (booking_date);

				CREATE UNIQUE INDEX IF NOT EXISTS transactions_import_fingerprint_unique
				ON transactions (import_fingerprint);
			`);
		},
	},
	{
		id: '20260416_0017_budget_categories_integer_id',
		description:
			'Migrate budget_categories.id from TEXT (UUID) to INTEGER, and update all referencing foreign keys',
		up: (db) => {
			db.exec(`
				-- We're inside a transaction (the framework wraps up() in one), so we
				-- can't disable foreign_keys. defer_foreign_keys postpones FK checks
				-- until COMMIT, which lets us rebuild parent + children atomically.
				PRAGMA defer_foreign_keys = ON;

				-- Step 1: build a mapping from old TEXT id -> new INTEGER id.
				-- AUTOINCREMENT keeps ids stable and monotonic (no rowid reuse).
				CREATE TABLE _category_id_map (
					new_id INTEGER PRIMARY KEY AUTOINCREMENT,
					old_id TEXT NOT NULL UNIQUE
				);
				INSERT INTO _category_id_map (old_id)
				SELECT id FROM budget_categories ORDER BY created_at, id;

				-- Step 2: rebuild budget_categories with INTEGER id.
				CREATE TABLE budget_categories_new (
					id INTEGER PRIMARY KEY,
					name TEXT NOT NULL,
					description TEXT,
					color TEXT,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
				INSERT INTO budget_categories_new (id, name, description, color, created_at, updated_at)
				SELECT m.new_id, bc.name, bc.description, bc.color, bc.created_at, bc.updated_at
				FROM budget_categories bc
				JOIN _category_id_map m ON m.old_id = bc.id;
				DROP TABLE budget_categories;
				ALTER TABLE budget_categories_new RENAME TO budget_categories;

				-- Step 3: rebuild recurring_costs with INTEGER category_id (NOT NULL, CASCADE).
				CREATE TABLE recurring_costs_new (
					id TEXT PRIMARY KEY,
					category_id INTEGER NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
					name TEXT NOT NULL,
					amount NUMERIC NOT NULL,
					period TEXT NOT NULL CHECK(period IN ('weekly', 'monthly', 'yearly')),
					start_date TEXT,
					end_date TEXT,
					is_active INTEGER NOT NULL DEFAULT 1,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL,
					is_essential INTEGER NOT NULL DEFAULT 0,
					kind TEXT NOT NULL DEFAULT 'expense' CHECK(kind IN ('expense', 'investment'))
				);
				INSERT INTO recurring_costs_new (
					id, category_id, name, amount, period, start_date, end_date,
					is_active, created_at, updated_at, is_essential, kind
				)
				SELECT rc.id, m.new_id, rc.name, rc.amount, rc.period, rc.start_date, rc.end_date,
					rc.is_active, rc.created_at, rc.updated_at, rc.is_essential, rc.kind
				FROM recurring_costs rc
				JOIN _category_id_map m ON m.old_id = rc.category_id;
				DROP TABLE recurring_costs;
				ALTER TABLE recurring_costs_new RENAME TO recurring_costs;
				CREATE INDEX idx_recurring_costs_category_id ON recurring_costs (category_id);
				CREATE INDEX idx_recurring_costs_is_active ON recurring_costs (is_active);
				CREATE INDEX idx_recurring_costs_kind ON recurring_costs (kind);

				-- Step 4: rebuild merchant_category_rules with INTEGER category_id (NOT NULL, CASCADE).
				CREATE TABLE merchant_category_rules_new (
					id TEXT PRIMARY KEY,
					normalized_description TEXT NOT NULL UNIQUE,
					category_id INTEGER NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
					confidence NUMERIC NOT NULL DEFAULT 1,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
				INSERT INTO merchant_category_rules_new (
					id, normalized_description, category_id, confidence, created_at, updated_at
				)
				SELECT r.id, r.normalized_description, m.new_id, r.confidence, r.created_at, r.updated_at
				FROM merchant_category_rules r
				JOIN _category_id_map m ON m.old_id = r.category_id;
				DROP TABLE merchant_category_rules;
				ALTER TABLE merchant_category_rules_new RENAME TO merchant_category_rules;
				CREATE INDEX idx_merchant_category_rules_category_id ON merchant_category_rules (category_id);

				-- Step 5: rebuild merchant_category_codex_cache with INTEGER suggested_category_id
				-- (nullable, SET NULL). LEFT JOIN so rows with NULL suggestions survive.
				CREATE TABLE merchant_category_codex_cache_new (
					id TEXT PRIMARY KEY,
					normalized_description TEXT NOT NULL,
					sample_description TEXT NOT NULL,
					suggested_category_id INTEGER REFERENCES budget_categories(id) ON DELETE SET NULL,
					confidence NUMERIC NOT NULL,
					reason TEXT,
					model_label TEXT NOT NULL,
					prompt_version TEXT NOT NULL,
					categories_hash TEXT NOT NULL,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
				INSERT INTO merchant_category_codex_cache_new (
					id, normalized_description, sample_description, suggested_category_id,
					confidence, reason, model_label, prompt_version, categories_hash,
					created_at, updated_at
				)
				SELECT c.id, c.normalized_description, c.sample_description, m.new_id,
					c.confidence, c.reason, c.model_label, c.prompt_version, c.categories_hash,
					c.created_at, c.updated_at
				FROM merchant_category_codex_cache c
				LEFT JOIN _category_id_map m ON m.old_id = c.suggested_category_id;
				DROP TABLE merchant_category_codex_cache;
				ALTER TABLE merchant_category_codex_cache_new RENAME TO merchant_category_codex_cache;
				CREATE UNIQUE INDEX merchant_category_codex_cache_lookup_unique
					ON merchant_category_codex_cache (normalized_description, prompt_version, categories_hash);
				CREATE INDEX idx_merchant_category_codex_cache_category_id
					ON merchant_category_codex_cache (suggested_category_id);

				-- Step 6: rebuild transactions with INTEGER category_id and suggested_category_id
				-- (both nullable, SET NULL). Two LEFT JOINs against the mapping table.
				CREATE TABLE transactions_new (
					id TEXT PRIMARY KEY,
					booking_date TEXT NOT NULL,
					description TEXT NOT NULL,
					normalized_description TEXT NOT NULL,
					amount NUMERIC NOT NULL,
					currency TEXT NOT NULL DEFAULT 'SEK',
					import_fingerprint TEXT NOT NULL,
					category_id INTEGER REFERENCES budget_categories(id) ON DELETE SET NULL,
					match_method TEXT NOT NULL CHECK(match_method IN ('rule_exact', 'history_exact', 'heuristic_keyword', 'codex_auto', 'codex_suggested', 'manual', 'needs_review', 'skipped_non_expense')),
					categorization_status TEXT NOT NULL DEFAULT 'needs_review' CHECK(categorization_status IN ('categorized', 'suggested', 'needs_review', 'skipped')),
					categorization_source TEXT NOT NULL DEFAULT 'rule_exact' CHECK(categorization_source IN ('rule_exact', 'history_exact', 'heuristic_keyword', 'codex_auto', 'codex_suggested', 'manual', 'skipped_non_expense')),
					suggested_category_id INTEGER REFERENCES budget_categories(id) ON DELETE SET NULL,
					suggested_confidence NUMERIC,
					suggested_reason TEXT,
					suggested_by_model TEXT,
					suggested_at TEXT,
					import_batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
				INSERT INTO transactions_new (
					id, booking_date, description, normalized_description, amount, currency,
					import_fingerprint, category_id, match_method, categorization_status,
					categorization_source, suggested_category_id, suggested_confidence,
					suggested_reason, suggested_by_model, suggested_at, import_batch_id,
					created_at, updated_at
				)
				SELECT t.id, t.booking_date, t.description, t.normalized_description, t.amount, t.currency,
					t.import_fingerprint, m1.new_id, t.match_method, t.categorization_status,
					t.categorization_source, m2.new_id, t.suggested_confidence, t.suggested_reason,
					t.suggested_by_model, t.suggested_at, t.import_batch_id, t.created_at, t.updated_at
				FROM transactions t
				LEFT JOIN _category_id_map m1 ON m1.old_id = t.category_id
				LEFT JOIN _category_id_map m2 ON m2.old_id = t.suggested_category_id;
				DROP TABLE transactions;
				ALTER TABLE transactions_new RENAME TO transactions;

				-- Recreate transactions indexes (mirrors migration 0016).
				CREATE INDEX idx_transactions_import_batch_id ON transactions (import_batch_id);
				CREATE INDEX idx_transactions_normalized_description ON transactions (normalized_description);
				CREATE INDEX idx_transactions_category_id ON transactions (category_id);
				CREATE INDEX idx_transactions_match_method ON transactions (match_method);
				CREATE INDEX idx_transactions_categorization_status ON transactions (categorization_status);
				CREATE INDEX idx_transactions_categorization_source ON transactions (categorization_source);
				CREATE INDEX idx_transactions_suggested_category_id ON transactions (suggested_category_id);
				CREATE INDEX idx_transactions_booking_date ON transactions (booking_date);
				CREATE UNIQUE INDEX transactions_import_fingerprint_unique ON transactions (import_fingerprint);

				-- Step 7: drop the temporary mapping table.
				DROP TABLE _category_id_map;
			`);
		},
	},
	{
		id: '20260416_0018_recurring_costs_integer_id',
		description: 'Migrate recurring_costs.id from TEXT (UUID) to INTEGER PRIMARY KEY AUTOINCREMENT',
		up: (db) => {
			db.exec(`
				-- No other tables reference recurring_costs.id, so we don't need a
				-- mapping table — just rebuild with an autoincrementing INTEGER id.
				CREATE TABLE recurring_costs_new (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					category_id INTEGER NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
					name TEXT NOT NULL,
					amount NUMERIC NOT NULL,
					period TEXT NOT NULL CHECK(period IN ('weekly', 'monthly', 'yearly')),
					start_date TEXT,
					end_date TEXT,
					is_active INTEGER NOT NULL DEFAULT 1,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL,
					is_essential INTEGER NOT NULL DEFAULT 0,
					kind TEXT NOT NULL DEFAULT 'expense' CHECK(kind IN ('expense', 'investment'))
				);
				INSERT INTO recurring_costs_new (
					category_id, name, amount, period, start_date, end_date,
					is_active, created_at, updated_at, is_essential, kind
				)
				SELECT category_id, name, amount, period, start_date, end_date,
					is_active, created_at, updated_at, is_essential, kind
				FROM recurring_costs
				ORDER BY created_at, id;
				DROP TABLE recurring_costs;
				ALTER TABLE recurring_costs_new RENAME TO recurring_costs;
				CREATE INDEX idx_recurring_costs_category_id ON recurring_costs (category_id);
				CREATE INDEX idx_recurring_costs_is_active ON recurring_costs (is_active);
				CREATE INDEX idx_recurring_costs_kind ON recurring_costs (kind);
			`);
		},
	},
	{
		id: '20260416_0019_drop_recurring_costs_is_active',
		description: 'Drop unused is_active column and index from recurring_costs',
		up: (db) => {
			const columnRows = db.prepare(`PRAGMA table_info(recurring_costs)`).all() as Array<{
				name: string;
			}>;
			const hasIsActive = columnRows.some((column) => column.name === 'is_active');
			if (!hasIsActive) {
				return;
			}

			db.exec(`
				DROP INDEX IF EXISTS idx_recurring_costs_is_active;
				ALTER TABLE recurring_costs DROP COLUMN is_active;
			`);
		},
	},
	{
		id: '20260419_0020_planned_purchases_integer_id',
		description:
			'Migrate wishlist_categories.id and wishlist_items.id from TEXT (UUID) to INTEGER, and update referencing foreign keys',
		up: (db) => {
			db.exec(`
				-- Mirrors migration 0017: defer_foreign_keys lets us rebuild parent +
				-- children atomically inside the wrapping transaction.
				PRAGMA defer_foreign_keys = ON;

				-- Step 1: map old TEXT category id -> new INTEGER id. AUTOINCREMENT
				-- keeps ids stable and monotonic across the rebuild.
				CREATE TABLE _wishlist_category_id_map (
					new_id INTEGER PRIMARY KEY AUTOINCREMENT,
					old_id TEXT NOT NULL UNIQUE
				);
				INSERT INTO _wishlist_category_id_map (old_id)
				SELECT id FROM wishlist_categories ORDER BY created_at, id;

				-- Step 2: rebuild wishlist_categories with INTEGER id.
				CREATE TABLE wishlist_categories_new (
					id INTEGER PRIMARY KEY,
					name TEXT NOT NULL UNIQUE,
					description TEXT,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
				INSERT INTO wishlist_categories_new (id, name, description, created_at, updated_at)
				SELECT m.new_id, wc.name, wc.description, wc.created_at, wc.updated_at
				FROM wishlist_categories wc
				JOIN _wishlist_category_id_map m ON m.old_id = wc.id;
				DROP TABLE wishlist_categories;
				ALTER TABLE wishlist_categories_new RENAME TO wishlist_categories;

				-- Step 3: rebuild wishlist_items with INTEGER PRIMARY KEY AUTOINCREMENT
				-- and INTEGER category_id FK. linked_loan_id stays TEXT — loans.id
				-- is still TEXT and isn't in scope for this migration.
				CREATE TABLE wishlist_items_new (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL,
					target_amount NUMERIC NOT NULL,
					target_amount_type TEXT NOT NULL DEFAULT 'exact' CHECK(target_amount_type IN ('exact', 'estimate')),
					target_date TEXT,
					priority INTEGER NOT NULL DEFAULT 5 CHECK(priority >= 0 AND priority <= 10),
					category_id INTEGER REFERENCES wishlist_categories(id) ON DELETE SET NULL,
					funding_strategy TEXT NOT NULL CHECK(funding_strategy IN ('save', 'loan', 'mixed', 'buy_outright')),
					linked_loan_id TEXT REFERENCES loans(id) ON DELETE SET NULL,
					currency TEXT NOT NULL DEFAULT 'SEK',
					notes TEXT,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
				INSERT INTO wishlist_items_new (
					name, target_amount, target_amount_type, target_date, priority,
					category_id, funding_strategy, linked_loan_id, currency, notes,
					created_at, updated_at
				)
				SELECT wi.name, wi.target_amount, wi.target_amount_type, wi.target_date, wi.priority,
					m.new_id, wi.funding_strategy, wi.linked_loan_id, wi.currency, wi.notes,
					wi.created_at, wi.updated_at
				FROM wishlist_items wi
				LEFT JOIN _wishlist_category_id_map m ON m.old_id = wi.category_id
				ORDER BY wi.created_at, wi.id;
				DROP TABLE wishlist_items;
				ALTER TABLE wishlist_items_new RENAME TO wishlist_items;
				CREATE INDEX idx_wishlist_priority ON wishlist_items (priority);
				CREATE INDEX idx_wishlist_funding_strategy ON wishlist_items (funding_strategy);
				CREATE INDEX idx_wishlist_linked_loan_id ON wishlist_items (linked_loan_id);
				CREATE INDEX idx_wishlist_category_id ON wishlist_items (category_id);

				-- Step 4: drop the mapping table.
				DROP TABLE _wishlist_category_id_map;
			`);
		},
	},
	{
		id: '20260424_0021_loans_integer_id',
		description:
			'Migrate loans.id from TEXT (UUID) to INTEGER, and flip wishlist_items.linked_loan_id to INTEGER alongside it',
		up: (db) => {
			db.exec(`
				-- Mirrors migrations 0017 and 0020: defer FK checks so parent +
				-- child rebuilds can happen atomically inside the wrapping txn.
				PRAGMA defer_foreign_keys = ON;

				-- Step 1: map old TEXT loan id -> new INTEGER id. AUTOINCREMENT
				-- keeps ids stable and monotonic across the rebuild.
				CREATE TABLE _loan_id_map (
					new_id INTEGER PRIMARY KEY AUTOINCREMENT,
					old_id TEXT NOT NULL UNIQUE
				);
				INSERT INTO _loan_id_map (old_id)
				SELECT id FROM loans ORDER BY created_at, id;

				-- Step 2: rebuild loans with INTEGER PRIMARY KEY AUTOINCREMENT.
				CREATE TABLE loans_new (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					direction TEXT NOT NULL CHECK(direction IN ('lent', 'borrowed')),
					counterparty TEXT NOT NULL,
					principal_amount NUMERIC NOT NULL,
					outstanding_amount NUMERIC NOT NULL,
					currency TEXT NOT NULL DEFAULT 'SEK',
					issue_date TEXT NOT NULL,
					due_date TEXT,
					status TEXT NOT NULL CHECK(status IN ('open', 'paid', 'overdue')),
					notes TEXT,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
				INSERT INTO loans_new (
					id, direction, counterparty, principal_amount, outstanding_amount,
					currency, issue_date, due_date, status, notes, created_at, updated_at
				)
				SELECT m.new_id, l.direction, l.counterparty, l.principal_amount, l.outstanding_amount,
					l.currency, l.issue_date, l.due_date, l.status, l.notes, l.created_at, l.updated_at
				FROM loans l
				JOIN _loan_id_map m ON m.old_id = l.id;
				DROP TABLE loans;
				ALTER TABLE loans_new RENAME TO loans;
				CREATE INDEX idx_loans_direction ON loans (direction);
				CREATE INDEX idx_loans_status ON loans (status);
				CREATE INDEX idx_loans_due_date ON loans (due_date);

				-- Step 3: rebuild wishlist_items with INTEGER linked_loan_id
				-- (nullable, SET NULL). LEFT JOIN so rows without a linked loan
				-- survive. This is the only table that references loans.id.
				CREATE TABLE wishlist_items_new (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL,
					target_amount NUMERIC NOT NULL,
					target_amount_type TEXT NOT NULL DEFAULT 'exact' CHECK(target_amount_type IN ('exact', 'estimate')),
					target_date TEXT,
					priority INTEGER NOT NULL DEFAULT 5 CHECK(priority >= 0 AND priority <= 10),
					category_id INTEGER REFERENCES wishlist_categories(id) ON DELETE SET NULL,
					funding_strategy TEXT NOT NULL CHECK(funding_strategy IN ('save', 'loan', 'mixed', 'buy_outright')),
					linked_loan_id INTEGER REFERENCES loans(id) ON DELETE SET NULL,
					currency TEXT NOT NULL DEFAULT 'SEK',
					notes TEXT,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
				INSERT INTO wishlist_items_new (
					id, name, target_amount, target_amount_type, target_date, priority,
					category_id, funding_strategy, linked_loan_id, currency, notes,
					created_at, updated_at
				)
				SELECT wi.id, wi.name, wi.target_amount, wi.target_amount_type, wi.target_date, wi.priority,
					wi.category_id, wi.funding_strategy, m.new_id, wi.currency, wi.notes,
					wi.created_at, wi.updated_at
				FROM wishlist_items wi
				LEFT JOIN _loan_id_map m ON m.old_id = wi.linked_loan_id
				ORDER BY wi.created_at, wi.id;
				DROP TABLE wishlist_items;
				ALTER TABLE wishlist_items_new RENAME TO wishlist_items;
				CREATE INDEX idx_wishlist_priority ON wishlist_items (priority);
				CREATE INDEX idx_wishlist_funding_strategy ON wishlist_items (funding_strategy);
				CREATE INDEX idx_wishlist_linked_loan_id ON wishlist_items (linked_loan_id);
				CREATE INDEX idx_wishlist_category_id ON wishlist_items (category_id);

				-- Step 4: drop the mapping table.
				DROP TABLE _loan_id_map;
			`);
		},
	},
	{
		id: '20260424_0022_financial_profile_integer_id',
		description:
			'Migrate financial_profile.id from TEXT to INTEGER PRIMARY KEY AUTOINCREMENT',
		up: (db) => {
			db.exec(`
				-- Singleton table — exactly one row in practice ('default'). No
				-- other tables reference financial_profile.id, so we don't need a
				-- mapping table; just rebuild and copy the single row over.
				CREATE TABLE financial_profile_new (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					monthly_salary NUMERIC NOT NULL DEFAULT 40000,
					salary_growth NUMERIC NOT NULL DEFAULT 6,
					municipal_tax_rate NUMERIC NOT NULL DEFAULT 32.41,
					savings_share_of_raise NUMERIC NOT NULL DEFAULT 50,
					currency TEXT NOT NULL DEFAULT 'SEK',
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
				INSERT INTO financial_profile_new (
					monthly_salary, salary_growth, municipal_tax_rate,
					savings_share_of_raise, currency, created_at, updated_at
				)
				SELECT monthly_salary, salary_growth, municipal_tax_rate,
					savings_share_of_raise, currency, created_at, updated_at
				FROM financial_profile
				ORDER BY created_at, id;
				DROP TABLE financial_profile;
				ALTER TABLE financial_profile_new RENAME TO financial_profile;
			`);
		},
	},
];
