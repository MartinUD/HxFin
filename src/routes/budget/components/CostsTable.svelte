<script lang="ts">
	import { formatCurrency, toMonthlyAmount } from '$lib/budget';
	import SortableTableHead from '$lib/components/SortableTableHead.svelte';
	import { Tag } from '$lib/components/ui/tag';
	import * as Table from '$lib/components/ui/table';
	import type { BudgetCategory, RecurringCost } from '$lib/schema/budget';

	interface Props {
		filteredCosts: RecurringCost[];
		categoriesCount: number;
		selectedCategoryFilter: string;
		categoryMap: Map<string, BudgetCategory>;
		filteredMonthlyTotal: number;
		onEditCost: (cost: RecurringCost) => void;
		onDeleteCost: (id: string) => void;
	}

	type SortDirection = 'asc' | 'desc';
	type CostSortKey = 'name' | 'category' | 'type' | 'essential' | 'period' | 'amount' | 'monthly';

	interface SortDefinition<T> {
		defaultDirection: SortDirection;
		compare: (left: T, right: T) => number;
	}

	let {
		filteredCosts,
		categoriesCount,
		selectedCategoryFilter,
		categoryMap,
		filteredMonthlyTotal,
		onEditCost,
		onDeleteCost,
	}: Props = $props();

	const periodRank: Record<RecurringCost['period'], number> = {
		weekly: 0,
		monthly: 1,
		yearly: 2,
	};

	let sortState = $state<{ key: CostSortKey; direction: SortDirection }>({
		key: 'name',
		direction: 'asc',
	});

	const sortDefinitions: Record<CostSortKey, SortDefinition<RecurringCost>> = {
		name: {
			defaultDirection: 'asc',
			compare: (left, right) => compareText(left.name, right.name),
		},
		category: {
			defaultDirection: 'asc',
			compare: (left, right) =>
				compareNullableText(
					categoryMap.get(left.categoryId)?.name ?? null,
					categoryMap.get(right.categoryId)?.name ?? null,
				),
		},
		type: {
			defaultDirection: 'asc',
			compare: (left, right) => compareText(left.kind, right.kind),
		},
		essential: {
			defaultDirection: 'desc',
			compare: (left, right) =>
				compareBoolean(
					left.kind !== 'investment' && left.isEssential,
					right.kind !== 'investment' && right.isEssential,
				),
		},
		period: {
			defaultDirection: 'asc',
			compare: (left, right) => compareNumber(periodRank[left.period], periodRank[right.period]),
		},
		amount: {
			defaultDirection: 'desc',
			compare: (left, right) => compareNumber(left.amount, right.amount),
		},
		monthly: {
			defaultDirection: 'desc',
			compare: (left, right) =>
				compareNumber(
					toMonthlyAmount(left.amount, left.period),
					toMonthlyAmount(right.amount, right.period),
				),
		},
	};

	let sortedCosts = $derived(filteredCosts.slice().sort(sortCosts));

	function compareText(left: string, right: string): number {
		return left.localeCompare(right, undefined, { sensitivity: 'base' });
	}

	function compareNumber(left: number, right: number): number {
		return left - right;
	}

	function compareBoolean(left: boolean, right: boolean): number {
		return Number(left) - Number(right);
	}

	function compareNullableText(left: string | null, right: string | null): number {
		if (left === null && right !== null) return 1;
		if (left !== null && right === null) return -1;
		if (left === null || right === null) return 0;
		return compareText(left, right);
	}

	function compareByCreatedAtDesc(leftCreatedAt: string, rightCreatedAt: string): number {
		return rightCreatedAt.localeCompare(leftCreatedAt);
	}

	function withDirection(comparison: number, direction: SortDirection): number {
		return direction === 'asc' ? comparison : comparison * -1;
	}

	function toggleSort(key: CostSortKey): void {
		if (sortState.key === key) {
			sortState = {
				key,
				direction: sortState.direction === 'asc' ? 'desc' : 'asc',
			};
			return;
		}

		sortState = {
			key,
			direction: sortDefinitions[key].defaultDirection,
		};
	}

	function sortCosts(left: RecurringCost, right: RecurringCost): number {
		const definition = sortDefinitions[sortState.key];
		const comparison = definition.compare(left, right);
		const withTiebreak =
			comparison === 0
				? compareByCreatedAtDesc(left.createdAt, right.createdAt)
				: comparison;

		return withDirection(withTiebreak, sortState.direction);
	}

	function getCategoryTagStyle(categoryId: string): string {
		const color = categoryMap.get(categoryId)?.color;
		const background = color ? `${color}22` : 'var(--app-bg-input)';
		const borderColor = color ? `${color}40` : 'var(--app-border)';
		const textColor = color ?? 'var(--app-text-secondary)';

		return `background:${background};border-color:${borderColor};color:${textColor};`;
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
							<Tag
								class="category-badge"
								style={getCategoryTagStyle(cost.categoryId)}
							>
								{categoryMap.get(cost.categoryId)?.name ?? 'Unknown'}
							</Tag>
						</Table.Cell>
						<Table.Cell class="budget-table-cell">
							<Tag variant={cost.kind === 'investment' ? 'accent' : 'neutral'} class="kind-pill">
								{cost.kind === 'investment' ? 'Investment' : 'Expense'}
							</Tag>
						</Table.Cell>
						<Table.Cell class="budget-table-cell">
							<Tag
								variant={
									cost.kind === 'investment'
										? 'subtle'
										: cost.isEssential
											? 'success'
											: 'subtle'
								}
								class="essential-pill"
							>
								{cost.kind === 'investment' ? 'N/A' : cost.isEssential ? 'Yes' : 'No'}
							</Tag>
						</Table.Cell>
						<Table.Cell class="budget-table-cell text-muted-foreground capitalize text-[0.96rem]">{cost.period}</Table.Cell>
						<Table.Cell class="budget-table-cell text-right tabular-nums text-foreground text-[1rem]">{formatCurrency(cost.amount)}</Table.Cell>
						<Table.Cell class="budget-table-cell text-right tabular-nums text-muted-foreground text-[0.96rem]">
							{formatCurrency(toMonthlyAmount(cost.amount, cost.period))}
						</Table.Cell>
						<Table.Cell class="budget-table-cell">
							<div class="row-actions">
								<button
									type="button"
									class="row-action-btn"
									onclick={() => onEditCost(cost)}
									title="Edit"
									aria-label={`Edit ${cost.name}`}
								>
									<svg aria-hidden="true" focusable="false" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
										<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
									</svg>
								</button>
								<button
									type="button"
									class="row-action-btn danger"
									onclick={() => onDeleteCost(cost.id)}
									title="Delete"
									aria-label={`Delete ${cost.name}`}
								>
									<svg aria-hidden="true" focusable="false" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

	:global(.essential-pill) {
		min-width: 48px;
		letter-spacing: 0.02em;
	}

	:global(.category-badge) {
		white-space: nowrap;
		flex-shrink: 0;
	}

	:global(.kind-pill) {
		letter-spacing: 0.02em;
	}

	@media (max-width: 768px) {
		.row-actions {
			opacity: 1;
		}
	}
</style>
