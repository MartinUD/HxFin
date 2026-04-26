<script lang="ts">
	import LoansWorkspace from '$lib/features/loans/LoansWorkspace.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Loans — HxFin</title>
</svelte:head>

<LoansWorkspace data={{ loans: data.loans.slice() }} />
