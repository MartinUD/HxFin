<svelte:head>
	<title>Imports / Rules — HxFin</title>
</svelte:head>

<div class="app-page placeholder-page">
	<section class="section-hero">
		<span class="section-kicker">Reserved Route</span>
		<h1 class="app-page-title">Rules</h1>
		<p class="section-lead">
			Merchant rules already influence categorization, but the explicit management workflow is
			not promoted yet. This route exists now so phase 6 can add it without another navigation
			change.
		</p>
	</section>

	<section class="status-panel">
		<div class="status-panel-title">Current recommendation</div>
		<p>Use <a href="/imports/inbox" class="inline-link">Inbox</a> for review decisions. Rule promotion and management will move here in a later phase.</p>
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
