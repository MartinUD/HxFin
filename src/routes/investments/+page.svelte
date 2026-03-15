<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import type * as Effect from 'effect/Effect';
	import { browser } from '$app/environment';
	import { type ApiClient, withApiClient } from '$lib/api/client';
	import { calculate } from '$lib/calculator';
	import ResultsPanel from '$lib/components/fire/ResultsPanel.svelte';
	import SettingsPanel from '$lib/components/fire/SettingsPanel.svelte';
	import SortableTableHead from '$lib/components/SortableTableHead.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import * as Table from '$lib/components/ui/table';
	import { toUserMessage } from '$lib/effect/errors';
	import { runUiEffect } from '$lib/effect/runtime/browser';
	import { formatSekAmount } from '$lib/finance/format';
	import type { InvestmentAccount, InvestmentHolding } from '$lib/schema/investments';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	let hydratedFromLoad = $state(false);
	let accounts = $state<InvestmentAccount[]>([]);
	let holdings = $state<InvestmentHolding[]>([]);
	let portfolioPending = $state(false);
	let portfolioMessage = $state<string | null>(null);

	let view = $state<'portfolio' | 'projections'>('portfolio');
	let platformFilter = $state<'all' | 'nordea' | 'avanza' | 'manual'>('all');
	let holdingSort = $state<{ key: HoldingSortKey; direction: 'asc' | 'desc' }>({
		key: 'value',
		direction: 'desc'
	});

	let holdingDialogOpen = $state(false);
	let holdingDialogMode = $state<'add' | 'edit'>('add');
	let editingHoldingId = $state('');
	let dialogHoldingName = $state('');
	let dialogHoldingValue = $state<number>(0);
	let dialogHoldingAllocation = $state<number>(0);
	let dialogHoldingUnits = $state<number | null>(null);
	let dialogHoldingTrackerSource = $state<'manual' | 'nordea' | 'avanza'>('manual');
	let dialogHoldingTrackerUrl = $state('');
	let dialogHoldingSortOrder = $state<number>(0);

	let startCapital = $state(100000);
	let monthlySaving = $state(5000);
	let monthlySalary = $state(40000);
	let salaryGrowth = $state(6);
	let kommunalskatt = $state(32.41);
	let savingsShareOfRaise = $state(50);
	let avgReturn = $state(8);
	let leverage = $state(0);
	let years = $state(20);
	let retirementYear = $state(20);
	let withdrawalRate = $state(4);
	let profileSavePending = $state(false);
	let profileSaveMessage = $state<string | null>(null);
	let projectionSaveMessage = $state<string | null>(null);
	let hasInitializedStartCapital = $state(false);

	const PROJECTION_PRESET_KEY = 'fin:investments:projection-preset';
	type HoldingSortKey = 'name' | 'platform' | 'value' | 'weight' | 'target' | 'change';

	let defaultAccountId = $derived(accounts[0]?.id ?? '');
	let portfolioHoldings = $derived(
		holdings
			.slice()
			.sort((a, b) => a.sortOrder - b.sortOrder)
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
	let overallHoldingsTotal = $derived(
		holdings.reduce((sum, h) => sum + h.currentValue, 0)
	);
	let overallAccountRecordedTotal = $derived(
		accounts.reduce((sum, a) => sum + a.totalValue, 0)
	);
	let portfolioTotal = $derived(
		overallHoldingsTotal > 0 ? overallHoldingsTotal : overallAccountRecordedTotal
	);
	let allocationRows = $derived(
		visibleHoldings
			.map((h) => ({
				...h,
				actualPercent: selectedHoldingsTotal > 0 ? (h.currentValue / selectedHoldingsTotal) * 100 : 0
			}))
			.sort(sortAllocationRows)
	);

	let results = $derived(
		calculate({
			startCapital,
			monthlySaving,
			monthlySalary,
			salaryGrowth,
			kommunalskatt,
			savingsShareOfRaise,
			avgReturn,
			leverage,
			years
		})
	);

	$effect(() => {
		if (hydratedFromLoad) return;
		accounts = (data.accounts as InvestmentAccount[]) ?? [];
		holdings = (data.holdings as InvestmentHolding[]) ?? [];
		monthlySalary = data.profile.monthlySalary;
		salaryGrowth = data.profile.salaryGrowth;
		kommunalskatt = data.profile.municipalTaxRate;
		savingsShareOfRaise = data.profile.savingsShareOfRaise;
		hydratedFromLoad = true;
	});

	$effect(() => {
		if (hasInitializedStartCapital) return;
		if (portfolioTotal > 0) {
			startCapital = Math.round(portfolioTotal);
			hasInitializedStartCapital = true;
		}
	});

	$effect(() => {
		if (!browser || !projectionSaveMessage) return;
		const timeout = window.setTimeout(() => {
			projectionSaveMessage = null;
		}, 2400);

		return () => window.clearTimeout(timeout);
	});

	$effect(() => {
		if (retirementYear !== years) {
			retirementYear = years;
		}
	});

	function formatCurrency(value: number): string { return formatSekAmount(value); }
	function formatPercent(value: number): string { return `${value.toFixed(1)}%`; }
	function prefixSigned(value: number): string { return value >= 0 ? '+' : ''; }
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

	function toErrorMessage(error: unknown, fallback: string): string {
		return toUserMessage(error, fallback);
	}

	function apiRun<A, E, R>(work: (client: ApiClient) => Effect.Effect<A, E, R>): Promise<A> {
		return runUiEffect(withApiClient(fetch, work));
	}

	async function refreshPortfolio(): Promise<void> {
		const [nextAccounts, nextHoldings] = await Promise.all([
			apiRun((client) => client.investments.listInvestmentAccounts()),
			apiRun((client) => client.investments.listInvestmentHoldings())
		]);
		accounts = nextAccounts;
		holdings = nextHoldings;
	}

	async function runPortfolioMutation(action: () => Promise<void>, fallback: string): Promise<void> {
		portfolioPending = true;
		portfolioMessage = null;
		try {
			await action();
		} catch (error) {
			portfolioMessage = toErrorMessage(error, fallback);
		} finally {
			portfolioPending = false;
		}
	}

	function openAddHoldingDialog(): void {
		if (!defaultAccountId) return;
		const nextSort = portfolioHoldings.length > 0
			? Math.max(...portfolioHoldings.map((h) => h.sortOrder)) + 1
			: 0;
		holdingDialogMode = 'add';
		editingHoldingId = '';
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
			} else if (editingHoldingId) {
				await apiRun((client) =>
					client.investments.updateInvestmentHolding({
						path: { holdingId: editingHoldingId },
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

	async function handleDeleteHolding(holdingId: string): Promise<void> {
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
			const report = await apiRun((client) => client.investments.refreshTrackedInvestmentHoldings());
			holdings = report.holdings;
		}, 'Failed to refresh tracked holdings');
	}

	function setStartCapitalFromPortfolio(): void {
		if (portfolioTotal > 0) startCapital = Math.round(portfolioTotal);
	}

	function loadProjectionPreset(): void {
		if (!browser) return;
		const raw = window.localStorage.getItem(PROJECTION_PRESET_KEY);
		if (!raw) return;

		try {
			const preset = JSON.parse(raw) as Record<string, number | string>;
			startCapital = Number(preset.startCapital ?? startCapital);
			monthlySaving = Number(preset.monthlySaving ?? monthlySaving);
			monthlySalary = Number(preset.monthlySalary ?? monthlySalary);
			salaryGrowth = Number(preset.salaryGrowth ?? salaryGrowth);
			kommunalskatt = Number(preset.kommunalskatt ?? kommunalskatt);
			savingsShareOfRaise = Number(preset.savingsShareOfRaise ?? savingsShareOfRaise);
			avgReturn = Number(preset.avgReturn ?? avgReturn);
			leverage = Number(preset.leverage ?? leverage);
			years = Number(preset.years ?? years);
			withdrawalRate = Number(preset.withdrawalRate ?? withdrawalRate);
		} catch {
			window.localStorage.removeItem(PROJECTION_PRESET_KEY);
		}
	}

	function saveProjectionPreset(): void {
		if (!browser) return;

		window.localStorage.setItem(
			PROJECTION_PRESET_KEY,
			JSON.stringify({
				startCapital,
				monthlySaving,
				monthlySalary,
				salaryGrowth,
				kommunalskatt,
				savingsShareOfRaise,
				avgReturn,
				leverage,
				years,
				withdrawalRate
			})
		);
		projectionSaveMessage = 'Setup saved';
	}

	async function saveIncomeProfile(): Promise<void> {
		profileSavePending = true;
		profileSaveMessage = null;
		try {
			await apiRun((client) =>
				client.finance.updateFinancialProfile({
					payload: {
						monthlySalary,
						salaryGrowth,
						municipalTaxRate: kommunalskatt,
						savingsShareOfRaise
					}
				})
			);
			profileSaveMessage = 'Income profile saved';
		} catch (error) {
			profileSaveMessage = toErrorMessage(error, 'Failed to save income profile');
		} finally {
			profileSavePending = false;
		}
	}

	if (browser) {
		loadProjectionPreset();
	}

	function toggleHoldingSort(key: HoldingSortKey): void {
		if (holdingSort.key === key) {
			holdingSort = {
				key,
				direction: holdingSort.direction === 'asc' ? 'desc' : 'asc'
			};
			return;
		}

		holdingSort = {
			key,
			direction: key === 'name' || key === 'platform' ? 'asc' : 'desc'
		};
	}

	function sortAllocationRows(
		left: InvestmentHolding & { actualPercent: number },
		right: InvestmentHolding & { actualPercent: number }
	): number {
		const factor = holdingSort.direction === 'asc' ? 1 : -1;
		let comparison = 0;

		switch (holdingSort.key) {
			case 'name':
				comparison = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
				break;
			case 'platform':
				comparison = formatPlatformLabel(left.trackerSource).localeCompare(formatPlatformLabel(right.trackerSource), undefined, {
					sensitivity: 'base'
				});
				break;
			case 'value':
				comparison = left.currentValue - right.currentValue;
				break;
			case 'weight':
				comparison = left.actualPercent - right.actualPercent;
				break;
			case 'target':
				comparison = left.allocationPercent - right.allocationPercent;
				break;
			case 'change':
				comparison = (left.changeAmountSinceLastSnapshot ?? Number.NEGATIVE_INFINITY) - (right.changeAmountSinceLastSnapshot ?? Number.NEGATIVE_INFINITY);
				break;
		}

		if (comparison === 0) {
			comparison = left.sortOrder - right.sortOrder;
		}

		return comparison * factor;
	}
</script>

<svelte:head>
	<title>Investments — FinDash</title>
</svelte:head>

<div class="page">
	<div class="topbar">
		<div class="topbar-left">
			<h1 class="page-title">Investments</h1>
			<div class="view-toggle" role="group" aria-label="Switch view">
				<button
					type="button"
					class="toggle-btn"
					class:active={view === 'portfolio'}
					onclick={() => (view = 'portfolio')}
				>Portfolio</button>
				<button
					type="button"
					class="toggle-btn"
					class:active={view === 'projections'}
					onclick={() => (view = 'projections')}
				>Projections</button>
			</div>
			{#if view === 'portfolio'}
				<div class="topbar-divider" aria-hidden="true"></div>
				<div class="platform-filter" role="group" aria-label="Filter holdings by platform">
					<button type="button" class="platform-filter-btn" class:active={platformFilter === 'all'} onclick={() => (platformFilter = 'all')}>All</button>
					<button type="button" class="platform-filter-btn" class:active={platformFilter === 'nordea'} onclick={() => (platformFilter = 'nordea')}>Nordea</button>
					<button type="button" class="platform-filter-btn" class:active={platformFilter === 'avanza'} onclick={() => (platformFilter = 'avanza')}>Avanza</button>
				</div>
			{/if}
		</div>

		{#if view === 'portfolio'}
			<div class="topbar-right">
				{#if trackedHoldingsCount > 0}
					<div class="sync-chip">
						<span class="sync-label">Tracked holdings</span>
						<span class="sync-stamp">{formatSyncStamp(latestTrackedSync)}</span>
					</div>
					<Button
						size="sm"
						variant="outline"
						class="toolbar-action-btn"
						onclick={handleRefreshTrackedPrices}
						disabled={portfolioPending}
					>
						Refresh prices
					</Button>
				{/if}

				{#if defaultAccountId}
					<Button size="sm" variant="outline" class="toolbar-action-btn" onclick={openAddHoldingDialog}>+ Holding</Button>
				{/if}
			</div>
		{:else}
			<div class="topbar-right">
				<Button size="sm" variant="outline" class="toolbar-action-btn" onclick={saveProjectionPreset}>
					Save
				</Button>
			</div>
		{/if}
	</div>

	{#if portfolioMessage}
		<Alert.Root class="border-destructive/50 bg-destructive/10">
			<Alert.Description class="flex items-center justify-between text-destructive text-xs">
				{portfolioMessage}
				<button type="button" onclick={() => (portfolioMessage = null)} class="ml-4 opacity-60 hover:opacity-100 text-xs">✕</button>
			</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- PORTFOLIO VIEW -->
	{#if view === 'portfolio'}
		<div class="portfolio-view">
			{#if accounts.length === 0}
				<p class="empty-copy">No portfolio storage exists yet. Reload after the default account has been created.</p>
			{/if}

			{#if defaultAccountId}
				<div class="portfolio-grid">
					<div class="table-shell rounded-lg border border-border overflow-hidden">
						<div class="table-scroll">
							<Table.Root class="portfolio-table">
								<Table.Header>
									<Table.Row class="portfolio-header-row border-border hover:bg-transparent">
										<SortableTableHead class="portfolio-head col-head w-[24%]" label="Name" active={holdingSort.key === 'name'} direction={holdingSort.direction} onToggle={() => toggleHoldingSort('name')} />
										<SortableTableHead class="portfolio-head col-head w-[15%]" label="Platform" active={holdingSort.key === 'platform'} direction={holdingSort.direction} onToggle={() => toggleHoldingSort('platform')} />
										<SortableTableHead class="portfolio-head col-head w-[15%]" label="Value" align="right" active={holdingSort.key === 'value'} direction={holdingSort.direction} onToggle={() => toggleHoldingSort('value')} />
										<SortableTableHead class="portfolio-head col-head w-[12%]" label="Weight" align="right" active={holdingSort.key === 'weight'} direction={holdingSort.direction} onToggle={() => toggleHoldingSort('weight')} />
										<SortableTableHead class="portfolio-head col-head w-[14%]" label="Target" align="right" active={holdingSort.key === 'target'} direction={holdingSort.direction} onToggle={() => toggleHoldingSort('target')} />
										<SortableTableHead class="portfolio-head col-head w-[15%]" label="Since update" align="right" active={holdingSort.key === 'change'} direction={holdingSort.direction} onToggle={() => toggleHoldingSort('change')} />
										<Table.Head class="portfolio-head w-[90px]"></Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each allocationRows as holding (holding.id)}
										<Table.Row class="border-border group">
											<Table.Cell class="portfolio-cell holding-name-cell text-foreground font-medium">{holding.name}</Table.Cell>
											<Table.Cell class="portfolio-cell">
												<span class="platform-pill platform-pill-{holding.trackerSource}">
													{formatPlatformLabel(holding.trackerSource)}
												</span>
											</Table.Cell>
											<Table.Cell class="portfolio-cell text-right font-mono tabular-nums text-foreground">{formatCurrency(holding.currentValue)}</Table.Cell>
											<Table.Cell class="portfolio-cell text-right font-mono tabular-nums text-muted-foreground">{formatPercent(holding.actualPercent)}</Table.Cell>
											<Table.Cell class="portfolio-cell text-right font-mono tabular-nums text-muted-foreground">{formatPercent(holding.allocationPercent)}</Table.Cell>
											<Table.Cell class="portfolio-cell text-right font-mono tabular-nums">
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
											</Table.Cell>
											<Table.Cell class="portfolio-cell">
												<div class="holding-actions">
													<button
														type="button"
														class="holding-action"
														onclick={() => openEditHoldingDialog(holding)}
														aria-label="Edit holding"
														title="Edit holding"
													>
														<PencilIcon class="holding-action-icon" size={12} strokeWidth={1.75} />
													</button>
													<button
														type="button"
														class="holding-action danger"
														onclick={() => handleDeleteHolding(holding.id)}
														aria-label="Delete holding"
														title="Delete holding"
													>
														<Trash2Icon class="holding-action-icon" size={12} strokeWidth={1.75} />
													</button>
												</div>
											</Table.Cell>
										</Table.Row>
									{:else}
										<Table.Row>
											<Table.Cell colspan={7} class="portfolio-cell text-center py-12 text-muted-foreground text-base">
												No holdings yet.
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</div>
						<div class="table-total">
							<span class="table-total-label">Total</span>
							<span class="table-total-value">{formatCurrency(selectedHoldingsTotal)}</span>
						</div>
					</div>

				</div>
			{/if}
		</div>

	<!-- PROJECTIONS VIEW -->
	{:else}
		<div class="projections-view">
			<div class="calculator-shell">
				<SettingsPanel
					bind:startCapital
					bind:monthlySaving
					bind:monthlySalary
					bind:salaryGrowth
					bind:kommunalskatt
					bind:savingsShareOfRaise
					bind:avgReturn
					bind:leverage
					bind:years
					bind:withdrawalRate
					{profileSavePending}
					{profileSaveMessage}
					onUsePortfolioTotal={setStartCapitalFromPortfolio}
					onSaveIncomeProfile={saveIncomeProfile}
				/>
				<ResultsPanel {results} {retirementYear} {withdrawalRate} />
			</div>
		</div>
	{/if}
</div>

<!-- Holding dialog -->
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
		width: 100%;
		max-width: none;
		margin: 0;
		padding: 14px 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-height: 0;
		height: 100%;
		overflow: hidden;
	}

	.topbar {
		display: flex;
		align-items: center;
		gap: 14px;
		justify-content: space-between;
		flex-wrap: wrap;
		padding: 4px 2px 8px;
	}

	.topbar-left,
	.topbar-right {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.topbar-left {
		flex: 1 1 auto;
		min-width: 0;
	}

	.topbar-right {
		flex: 0 0 auto;
		justify-content: flex-end;
	}

	.page-title {
		font-family: var(--ds-font-display);
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--app-text-primary);
		margin: 0;
	}

	.topbar-divider {
		width: 1px;
		height: 2rem;
		background: var(--ds-glass-border);
		flex: 0 0 auto;
	}

	/* ── Segmented toggle ── */
	.view-toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.16));
		border: 1px solid var(--ds-glass-border);
		border-radius: 12px;
		padding: 4px;
		margin-left: 4px;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
	}

	.toggle-btn {
		height: 2.8rem;
		padding: 0.55rem 1rem;
		border-radius: 0.8rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--app-text-muted);
		font-family: var(--ds-font-body);
		font-size: 0.92rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 0.13s var(--ds-ease),
			color 0.13s var(--ds-ease),
			border-color 0.13s var(--ds-ease);
	}

	.toggle-btn:hover:not(.active) {
		color: var(--app-text-secondary);
	}

	.toggle-btn.active {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--app-accent) 14%, color-mix(in oklab, var(--ds-glass-surface) 82%, rgba(12, 20, 14, 0.1)));
		border-color: color-mix(in oklab, var(--app-accent) 50%, var(--app-border));
		color: var(--app-accent-light);
	}

	.platform-filter {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px;
		border: 1px solid var(--ds-glass-border);
		border-radius: 12px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.16));
		box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.03);
	}

	.platform-filter-btn {
		height: 2.8rem;
		padding: 0.55rem 1rem;
		border: 1px solid transparent;
		border-radius: 0.8rem;
		background: transparent;
		color: var(--app-text-muted);
		font-size: 0.92rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 0.13s var(--ds-ease),
			color 0.13s var(--ds-ease),
			border-color 0.13s var(--ds-ease);
	}

	.platform-filter-btn.active {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--app-accent) 14%, color-mix(in oklab, var(--ds-glass-surface) 82%, rgba(12, 20, 14, 0.1)));
		border-color: color-mix(in oklab, var(--app-accent) 50%, var(--app-border));
		color: var(--app-accent-light);
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

	:global(.toolbar-action-btn) {
		height: 2.8rem;
		padding-inline: 1rem;
		border-radius: 0.9rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.16));
		border-color: var(--ds-glass-border);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
		color: var(--app-text-primary);
		font-size: 0.92rem;
		font-weight: 700;
	}

	:global(.toolbar-action-btn:hover) {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
			color-mix(in oklab, var(--ds-glass-surface) 88%, rgba(12, 20, 14, 0.1));
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

	/* ── Portfolio grid ── */
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

	:global(.col-head) {
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0;
		text-transform: none;
		color: var(--app-text-secondary);
	}

	.table-shell {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
		background:
			linear-gradient(180deg, var(--ds-glass-bg-strong), var(--ds-glass-bg)),
			var(--ds-glass-surface);
		backdrop-filter: blur(var(--ds-glass-blur));
		-webkit-backdrop-filter: blur(var(--ds-glass-blur));
		box-shadow: var(--ds-glass-shadow), inset 0 1px 0 var(--ds-glass-edge);
		border-color: var(--ds-glass-border);
		--table-container-bg: rgba(0, 0, 0, 0.08);
		--table-header-bg: rgba(0, 0, 0, 0.06);
	}

	.table-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		overscroll-behavior: contain;
		scrollbar-gutter: stable;
	}

	:global(.portfolio-table table) {
		width: 100%;
		table-layout: fixed;
	}

	:global(.portfolio-table [data-slot="table-container"]) {
		overflow: visible;
	}

	:global(.portfolio-table [data-slot="table-header"]) {
		position: sticky;
		top: 0;
		z-index: 4;
	}

	:global(.portfolio-header-row) {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.14));
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		box-shadow:
			inset 0 -1px 0 var(--ds-glass-border),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	:global(.portfolio-head) {
		height: 3.7rem;
		padding: 1.15rem 1.25rem;
		font-size: 0.86rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	:global(.portfolio-table [data-slot="table-cell"]) {
		padding: 1.15rem 1.25rem;
		font-size: 1.06rem;
	}

	:global(.portfolio-cell) {
		line-height: 1.3;
	}

	:global(.holding-name-cell) {
		font-size: 1.16rem;
		font-weight: 700;
	}

	.table-total {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.9rem 1.25rem 1rem;
		border-top: 1px solid var(--ds-glass-border);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.12)),
			color-mix(in oklab, var(--ds-glass-surface) 92%, transparent);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.table-total-label {
		color: var(--app-text-muted);
		font-family: var(--ds-font-display);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.table-total-value {
		font-family: var(--ds-font-mono);
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--app-accent-light);
		font-variant-numeric: tabular-nums;
	}

	.holding-actions {
		display: flex;
		justify-content: flex-end;
		gap: 5px;
	}

	.platform-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.34rem 0.95rem;
		border-radius: 999px;
		border: 1px solid var(--app-border);
		font-size: 0.84rem;
		font-weight: 600;
	}

	.platform-pill-nordea {
		color: var(--app-text-primary);
		background: rgba(255, 255, 255, 0.04);
	}

	.platform-pill-avanza {
		color: var(--app-accent-light);
		background: var(--app-accent-glow);
		border-color: color-mix(in oklab, var(--app-accent) 45%, var(--app-border));
	}

	.platform-pill-manual {
		color: var(--app-text-secondary);
		background: rgba(255, 255, 255, 0.03);
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

	.holding-action-icon {
		width: 13px;
		height: 13px;
		flex: none;
	}

	.holding-action:hover { color: var(--app-text-primary); border-color: var(--app-border-focus); }
	.holding-action.danger:hover { border-color: var(--app-red); color: var(--app-red); }

	/* ── Projections view ── */
	.projections-view {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 0;
		flex: 1 1 auto;
	}

	.calculator-shell {
		display: grid;
		grid-template-columns: 320px minmax(0, 1fr);
		min-height: 0;
		height: 100%;
		overflow: hidden;
		border: 1px solid var(--ds-glass-border);
		border-radius: 14px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.008)),
			color-mix(in oklab, var(--ds-bg-1) 90%, rgba(12, 20, 14, 0.18));
		box-shadow: var(--ds-glass-shadow), inset 0 1px 0 var(--ds-glass-edge);
	}

	/* ── Dialog ── */
	.dialog-fields { display: flex; flex-direction: column; gap: 10px; }
	.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

	/* ── Misc ── */
	.empty-copy { font-size: 0.8rem; color: var(--app-text-muted); padding: 6px 0; }

	/* ── Responsive ── */
	@media (max-width: 1100px) {
		.portfolio-grid { display: block; }
	}

	@media (max-width: 980px) {
		.calculator-shell { grid-template-columns: 1fr; min-height: 0; }
	}

	@media (max-width: 768px) {
		.page { padding-top: 68px; }
		.topbar-left,
		.topbar-right {
			width: 100%;
			flex-wrap: wrap;
		}
		.topbar-right {
			justify-content: flex-start;
		}
		.topbar-divider {
			display: none;
		}
		.proj-toolbar {
			flex-wrap: wrap;
			align-items: flex-start;
		}
	}

	@media (max-width: 640px) {
		.page { padding: 16px 14px 32px; }
	}
</style>
