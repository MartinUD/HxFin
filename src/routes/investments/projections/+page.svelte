<script lang="ts">
	import InvestmentsWorkspace from '$lib/features/investments/InvestmentsWorkspace.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Investments / Projections — HxFin</title>
</svelte:head>

<InvestmentsWorkspace
	view="projections"
	data={{
		profile: data.profile,
		accounts: data.accounts.slice(),
		holdings: data.holdings.slice()
	}}
/>
