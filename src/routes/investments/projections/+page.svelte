<script lang="ts">
	import ProjectionsWorkspace from '$lib/features/investments/projections/ProjectionsWorkspace.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Investments / Projections — HxFin</title>
</svelte:head>

<ProjectionsWorkspace
	data={{
		profile: data.profile,
		accounts: data.accounts.slice(),
		holdings: data.holdings.slice()
	}}
/>
