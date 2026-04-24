<script lang="ts">
	import RecurringBudgetWorkspace from '$lib/features/budget/RecurringBudgetWorkspace.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Budget / Recurring — HxFin</title>
</svelte:head>

<RecurringBudgetWorkspace
	data={{
		categories: data.categories.slice(),
		costs: data.costs.slice(),
		summary: data.summary
	}}
/>
