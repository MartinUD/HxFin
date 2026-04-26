<script lang="ts">
	import PlannedPurchasesWorkspace from '$lib/features/budget/planned-purchases/PlannedPurchasesWorkspace.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Budget / Planned Purchases — HxFin</title>
</svelte:head>

<PlannedPurchasesWorkspace
	data={{
		items: data.items.slice(),
		loans: data.loans.slice(),
		categories: data.categories.slice()
	}}
/>
