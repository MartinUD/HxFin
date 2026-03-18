<script lang="ts">
	import { DEFAULT_COLOR } from '$lib/budget';
	import { Button } from '$lib/components/ui/button';
	import {
		SegmentedControl,
		type SegmentedControlOption
	} from '$lib/components/ui/segmented-control';
	import type { BudgetCategory } from '$lib/schema/budget';

	interface Props {
		categories: BudgetCategory[];
		activeCostCount: number;
		selectedCategoryFilter: string;
		onOpenCategoriesDialog: () => void;
		onOpenAddCostDialog: () => void;
	}

	let {
		categories,
		activeCostCount,
		selectedCategoryFilter = $bindable(),
		onOpenCategoriesDialog,
		onOpenAddCostDialog,
	}: Props = $props();

	let categoryOptions = $derived<SegmentedControlOption[]>([
		{
			value: 'all',
			label: 'All',
			meta: String(activeCostCount)
		},
		...categories.map((category) => ({
			value: category.id,
			label: category.name,
			dotColor: category.color ?? DEFAULT_COLOR
		}))
	]);
</script>

<div class="budget-toolbar">
	{#if categories.length > 0}
		<div class="budget-toolbar-filters">
			<SegmentedControl
				bind:value={selectedCategoryFilter}
				options={categoryOptions}
				variant="pills"
				size="lg"
				ariaLabel="Filter costs by category"
				class="budget-category-control"
			/>
		</div>
	{/if}

	<div class="budget-actions">
		<Button
			variant="outline"
			size="sm"
			onclick={onOpenCategoriesDialog}
			class="bg-[rgba(0,0,0,0.34)] hover:bg-[rgba(0,0,0,0.46)] border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
		>
			Manage Categories
		</Button>
		<Button size="sm" onclick={onOpenAddCostDialog} disabled={categories.length === 0}>
			+ Add Cost
		</Button>
	</div>
</div>

<style>
	.budget-toolbar {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		padding: 8px 6px 10px;
		border-radius: 12px;
	}

	.budget-toolbar-filters {
		flex: 1 1 340px;
		min-width: 0;
	}

	.budget-actions {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		margin-left: auto;
		flex: 0 0 auto;
	}

	:global(.budget-actions button) {
		height: 3rem;
		padding-inline: 1.15rem;
		font-size: 0.96rem;
		font-weight: 700;
		border-radius: 0.95rem;
	}

	:global(.budget-category-control) {
		display: flex;
		flex-wrap: wrap;
		max-width: 100%;
	}

	:global(.budget-actions button) {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.16));
		border-color: var(--ds-glass-border);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
		color: var(--app-text-primary);
	}

	:global(.budget-actions button:hover) {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
			color-mix(in oklab, var(--ds-glass-surface) 88%, rgba(12, 20, 14, 0.1));
	}

	@media (max-width: 640px) {
		.budget-toolbar {
			align-items: stretch;
			padding: 8px;
		}

		.budget-actions {
			width: 100%;
			margin-left: 0;
			justify-content: flex-end;
		}
	}
</style>
