<script lang="ts">
	import { DEFAULT_COLOR } from '$lib/features/budget/helpers';
	import {
		SegmentedControl,
		type SegmentedControlOption
	} from '$lib/shadcn-prim/segmented-control';
	import {
		ToolbarActionButton,
		ToolbarActions
	} from '$lib/shadcn-prim/toolbar-actions';
	import type { BudgetCategory } from '$lib/schema/budget';
	import type { CategoryFilter } from '$lib/features/budget/selectors';

	interface Props {
		categories: BudgetCategory[];
		costCount: number;
		selectedCategoryFilter: CategoryFilter[];
		onOpenCategoriesDialog: () => void;
		onOpenAddCostDialog: () => void;
	}

	let {
		categories,
		costCount,
		selectedCategoryFilter = $bindable(),
		onOpenCategoriesDialog,
		onOpenAddCostDialog,
	}: Props = $props();

	let categoryOptions = $derived<SegmentedControlOption[]>([
		{
			value: 'all',
			label: 'All',
			meta: String(costCount)
		},
		...categories.map((category) => ({
			value: String(category.id),
			label: category.name,
			dotColor: category.color ?? DEFAULT_COLOR
		}))
	]);

	let segmentedValue = $derived(selectedCategoryFilter.map((value) => String(value)));

	function parseFilterValue(value: string): CategoryFilter {
		return value === 'all' ? 'all' : Number(value);
	}

	function handleCategoryFilterChange(nextValue: string | string[], changedValue: string): void {
		const rawValues = Array.isArray(nextValue) ? nextValue : [nextValue];
		const uniqueValues = Array.from(new Set(rawValues.filter(Boolean)));

		if (changedValue === 'all') {
			selectedCategoryFilter = ['all'];
			return;
		}

		const withoutAll = uniqueValues.filter((value) => value !== 'all').map(parseFilterValue);
		selectedCategoryFilter = withoutAll.length > 0 ? withoutAll : ['all'];
	}
</script>

<div class="budget-toolbar">
	{#if categories.length > 0}
		<div class="budget-toolbar-filters">
			<SegmentedControl
				value={segmentedValue}
				options={categoryOptions}
				selectionMode="multiple"
				variant="pills"
				size="lg"
				ariaLabel="Filter costs by category"
				class="budget-category-control"
				onValueChange={handleCategoryFilterChange}
			/>
		</div>
	{/if}

	<ToolbarActions>
		<ToolbarActionButton tone="muted" onclick={onOpenCategoriesDialog}>
			Manage Categories
		</ToolbarActionButton>
		<ToolbarActionButton onclick={onOpenAddCostDialog} disabled={categories.length === 0}>
			+ Add Cost
		</ToolbarActionButton>
	</ToolbarActions>
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

	:global(.budget-category-control) {
		display: flex;
		flex-wrap: wrap;
		max-width: 100%;
	}

	@media (max-width: 640px) {
		.budget-toolbar {
			align-items: stretch;
			padding: 8px;
		}
	}
</style>
