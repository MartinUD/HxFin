<script lang="ts">
	import { formatCurrency, toMonthlyAmount } from '$lib/budget';
	import { Tag } from '$lib/components/ui/tag';
	import {
		Table,
		SortableTableHead,
		type SortDirection,
		sortAlphabetical,
		sortValue,
		toggleSort as toggleTableSort,
	} from '$lib/components/ui/table';
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

	type CostSortKey = 'name' | 'category' | 'type' | 'essential' | 'period' | 'amount' | 'monthly';

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

	let sortedCosts = $derived(filteredCosts.slice().sort(sortCosts));

	function toggleSort(key: CostSortKey): void {
		sortState = toggleTableSort(sortState, key);
	}

	function sortCosts(left: RecurringCost, right: RecurringCost): number {
		switch (sortState.key) {
			case 'name':
				return withCreatedAtTiebreak(
					sortAlphabetical(left.name, right.name, sortState.direction),
					left,
					right,
				);
			case 'category':
				return withCreatedAtTiebreak(
					sortAlphabetical(
						categoryMap.get(left.categoryId)?.name ?? '',
						categoryMap.get(right.categoryId)?.name ?? '',
						sortState.direction,
					),
					left,
					right,
				);
			case 'type':
				return withCreatedAtTiebreak(
					sortAlphabetical(left.kind, right.kind, sortState.direction),
					left,
					right,
				);
			case 'essential':
				return withCreatedAtTiebreak(
					sortValue(
						Number(left.kind !== 'investment' && left.isEssential),
						Number(right.kind !== 'investment' && right.isEssential),
						sortState.direction,
					),
					left,
					right,
				);
			case 'period':
				return withCreatedAtTiebreak(
					sortValue(periodRank[left.period], periodRank[right.period], sortState.direction),
					left,
					right,
				);
			case 'amount':
				return withCreatedAtTiebreak(
					sortValue(left.amount, right.amount, sortState.direction),
					left,
					right,
				);
			case 'monthly':
				return withCreatedAtTiebreak(
					sortValue(
						toMonthlyAmount(left.amount, left.period),
						toMonthlyAmount(right.amount, right.period),
						sortState.direction,
					),
					left,
					right,
				);
		}
	}

	function withCreatedAtTiebreak(
		comparison: number,
		left: RecurringCost,
		right: RecurringCost,
	): number {
		return comparison !== 0 ? comparison : right.createdAt.localeCompare(left.createdAt);
	}

	function getCategoryTagStyle(categoryId: string): string {
		const color = categoryMap.get(categoryId)?.color;
		const background = color ? `${color}22` : 'var(--app-bg-input)';
		const borderColor = color ? `${color}40` : 'var(--app-border)';
		const textColor = color ?? 'var(--app-text-secondary)';

		return `background:${background};border-color:${borderColor};color:${textColor};`;
	}
</script>

<Table
	fill
	class="budget-table table-fixed"
	showFooter={filteredCosts.length > 0}
>
	{#snippet footer()}
		<span class="table-summary-label">Monthly Total</span>
		<strong class="table-summary-value">{formatCurrency(filteredMonthlyTotal)}</strong>
	{/snippet}
	<thead>
		<tr>
			<SortableTableHead class="w-[22%]" label="Name" active={sortState.key === 'name'} direction={sortState.direction} onToggle={() => toggleSort('name')} />
			<SortableTableHead class="w-[17%]" label="Category" active={sortState.key === 'category'} direction={sortState.direction} onToggle={() => toggleSort('category')} />
			<SortableTableHead class="w-[13%]" label="Type" active={sortState.key === 'type'} direction={sortState.direction} onToggle={() => toggleSort('type')} />
			<SortableTableHead class="w-[11%]" label="Essential" active={sortState.key === 'essential'} direction={sortState.direction} onToggle={() => toggleSort('essential')} />
			<SortableTableHead class="w-[12%]" label="Period" active={sortState.key === 'period'} direction={sortState.direction} onToggle={() => toggleSort('period')} />
			<SortableTableHead class="w-[13%]" label="Amount" align="right" active={sortState.key === 'amount'} direction={sortState.direction} onToggle={() => toggleSort('amount')} />
			<SortableTableHead class="w-[9%]" label="/mo" align="right" active={sortState.key === 'monthly'} direction={sortState.direction} onToggle={() => toggleSort('monthly')} />
			<th class="w-[5%]"></th>
		</tr>
	</thead>
	<tbody>
		{#each sortedCosts as cost (cost.id)}
			<tr class="group">
				<td class="budget-table-cell font-medium text-foreground">{cost.name}</td>
				<td class="budget-table-cell">
					<Tag
						class="category-badge"
						style={getCategoryTagStyle(cost.categoryId)}
					>
						{categoryMap.get(cost.categoryId)?.name ?? 'Unknown'}
					</Tag>
				</td>
				<td class="budget-table-cell">
					<Tag variant={cost.kind === 'investment' ? 'accent' : 'neutral'} class="kind-pill">
						{cost.kind === 'investment' ? 'Investment' : 'Expense'}
					</Tag>
				</td>
				<td class="budget-table-cell">
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
				</td>
				<td class="budget-table-cell text-muted-foreground capitalize text-[0.96rem]">{cost.period}</td>
				<td class="budget-table-cell text-right tabular-nums text-foreground text-[1rem]">{formatCurrency(cost.amount)}</td>
				<td class="budget-table-cell text-right tabular-nums text-muted-foreground text-[0.96rem]">
					{formatCurrency(toMonthlyAmount(cost.amount, cost.period))}
				</td>
				<td class="budget-table-cell">
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
				</td>
			</tr>
		{:else}
			<tr>
				<td colspan={8} class="table-empty-state">
					{#if categoriesCount === 0}
						Add a category first, then add costs.
					{:else if selectedCategoryFilter !== 'all'}
						No active costs in this category.
					{:else}
						No active costs yet. Click "+ Add Cost" to get started.
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</Table>

<style>
	:global(.budget-table[data-slot='table']) {
		table-layout: fixed;
		width: 100%;
	}

	:global(.budget-table-cell) {
		line-height: 1.3;
	}

	:global(.budget-table .group td:first-child) {
		font-size: 1.16rem;
		font-weight: 700;
	}

	:global(.budget-table .group td:last-child),
	:global(.budget-table thead th:last-child) {
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

	.table-summary-value {
		font-size: 1.3rem;
		font-weight: 800;
	}

	@media (max-width: 768px) {
		.row-actions {
			opacity: 1;
		}
	}
</style>

