<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import type * as Effect from 'effect/Effect';
	import { type ApiClient, withApiClient } from '$lib/api/client';
	import * as Alert from '$lib/components/ui/alert';
	import {
		SegmentedControl,
		type SegmentedControlOption
	} from '$lib/components/ui/segmented-control';
	import * as Select from '$lib/components/ui/select';
	import { Tag, type TagVariant } from '$lib/components/ui/tag';
	import {
		ToolbarActionButton,
		ToolbarActions
	} from '$lib/components/ui/toolbar-actions';
	import {
		Table,
		SortableTableHead,
		type SortDirection,
		sortAlphabetical,
		sortValue,
		toggleSort as toggleTableSort
	} from '$lib/components/ui/table';
	import { toUserMessage } from '$lib/effect/errors';
	import { runUiEffect } from '$lib/effect/runtime/browser';
	import { formatSekAmount } from '$lib/finance/format';
	import type { BudgetCategory } from '$lib/schema/budget';
	import type {
		ImportBatch,
		ImportedTransaction,
		SuggestTransactionCategoryWithAiResult,
		TransactionCategorizationStatus
	} from '$lib/schema/imports';

	interface Props {
		data: {
			categories: BudgetCategory[];
			batches: ImportBatch[];
			reviewTransactions: ImportedTransaction[];
		};
	}

	let { data }: Props = $props();

	const reviewFilterOptions: SegmentedControlOption[] = [
		{ value: 'all', label: 'All' },
		{ value: 'suggested', label: 'Suggested' },
		{ value: 'needs_review', label: 'Needs review' }
	];

	let hydratedFromLoad = $state(false);
	let categories = $state<BudgetCategory[]>([]);
	let batches = $state<ImportBatch[]>([]);
	let reviewTransactions = $state<ImportedTransaction[]>([]);
	let selectedBatchId = $state<'all' | string>('all');
	let selectedFile = $state<File | null>(null);
	let pending = $state(false);
	let uploadPending = $state(false);
	let reprocessPending = $state(false);
	let aiSuggestPendingId = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let reviewFilter = $state<'all' | 'suggested' | 'needs_review'>('all');
	let lastAiDebug = $state<SuggestTransactionCategoryWithAiResult['debug'] | null>(null);
	let showAiDebug = $state(false);
	let transactionSort = $state<{ key: ImportSortKey; direction: SortDirection }>({
		key: 'date',
		direction: 'desc'
	});

	type ImportSortKey = 'date' | 'description' | 'amount' | 'batch' | 'status';

	let totalImportedRows = $derived(batches.reduce((sum, batch) => sum + batch.rowCount, 0));
	let filteredReviewTransactions = $derived.by(() =>
		reviewTransactions.filter((transaction) => {
			if (reviewFilter === 'all') {
				return true;
			}

			return transaction.categorizationStatus === reviewFilter;
		})
	);
	let sortedReviewTransactions = $derived(filteredReviewTransactions.slice().sort(sortReviewTransactions));
	let reviewCount = $derived(sortedReviewTransactions.length);
	let reviewableCount = $derived(
		reviewTransactions.filter(
			(transaction) =>
				transaction.categorizationStatus === 'suggested' ||
				transaction.categorizationStatus === 'needs_review'
		).length
	);
	let suggestedCount = $derived(
		reviewTransactions.filter((transaction) => transaction.categorizationStatus === 'suggested').length
	);
	let needsReviewCount = $derived(
		reviewTransactions.filter((transaction) => transaction.categorizationStatus === 'needs_review').length
	);
	let selectedBatchLabel = $derived(
		selectedBatchId === 'all'
			? 'All batches'
			: (batches.find((b) => b.id === selectedBatchId)?.sourceName ?? 'All batches')
	);

	$effect(() => {
		if (hydratedFromLoad) {
			return;
		}

		categories = ((data.categories as BudgetCategory[]) ?? []).slice();
		batches = ((data.batches as ImportBatch[]) ?? []).slice();
		reviewTransactions = ((data.reviewTransactions as ImportedTransaction[]) ?? []).slice();
		hydratedFromLoad = true;
	});

	function formatCurrency(amount: number): string {
		return formatSekAmount(amount);
	}

	function toggleTransactionSort(key: ImportSortKey): void {
		transactionSort = toggleTableSort(transactionSort, key);
	}

	function sortReviewTransactions(left: ImportedTransaction, right: ImportedTransaction): number {
		switch (transactionSort.key) {
			case 'date':
				return withCreatedAtTiebreak(
					sortAlphabetical(left.bookingDate, right.bookingDate, transactionSort.direction),
					left,
					right
				);
			case 'description':
				return withCreatedAtTiebreak(
					sortAlphabetical(left.description, right.description, transactionSort.direction),
					left,
					right
				);
			case 'amount':
				return withCreatedAtTiebreak(
					sortValue(left.amount, right.amount, transactionSort.direction),
					left,
					right
				);
			case 'batch':
				return withCreatedAtTiebreak(
					sortAlphabetical(
						left.importBatchSourceName,
						right.importBatchSourceName,
						transactionSort.direction
					),
					left,
					right
				);
			case 'status':
				return withCreatedAtTiebreak(
					sortAlphabetical(
						left.categorizationStatus,
						right.categorizationStatus,
						transactionSort.direction
					),
					left,
					right
				);
		}
	}

	function withCreatedAtTiebreak(
		comparison: number,
		left: ImportedTransaction,
		right: ImportedTransaction
	): number {
		return comparison !== 0 ? comparison : right.createdAt.localeCompare(left.createdAt);
	}

	function statusVariant(status: TransactionCategorizationStatus): TagVariant {
		switch (status) {
			case 'suggested':
				return 'success';
			case 'needs_review':
				return 'warning';
			case 'categorized':
				return 'accent';
			case 'skipped':
				return 'subtle';
		}
	}

	function statusLabel(status: TransactionCategorizationStatus): string {
		return status.replace('_', ' ');
	}

	function toErrorMessage(error: unknown, fallbackMessage: string): string {
		return toUserMessage(error, fallbackMessage);
	}

	function apiRun<A, E, R>(work: (client: ApiClient) => Effect.Effect<A, E, R>): Promise<A> {
		return runUiEffect(withApiClient(fetch, work));
	}

	async function refreshImportData(): Promise<void> {
		const batchFilter = selectedBatchId !== 'all' ? selectedBatchId : undefined;
		const [nextBatches, nextReviewTransactions] = await Promise.all([
			apiRun((client) => client.imports.listImportBatches({ urlParams: { limit: 30 } })),
			apiRun((client) =>
				client.imports.listImportTransactions({
					urlParams: {
						batchId: batchFilter,
						limit: 300
					}
				})
			)
		]);

		batches = nextBatches.slice();
		reviewTransactions = nextReviewTransactions.slice();
	}

	async function handleUploadCsv(): Promise<void> {
		if (!selectedFile) {
			return;
		}

		uploadPending = true;
		errorMessage = null;
		successMessage = null;

		try {
			const file = selectedFile;
			const csvText = await file.text();
			const result = await apiRun((client) =>
				client.imports.uploadImportCsv({
					payload: {
						sourceName: file.name,
						csvText,
						importedAt: new Date().toISOString()
					}
				})
			);
			selectedFile = null;
			selectedBatchId = 'all';
			await refreshImportData();
			successMessage = `Imported ${result.summary.inserted} transactions from ${result.batch.sourceName}. ${result.summary.categorizedByRule + result.summary.categorizedByHistory + result.summary.categorizedByHeuristic + result.summary.categorizedByAi} categorized, ${result.summary.suggestedByAi} suggested, ${result.summary.needsReview} left for review, ${result.summary.skippedDuplicates} duplicates skipped.`;
		} catch (error) {
			errorMessage = toErrorMessage(error, 'Failed to import CSV');
		} finally {
			uploadPending = false;
		}
	}

	async function handleBatchFilterChange(value: string): Promise<void> {
		selectedBatchId = (value || 'all') as 'all' | string;

		pending = true;
		errorMessage = null;
		try {
			await refreshImportData();
		} catch (error) {
			errorMessage = toErrorMessage(error, 'Failed to refresh review queue');
		} finally {
			pending = false;
		}
	}

	async function handleReprocessReviewQueue(): Promise<void> {
		reprocessPending = true;
		errorMessage = null;
		successMessage = null;

		try {
			const batchId = selectedBatchId !== 'all' ? selectedBatchId : undefined;
			const result = await apiRun((client) =>
				client.imports.reprocessImportTransactions({
					payload: {
						batchId
					}
				})
			);
			await refreshImportData();
			successMessage = `Processed ${result.processed} review transactions. ${result.categorizedByAi} auto-categorized, ${result.suggestedByAi} suggested, ${result.needsReview} still need review.`;
		} catch (error) {
			errorMessage = toErrorMessage(error, 'Failed to run AI categorization');
		} finally {
			reprocessPending = false;
		}
	}

	async function handleAcceptSuggestion(transaction: ImportedTransaction): Promise<void> {
		if (!transaction.suggestedCategoryId) {
			errorMessage = 'No suggested category to accept';
			return;
		}

		pending = true;
		errorMessage = null;
		successMessage = null;

		try {
			const updated = await apiRun((client) =>
				client.imports.assignImportTransactionCategory({
					path: { transactionId: transaction.id },
					payload: {
						categoryId: transaction.suggestedCategoryId,
						saveRule: true
					}
				})
			);

			reviewTransactions = reviewTransactions.map((current) =>
				current.id === updated.id ? updated : current
			);
			successMessage = `Accepted suggestion and saved merchant rule for "${updated.description}"`;
		} catch (error) {
			errorMessage = toErrorMessage(error, 'Failed to accept suggestion');
		} finally {
			pending = false;
		}
	}

	async function handleInlineCategoryChange(transaction: ImportedTransaction, categoryId: string): Promise<void> {
		if (!categoryId) return;

		pending = true;
		errorMessage = null;
		successMessage = null;

		try {
			const updated = await apiRun((client) =>
				client.imports.assignImportTransactionCategory({
					path: { transactionId: transaction.id },
					payload: {
						categoryId,
						saveRule: true
					}
				})
			);

			reviewTransactions = reviewTransactions.map((current) =>
				current.id === updated.id ? updated : current
			);
			successMessage = `Assigned category and saved merchant rule for "${updated.description}"`;
		} catch (error) {
			errorMessage = toErrorMessage(error, 'Failed to assign category');
		} finally {
			pending = false;
		}
	}

	async function handleAskAi(transaction: ImportedTransaction): Promise<void> {
		aiSuggestPendingId = transaction.id;
		errorMessage = null;
		successMessage = null;
		lastAiDebug = null;

		try {
			const result = await apiRun((client) =>
				client.imports.suggestImportTransactionCategoryWithAi({
					path: { transactionId: transaction.id },
					payload: {}
				})
			);
			const updated = result.transaction;

			reviewTransactions = reviewTransactions.map((current) =>
				current.id === updated.id ? updated : current
			);
			lastAiDebug = result.debug;
			successMessage = updated.suggestedCategoryName
				? `AI suggested "${updated.suggestedCategoryName}" for "${updated.description}"`
				: `AI could not confidently suggest a category for "${updated.description}"`;
		} catch (error) {
			errorMessage = toErrorMessage(error, 'Failed to ask AI for a suggestion');
		} finally {
			aiSuggestPendingId = null;
		}
	}
