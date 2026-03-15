<script lang="ts">
	import { DEFAULT_COLOR } from '$lib/budget';
	import { Button } from '$lib/components/ui/button';
	import * as Tabs from '$lib/components/ui/tabs';
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
</script>

<div class="budget-toolbar">
	{#if categories.length > 0}
		<div class="budget-toolbar-filters">
			<Tabs.Root bind:value={selectedCategoryFilter}>
				<Tabs.List class="budget-category-list">
					<Tabs.Trigger value="all" class="budget-category-chip">
						All
						<span class="ml-1.5 opacity-60 text-[10px]">{activeCostCount}</span>
					</Tabs.Trigger>
					{#each categories as category}
						<Tabs.Trigger
							value={category.id}
							class="budget-category-chip flex items-center gap-1.5"
						>
							<span
								class="w-2 h-2 rounded-full flex-shrink-0"
								style="background: {category.color ?? DEFAULT_COLOR}"
							></span>
							{category.name}
						</Tabs.Trigger>
					{/each}
				</Tabs.List>
			</Tabs.Root>
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

	:global(.budget-category-list) {
		height: auto;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		padding: 0;
		background: transparent;
		border: 0;
		border-radius: 0;
		box-shadow: none;
	}

	:global([data-slot="tabs-trigger"].budget-category-chip) {
		height: 3rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.18));
		border: 1px solid var(--ds-glass-border);
		border-radius: 999px;
		color: var(--app-text-secondary);
		font-size: 0.98rem;
		font-weight: 600;
		padding: 0.65rem 1.3rem;
		box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.04);
		transition:
			color 0.16s var(--ds-ease),
			border-color 0.16s var(--ds-ease),
			background-color 0.16s var(--ds-ease);
	}

	:global([data-slot="tabs-trigger"].budget-category-chip:hover) {
		color: var(--app-text-primary);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
			color-mix(in oklab, var(--ds-glass-surface) 88%, rgba(12, 20, 14, 0.12));
	}

	:global([data-slot="tabs-trigger"].budget-category-chip[data-state="active"]) {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.01)),
			color-mix(
				in oklab,
				var(--ds-accent) 14%,
				color-mix(in oklab, var(--ds-glass-surface) 82%, rgba(12, 20, 14, 0.1))
			);
		color: var(--app-accent-light);
		border-color: color-mix(in oklab, var(--app-accent) 75%, var(--ds-glass-border));
		box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.06);
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
