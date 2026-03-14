<script lang="ts">
	import { formatCurrency, toMonthlyAmount } from '$lib/budget';
	import CategoryBadge from '$lib/components/budget/CategoryBadge.svelte';
	import SortableTableHead from '$lib/components/SortableTableHead.svelte';
	import * as Table from '$lib/components/ui/table';
	import type { BudgetCategory, RecurringCost } from '$lib/contracts/budget';

	interface Props {
		filteredCosts: RecurringCost[];
		categoriesCount: number;
		selectedCategoryFilter: string;
		categoryMap: Map<string, BudgetCategory>;
		filteredMonthlyTotal: number;
		onEditCost: (cost: RecurringCost) => void;
		onDeleteCost: (id: string) => void;
	}

	let {
		filteredCosts,
		categoriesCount,
		selectedCategoryFilter,
		categoryMap,
		filteredMonthlyTotal,
		onEditCost,
		onDeleteCost
	}: Props = $props();

	type CostSortKey = 'name' | 'category' | 'type' | 'essential' | 'period' | 'amount' | 'monthly';

	let sortState = $state<{ key: CostSortKey; direction: 'asc' | 'desc' }>({
		key: 'name',
		direction: 'asc'
	});

	let sortedCosts = $derived(filteredCosts.slice().sort(sortCosts));

	function toggleSort(key: CostSortKey): void {
		if (sortState.key === key) {
			sortState = {
				key,
				direction: sortState.direction === 'asc' ? 'desc' : 'asc'
			};
			return;
		}

		sortState = {
			key,
			direction: key === 'name' || key === 'category' || key === 'type' || key === 'period' ? 'asc' : 'desc'
		};
	}

	function sortCosts(left: RecurringCost, right: RecurringCost): number {
		const factor = sortState.direction === 'asc' ? 1 : -1;
		let comparison = 0;

		switch (sortState.key) {
			case 'name':
				comparison = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
				break;
			case 'category':
				comparison = (categoryMap.get(left.categoryId)?.name ?? '').localeCompare(categoryMap.get(right.categoryId)?.name ?? '', undefined, {
					sensitivity: 'base'
				});
				break;
			case 'type':
				comparison = left.kind.localeCompare(right.kind);
				break;
			case 'essential':
				comparison = Number(left.kind !== 'investment' && left.isEssential) - Number(right.kind !== 'investment' && right.isEssential);
				break;
			case 'period':
				comparison = periodRank(left.period) - periodRank(right.period);
				break;
			case 'amount':
				comparison = left.amount - right.amount;
				break;
			case 'monthly':
				comparison = toMonthlyAmount(left.amount, left.period) - toMonthlyAmount(right.amount, right.period);
				break;
		}

		if (comparison === 0) {
			comparison = right.createdAt.localeCompare(left.createdAt);
		}

		return comparison * factor;
	}

	function periodRank(period: RecurringCost['period']): number {
		switch (period) {
			case 'weekly':
				return 0;
			case 'monthly':
				return 1;
			case 'yearly':
				return 2;
		}
	}
</script>