</script>

<div class="app-page imports-page">
	<div class="app-toolbar">
		<div class="app-toolbar-left">
			<h1 class="app-page-title">Inbox</h1>

			<SegmentedControl
				bind:value={reviewFilter}
				options={reviewFilterOptions}
				ariaLabel="Filter by review state"
				class="import-filter"
			/>

			<div class="app-toolbar-divider" aria-hidden="true"></div>

			<Select.Root
				type="single"
				value={selectedBatchId}
				onValueChange={(value: string) => handleBatchFilterChange(value)}
			>
				<Select.Trigger class="batch-filter-trigger">
					{selectedBatchLabel}
				</Select.Trigger>
				<Select.Content class="bg-card border-border">
					<Select.Item value="all" class="text-foreground cursor-pointer">All batches</Select.Item>
					{#each batches as batch (batch.id)}
						<Select.Item value={batch.id} class="text-foreground cursor-pointer">
							{batch.sourceName} ({batch.importedAt.slice(0, 10)})
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<div class="app-toolbar-right">
			<ToolbarActions>
				<ToolbarActionButton
					tone="muted"
					onclick={handleReprocessReviewQueue}
					disabled={reprocessPending || reviewableCount === 0}
				>
					{reprocessPending ? 'Running AI...' : 'Run AI'}
				</ToolbarActionButton>
				<label class="file-input-wrap">
					<span class="file-input-label">{selectedFile?.name ?? 'Choose CSV'}</span>
					<input
						type="file"
						accept=".csv,text/csv"
						onchange={(event) => {
							const input = event.target as HTMLInputElement;
							selectedFile = input.files?.[0] ?? null;
						}}
						class="file-input"
					/>
				</label>
				<ToolbarActionButton onclick={handleUploadCsv} disabled={uploadPending || !selectedFile}>
					{uploadPending ? 'Importing...' : 'Import CSV'}
				</ToolbarActionButton>
			</ToolbarActions>
		</div>
	</div>

	{#if errorMessage}
		<Alert.Root class="border-destructive/50 bg-destructive/10">
			<Alert.Description class="flex items-center justify-between text-destructive text-xs">
				{errorMessage}
				<button type="button" onclick={() => (errorMessage = null)} class="ml-4 opacity-60 hover:opacity-100 text-xs">✕</button>
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if successMessage}
		<Alert.Root class="border-[var(--app-border)] bg-[var(--app-accent-glow)]">
			<Alert.Description class="flex items-center justify-between text-[var(--app-accent-light)] text-xs">
				{successMessage}
				<button type="button" onclick={() => (successMessage = null)} class="ml-4 opacity-60 hover:opacity-100 text-xs">✕</button>
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if lastAiDebug}
		<div class="ai-debug-bar">
			<button type="button" class="ai-debug-toggle" onclick={() => (showAiDebug = !showAiDebug)}>
				{showAiDebug ? 'Hide' : 'Show'} AI debug
			</button>
			<button type="button" class="ai-debug-toggle" onclick={() => { lastAiDebug = null; showAiDebug = false; }}>
				Dismiss
			</button>
		</div>
		{#if showAiDebug}
			<Alert.Root class="border-[var(--app-border)] bg-[rgba(255,255,255,0.03)]">
				<Alert.Description>
					<div class="codex-debug">
						<div class="codex-debug-block">
							<div class="codex-debug-label">Prompt</div>
							<pre>{lastAiDebug.prompt}</pre>
						</div>
						<div class="codex-debug-block">
							<div class="codex-debug-label">Raw output</div>
							<pre>{lastAiDebug.rawResponse ?? '(no output captured)'}</pre>
						</div>
						{#if lastAiDebug.error}
							<div class="codex-debug-block">
								<div class="codex-debug-label">Error</div>
								<pre>{lastAiDebug.error}</pre>
							</div>
						{/if}
					</div>
				</Alert.Description>
			</Alert.Root>
		{/if}
	{/if}

	<Table fill>
		{#snippet footer()}
			<div class="table-summary-copy">
				<span class="table-summary-label">Transactions</span>
				<span class="table-total-count">{reviewCount} shown · {suggestedCount} suggested · {needsReviewCount} needs review</span>
			</div>
			<span class="table-summary-value">{batches.length} batches · {totalImportedRows} imported</span>
		{/snippet}
		<thead>
			<tr>
				<SortableTableHead class="w-[28%]" label="Transaction" active={transactionSort.key === 'description'} direction={transactionSort.direction} onToggle={() => toggleTransactionSort('description')} />
				<SortableTableHead class="w-[11%]" label="Amount" align="right" active={transactionSort.key === 'amount'} direction={transactionSort.direction} onToggle={() => toggleTransactionSort('amount')} />
				<SortableTableHead class="w-[14%]" label="Batch" active={transactionSort.key === 'batch'} direction={transactionSort.direction} onToggle={() => toggleTransactionSort('batch')} />
				<SortableTableHead class="w-[10%]" label="Status" active={transactionSort.key === 'status'} direction={transactionSort.direction} onToggle={() => toggleTransactionSort('status')} />
				<th class="w-[17%]">Suggestion</th>
				<th class="w-[12%]">Category</th>
				<th class="actions-head"></th>
			</tr>
		</thead>
		<tbody>
			{#each sortedReviewTransactions as transaction (transaction.id)}
				<tr class="group">
					<td>
						<div class="item-name">{transaction.description}</div>
						<div class="muted-copy">{transaction.normalizedDescription} · {transaction.bookingDate}</div>
					</td>

					<td class="text-right">
						<div class="mono">{formatCurrency(transaction.amount)}</div>
					</td>

					<td>
						<div class="muted-copy no-top-margin">{transaction.importBatchSourceName}</div>
					</td>

					<td>
						<Tag variant={statusVariant(transaction.categorizationStatus)} size="sm">
							{statusLabel(transaction.categorizationStatus)}
						</Tag>
					</td>

					<td>
						{#if transaction.suggestedCategoryName}
							<div class="suggestion-name">{transaction.suggestedCategoryName}</div>
							{#if transaction.suggestedConfidence !== null}
								<div class="muted-copy">{Math.round(transaction.suggestedConfidence * 100)}%{#if transaction.suggestedReason} · {transaction.suggestedReason}{/if}</div>
							{/if}
						{:else}
							<span class="muted-copy no-top-margin">&mdash;</span>
						{/if}
					</td>

					<td>
						<Select.Root
							type="single"
							value={transaction.categoryId ?? '__none__'}
							onValueChange={(value: string) => {
								if (value && value !== '__none__') handleInlineCategoryChange(transaction, value);
							}}
						>
							<Select.Trigger size="sm" class="category-trigger">
								{transaction.categoryName ?? 'Select category'}
							</Select.Trigger>
							<Select.Content class="bg-card border-border">
								{#each categories as category (category.id)}
									<Select.Item value={category.id} class="text-foreground cursor-pointer">{category.name}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</td>

					<td>
						<div class="row-actions">
							{#if transaction.categorizationStatus === 'suggested' && transaction.suggestedCategoryId}
								<button
									type="button"
									class="row-action accent"
									onclick={() => handleAcceptSuggestion(transaction)}
									disabled={pending}
									aria-label="Accept suggestion"
									title="Accept suggestion"
								>
									<CheckIcon size={12} strokeWidth={1.8} />
								</button>
							{/if}
							<button
								type="button"
								class="row-action"
								onclick={() => handleAskAi(transaction)}
								disabled={aiSuggestPendingId === transaction.id}
								aria-label="Ask AI for suggestion"
								title="Ask AI for suggestion"
							>
								<SparklesIcon size={12} strokeWidth={1.8} />
							</button>
						</div>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan={7} class="table-empty-state">
						No imported transactions match the current filters.
					</td>
				</tr>
			{/each}
		</tbody>
	</Table>
</div>

<style>
	.imports-page {
		gap: 14px;
	}

	:global(.import-filter) {
		margin-left: 4px;
		max-width: 100%;
	}

	:global([data-slot='select-trigger'].batch-filter-trigger) {
		height: calc(2.75rem + 0.5rem + 2px);
		min-height: calc(2.75rem + 0.5rem + 2px);
		padding-inline: 1.15rem;
		border-radius: 0.95rem;
		border-color: var(--ds-glass-border);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.16));
		color: var(--app-text-secondary);
		font-size: 0.92rem;
		font-weight: 700;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	:global([data-slot='select-trigger'].batch-filter-trigger:hover) {
		color: var(--app-text-primary);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
			color-mix(in oklab, var(--ds-glass-surface) 88%, rgba(12, 20, 14, 0.1));
	}

	.file-input-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		height: 3rem;
		padding-inline: 1.15rem;
		border-radius: 0.95rem;
		border: 1px solid var(--ds-glass-border);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.16));
		color: var(--app-text-secondary);
		font-size: 0.96rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
		transition: color 0.16s var(--ds-ease), background 0.16s var(--ds-ease);
	}

	.file-input-wrap:hover {
		color: var(--app-text-primary);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
			color-mix(in oklab, var(--ds-glass-surface) 88%, rgba(12, 20, 14, 0.1));
	}

	.file-input-label {
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.item-name {
		font-size: 1.16rem;
		font-weight: 700;
		color: var(--app-text-primary);
	}

	.muted-copy {
		margin-top: 0.24rem;
		font-size: 0.76rem;
		color: var(--app-text-muted);
	}

	.no-top-margin {
		margin-top: 0;
	}

	.mono {
		font-family: var(--ds-font-mono);
		font-size: 0.95rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--app-text-primary);
	}

	.suggestion-name {
		font-size: 0.86rem;
		font-weight: 600;
		color: var(--app-text-primary);
	}

	:global(.category-trigger) {
		width: 100%;
		font-size: 0.78rem !important;
		font-weight: 600;
		border-radius: 0.55rem;
		background: rgba(0, 0, 0, 0.25);
	}

	:global(.category-trigger [data-slot='select-value']) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: block !important;
		min-width: 0;
	}

	.actions-head {
		width: 88px;
	}

	.row-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.35rem;
		opacity: 0;
		transition: opacity 0.16s var(--ds-ease);
	}

	:global(.group:hover) .row-actions,
	:global(.group:focus-within) .row-actions {
		opacity: 1;
	}

	.row-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 0.55rem;
		border: 1px solid var(--app-border);
		background: rgba(255, 255, 255, 0.025);
		color: var(--app-text-secondary);
		transition: color 0.16s var(--ds-ease), border-color 0.16s var(--ds-ease), background-color 0.16s var(--ds-ease);
	}

	.row-action:hover:not(:disabled) {
		color: var(--app-text-primary);
		border-color: var(--app-border-focus);
		background: rgba(255, 255, 255, 0.05);
	}

	.row-action.accent:hover:not(:disabled) {
		color: var(--app-accent-light);
		border-color: color-mix(in oklab, var(--app-accent) 55%, var(--app-border));
	}

	.row-action:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.ai-debug-bar {
		display: flex;
		gap: 8px;
	}

	.ai-debug-toggle {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--app-text-muted);
		background: transparent;
		border: 1px solid var(--app-border);
		border-radius: 6px;
		padding: 4px 10px;
		transition: color 0.16s var(--ds-ease), border-color 0.16s var(--ds-ease);
	}

	.ai-debug-toggle:hover {
		color: var(--app-text-secondary);
		border-color: var(--app-border-focus);
	}

	.codex-debug {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		color: var(--app-text-primary);
	}

	.codex-debug-block {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.codex-debug-label {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--app-text-muted);
	}

	.codex-debug pre {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		font-size: 0.72rem;
		line-height: 1.45;
		color: var(--app-text-primary);
	}

	.table-total-count {
		font-size: 0.8rem;
		color: var(--app-text-secondary);
	}

	@media (max-width: 768px) {
		.row-actions {
			opacity: 1;
		}
	}

	@media (max-width: 640px) {
		.file-input-label {
			max-width: 150px;
		}
	}
</style>
