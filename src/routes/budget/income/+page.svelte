<script lang="ts">
	import IncomeWorkspace from '$lib/features/budget/IncomeWorkspace.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Budget / Income — HxFin</title>
</svelte:head>

<IncomeWorkspace
	data={{
		profile: data.profile
	}}
/>
