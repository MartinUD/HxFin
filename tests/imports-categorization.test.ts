import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, beforeEach } from 'node:test';

import * as Effect from 'effect/Effect';

const tempDir = mkdtempSync(join(tmpdir(), 'fin-imports-'));
process.env.BUDGET_DB_PATH = join(tempDir, 'budget.db');

const [
	{ ensureSchema },
	{
		importNordeaCsvWithDependencies,
		assignTransactionCategoryEffect,
		reprocessImportTransactionsWithDependencies,
		suggestTransactionCategoryWithCodexWithDependencies,
	},
	{ listCategories, listTransactionsByImportBatchId, listReviewTransactions, upsertMerchantCategoryRule },
	{ default: db },
	{ findHeuristicCategoryMatch },
	{
		buildCodexCategorizationPrompt,
		buildSingleTransactionCategoryPrompt,
		parseCodexCategorizationResponse,
		parseSingleTransactionCategoryResponse,
	},
	{ parseBatchResponse },
] = await Promise.all([
	import('../src/lib/server/schema.ts'),
	import('../src/lib/server/imports/service.ts'),
	import('../src/lib/server/imports/repository.ts'),
	import('../src/lib/server/db.ts'),
	import('../src/lib/server/imports/heuristic-categorization.ts'),
	import('../src/lib/server/imports/codex-categorization.ts'),
	import('../src/lib/server/imports/ai-categorization.ts'),
]);

// Seeds a budget category row directly — the production write path lives in
// the Rust backend now, so we no longer import it from TS. Inlined here
// because only the tests still create categories in-process.
function createCategory(input: {
	name: string;
	description: string | null;
	color: string | null;
}): { id: number; name: string } {
	const timestamp = new Date().toISOString();
	const result = db
		.prepare(
			`INSERT INTO budget_categories (name, description, color, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)
			 RETURNING id, name`,
		)
		.get(input.name, input.description, input.color, timestamp, timestamp) as
		| { id: number; name: string }
		| undefined;
	if (!result) {
		throw new Error('Failed to insert budget category');
	}
	return result;
}

function resetDatabase(): void {
	ensureSchema();
	db.exec(`
		DELETE FROM merchant_category_codex_cache;
		DELETE FROM merchant_category_rules;
		DELETE FROM transactions;
		DELETE FROM import_batches;
		DELETE FROM budget_categories;
	`);
}

function createCsv(
	rows: Array<{ bookingDate: string; amount: string; description: string }>,
): string {
	return [
		'\uFEFFBokf\u00f6ringsdag;Belopp;Avs\u00e4ndare;Mottagare;Namn;Rubrik;Saldo;Valuta;',
		...rows.map(
			(row) => `${row.bookingDate};${row.amount};0000 00 00001;;;${row.description};100688,69;SEK;`,
		),
	].join('\n');
}

beforeEach(() => {
	resetDatabase();
});

