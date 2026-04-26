<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import type * as Effect from 'effect/Effect';
	import { type ApiClient, withApiClient } from '$lib/api/client';
	import * as Alert from '$lib/shadcn-prim/alert';
	import { Button } from '$lib/shadcn-prim/button';
	import * as Dialog from '$lib/shadcn-prim/dialog';
	import { Input } from '$lib/shadcn-prim/input';
	import { Label } from '$lib/shadcn-prim/label';
	import {
		SegmentedControl,
		type SegmentedControlOption
	} from '$lib/shadcn-prim/segmented-control';
	import * as Select from '$lib/shadcn-prim/select';
	import { Tag } from '$lib/shadcn-prim/tag';
	import {
		ToolbarActionButton,
		ToolbarActions
	} from '$lib/shadcn-prim/toolbar-actions';
	import {
		Table,
		SortableTableHead,
		type SortDirection,
		sortAlphabetical,
		sortValue,
		toggleSort as toggleTableSort
	} from '$lib/shadcn-prim/table';
	import { toUserMessage } from '$lib/effect/errors';
	import { runUiEffect } from '$lib/effect/runtime/browser';
	import { formatSekAmount } from '$lib/shared/format';
	import type { InvestmentAccount, InvestmentHolding } from '$lib/schema/investments';

	interface Props {
		data: {
			accounts: InvestmentAccount[];
			holdings: InvestmentHolding[];
		};
	}

	let { data }: Props = $props();

	type HoldingSortKey = 'name' | 'platform' | 'value' | 'weight' | 'target' | 'change';
	type AllocationRow = InvestmentHolding & { actualPercent: number };

	let hydratedFromLoad = $state(false);
	let accounts = $state<InvestmentAccount[]>([]);
	let holdings = $state<InvestmentHolding[]>([]);
	let portfolioPending = $state(false);
	let portfolioMessage = $state<string | null>(null);

	let platformFilter = $state<'all' | 'nordea' | 'avanza' | 'manual'>('all');
	let holdingSort = $state<{ key: HoldingSortKey; direction: SortDirection }>({
		key: 'value',
		direction: 'desc'
	});

	let holdingDialogOpen = $state(false);
	let holdingDialogMode = $state<'add' | 'edit'>('add');
	let editingHoldingId = $state<number | null>(null);
	let dialogHoldingName = $state('');
	let dialogHoldingValue = $state<number>(0);
	let dialogHoldingAllocation = $state<number>(0);
	let dialogHoldingUnits = $state<number | null>(null);
	let dialogHoldingTrackerSource = $state<'manual' | 'nordea' | 'avanza'>('manual');
	let dialogHoldingTrackerUrl = $state('');
	let dialogHoldingSortOrder = $state<number>(0);

	let defaultAccountId = $derived(accounts[0]?.id ?? null);
	let portfolioHoldings = $derived(
		holdings.slice().sort((a, b) => a.sortOrder - b.sortOrder)
	);
	let visibleHoldings = $derived(
		platformFilter === 'all'
			? portfolioHoldings
			: portfolioHoldings.filter((holding) => holding.trackerSource === platformFilter)
	);
	let selectedHoldingsTotal = $derived(
		visibleHoldings.reduce((sum, h) => sum + h.currentValue, 0)
	);
	let trackedHoldingsCount = $derived(
		portfolioHoldings.filter((holding) => holding.trackerSource !== 'manual').length
	);
	let latestTrackedSync = $derived(
		portfolioHoldings
			.filter((holding) => holding.lastSyncedAt)
			.map((holding) => holding.lastSyncedAt as string)
			.sort()
			.at(-1) ?? null
	);
	let platformOptions = $derived<SegmentedControlOption[]>([
		{ value: 'all', label: 'All' },
		{ value: 'nordea', label: 'Nordea' },
		{ value: 'avanza', label: 'Avanza' }
	]);
	let allocationRows = $derived(
		visibleHoldings
			.map((h) => ({
				...h,
				actualPercent:
					selectedHoldingsTotal > 0 ? (h.currentValue / selectedHoldingsTotal) * 100 : 0
			}))
			.sort(sortAllocationRows)
	);

	$effect(() => {
		if (hydratedFromLoad) return;
		accounts = (data.accounts as InvestmentAccount[]) ?? [];
		holdings = (data.holdings as InvestmentHolding[]) ?? [];
		hydratedFromLoad = true;
	});

	function formatCurrency(value: number): string {
		return formatSekAmount(value);
	}

	function formatPercent(value: number): string {
		return `${value.toFixed(1)}%`;
	}

	function prefixSigned(value: number): string {
		return value >= 0 ? '+' : '';
	}

	function formatPlatformLabel(value: 'manual' | 'nordea' | 'avanza'): string {
		return value === 'manual' ? 'Manual' : value === 'nordea' ? 'Nordea' : 'Avanza';
	}

	function formatSyncStamp(value: string | null): string {
		if (!value) return 'Not synced yet';
		return new Intl.DateTimeFormat('sv-SE', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(value));
	}

	function apiRun<A, E, R>(work: (client: ApiClient) => Effect.Effect<A, E, R>): Promise<A> {
		return runUiEffect(withApiClient(fetch, work));
	}

	async function refreshPortfolio(): Promise<void> {
		const [nextAccounts, nextHoldings] = await Promise.all([
			apiRun((client) => client.investments.listInvestmentAccounts()),
			apiRun((client) => client.investments.listInvestmentHoldings({ urlParams: {} }))
		]);
		accounts = nextAccounts.slice();
		holdings = nextHoldings.slice();
	}

	async function runPortfolioMutation(
		action: () => Promise<void>,
		fallback: string
	): Promise<void> {
		portfolioPending = true;
		portfolioMessage = null;
		try {
			await action();
		} catch (error) {
			portfolioMessage = toUserMessage(error, fallback);
		} finally {
			portfolioPending = false;
		}
	}

	function openAddHoldingDialog(): void {
		if (!defaultAccountId) return;
		const nextSort =
			portfolioHoldings.length > 0
				? Math.max(...portfolioHoldings.map((h) => h.sortOrder)) + 1
				: 0;
		holdingDialogMode = 'add';
		editingHoldingId = null;
		dialogHoldingName = '';
		dialogHoldingValue = 0;
		dialogHoldingAllocation = 0;
		dialogHoldingUnits = null;
		dialogHoldingTrackerSource = 'manual';
		dialogHoldingTrackerUrl = '';
		dialogHoldingSortOrder = nextSort;
		holdingDialogOpen = true;
	}

	function openEditHoldingDialog(holding: InvestmentHolding): void {
		holdingDialogMode = 'edit';
		editingHoldingId = holding.id;
		dialogHoldingName = holding.name;
		dialogHoldingValue = holding.currentValue;
		dialogHoldingAllocation = holding.allocationPercent;
		dialogHoldingUnits = holding.units;
		dialogHoldingTrackerSource = holding.trackerSource;
		dialogHoldingTrackerUrl = holding.trackerUrl ?? '';
		dialogHoldingSortOrder = holding.sortOrder;
		holdingDialogOpen = true;
	}

	async function handleSaveHolding(): Promise<void> {
		if (!defaultAccountId || !dialogHoldingName.trim() || dialogHoldingValue < 0) return;
		if (dialogHoldingTrackerSource !== 'manual' && dialogHoldingValue <= 0) {
			portfolioMessage = 'Tracked holdings need a current SEK value so units can be derived';
			return;
		}
		await runPortfolioMutation(async () => {
			if (holdingDialogMode === 'add') {
				await apiRun((client) =>
					client.investments.createInvestmentHolding({
						payload: {
							accountId: defaultAccountId,
							name: dialogHoldingName.trim(),
							currentValue: dialogHoldingValue,
							allocationPercent: dialogHoldingAllocation,
							units: dialogHoldingTrackerSource === 'manual' ? null : dialogHoldingUnits,
							trackerSource: dialogHoldingTrackerSource,
							trackerUrl: dialogHoldingTrackerUrl.trim() || null,
							sortOrder: dialogHoldingSortOrder
						}
					})
				);
			} else if (editingHoldingId !== null) {
				const holdingId = editingHoldingId;
				await apiRun((client) =>
					client.investments.updateInvestmentHolding({
						path: { holdingId },
						payload: {
							accountId: defaultAccountId,
							name: dialogHoldingName.trim(),
							currentValue: dialogHoldingValue,
							allocationPercent: dialogHoldingAllocation,
							units: dialogHoldingTrackerSource === 'manual' ? null : dialogHoldingUnits,
							trackerSource: dialogHoldingTrackerSource,
							trackerUrl: dialogHoldingTrackerUrl.trim() || null,
							sortOrder: dialogHoldingSortOrder
						}
					})
				);
			}
			await refreshPortfolio();
			holdingDialogOpen = false;
		}, 'Failed to save holding');
	}

	async function handleDeleteHolding(holdingId: number): Promise<void> {
		if (!confirm('Delete this holding?')) return;
		await runPortfolioMutation(async () => {
			await apiRun((client) =>
				client.investments.deleteInvestmentHolding({
					path: { holdingId }
				})
			);
			await refreshPortfolio();
		}, 'Failed to delete holding');
	}

	async function handleRefreshTrackedPrices(): Promise<void> {
		await runPortfolioMutation(async () => {
			const report = await apiRun((client) =>
				client.investments.refreshTrackedInvestmentHoldings()
			);
			holdings = report.holdings.slice();
		}, 'Failed to refresh tracked holdings');
	}

	function toggleHoldingSort(key: HoldingSortKey): void {
		holdingSort = toggleTableSort(holdingSort, key);
	}

	function sortAllocationRows(left: AllocationRow, right: AllocationRow): number {
		switch (holdingSort.key) {
			case 'name':
				return withSortOrderTiebreak(
					sortAlphabetical(left.name, right.name, holdingSort.direction),
					left,
					right
				);
			case 'platform':
				return withSortOrderTiebreak(
					sortAlphabetical(
						formatPlatformLabel(left.trackerSource),
						formatPlatformLabel(right.trackerSource),
						holdingSort.direction
					),
					left,
					right
				);
			case 'value':
				return withSortOrderTiebreak(
					sortValue(left.currentValue, right.currentValue, holdingSort.direction),
					left,
					right
				);
			case 'weight':
				return withSortOrderTiebreak(
					sortValue(left.actualPercent, right.actualPercent, holdingSort.direction),
					left,
					right
				);
			case 'target':
				return withSortOrderTiebreak(
					sortValue(left.allocationPercent, right.allocationPercent, holdingSort.direction),
					left,
					right
				);
			case 'change':
				return withSortOrderTiebreak(
					sortValue(
						left.changeAmountSinceLastSnapshot ?? Number.NEGATIVE_INFINITY,
						right.changeAmountSinceLastSnapshot ?? Number.NEGATIVE_INFINITY,
						holdingSort.direction
					),
					left,
					right
				);
		}
	}

	function withSortOrderTiebreak(
		comparison: number,
		left: AllocationRow,
		right: AllocationRow
	): number {
		return comparison !== 0 ? comparison : left.sortOrder - right.sortOrder;
	}
