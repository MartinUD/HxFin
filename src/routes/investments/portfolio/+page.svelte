<script lang="ts">
	import PortfolioWorkspace from '$lib/features/investments/portfolio/PortfolioWorkspace.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Investments / Portfolio — HxFin</title>
</svelte:head>

<PortfolioWorkspace
	data={{
		accounts: data.accounts.slice(),
		holdings: data.holdings.slice()
	}}
/>