describe('imports categorization flow', () => {
	it('categorizes obvious merchants heuristically without Codex', async () => {
		const food = createCategory({ name: 'Food', description: null, color: null });
		createCategory({ name: 'Groceries', description: null, color: null });
		createCategory({ name: 'Transport', description: null, color: null });

		let codexCalls = 0;
		const result = await importNordeaCsvWithDependencies(
			{
				sourceName: 'heuristic.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/19',
						amount: '-120,00',
						description: 'Kortk\u00f6p 260319 Foodora AB',
					},
				]),
			},
			{
				codexCategorizer: async () => {
					codexCalls += 1;
					return [];
				},
			},
		);

		assert.equal(codexCalls, 0);
		assert.equal(result.summary.categorizedByHeuristic, 1);

		const transactions = listTransactionsByImportBatchId(result.batch.id);
		assert.equal(transactions[0]?.categoryId, food.id);
		assert.equal(transactions[0]?.matchMethod, 'manual');
		assert.equal(transactions[0]?.categorizationSource, 'heuristic_keyword');
		assert.equal(transactions[0]?.categorizationStatus, 'categorized');
	});

	it('skips non-expense rows from categorization', async () => {
		createCategory({ name: 'Food', description: null, color: null });

		const result = await importNordeaCsvWithDependencies(
			{
				sourceName: 'income.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/19',
						amount: '478,00',
						description: 'Swish inbetalning EXEMPEL',
					},
				]),
			},
			{
				codexCategorizer: async () => {
					throw new Error('Codex should not run for income');
				},
			},
		);

		assert.equal(result.summary.skippedNonExpense, 1);
		assert.equal(result.summary.needsReview, 0);
		assert.equal(listReviewTransactions().length, 0);

		const transactions = listTransactionsByImportBatchId(result.batch.id);
		assert.equal(transactions[0]?.matchMethod, 'needs_review');
		assert.equal(transactions[0]?.categorizationStatus, 'skipped');
		assert.equal(transactions[0]?.categorizationSource, 'skipped_non_expense');
	});

	it('batches duplicate unresolved merchants into one AI input and skips overlapping duplicate imports later', async () => {
		const shopping = createCategory({ name: 'Shopping', description: null, color: null });
		let codexCalls = 0;

		const codexCategorizer = async (input: {
			merchants: Array<{ normalizedDescription: string }>;
		}) => {
			codexCalls += 1;
			assert.equal(input.merchants.length, 1);
			return [
				{
					normalizedDescription: input.merchants[0].normalizedDescription,
					suggestedCategoryId: shopping.id,
					confidence: 0.72,
					reason: 'Likely shopping merchant',
					isCertain: false,
				},
			];
		};

		const csv = createCsv([
			{
				bookingDate: '2026/03/19',
				amount: '-59,00',
				description: 'Kortk\u00f6p 260319 Mystery Shop AB',
			},
			{
				bookingDate: '2026/03/18',
				amount: '-129,00',
				description: 'Kortk\u00f6p 260318 Mystery Shop AB',
			},
		]);

		const firstImport = await importNordeaCsvWithDependencies(
			{ sourceName: 'first.csv', csvText: csv },
			{ codexCategorizer },
		);
		assert.equal(firstImport.summary.suggestedByCodex, 2);
		assert.equal(codexCalls, 1);
		const firstTransactions = listTransactionsByImportBatchId(firstImport.batch.id);
		assert.equal(firstTransactions[0]?.matchMethod, 'needs_review');
		assert.equal(firstTransactions[1]?.matchMethod, 'needs_review');

		const secondImport = await importNordeaCsvWithDependencies(
			{ sourceName: 'second.csv', csvText: csv },
			{
				codexCategorizer: async () => {
					throw new Error('Expected duplicate detection to bypass AI');
				},
			},
		);
		assert.equal(secondImport.summary.inserted, 0);
		assert.equal(secondImport.summary.skippedDuplicates, 2);
		assert.equal(codexCalls, 1);
	});

	it('creates review suggestions for low-confidence Codex matches and saves manual review as a rule', async () => {
		const utilities = createCategory({ name: 'Utilities', description: null, color: null });

		const firstImport = await importNordeaCsvWithDependencies(
			{
				sourceName: 'suggested.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/19',
						amount: '-350,00',
						description: 'Kortk\u00f6p 260319 Unknown Utility AB',
					},
				]),
			},
			{
				codexCategorizer: async (input) => [
					{
						normalizedDescription: input.merchants[0].normalizedDescription,
						suggestedCategoryId: utilities.id,
						confidence: 0.62,
						reason: 'Could be utility billing',
						isCertain: false,
					},
				],
			},
		);

		assert.equal(firstImport.summary.suggestedByCodex, 1);
		const [reviewTransaction] = listReviewTransactions();
		assert.equal(reviewTransaction?.categorizationStatus, 'suggested');
		assert.equal(reviewTransaction?.suggestedCategoryId, utilities.id);

		const updated = await Effect.runPromise(
			assignTransactionCategoryEffect(reviewTransaction.id, {
				categoryId: utilities.id,
				saveRule: true,
			}),
		);
		assert.equal(updated.categorizationSource, 'manual');
		assert.equal(updated.categoryId, utilities.id);
		assert.equal(updated.categoryName, 'Utilities');
		assert.equal(listReviewTransactions().length, 0);

		const secondImport = await importNordeaCsvWithDependencies(
			{
				sourceName: 'rule-reuse.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/20',
						amount: '-410,00',
						description: 'Kortk\u00f6p 260320 Unknown Utility AB',
					},
				]),
			},
			{
				codexCategorizer: async () => {
					throw new Error('Expected merchant rule to bypass Codex');
				},
			},
		);
		assert.equal(secondImport.summary.categorizedByRule, 1);
	});

	it('does not save a merchant rule when manual assignment sets saveRule to false', async () => {
		const utilities = createCategory({ name: 'Utilities', description: null, color: null });

		const firstImport = await importNordeaCsvWithDependencies(
			{
				sourceName: 'manual-no-rule.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/19',
						amount: '-350,00',
						description: 'Kortk\u00f6p 260319 No Rule Utility AB',
					},
				]),
			},
			{
				codexCategorizer: async (input) => [
					{
						normalizedDescription: input.merchants[0].normalizedDescription,
						suggestedCategoryId: utilities.id,
						confidence: 0.62,
						reason: 'Could be utility billing',
						isCertain: false,
					},
				],
			},
		);

		assert.equal(firstImport.summary.suggestedByCodex, 1);
		const [reviewTransaction] = listReviewTransactions();
		assert.ok(reviewTransaction);

		await Effect.runPromise(
			assignTransactionCategoryEffect(reviewTransaction.id, {
				categoryId: utilities.id,
				saveRule: false,
			}),
		);

		const secondImport = await importNordeaCsvWithDependencies(
			{
				sourceName: 'manual-no-rule-follow-up.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/20',
						amount: '-410,00',
						description: 'Kortk\u00f6p 260320 No Rule Utility AB',
					},
				]),
			},
			{
				codexCategorizer: async (input) => [
					{
						normalizedDescription: input.merchants[0].normalizedDescription,
						suggestedCategoryId: null,
						confidence: 0,
						reason: 'No saved rule available',
						isCertain: false,
					},
				],
			},
		);

		assert.equal(secondImport.summary.categorizedByRule, 0);
		assert.equal(secondImport.summary.categorizedByHistory, 1);
	});

	it('uses prior categorized history before heuristic or Codex when no rule exists', async () => {
		const shopping = createCategory({ name: 'Shopping', description: null, color: null });

		await importNordeaCsvWithDependencies(
			{
				sourceName: 'history-seed.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/18',
						amount: '-88,00',
						description: 'Kortk\u00f6p 260318 Rare Boutique AB',
					},
				]),
			},
			{
				codexCategorizer: async (input) => [
					{
						normalizedDescription: input.merchants[0].normalizedDescription,
						suggestedCategoryId: shopping.id,
						confidence: 0.95,
						reason: 'Boutique purchase',
						isCertain: true,
					},
				],
			},
		);

		const followUp = await importNordeaCsvWithDependencies(
			{
				sourceName: 'history-reuse.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/19',
						amount: '-99,00',
						description: 'Kortk\u00f6p 260319 Rare Boutique AB',
					},
				]),
			},
			{
				codexCategorizer: async () => {
					throw new Error('Expected categorized history to bypass Codex');
				},
			},
		);
		assert.equal(followUp.summary.categorizedByHistory, 1);
	});

	it('stores Codex auto matches as legacy manual matchMethod while preserving categorizationSource', async () => {
		const shopping = createCategory({ name: 'Shopping', description: null, color: null });

		const result = await importNordeaCsvWithDependencies(
			{
				sourceName: 'codex-auto.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/19',
						amount: '-88,00',
						description: 'Kortk\u00f6p 260319 Fancy Boutique AB',
					},
				]),
			},
			{
				codexCategorizer: async (input) => [
					{
						normalizedDescription: input.merchants[0].normalizedDescription,
						suggestedCategoryId: shopping.id,
						confidence: 0.97,
						reason: 'Boutique purchase',
						isCertain: true,
					},
				],
			},
		);

		const transactions = listTransactionsByImportBatchId(result.batch.id);
		assert.equal(transactions[0]?.matchMethod, 'manual');
		assert.equal(transactions[0]?.categorizationSource, 'codex_auto');
	});

	it('prefers exact rules over later stages', async () => {
		const groceries = createCategory({ name: 'Groceries', description: null, color: null });
		upsertMerchantCategoryRule({
			normalizedDescription: 'special market ab',
			categoryId: groceries.id,
		});

		const result = await importNordeaCsvWithDependencies(
			{
				sourceName: 'rule.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/19',
						amount: '-149,00',
						description: 'Kortk\u00f6p 260319 Special Market AB',
					},
				]),
			},
			{
				codexCategorizer: async () => {
					throw new Error('Expected exact rule to bypass Codex');
				},
			},
		);

		assert.equal(result.summary.categorizedByRule, 1);
	});

	it('falls back to needs review when Codex fails', async () => {
		createCategory({ name: 'Shopping', description: null, color: null });

		const result = await importNordeaCsvWithDependencies(
			{
				sourceName: 'failure.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/19',
						amount: '-49,00',
						description: 'Kortk\u00f6p 260319 Unclear Merchant AB',
					},
				]),
			},
			{
				codexCategorizer: async () => {
					throw new Error('timeout');
				},
			},
		);

		assert.equal(result.summary.needsReview, 1);
		const [reviewTransaction] = listReviewTransactions();
		assert.equal(reviewTransaction?.categorizationStatus, 'needs_review');
	});

	it('ignores Codex suggestions that do not map to an existing category during import', async () => {
		createCategory({ name: 'Shopping', description: null, color: null });

		const imported = await importNordeaCsvWithDependencies(
			{
				sourceName: 'invalid-category.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/19',
						amount: '-199,00',
						description: 'Kortk\u00f6p 260319 Broken Suggestion AB',
					},
				]),
			},
			{
				codexCategorizer: async (input) => [
					{
						normalizedDescription: input.merchants[0].normalizedDescription,
						suggestedCategoryId: 'missing-category',
						confidence: 0.98,
						reason: 'Invalid category id',
						isCertain: true,
					},
				],
			},
		);

		assert.equal(imported.summary.categorizedByCodex, 0);
		assert.equal(imported.summary.suggestedByCodex, 0);
		assert.equal(imported.summary.needsReview, 1);

		const [reviewTransaction] = listReviewTransactions({ batchId: imported.batch.id });
		assert.equal(reviewTransaction?.categorizationStatus, 'needs_review');
		assert.equal(reviewTransaction?.categoryId, null);
		assert.equal(reviewTransaction?.suggestedCategoryId, null);
	});

	it('can re-run Codex on already imported review transactions', async () => {
		const shopping = createCategory({ name: 'Shopping', description: null, color: null });

		const imported = await importNordeaCsvWithDependencies(
			{
				sourceName: 'reprocess-source.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/19',
						amount: '-49,00',
						description: 'Kortk\u00f6p 260319 Later Classified AB',
					},
				]),
			},
			{
				codexCategorizer: async () => {
					throw new Error('initial failure');
				},
			},
		);
		assert.equal(imported.summary.needsReview, 1);

		const reprocessed = await reprocessImportTransactionsWithDependencies(
			{ batchId: imported.batch.id },
			{
				codexCategorizer: async (input) => [
					{
						normalizedDescription: input.merchants[0].normalizedDescription,
						suggestedCategoryId: shopping.id,
						confidence: 0.95,
						reason: 'Shopping merchant',
						isCertain: true,
					},
				],
			},
		);

		assert.equal(reprocessed.processed, 1);
		assert.equal(reprocessed.categorizedByCodex, 1);
		assert.equal(listReviewTransactions({ batchId: imported.batch.id }).length, 0);
	});

	it('ignores Codex suggestions that do not map to an existing category during reprocessing', async () => {
		createCategory({ name: 'Shopping', description: null, color: null });

		const imported = await importNordeaCsvWithDependencies(
			{
				sourceName: 'reprocess-invalid.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/19',
						amount: '-225,00',
						description: 'Kortk\u00f6p 260319 Reprocess Broken AB',
					},
				]),
			},
			{
				codexCategorizer: async () => {
					throw new Error('initial failure');
				},
			},
		);

		const reprocessed = await reprocessImportTransactionsWithDependencies(
			{ batchId: imported.batch.id },
			{
				codexCategorizer: async (input) => [
					{
						normalizedDescription: input.merchants[0].normalizedDescription,
						suggestedCategoryId: 'missing-category',
						confidence: 0.99,
						reason: 'Invalid category id',
						isCertain: true,
					},
				],
			},
		);

		assert.equal(reprocessed.categorizedByCodex, 0);
		assert.equal(reprocessed.suggestedByCodex, 0);
		assert.equal(reprocessed.needsReview, 1);

		const [reviewTransaction] = listReviewTransactions({ batchId: imported.batch.id });
		assert.equal(reviewTransaction?.categorizationStatus, 'needs_review');
		assert.equal(reviewTransaction?.categoryId, null);
		assert.equal(reviewTransaction?.suggestedCategoryId, null);
	});

	it('does not reuse empty Codex cache entries on later reprocessing', async () => {
		const shopping = createCategory({ name: 'Shopping', description: null, color: null });

		const imported = await importNordeaCsvWithDependencies(
			{
				sourceName: 'empty-cache.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/19',
						amount: '-49,00',
						description: 'Kortk\u00f6p 260319 Retry Merchant AB',
					},
				]),
			},
			{
				codexCategorizer: async (input) => [
					{
						normalizedDescription: input.merchants[0].normalizedDescription,
						suggestedCategoryId: null,
						confidence: 0.1,
						reason: 'Unsure',
						isCertain: false,
					},
				],
			},
		);
		assert.equal(imported.summary.needsReview, 1);

		let secondRunCalls = 0;
		const reprocessed = await reprocessImportTransactionsWithDependencies(
			{ batchId: imported.batch.id },
			{
				codexCategorizer: async (input) => {
					secondRunCalls += 1;
					return [
						{
							normalizedDescription: input.merchants[0].normalizedDescription,
							suggestedCategoryId: shopping.id,
							confidence: 0.95,
							reason: 'Shopping merchant',
							isCertain: true,
						},
					];
				},
			},
		);

		assert.equal(secondRunCalls, 1);
		assert.equal(reprocessed.categorizedByCodex, 1);
	});

	it('can ask Codex for a single transaction suggestion with the simple prompt path', async () => {
		const category = createCategory({ name: 'Matkostnader', description: null, color: null });

		const imported = await importNordeaCsvWithDependencies(
			{
				sourceName: 'single-codex.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/19',
						amount: '-209,00',
						description: 'Autogiro Push Gym',
					},
				]),
			},
			{
				codexCategorizer: async () => [],
			},
		);
		const [reviewTransaction] = listReviewTransactions({ batchId: imported.batch.id });

		const result = await suggestTransactionCategoryWithCodexWithDependencies(
			reviewTransaction.id,
			{},
			{
				singleTransactionCodexCategorizer: async () => ({
					suggestedCategoryId: category.id,
					reason: 'Parsed single-category Codex response',
					confidence: 0.65,
				}),
			},
		);
		const updated = result.transaction;

		assert.equal(updated.suggestedCategoryId, category.id);
		assert.equal(updated.categorizationStatus, 'suggested');
		assert.match(result.debug.prompt, /"description":"Autogiro Push Gym"/);
		assert.match(result.debug.prompt, /"amount":-209/);
	});

	it('keeps a transaction in review when single-row Codex suggestion fails', async () => {
		createCategory({ name: 'Matkostnader', description: null, color: null });

		const imported = await importNordeaCsvWithDependencies(
			{
				sourceName: 'single-codex-failure.csv',
				csvText: createCsv([
					{
						bookingDate: '2026/03/19',
						amount: '-209,00',
						description: 'Autogiro Push Gym',
					},
				]),
			},
			{
				codexCategorizer: async () => [],
			},
		);
		const [reviewTransaction] = listReviewTransactions({ batchId: imported.batch.id });

		const result = await suggestTransactionCategoryWithCodexWithDependencies(
			reviewTransaction.id,
			{},
			{
				singleTransactionCodexCategorizer: async () => {
					throw new Error('codex exec failed');
				},
			},
		);
		const updated = result.transaction;

		assert.equal(updated.suggestedCategoryId, null);
		assert.equal(updated.categorizationStatus, 'needs_review');
		assert.equal(result.debug.error, 'codex exec failed');
	});
});