</script>

<div class="app-page page">
	<div class="app-toolbar">
		<div class="app-toolbar-left">
			<SegmentedControl
				bind:value={platformFilter}
				options={platformOptions}
				ariaLabel="Filter holdings by platform"
				class="platform-filter"
			/>
		</div>

		<div class="app-toolbar-right">
			{#if trackedHoldingsCount > 0 || defaultAccountId}
				<ToolbarActions>
					{#if trackedHoldingsCount > 0}
						<div class="sync-chip">
							<span class="sync-label">Tracked holdings</span>
							<span class="sync-stamp">{formatSyncStamp(latestTrackedSync)}</span>
						</div>
						<ToolbarActionButton
							tone="muted"
							onclick={handleRefreshTrackedPrices}
							disabled={portfolioPending}
						>
							Refresh prices
						</ToolbarActionButton>
					{/if}

					{#if defaultAccountId}
						<ToolbarActionButton onclick={openAddHoldingDialog}>+ Holding</ToolbarActionButton>
					{/if}
				</ToolbarActions>
			{/if}
		</div>
	</div>

	{#if portfolioMessage}
		<Alert.Root class="border-destructive/50 bg-destructive/10">
			<Alert.Description class="flex items-center justify-between text-destructive text-xs">
				{portfolioMessage}
				<button
					type="button"
					onclick={() => (portfolioMessage = null)}
					class="ml-4 opacity-60 hover:opacity-100 text-xs"
				>✕</button>
			</Alert.Description>
		</Alert.Root>
	{/if}

	<div class="portfolio-view">
		{#if accounts.length === 0}
			<p class="empty-copy">
				No portfolio storage exists yet. Reload after the default account has been created.
			</p>
		{/if}

		{#if defaultAccountId}
			<div class="portfolio-grid">
				<Table fill class="portfolio-table table-fixed">
					{#snippet footer()}
						<span class="table-summary-label">Total</span>
						<span class="table-summary-value">{formatCurrency(selectedHoldingsTotal)}</span>
					{/snippet}
					<thead>
						<tr>
							<SortableTableHead class="w-[24%]" label="Name" active={holdingSort.key === 'name'} direction={holdingSort.direction} onToggle={() => toggleHoldingSort('name')} />
							<SortableTableHead class="w-[15%]" label="Platform" active={holdingSort.key === 'platform'} direction={holdingSort.direction} onToggle={() => toggleHoldingSort('platform')} />
							<SortableTableHead class="w-[15%]" label="Value" align="right" active={holdingSort.key === 'value'} direction={holdingSort.direction} onToggle={() => toggleHoldingSort('value')} />
							<SortableTableHead class="w-[12%]" label="Weight" align="right" active={holdingSort.key === 'weight'} direction={holdingSort.direction} onToggle={() => toggleHoldingSort('weight')} />
							<SortableTableHead class="w-[14%]" label="Target" align="right" active={holdingSort.key === 'target'} direction={holdingSort.direction} onToggle={() => toggleHoldingSort('target')} />
							<SortableTableHead class="w-[15%]" label="Since update" align="right" active={holdingSort.key === 'change'} direction={holdingSort.direction} onToggle={() => toggleHoldingSort('change')} />
							<th class="w-[90px]"></th>
						</tr>
					</thead>
					<tbody>
						{#each allocationRows as holding (holding.id)}
							<tr class="group">
								<td class="portfolio-cell holding-name-cell text-foreground font-medium">{holding.name}</td>
								<td class="portfolio-cell">
									<Tag
										variant={
											holding.trackerSource === 'avanza'
												? 'success'
												: holding.trackerSource === 'manual'
													? 'neutral'
													: 'subtle'
										}
										class="platform-pill"
									>
										{formatPlatformLabel(holding.trackerSource)}
									</Tag>
								</td>
								<td class="portfolio-cell text-right font-mono tabular-nums text-foreground">{formatCurrency(holding.currentValue)}</td>
								<td class="portfolio-cell text-right font-mono tabular-nums text-muted-foreground">{formatPercent(holding.actualPercent)}</td>
								<td class="portfolio-cell text-right font-mono tabular-nums text-muted-foreground">{formatPercent(holding.allocationPercent)}</td>
								<td class="portfolio-cell text-right font-mono tabular-nums">
									{#if holding.changeAmountSinceLastSnapshot !== null}
										<div
											class:text-emerald-400={holding.changeAmountSinceLastSnapshot >= 0}
											class:text-red-400={holding.changeAmountSinceLastSnapshot < 0}
										>
											{prefixSigned(holding.changeAmountSinceLastSnapshot)}{formatCurrency(holding.changeAmountSinceLastSnapshot)}
										</div>
										<div class="text-muted-foreground">
											{prefixSigned(holding.changePercentSinceLastSnapshot ?? 0)}{formatPercent(holding.changePercentSinceLastSnapshot ?? 0)}
										</div>
									{:else}
										<span class="text-muted-foreground">-</span>
									{/if}
								</td>
								<td class="portfolio-cell">
									<div class="holding-actions">
										<button type="button" class="holding-action" onclick={() => openEditHoldingDialog(holding)} aria-label="Edit holding" title="Edit holding">
											<PencilIcon class="holding-action-icon" size={12} strokeWidth={1.75} />
										</button>
										<button type="button" class="holding-action danger" onclick={() => handleDeleteHolding(holding.id)} aria-label="Delete holding" title="Delete holding">
											<Trash2Icon class="holding-action-icon" size={12} strokeWidth={1.75} />
										</button>
									</div>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan={7} class="table-empty-state">No holdings yet.</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			</div>
		{/if}
	</div>
</div>

<Dialog.Root bind:open={holdingDialogOpen}>
	<Dialog.Content class="bg-card border-border sm:max-w-[460px]">
		<Dialog.Header>
			<Dialog.Title class="text-foreground">
				{holdingDialogMode === 'add' ? 'Add holding' : 'Edit holding'}
			</Dialog.Title>
			<Dialog.Description class="text-muted-foreground text-sm">
				{holdingDialogMode === 'add'
					? 'Add a new tracked or manual holding.'
					: 'Update this holding value and tracking details.'}
			</Dialog.Description>
		</Dialog.Header>
		<div class="dialog-fields">
			<div class="form-field">
				<Label class="field-label">Name</Label>
				<Input bind:value={dialogHoldingName} placeholder="e.g. Global index" class="bg-muted border-border text-foreground" />
			</div>
			<div class="form-field">
				<Label class="field-label">Current value</Label>
				<Input type="number" min="0" step="0.01" bind:value={dialogHoldingValue} class="bg-muted border-border text-foreground" />
			</div>
			<div class="form-row">
				<div class="form-field">
					<Label class="field-label">Weight %</Label>
					<Input type="number" min="0" max="100" step="0.1" bind:value={dialogHoldingAllocation} class="bg-muted border-border text-foreground" />
				</div>
				<div class="form-field">
					<Label class="field-label">Sort order</Label>
					<Input type="number" min="0" step="1" bind:value={dialogHoldingSortOrder} class="bg-muted border-border text-foreground" />
				</div>
			</div>
			<div class="form-row">
				<div class="form-field">
					<Label class="field-label">Platform</Label>
					<Select.Root
						type="single"
						value={dialogHoldingTrackerSource}
						onValueChange={(value: string) =>
							(dialogHoldingTrackerSource = (value ?? 'manual') as 'manual' | 'nordea' | 'avanza')}
					>
						<Select.Trigger class="w-full bg-muted border-border text-foreground">
							{dialogHoldingTrackerSource === 'manual'
								? 'Manual'
								: dialogHoldingTrackerSource === 'nordea'
									? 'Nordea'
									: 'Avanza'}
						</Select.Trigger>
						<Select.Content class="bg-card border-border">
							<Select.Item value="manual" class="text-foreground cursor-pointer">Manual</Select.Item>
							<Select.Item value="nordea" class="text-foreground cursor-pointer">Nordea</Select.Item>
							<Select.Item value="avanza" class="text-foreground cursor-pointer">Avanza</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
				<div class="form-field">
					<Label class="field-label">Units</Label>
					<Input
						type="number"
						min="0"
						step="0.0001"
						bind:value={dialogHoldingUnits}
						class="bg-muted border-border text-foreground"
						disabled={dialogHoldingTrackerSource === 'manual'}
						placeholder="Optional, derived from SEK value on first refresh"
					/>
				</div>
			</div>
			<div class="form-field">
				<Label class="field-label">Tracker URL</Label>
				<Input
					bind:value={dialogHoldingTrackerUrl}
					placeholder={dialogHoldingTrackerSource === 'avanza'
						? 'Optional, e.g. https://www.avanza.se/avanza-global'
						: dialogHoldingTrackerSource === 'nordea'
							? 'Optional, e.g. https://www.nordeafunds.com/sv/fonder/global-index-select-a'
							: 'Optional'}
					class="bg-muted border-border text-foreground"
					disabled={dialogHoldingTrackerSource === 'manual'}
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="ghost" onclick={() => (holdingDialogOpen = false)}>Cancel</Button>
			<Button onclick={handleSaveHolding} disabled={portfolioPending || !dialogHoldingName.trim()}>
				{holdingDialogMode === 'add' ? 'Add holding' : 'Save'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.page {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
		overflow: hidden;
	}

	:global(.platform-filter) {
		margin-left: 4px;
		max-width: 100%;
	}

	.sync-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		height: 2.8rem;
		padding: 0.55rem 0.95rem;
		border: 1px solid var(--ds-glass-border);
		border-radius: 0.9rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.16));
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
	}

	.sync-label {
		font-size: 0.88rem;
		font-weight: 700;
		color: var(--app-text-secondary);
		white-space: nowrap;
	}

	.sync-stamp {
		font-size: 0.84rem;
		color: var(--app-text-muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	:global(.field-label) {
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0;
		text-transform: none;
		color: var(--app-text-secondary);
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.portfolio-view {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 0;
		flex: 1 1 auto;
	}

	.portfolio-grid {
		display: block;
		min-height: 0;
		flex: 1 1 auto;
	}

	:global(.portfolio-table[data-slot='table']) {
		width: 100%;
		table-layout: fixed;
	}

	:global(.portfolio-cell) {
		line-height: 1.3;
	}

	:global(.holding-name-cell) {
		font-size: 1.16rem;
		font-weight: 700;
	}

	.holding-actions {
		display: flex;
		justify-content: flex-end;
		gap: 5px;
	}

	:global(.platform-pill) {
		font-size: 0.84rem;
	}

	.holding-action {
		color: var(--app-text-secondary);
		border: 1px solid var(--app-border);
		background: transparent;
		border-radius: 8px;
		width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		cursor: pointer;
		transition: color 0.12s ease, border-color 0.12s ease;
	}

	:global(.holding-action-icon) {
		width: 13px;
		height: 13px;
		flex: none;
	}

	.holding-action:hover {
		color: var(--app-text-primary);
		border-color: var(--app-border-focus);
	}

	.holding-action.danger:hover {
		border-color: var(--app-red);
		color: var(--app-red);
	}

	.dialog-fields {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.empty-copy {
		font-size: 0.8rem;
		color: var(--app-text-muted);
		padding: 6px 0;
	}
</style>
