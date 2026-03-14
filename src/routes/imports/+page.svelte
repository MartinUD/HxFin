<script lang="ts">
	import type { PageData } from './$types';
	import { withApiClient } from '$lib/api/client';
	import { toUserMessage } from '$lib/effect/errors';
	import { runUiEffect } from '$lib/effect/runtime/browser';
	import { formatSekAmount } from '$lib/finance/format';
	import type { BudgetCategory } from '$lib/schema/budget';
	import type { ImportBatch, ImportedTransaction, UploadCsvResult } from '$lib/schema/imports';
	import { Button } from '$lib/components/ui/button';
	import SortableTableHead from '$lib/components/SortableTableHead.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import * as Table from '$lib/components/ui/table';

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
	let completedBatchCount = $derived(batches.filter((batch) => batch.status === 'completed').length);
	let failedBatchCount = $derived(batches.filter((batch) => batch.status === 'failed').length);
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

	function apiRun(work: (client: any) => any): Promise<any> {
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

		batches = nextBatches;
		reviewTransactions = nextReviewTransactions;
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

<div class="imports-page">
	<div class="page-header">
		<div class="header-copy">
			<div class="header-icon">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 3v12" />
					<path d="m7 10 5 5 5-5" />
					<path d="M4 21h16" />
				</svg>
			</div>
			<div>
				<h1 class="page-title">CSV Imports</h1>
				<p class="page-subtitle">Import monthly transactions, auto-categorize deterministically, then resolve the remaining review queue.</p>
			</div>
		</div>
	</div>

	{#if errorMessage}
		<Alert.Root class="border-destructive/50 bg-destructive/10">
			<Alert.Description class="flex items-center justify-between text-destructive">
				{errorMessage}
				<button onclick={() => (errorMessage = null)} class="ml-4 opacity-70 hover:opacity-100 text-sm leading-none">✕</button>
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if successMessage}
		<Alert.Root class="border-[var(--app-border)] bg-[var(--app-accent-glow)]">
			<Alert.Description class="flex items-center justify-between text-[var(--app-accent-light)]">
				{successMessage}
				<button onclick={() => (successMessage = null)} class="ml-4 opacity-70 hover:opacity-100 text-sm leading-none">✕</button>
			</Alert.Description>
		</Alert.Root>
	{/if}

	<div class="summary-grid">
		<div class="summary-card">
			<p class="summary-label">Batches</p>
			<p class="summary-value">{batches.length}</p>
		</div>
		<div class="summary-card">
			<p class="summary-label">Rows Imported</p>
			<p class="summary-value">{totalImportedRows}</p>
		</div>
		<div class="summary-card">
			<p class="summary-label">Completed / Failed</p>
			<p class="summary-value">{completedBatchCount} / {failedBatchCount}</p>
		</div>
		<div class="summary-card">
			<p class="summary-label">Needs Review</p>
			<p class="summary-value">{reviewCount}</p>
		</div>
	</div>

	<div class="import-card">
		<div class="import-card-copy">
			<h2 class="section-title">Upload CSV</h2>
			<p class="section-subtitle">Supported: Nordea semicolon exports with Swedish numeric/date formatting.</p>
		</div>
		<div class="import-card-actions">
			<input
				type="file"
				accept=".csv,text/csv"
				onchange={onFileChange}
				class="file-input"
			/>
			<Button onclick={handleUploadCsv} disabled={uploadPending || !selectedFile}>
				{uploadPending ? 'Importing...' : 'Import CSV'}
			</Button>
		</div>
		{#if lastUploadResult}
			<div class="last-import-summary">
				<span>Last import: {lastUploadResult.batch.sourceName}</span>
				<span>Inserted {lastUploadResult.summary.inserted}</span>
				<span>Rule {lastUploadResult.summary.categorizedByRule}</span>
				<span>History {lastUploadResult.summary.categorizedByHistory}</span>
				<span>Review {lastUploadResult.summary.needsReview}</span>
			</div>
		{/if}
	</div>

	<div class="filter-bar">
		<div class="filter-group">
			<label for="batch-filter" class="filter-label">Batch</label>
			<select id="batch-filter" class="filter-select" value={selectedBatchId} onchange={handleBatchFilterChange}>
				<option value="all">All batches</option>
				{#each batches as batch}
					<option value={batch.id}>{batch.sourceName} ({batch.importedAt.slice(0, 10)})</option>
				{/each}
			</select>
		</div>
	</div>

	<div class="table-shell rounded-lg border border-border overflow-hidden">
		<Table.Root>
			<Table.Header>
				<Table.Row class="border-border hover:bg-transparent">
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
								<button class="row-action-btn" onclick={() => handleAssignCategory(transaction.id, false)} disabled={pending}>
									Apply
								</button>
								<button class="row-action-btn accent" onclick={() => handleAssignCategory(transaction.id, true)} disabled={pending}>
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
</div>

<style>
	.imports-page {
		max-width: 1320px;
		margin: 0 auto;
		padding: 32px 24px 58px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		background:
			linear-gradient(180deg, var(--ds-glass-bg-strong), var(--ds-glass-bg)),
			var(--ds-glass-surface);
		border: 1px solid var(--ds-glass-border);
		border-radius: 14px;
		padding: 14px;
		backdrop-filter: blur(var(--ds-glass-blur));
		-webkit-backdrop-filter: blur(var(--ds-glass-blur));
		box-shadow: inset 0 1px 0 var(--ds-glass-edge);
	}

	.header-copy {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.header-icon {
		width: 42px;
		height: 42px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--app-accent-glow);
		color: var(--app-accent-light);
	}

	.page-title {
		font-family: var(--ds-font-display);
		font-size: 1.4rem;
		font-weight: 800;
		letter-spacing: -0.025em;
		color: var(--app-text-primary);
	}

	.page-subtitle {
		margin-top: 2px;
		font-size: 0.84rem;
		color: var(--app-text-secondary);
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 10px;
	}

	.summary-card {
		padding: 11px 12px;
		border-radius: 10px;
		border: 1px solid var(--ds-glass-border);
		background:
			linear-gradient(180deg, var(--ds-glass-bg-strong), var(--ds-glass-bg)),
			var(--ds-glass-surface);
		backdrop-filter: blur(var(--ds-glass-blur));
		-webkit-backdrop-filter: blur(var(--ds-glass-blur));
		box-shadow: var(--ds-shadow-sm), inset 0 1px 0 var(--ds-glass-edge);
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.summary-label {
		font-size: 0.67rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--app-text-muted);
		text-transform: uppercase;
	}

	.summary-value {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--app-text-primary);
		font-variant-numeric: tabular-nums;
	}

	.import-card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		border: 1px solid var(--ds-glass-border);
		border-radius: 12px;
		background:
			linear-gradient(180deg, var(--ds-glass-bg-strong), var(--ds-glass-bg)),
			var(--ds-glass-surface);
		backdrop-filter: blur(var(--ds-glass-blur));
		-webkit-backdrop-filter: blur(var(--ds-glass-blur));
		box-shadow: inset 0 1px 0 var(--ds-glass-edge);
		padding: 12px;
	}

	.import-card-copy {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.section-title {
		font-size: 0.96rem;
		font-weight: 700;
		color: var(--app-text-primary);
	}

	.section-subtitle {
		font-size: 0.78rem;
		color: var(--app-text-muted);
	}

	.import-card-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.file-input {
		color: var(--app-text-secondary);
		font-size: 0.76rem;
		padding: 5px 8px;
		border-radius: 8px;
		border: 1px solid var(--app-border);
		background: rgba(0, 0, 0, 0.34);
	}

	.last-import-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		font-size: 0.72rem;
		color: var(--app-text-secondary);
	}

	.filter-bar {
		display: flex;
		align-items: center;
		justify-content: flex-start;
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

	.table-shell {
		background:
			linear-gradient(180deg, var(--ds-glass-bg-strong), var(--ds-glass-bg)),
			var(--ds-glass-surface);
		backdrop-filter: blur(var(--ds-glass-blur));
		-webkit-backdrop-filter: blur(var(--ds-glass-blur));
		box-shadow: var(--ds-glass-shadow), inset 0 1px 0 var(--ds-glass-edge);
		border-color: var(--ds-glass-border);
		--table-container-bg: rgba(0, 0, 0, 0.08);
		--table-bg: transparent;
		--table-header-bg: rgba(0, 0, 0, 0.06);
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

	@media (max-width: 900px) {
		.summary-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 768px) {
		.imports-page {
			padding-top: 72px;
		}
	}

	@media (max-width: 640px) {
		.imports-page {
			padding: 20px 16px 48px;
		}

		.summary-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
