<script lang="ts">
	import type * as Effect from 'effect/Effect';
	import { type ApiClient, withApiClient } from '$lib/api/client';
	import SortableTableHead from '$lib/components/SortableTableHead.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
	import { toUserMessage } from '$lib/effect/errors';
	import { runUiEffect } from '$lib/effect/runtime/browser';
	import { formatSekAmount } from '$lib/finance/format';
	import type { BudgetCategory } from '$lib/schema/budget';
	import type { ImportBatch, ImportedTransaction, UploadCsvResult } from '$lib/schema/imports';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let hydratedFromLoad = $state(false);
	let categories = $state<BudgetCategory[]>([]);
	let batches = $state<ImportBatch[]>([]);
	let reviewTransactions = $state<ImportedTransaction[]>([]);
	let selectedBatchId = $state<'all' | string>('all');
	let selectedFile = $state<File | null>(null);
	let selectedCategoryByTransactionId = $state<Record<string, string>>({});
	let pending = $state(false);
	let uploadPending = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let lastUploadResult = $state<UploadCsvResult | null>(null);
	let transactionSort = $state<{ key: ImportSortKey; direction: 'asc' | 'desc' }>({
		key: 'date',
		direction: 'desc'
	});

	type ImportSortKey = 'date' | 'description' | 'normalized' | 'amount' | 'batch';

	let totalImportedRows = $derived(batches.reduce((sum, batch) => sum + batch.rowCount, 0));
	let sortedReviewTransactions = $derived(reviewTransactions.slice().sort(sortReviewTransactions));
	let reviewCount = $derived(sortedReviewTransactions.length);

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
		if (transactionSort.key === key) {
			transactionSort = {
				key,
				direction: transactionSort.direction === 'asc' ? 'desc' : 'asc'
			};
			return;
		}

		transactionSort = {
			key,
			direction: key === 'amount' ? 'desc' : key === 'date' ? 'desc' : 'asc'
		};
	}

	function sortReviewTransactions(left: ImportedTransaction, right: ImportedTransaction): number {
		const factor = transactionSort.direction === 'asc' ? 1 : -1;
		let comparison = 0;

		switch (transactionSort.key) {
			case 'date':
				comparison = left.bookingDate.localeCompare(right.bookingDate);
				break;
			case 'description':
				comparison = left.description.localeCompare(right.description, undefined, { sensitivity: 'base' });
				break;
			case 'normalized':
				comparison = left.normalizedDescription.localeCompare(right.normalizedDescription, undefined, {
					sensitivity: 'base'
				});
				break;
			case 'amount':
				comparison = left.amount - right.amount;
				break;
			case 'batch':
				comparison = left.importBatchSourceName.localeCompare(right.importBatchSourceName, undefined, {
					sensitivity: 'base'
				});
				break;
		}

		if (comparison === 0) {
			comparison = right.createdAt.localeCompare(left.createdAt);
		}

		return comparison * factor;
	}

	function toErrorMessage(error: unknown, fallbackMessage: string): string {
		return toUserMessage(error, fallbackMessage);
	}

	function apiRun<A, E, R>(work: (client: ApiClient) => Effect.Effect<A, E, R>): Promise<A> {
		return runUiEffect(withApiClient(fetch, work));
	}

	function onFileChange(event: Event): void {
		const input = event.target as HTMLInputElement;
		selectedFile = input.files?.[0] ?? null;
	}

	async function refreshImportData(): Promise<void> {
		const batchFilter = selectedBatchId !== 'all' ? selectedBatchId : undefined;
		const [nextBatches, nextReviewTransactions] = await Promise.all([
			apiRun((client) => client.imports.listImportBatches({ urlParams: { limit: 30 } })),
			apiRun((client) =>
				client.imports.listReviewTransactions({
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
			lastUploadResult = result;
			selectedFile = null;
			selectedBatchId = 'all';
			await refreshImportData();
			successMessage = `Imported ${result.summary.inserted} transactions from ${result.batch.sourceName}`;
		} catch (error) {
			errorMessage = toErrorMessage(error, 'Failed to import CSV');
		} finally {
			uploadPending = false;
		}
	}

	async function handleBatchFilterChange(event: Event): Promise<void> {
		const select = event.target as HTMLSelectElement;
		selectedBatchId = (select.value || 'all') as 'all' | string;

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

	async function handleAssignCategory(
		transactionId: string,
		saveRule: boolean
	): Promise<void> {
		const categoryId = selectedCategoryByTransactionId[transactionId] ?? '';
		if (!categoryId) {
			errorMessage = 'Select a category before applying';
			return;
		}

		pending = true;
		errorMessage = null;
		successMessage = null;

		try {
			const updated = await apiRun((client) =>
				client.imports.assignImportTransactionCategory({
					path: { transactionId },
					payload: {
						categoryId,
						saveRule
					}
				})
			);

			reviewTransactions = reviewTransactions.filter((tx) => tx.id !== transactionId);
			delete selectedCategoryByTransactionId[transactionId];
			selectedCategoryByTransactionId = { ...selectedCategoryByTransactionId };
			successMessage = saveRule
				? `Assigned and saved rule for "${updated.description}"`
				: `Assigned category for "${updated.description}"`;
		} catch (error) {
			errorMessage = toErrorMessage(error, 'Failed to assign category');
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>Imports — FinDash</title>
</svelte:head>

<div class="app-page imports-page">
	<div class="app-toolbar">
		<div class="app-toolbar-left">
			<h1 class="app-page-title">Imports</h1>
			<div class="app-pill-group review-summary" aria-label="Import summary">
				<span class="summary-pill">{batches.length} batches</span>
				<span class="summary-pill">{totalImportedRows} rows</span>
				<span class="summary-pill">{reviewCount} in review</span>
			</div>
		</div>
		<div class="app-toolbar-right import-actions">
			<label class="file-input-wrap">
				<span class="file-input-label">{selectedFile?.name ?? 'Choose CSV'}</span>
				<input
					type="file"
					accept=".csv,text/csv"
					onchange={onFileChange}
					class="file-input"
				/>
			</label>
			<Button class="app-action-btn" onclick={handleUploadCsv} disabled={uploadPending || !selectedFile}>
				{uploadPending ? 'Importing...' : 'Import CSV'}
			</Button>
		</div>
	</div>

	{#if errorMessage}
		<Alert.Root class="border-destructive/50 bg-destructive/10">
			<Alert.Description class="flex items-center justify-between text-destructive">
				{errorMessage}
				<button type="button" onclick={() => (errorMessage = null)} class="ml-4 opacity-70 hover:opacity-100 text-sm leading-none">✕</button>
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if successMessage}
		<Alert.Root class="border-[var(--app-border)] bg-[var(--app-accent-glow)]">
			<Alert.Description class="flex items-center justify-between text-[var(--app-accent-light)]">
				{successMessage}
				<button type="button" onclick={() => (successMessage = null)} class="ml-4 opacity-70 hover:opacity-100 text-sm leading-none">✕</button>
			</Alert.Description>
		</Alert.Root>
	{/if}

	<div class="filter-row">
		<div class="filter-group">
			<label for="batch-filter" class="filter-label">Batch filter</label>
			<select id="batch-filter" class="filter-select" value={selectedBatchId} onchange={handleBatchFilterChange}>
				<option value="all">All batches</option>
				{#each batches as batch}
					<option value={batch.id}>{batch.sourceName} ({batch.importedAt.slice(0, 10)})</option>
				{/each}
			</select>
		</div>
		{#if lastUploadResult}
			<div class="last-import-summary">
				<span>{lastUploadResult.batch.sourceName}</span>
				<span>{lastUploadResult.summary.inserted} inserted</span>
				<span>{lastUploadResult.summary.needsReview} review</span>
			</div>
		{/if}
	</div>

	<div class="app-table-shell rounded-lg border border-border overflow-hidden">
		<div class="app-table-scroll">
			<Table.Root>
				<Table.Header>
					<Table.Row class="imports-header-row border-border hover:bg-transparent">
					<SortableTableHead class="imports-head w-[10%]" label="Date" active={transactionSort.key === 'date'} direction={transactionSort.direction} onToggle={() => toggleTransactionSort('date')} />
					<SortableTableHead class="imports-head w-[24%]" label="Description" active={transactionSort.key === 'description'} direction={transactionSort.direction} onToggle={() => toggleTransactionSort('description')} />
					<SortableTableHead class="imports-head w-[14%]" label="Normalized" active={transactionSort.key === 'normalized'} direction={transactionSort.direction} onToggle={() => toggleTransactionSort('normalized')} />
					<SortableTableHead class="imports-head w-[10%]" label="Amount" align="right" active={transactionSort.key === 'amount'} direction={transactionSort.direction} onToggle={() => toggleTransactionSort('amount')} />
					<SortableTableHead class="imports-head w-[16%]" label="Batch" active={transactionSort.key === 'batch'} direction={transactionSort.direction} onToggle={() => toggleTransactionSort('batch')} />
					<Table.Head class="imports-head w-[16%]">Category</Table.Head>
					<Table.Head class="w-[10%]"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each sortedReviewTransactions as transaction (transaction.id)}
						<Table.Row class="border-border">
						<Table.Cell class="text-muted-foreground text-sm">{transaction.bookingDate}</Table.Cell>
						<Table.Cell class="text-foreground text-sm">{transaction.description}</Table.Cell>
						<Table.Cell class="text-muted-foreground text-xs">{transaction.normalizedDescription}</Table.Cell>
						<Table.Cell class="text-right tabular-nums text-foreground text-sm">{formatCurrency(transaction.amount)}</Table.Cell>
						<Table.Cell class="text-muted-foreground text-xs">{transaction.importBatchSourceName}</Table.Cell>
						<Table.Cell>
							<select
								class="category-select"
								value={selectedCategoryByTransactionId[transaction.id] ?? ''}
								onchange={(event) => {
									const target = event.target as HTMLSelectElement;
									selectedCategoryByTransactionId[transaction.id] = target.value;
									selectedCategoryByTransactionId = { ...selectedCategoryByTransactionId };
								}}
							>
								<option value="">Select category</option>
								{#each categories as category}
									<option value={category.id}>{category.name}</option>
								{/each}
							</select>
						</Table.Cell>
						<Table.Cell>
							<div class="row-actions">
								<button type="button" class="row-action-btn" onclick={() => handleAssignCategory(transaction.id, false)} disabled={pending}>
									Apply
								</button>
								<button type="button" class="row-action-btn accent" onclick={() => handleAssignCategory(transaction.id, true)} disabled={pending}>
									Apply + Rule
								</button>
							</div>
						</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={7} class="text-center py-14 text-muted-foreground text-sm">
								No transactions in review queue.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
		<div class="app-table-summary">
			<span class="app-table-summary-label">Review queue</span>
			<span class="app-table-summary-value">{reviewCount}</span>
		</div>
	</div>
</div>

<style>
	.imports-page {
		gap: 14px;
	}

	.import-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.review-summary {
		gap: 0.5rem;
	}

	.summary-pill {
		display: inline-flex;
		align-items: center;
		height: 2.1rem;
		padding: 0 0.8rem;
		border-radius: 999px;
		border: 1px solid var(--ds-glass-border);
		background: rgba(255, 255, 255, 0.03);
		color: var(--app-text-secondary);
		font-size: 0.8rem;
		font-weight: 600;
	}

	.file-input-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		height: 2.8rem;
		padding: 0 0.95rem;
		border-radius: 0.9rem;
		border: 1px solid var(--ds-glass-border);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.16));
		color: var(--app-text-secondary);
		font-size: 0.86rem;
		font-weight: 600;
		cursor: pointer;
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

	.last-import-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		font-size: 0.78rem;
		color: var(--app-text-secondary);
	}

	.filter-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.filter-label {
		font-size: 0.67rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--app-text-muted);
	}

	.filter-select {
		padding: 6px 9px;
		border-radius: 8px;
		border: 1px solid var(--app-border);
		background: rgba(0, 0, 0, 0.35);
		color: var(--app-text-primary);
		font-size: 0.76rem;
	}

	:global(.imports-header-row) {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.14));
	}

	:global(.imports-head) {
		height: 3.7rem;
		padding: 1.15rem 1.25rem;
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0;
		text-transform: none;
		color: var(--app-text-secondary);
	}

	.category-select {
		width: 100%;
		padding: 4px 6px;
		font-size: 0.74rem;
		border-radius: 7px;
		border: 1px solid var(--app-border);
		background: rgba(0, 0, 0, 0.34);
		color: var(--app-text-primary);
	}

	.row-actions {
		display: flex;
		gap: 5px;
		justify-content: flex-end;
	}

	.row-action-btn {
		font-size: 0.67rem;
		color: var(--app-text-secondary);
		background: transparent;
		border: 1px solid var(--app-border);
		border-radius: 6px;
		padding: 3px 6px;
	}

	.row-action-btn:hover:not(:disabled) {
		border-color: var(--app-border-focus);
		color: var(--app-text-primary);
	}

	.row-action-btn.accent:hover:not(:disabled) {
		color: var(--app-accent-light);
		border-color: color-mix(in oklab, var(--app-accent) 55%, var(--app-border));
	}

	.row-action-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.file-input-label {
			max-width: 150px;
		}
	}
</style>
