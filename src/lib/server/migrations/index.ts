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
		}
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
		}
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
				) VALUES (?, ?, ?, ?, ?, ?, ?)`
			).run(accountId, 'Nordea funds', 'Nordea', 'SEK', 700000, timestamp, timestamp);

			const insertHolding = db.prepare(
				`INSERT INTO investment_holdings (
					id, account_id, name, allocation_percent, current_value, sort_order, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			);

			insertHolding.run('seed-holding-global', accountId, 'Global', 40, 280000, 0, timestamp, timestamp);
			insertHolding.run('seed-holding-sweden', accountId, 'Sweden', 20, 140000, 1, timestamp, timestamp);
			insertHolding.run('seed-holding-europe', accountId, 'Europe', 20, 140000, 2, timestamp, timestamp);
			insertHolding.run(
				'seed-holding-emerging-markets',
				accountId,
				'Emerging markets',
				20,
				140000,
				3,
				timestamp,
				timestamp
			);
		}
	},
	{
		id: '20260221_0004_budget_is_essential',
		description: 'Add essential flag to recurring costs for expense classification',
		up: (db) => {
			const columnRows = db
				.prepare(`PRAGMA table_info(recurring_costs)`)
				.all() as Array<{ name: string }>;
			const hasEssentialColumn = columnRows.some((column) => column.name === 'is_essential');

			if (!hasEssentialColumn) {
				db.exec(`
					ALTER TABLE recurring_costs
					ADD COLUMN is_essential INTEGER NOT NULL DEFAULT 0;
				`);
			}
		}
	},
	{
		id: '20260221_0005_budget_cost_kind',
		description: 'Add kind to recurring costs to separate expenses and investments',
		up: (db) => {
			const columnRows = db
				.prepare(`PRAGMA table_info(recurring_costs)`)
				.all() as Array<{ name: string }>;
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
		}
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
		}
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
		}
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
					match_method TEXT NOT NULL CHECK(match_method IN ('rule_exact', 'history_exact', 'manual', 'needs_review')),
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
		}
	},
	{
		id: '20260306_0009_investment_tracking',
		description: 'Add tracker metadata and snapshots for investment holdings',
		up: (db) => {
			const holdingColumns = db
				.prepare(`PRAGMA table_info(investment_holdings)`)
				.all() as Array<{ name: string }>;

			const ensureHoldingColumn = (name: string, sql: string) => {
				if (!holdingColumns.some((column) => column.name === name)) {
					db.exec(sql);
				}
			};

			ensureHoldingColumn(
				'units',
				`ALTER TABLE investment_holdings ADD COLUMN units NUMERIC;`
			);
			ensureHoldingColumn(
				'latest_unit_price',
				`ALTER TABLE investment_holdings ADD COLUMN latest_unit_price NUMERIC;`
			);
			ensureHoldingColumn(
				'tracker_source',
				`ALTER TABLE investment_holdings ADD COLUMN tracker_source TEXT NOT NULL DEFAULT 'manual' CHECK(tracker_source IN ('manual', 'nordea', 'avanza'));`
			);
			ensureHoldingColumn(
				'tracker_url',
				`ALTER TABLE investment_holdings ADD COLUMN tracker_url TEXT;`
			);
			ensureHoldingColumn(
				'latest_price_date',
				`ALTER TABLE investment_holdings ADD COLUMN latest_price_date TEXT;`
			);
			ensureHoldingColumn(
				'last_synced_at',
				`ALTER TABLE investment_holdings ADD COLUMN last_synced_at TEXT;`
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
					url: 'https://www.nordeafunds.com/sv/fonder/emerging-markets-enhanced-bp'
				},
				{
					id: 'seed-holding-europe',
					name: 'Nordea Europa Index Select A',
					currentValue: 79800.31,
					units: 698.78,
					unitPrice: 114.2,
					url: 'https://www.nordeafunds.com/sv/fonder/europa-index-select-a'
				},
				{
					id: 'seed-holding-global',
					name: 'Nordea Global Index Select A',
					currentValue: 408176.23,
					units: 685.8,
					unitPrice: 595.19,
					url: 'https://www.nordeafunds.com/sv/fonder/global-index-select-a'
				},
				{
					id: 'seed-holding-sweden',
					name: 'Nordea Sverige Passiv',
					currentValue: 131513.44,
					units: 244.18,
					unitPrice: 538.59,
					url: 'https://www.nordeafunds.com/sv/fonder/sverige-passiv-a-a'
				}
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
				`SELECT COUNT(*) AS count FROM investment_holding_snapshots WHERE holding_id = ?`
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
					timestamp
				});

				const snapshotCountRow = existingSnapshotCount.get(seed.id) as { count: number };
				if (snapshotCountRow.count === 0) {
					insertSnapshot.run(
						`${seed.id}-baseline-20260306`,
						seed.id,
						seed.currentValue,
						seed.unitPrice,
						seed.units,
						timestamp
					);
				}
			}

			db.prepare(
				`UPDATE investment_accounts
				 SET total_value = ?, updated_at = ?
				 WHERE id = 'seed-account-nordea-funds'`
			).run(695974.15, timestamp);
		}
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
					 LIMIT 1`
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
					sortOrder: 10
				},
				{
					id: 'seed-holding-avanza-emerging-markets',
					name: 'Avanza Emerging Markets',
					currentValue: 1018,
					units: 6.304186,
					unitPrice: 161.48,
					url: 'https://www.avanza.se/avanza-emerging-markets',
					sortOrder: 11
				}
			];

			const existingHolding = db.prepare(`SELECT id FROM investment_holdings WHERE id = ?`);
			const insertHolding = db.prepare(`
				INSERT INTO investment_holdings (
					id, account_id, name, allocation_percent, current_value, units, latest_unit_price,
					tracker_source, tracker_url, latest_price_date, last_synced_at, sort_order, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, 'avanza', ?, '2026-03-05', ?, ?, ?, ?)
			`);
			const snapshotExists = db.prepare(
				`SELECT COUNT(*) AS count FROM investment_holding_snapshots WHERE holding_id = ?`
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
						timestamp
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
						timestamp
					);
				}
			}
		}
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
				['Avanza Emerging Markets', 30]
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
		}
	},
	{
		id: '20260306_0012_wishlist_item_shape',
		description: 'Add wishlist amount type, category, and numeric priority',
		up: (db) => {
			const wishlistColumns = db
				.prepare(`PRAGMA table_info(wishlist_items)`)
				.all() as Array<{ name: string }>;

			const ensureColumn = (name: string, sql: string) => {
				if (!wishlistColumns.some((column) => column.name === name)) {
					db.exec(sql);
				}
			};

			ensureColumn(
				'target_amount_type',
				`ALTER TABLE wishlist_items ADD COLUMN target_amount_type TEXT NOT NULL DEFAULT 'exact' CHECK(target_amount_type IN ('exact', 'estimate'));`
			);
			ensureColumn(
				'category',
				`ALTER TABLE wishlist_items ADD COLUMN category TEXT;`
			);

			const priorityColumn = wishlistColumns.find((column) => column.name === 'priority');
			if (priorityColumn) {
				const priorityTypeRow = db
					.prepare(`SELECT typeof(priority) AS type FROM wishlist_items WHERE priority IS NOT NULL LIMIT 1`)
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
		}
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

			const itemColumns = db
				.prepare(`PRAGMA table_info(wishlist_items)`)
				.all() as Array<{ name: string }>;

			const hasCategoryId = itemColumns.some((column) => column.name === 'category_id');
			if (!hasCategoryId) {
				db.exec(`ALTER TABLE wishlist_items ADD COLUMN category_id TEXT REFERENCES wishlist_categories(id) ON DELETE SET NULL;`);
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
					const categoryId = `wishlist-category-${row.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'general'}`;
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
		}
	}
];
