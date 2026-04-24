<script lang="ts">
	import ImportsInboxWorkspace from '$lib/features/imports/ImportsInboxWorkspace.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Imports / Inbox — HxFin</title>
</svelte:head>

<ImportsInboxWorkspace
	data={{
		categories: data.categories.slice(),
		batches: data.batches.slice(),
		reviewTransactions: data.reviewTransactions.slice()
	}}
/>
