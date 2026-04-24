<svelte:head>
	<title>Imports / All Transactions — HxFin</title>
</svelte:head>

<div class="app-page placeholder-page">
	<section class="section-hero">
		<span class="section-kicker">Reserved Route</span>
		<h1 class="app-page-title">All Transactions</h1>
		<p class="section-lead">
			This destination is reserved in phase 1 so the full transaction ledger can land later
			without changing navigation again. Use the inbox for active review work today.
		</p>
	</section>

	<section class="status-panel">
		<div class="status-panel-title">Current recommendation</div>
		<p>Use <a href="/imports/inbox" class="inline-link">Inbox</a> to process imported transactions until the dedicated ledger view is introduced.</p>
	</section>
</div>

<style>
	.placeholder-page {
		gap: 14px;
	}

	.inline-link {
		color: var(--app-accent-light);
		text-decoration: none;
		font-weight: 700;
	}
</style>
