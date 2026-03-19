<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toUserMessage } from '$lib/effect/errors';
	import type { BudgetCategory, BudgetSummary, RecurringCost } from '$lib/schema/budget';
	import { deleteRecurringCost } from './api';
	import {
		buildCategoryMap,
		buildSummaryByCategory,
		filterActiveCosts,
		getActiveCostCount,
		getFilteredMonthlyTotal,
	} from './selectors';
	import type { PageData } from './$types';
	import CategoriesDialog from './components/CategoriesDialog.svelte';
	import CostDialog from './components/CostDialog.svelte';
	import CostsTable from './components/CostsTable.svelte';
	import ErrorAlert from './components/ErrorAlert.svelte';
	import Toolbar from './components/Toolbar.svelte';

	interface Props {
		data: PageData;
	}

	type CostDialogRef = {
		openAdd: () => void;
		openEdit: (cost: RecurringCost) => void;
		close: () => void;
	};

	type CategoriesDialogRef = {
		open: () => void;
		close: () => void;
	};

	let { data }: Props = $props();

	let selectedCategoryFilter = $state('all');
	let errorMessage = $state<string | null>(null);
	let costDialog: CostDialogRef | null = null;
	let categoriesDialog: CategoriesDialogRef | null = null;

	let categories = $derived(data.categories as BudgetCategory[]);
	let costs = $derived(data.costs as RecurringCost[]);
	let summary = $derived(data.summary as BudgetSummary);
	let categoryMap = $derived(buildCategoryMap(categories));
	let summaryByCategory = $derived(buildSummaryByCategory(summary));
	let filteredCosts = $derived(filterActiveCosts(costs, selectedCategoryFilter));
	let filteredMonthlyTotal = $derived(getFilteredMonthlyTotal(filteredCosts));
	let activeCostCount = $derived(getActiveCostCount(costs));

	async function handleDeleteCost(costId: string): Promise<void> {
		if (!confirm('Delete this recurring cost?')) {
			return;
		}

		errorMessage = null;

		try {
			await deleteRecurringCost(fetch, costId);
			await invalidateAll();
		} catch (error) {
			errorMessage = toUserMessage(error, 'Failed to delete cost');
		}
	}
</script>

<svelte:head>
	<title>Budget Tracker — FinDash</title>
</svelte:head>

<div class="budget-page">
	<Toolbar
		{categories}
		{activeCostCount}
		bind:selectedCategoryFilter
		onOpenCategoriesDialog={() => categoriesDialog?.open()}
		onOpenAddCostDialog={() => costDialog?.openAdd()}
	/>

	<ErrorAlert message={errorMessage} onDismiss={() => (errorMessage = null)} />

	<CostsTable
		{filteredCosts}
		categoriesCount={categories.length}
		{selectedCategoryFilter}
		{categoryMap}
		{filteredMonthlyTotal}
		onEditCost={(cost) => costDialog?.openEdit(cost)}
		onDeleteCost={handleDeleteCost}
	/>
</div>

<CostDialog
	bind:this={costDialog}
	{categories}
	{selectedCategoryFilter}
	onSaved={invalidateAll}
	onError={(message) => (errorMessage = message)}
/>

<CategoriesDialog
	bind:this={categoriesDialog}
	{categories}
	{summaryByCategory}
	{selectedCategoryFilter}
	onSaved={invalidateAll}
	onError={(message) => (errorMessage = message)}
	onCategoryDeleted={(categoryId) => {
		if (selectedCategoryFilter === categoryId) {
			selectedCategoryFilter = 'all';
		}
	}}
/>

<style>
	.budget-page {
		width: 100%;
		max-width: none;
		margin: 0;
		padding: 14px 16px 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		flex: 1 1 auto;
		min-height: 0;
		height: 100%;
		overflow: hidden;
	}

	@media (max-width: 768px) {
		.budget-page {
			padding-top: 72px;
		}
	}

	@media (max-width: 640px) {
		.budget-page {
			padding: 20px 16px 20px;
		}
	}
</style>