<div class="budget-table-shell rounded-lg border border-border overflow-hidden">
	<div class="budget-table-scroll">
		<Table.Root class="budget-table">
			<Table.Header>
				<Table.Row class="budget-table-header-row border-border hover:bg-transparent">
					<SortableTableHead class="budget-table-head w-[22%]" label="Name" active={sortState.key === 'name'} direction={sortState.direction} onToggle={() => toggleSort('name')} />
					<SortableTableHead class="budget-table-head w-[17%]" label="Category" active={sortState.key === 'category'} direction={sortState.direction} onToggle={() => toggleSort('category')} />
					<SortableTableHead class="budget-table-head w-[13%]" label="Type" active={sortState.key === 'type'} direction={sortState.direction} onToggle={() => toggleSort('type')} />
					<SortableTableHead class="budget-table-head w-[11%]" label="Essential" active={sortState.key === 'essential'} direction={sortState.direction} onToggle={() => toggleSort('essential')} />
					<SortableTableHead class="budget-table-head w-[12%]" label="Period" active={sortState.key === 'period'} direction={sortState.direction} onToggle={() => toggleSort('period')} />
					<SortableTableHead class="budget-table-head w-[13%]" label="Amount" align="right" active={sortState.key === 'amount'} direction={sortState.direction} onToggle={() => toggleSort('amount')} />
					<SortableTableHead class="budget-table-head w-[9%]" label="/mo" align="right" active={sortState.key === 'monthly'} direction={sortState.direction} onToggle={() => toggleSort('monthly')} />
					<Table.Head class="w-[5%]"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each sortedCosts as cost (cost.id)}
					<Table.Row class="border-border group">
						<Table.Cell class="budget-table-cell font-medium text-foreground">{cost.name}</Table.Cell>
						<Table.Cell class="budget-table-cell">
							<CategoryBadge
								name={categoryMap.get(cost.categoryId)?.name ?? 'Unknown'}
								color={categoryMap.get(cost.categoryId)?.color ?? null}
							/>
						</Table.Cell>
						<Table.Cell class="budget-table-cell">
							<span class="kind-pill" class:kind-pill-investment={cost.kind === 'investment'}>
								{cost.kind === 'investment' ? 'Investment' : 'Expense'}
							</span>
						</Table.Cell>
						<Table.Cell class="budget-table-cell">
							<span
								class="essential-pill"
								class:essential-pill-na={cost.kind === 'investment'}
								class:essential-pill-on={cost.kind !== 'investment' && cost.isEssential}
							>
								{cost.kind === 'investment' ? 'N/A' : (cost.isEssential ? 'Yes' : 'No')}
							</span>
						</Table.Cell>
						<Table.Cell class="budget-table-cell text-muted-foreground capitalize text-[0.96rem]">{cost.period}</Table.Cell>
						<Table.Cell class="budget-table-cell text-right tabular-nums text-foreground text-[1rem]">{formatCurrency(cost.amount)}</Table.Cell>
						<Table.Cell class="budget-table-cell text-right tabular-nums text-muted-foreground text-[0.96rem]">
							{formatCurrency(toMonthlyAmount(cost.amount, cost.period))}
						</Table.Cell>
						<Table.Cell class="budget-table-cell">
							<div class="row-actions">
								<button
									class="row-action-btn"
									onclick={() => onEditCost(cost)}
									title="Edit"
									aria-label={`Edit ${cost.name}`}
								>
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
										<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
									</svg>
								</button>
								<button
									class="row-action-btn danger"
									onclick={() => onDeleteCost(cost.id)}
									title="Delete"
									aria-label={`Delete ${cost.name}`}
								>
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="3 6 5 6 21 6"/>
										<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
									</svg>
								</button>
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={8} class="budget-table-cell text-center py-14 text-muted-foreground text-base">
							{#if categoriesCount === 0}
								Add a category first, then add costs.
							{:else if selectedCategoryFilter !== 'all'}
								No active costs in this category.
							{:else}
								No active costs yet. Click "+ Add Cost" to get started.
							{/if}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>

	{#if filteredCosts.length > 0}
		<div class="budget-table-summary">
			<span class="budget-table-summary-label">Monthly Total</span>
			<strong class="budget-table-summary-value">{formatCurrency(filteredMonthlyTotal)}</strong>
		</div>
	{/if}
</div>

<style>
	.budget-table-shell {
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
		--table-bg: transparent;
		--table-header-bg: rgba(0, 0, 0, 0.06);
		--table-footer-bg: rgba(0, 0, 0, 0.10);
	}

	:global(.budget-table table) {
		table-layout: fixed;
		width: 100%;
	}

	.budget-table-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		overscroll-behavior: contain;
		scrollbar-gutter: stable;
	}

	:global(.budget-table [data-slot="table-container"]) {
		overflow: visible;
	}

	:global(.budget-table [data-slot="table-header"]) {
		position: sticky;
		top: 0;
		z-index: 4;
	}

	:global(.budget-table-header-row) {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.14));
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		box-shadow:
			inset 0 -1px 0 var(--ds-glass-border),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	:global(.budget-table-head) {
		height: 3.7rem;
		padding-top: 1.15rem;
		padding-bottom: 1.15rem;
		padding-left: 1.25rem;
		padding-right: 1.25rem;
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0;
		text-transform: none;
		color: var(--app-text-secondary);
	}

	:global(.budget-table [data-slot="table-cell"]) {
		padding-top: 1.15rem;
		padding-bottom: 1.15rem;
		padding-left: 1.25rem;
		padding-right: 1.25rem;
		font-size: 1.06rem;
	}

	:global(.budget-table-cell) {
		line-height: 1.3;
	}

	.budget-table-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 1.25rem 1rem;
		border-top: 1px solid var(--ds-glass-border);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.12)),
			color-mix(in oklab, var(--ds-glass-surface) 92%, transparent);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.budget-table-summary-label {
		color: var(--app-text-muted);
		font-family: var(--ds-font-display);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.budget-table-summary-value {
		color: var(--app-accent-light);
		font-size: 1.3rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}

	:global(.budget-table .group [data-slot="table-cell"]:first-child) {
		font-size: 1.16rem;
		font-weight: 700;
	}

	:global(.budget-table .group [data-slot="table-cell"]:last-child),
	:global(.budget-table .budget-table-header-row [data-slot="table-head"]:last-child) {
		padding-right: 1.25rem;
	}

	.row-actions {
		display: flex;
		justify-content: flex-end;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.16s var(--ds-ease);
	}

	:global(.group:hover) .row-actions,
	:global(.group:focus-within) .row-actions {
		opacity: 1;
	}

	.row-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		color: var(--app-text-muted);
		cursor: pointer;
		transition: all 0.16s var(--ds-ease);
		padding: 0;
	}

	.row-action-btn:hover {
		background: var(--app-bg-input);
		border-color: var(--app-border);
		color: var(--app-text-secondary);
	}

	.row-action-btn:focus-visible {
		outline: none;
		border-color: color-mix(in oklab, var(--app-accent) 60%, transparent);
		box-shadow: 0 0 0 3px var(--app-accent-glow);
		color: var(--app-text-primary);
	}

	.row-action-btn.danger:hover {
		background: var(--app-red-glow);
		border-color: var(--app-red);
		color: var(--app-red);
	}

	.row-action-btn.danger:focus-visible {
		border-color: color-mix(in oklab, var(--app-red) 60%, transparent);
		box-shadow: 0 0 0 3px var(--app-red-glow);
		color: var(--app-red);
	}

	.essential-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 48px;
		padding: 0.32rem 0.9rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: var(--app-text-muted);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--app-border);
	}

	.essential-pill-on {
		color: var(--app-accent-light);
		background: var(--app-accent-glow);
		border-color: color-mix(in oklab, var(--app-accent) 60%, var(--app-border));
	}

	.essential-pill-na {
		opacity: 0.55;
	}

	.kind-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.32rem 0.9rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: var(--app-text-secondary);
		border: 1px solid var(--app-border);
		background: rgba(255, 255, 255, 0.03);
	}

	.kind-pill-investment {
		color: var(--app-accent-light);
		border-color: color-mix(in oklab, var(--app-accent) 62%, var(--app-border));
		background: color-mix(in oklab, var(--app-accent) 24%, transparent);
	}

	@media (max-width: 768px) {
		.row-actions {
			opacity: 1;
		}
	}
</style>