describe('heuristic and Codex response helpers', () => {
	it('finds heuristic category matches only when one category alias is available', () => {
		const categories = [
			createCategory({ name: 'Food', description: null, color: null }),
			createCategory({ name: 'Transport', description: null, color: null }),
		];

		const match = findHeuristicCategoryMatch({
			normalizedDescription: 'foodora ab',
			categories,
		});
		assert.equal(match?.source, 'heuristic_keyword');
		assert.equal(match?.categoryId, categories[0].id);
	});

	it('matches an existing budget category using description aliases', () => {
		const categories = [
			createCategory({
				name: 'Eating Out',
				description: 'Food, restaurants, takeaway',
				color: null,
			}),
			createCategory({ name: 'Transport', description: 'Travel and commute', color: null }),
		];

		const match = findHeuristicCategoryMatch({
			normalizedDescription: 'foodora ab',
			categories,
		});

		assert.equal(match?.source, 'heuristic_keyword');
		assert.equal(match?.categoryId, categories[0].id);
	});

	it('matches recurring gym merchants to subscriptions categories', () => {
		const categories = [
			createCategory({
				name: 'Prenumerationer',
				description: 'Subscriptions, memberships, recurring services',
				color: null,
			}),
			createCategory({ name: 'Transport', description: 'Travel and commute', color: null }),
		];

		const match = findHeuristicCategoryMatch({
			normalizedDescription: 'push gym',
			categories,
		});

		assert.equal(match?.source, 'heuristic_keyword');
		assert.equal(match?.categoryId, categories[0].id);
	});

	it('does not heuristically match when multiple budget categories fit the same alias', () => {
		const categories = [
			createCategory({
				name: 'Eating Out',
				description: 'Food and restaurants',
				color: null,
			}),
			createCategory({
				name: 'Dining',
				description: 'Takeaway, food delivery',
				color: null,
			}),
		];

		const match = findHeuristicCategoryMatch({
			normalizedDescription: 'foodora ab',
			categories,
		});

		assert.equal(match, null);
	});

	it('parses strict Codex JSON and ignores invalid category ids', () => {
		createCategory({ name: 'Shopping', description: null, color: null });
		const categories = listCategories();
		const parsed = parseCodexCategorizationResponse({
			text: JSON.stringify({
				results: [
					{
						normalizedDescription: 'merchant one',
						suggestedCategoryId: categories[0]?.id ?? 'missing',
						confidence: 1.2,
						reason: 'Valid choice',
						isCertain: true,
					},
					{
						normalizedDescription: 'merchant two',
						suggestedCategoryId: 'not-allowed',
						confidence: 0.5,
						reason: 'Should be ignored',
						isCertain: false,
					},
				],
			}),
			allowedCategoryIds: new Set(categories.map((category) => category.id)),
			merchantKeys: new Set(['merchant one', 'merchant two']),
		});

		assert.equal(parsed.length, 1);
		assert.equal(parsed[0].normalizedDescription, 'merchant one');
		assert.equal(parsed[0].confidence, 1);
	});

	it('extracts JSON when Codex prepends prose before the payload', () => {
		createCategory({ name: 'Food', description: null, color: null });
		const categories = listCategories();
		const parsed = parseCodexCategorizationResponse({
			text: `The result is below.\n\n${JSON.stringify({
				results: [
					{
						normalizedDescription: 'foodora ab',
						suggestedCategoryId: categories[0].id,
						confidence: 0.96,
						reason: 'Food delivery merchant',
						isCertain: true,
					},
				],
			})}`,
			allowedCategoryIds: new Set(categories.map((category) => category.id)),
			merchantKeys: new Set(['foodora ab']),
		});

		assert.equal(parsed.length, 1);
		assert.equal(parsed[0].normalizedDescription, 'foodora ab');
		assert.equal(parsed[0].suggestedCategoryId, categories[0].id);
	});

	it('parses a pure JSON array with category names', () => {
		createCategory({ name: 'Matkostnader', description: null, color: null });
		const categories = listCategories();
		const parsed = parseCodexCategorizationResponse({
			text: JSON.stringify([
				{
					normalizedDescription: 'foodora ab',
					description: 'Kortkop 260319 Foodora AB',
					category: 'Matkostnader',
				},
			]),
			allowedCategoryIds: new Set(categories.map((category) => category.id)),
			merchantKeys: new Set(['foodora ab']),
			categories: categories.map((category) => ({ id: category.id, name: category.name })),
		});

		assert.equal(parsed.length, 1);
		assert.equal(parsed[0].normalizedDescription, 'foodora ab');
		assert.equal(parsed[0].suggestedCategoryId, categories[0].id);
		assert.equal(parsed[0].reason, 'Parsed category-name Codex response');
	});

	it('maps a single-merchant plain-text category response', () => {
		createCategory({ name: 'Food', description: null, color: null });
		const categories = listCategories();
		const parsed = parseCodexCategorizationResponse({
			text: 'Suggested category: Food',
			allowedCategoryIds: new Set(categories.map((category) => category.id)),
			merchantKeys: new Set(['foodora ab']),
			categories: categories.map((category) => ({ id: category.id, name: category.name })),
		});

		assert.equal(parsed.length, 1);
		assert.equal(parsed[0].normalizedDescription, 'foodora ab');
		assert.equal(parsed[0].suggestedCategoryId, categories[0].id);
		assert.equal(parsed[0].isCertain, false);
	});

	it('maps a single-merchant uncertain plain-text response to no suggestion', () => {
		createCategory({ name: 'Food', description: null, color: null });
		const categories = listCategories();
		const parsed = parseCodexCategorizationResponse({
			text: 'I am not sure.',
			allowedCategoryIds: new Set(categories.map((category) => category.id)),
			merchantKeys: new Set(['foodora ab']),
			categories: categories.map((category) => ({ id: category.id, name: category.name })),
		});

		assert.equal(parsed.length, 1);
		assert.equal(parsed[0].suggestedCategoryId, null);
		assert.equal(parsed[0].isCertain, false);
	});

	it('maps a single-merchant null plain-text response to no suggestion', () => {
		createCategory({ name: 'Food', description: null, color: null });
		const categories = listCategories();
		const parsed = parseCodexCategorizationResponse({
			text: 'null',
			allowedCategoryIds: new Set(categories.map((category) => category.id)),
			merchantKeys: new Set(['foodora ab']),
			categories: categories.map((category) => ({ id: category.id, name: category.name })),
		});

		assert.equal(parsed.length, 1);
		assert.equal(parsed[0].suggestedCategoryId, null);
		assert.equal(parsed[0].isCertain, false);
	});

	it('builds the simple single-transaction prompt in the expected style', () => {
		const categories = [
			createCategory({ name: 'Boendekostnader', description: null, color: null }),
			createCategory({ name: 'Matkostnader', description: null, color: null }),
			createCategory({ name: 'Prenumerationer', description: null, color: null }),
			createCategory({ name: 'Transport', description: null, color: null }),
			createCategory({ name: 'Utseende', description: null, color: null }),
		];

		const prompt = buildSingleTransactionCategoryPrompt({
			categories,
			description: 'Autogiro Push Gym',
			amount: -209,
		});

		assert.match(
			prompt,
			/Only reply with exactly one category name from the list or UNKNOWN\. Only the category name nothing else\.Categories:/,
		);
		assert.match(
			prompt,
			/Categories: Boendekostnader, Matkostnader, Prenumerationer, Transport, Utseende Purchase: Autogiro Push Gym, 209\.00kr/,
		);
	});

	it('maps a simple plain-text category name to one existing category', () => {
		const categories = [
			createCategory({ name: 'Matkostnader', description: null, color: null }),
			createCategory({ name: 'Transport', description: null, color: null }),
		];

		const parsed = parseSingleTransactionCategoryResponse({
			text: 'Matkostnader',
			categories,
		});

		assert.equal(parsed.suggestedCategoryId, categories[0].id);
		assert.equal(parsed.confidence, 0.65);
	});

	it('maps a quoted single-line category response to one existing category', () => {
		const categories = [
			createCategory({ name: 'Matkostnader', description: null, color: null }),
			createCategory({ name: 'Transport', description: null, color: null }),
		];

		const parsed = parseSingleTransactionCategoryResponse({
			text: '"Matkostnader"',
			categories,
		});

		assert.equal(parsed.suggestedCategoryId, categories[0].id);
		assert.equal(parsed.confidence, 0.65);
	});

	it('maps a sentence containing one category name to one existing category', () => {
		const categories = [
			createCategory({ name: 'Matkostnader', description: null, color: null }),
			createCategory({ name: 'Transport', description: null, color: null }),
		];

		const parsed = parseSingleTransactionCategoryResponse({
			text: 'Matkostnader because this looks like a recurring purchase.',
			categories,
		});

		assert.equal(parsed.suggestedCategoryId, categories[0].id);
		assert.equal(parsed.confidence, 0.65);
	});

	it('builds a prompt that asks for pure json with category names', () => {
		const categories = [createCategory({ name: 'Food', description: null, color: null })];
		const prompt = buildCodexCategorizationPrompt({
			categories,
			merchants: [
				{
					normalizedDescription: 'foodora ab',
					description: 'Kortkop 260319 Foodora AB',
				},
			],
		});

		assert.match(prompt, /Based from these categories please categorise my purchases/);
		assert.match(prompt, /Categories: \["Food","UNKNOWN"\]/);
		assert.match(prompt, /keep normalizedDescription and description exactly as provided/);
		assert.match(prompt, /"normalizedDescription":"foodora ab"/);
		assert.match(prompt, /"category":"Food"/);
	});
});

describe('AI response helpers', () => {
	it('parses a top-level array batch response', () => {
		const parsed = parseBatchResponse(
			JSON.stringify([
				{
					normalizedDescription: 'push gym',
					categoryId: 'category-1',
					certainty: 93,
				},
			]),
			[{ normalizedDescription: 'push gym', description: 'Autogiro Push Gym' }],
		);

		assert.equal(parsed.length, 1);
		assert.equal(parsed[0]?.normalizedDescription, 'push gym');
		assert.equal(parsed[0]?.categoryId, 'category-1');
		assert.equal(parsed[0]?.certainty, 93);
	});

	it('maps description-based batch responses and normalizes decimal certainty', () => {
		const parsed = parseBatchResponse(
			JSON.stringify([
				{
					description: 'Autogiro Push Gym',
					categoryId: 'category-1',
					certainty: 0.9,
				},
			]),
			[{ normalizedDescription: 'push gym', description: 'Autogiro Push Gym' }],
		);

		assert.equal(parsed.length, 1);
		assert.equal(parsed[0]?.normalizedDescription, 'push gym');
		assert.equal(parsed[0]?.categoryId, 'category-1');
		assert.equal(parsed[0]?.certainty, 90);
	});
});
