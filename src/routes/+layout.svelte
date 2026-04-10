<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';


	let { children } = $props();

	let pathname = $derived($page.url.pathname);
	let sidebarOpen = $state(false);

	const navRoutes = ['/budget', '/investments', '/loans', '/wishlist', '/imports'];
	let activeIndex = $derived(navRoutes.findIndex((href) => pathname.startsWith(href)));
	let hasActiveNav = $derived(activeIndex >= 0);

	function isActive(href: string): boolean {
		if (href === '/') return pathname === '/';
		return pathname.startsWith(href);
	}

	function closeSidebar() {
		sidebarOpen = false;
	}
</script>

<!-- Mobile hamburger -->
<button
	type="button"
	class="hamburger"
	onclick={() => (sidebarOpen = !sidebarOpen)}
	aria-label="Toggle navigation"
	aria-expanded={sidebarOpen}
	aria-controls="main-sidebar"
>
	{#if sidebarOpen}
		<svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	{:else}
		<svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<line x1="3" y1="6" x2="21" y2="6" />
			<line x1="3" y1="12" x2="21" y2="12" />
			<line x1="3" y1="18" x2="21" y2="18" />
		</svg>
	{/if}
</button>

<!-- Overlay -->
{#if sidebarOpen}
	<button type="button" class="overlay" onclick={closeSidebar} aria-label="Close navigation"></button>
{/if}

<div class="shell">
	<nav id="main-sidebar" class="sidebar" class:open={sidebarOpen}>
		<div class="logo-area">
			<div class="logo-icon">
				<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10" />
					<polyline points="12 6 12 12 16 14" />
				</svg>
			</div>
			<span class="logo-text">FinDash</span>
		</div>

		<span class="nav-section-label">Navigation</span>

		<ul
			class="nav-items"
			style:--nav-count={navRoutes.length}
			style:--nav-active-index={activeIndex}
		>
			{#if hasActiveNav}
				<li class="nav-slider" aria-hidden="true"></li>
			{/if}
			<li>
				<a href="/budget" class="nav-link" class:active={isActive('/budget')} onclick={closeSidebar}>
					<svg aria-hidden="true" focusable="false" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="2" y="3" width="20" height="14" rx="2" />
						<path d="M8 21h8M12 17v4" />
					</svg>
					<span>Budget</span>
				</a>
			</li>
			<li>
				<a href="/investments" class="nav-link" class:active={isActive('/investments')} onclick={closeSidebar}>
					<svg aria-hidden="true" focusable="false" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
						<polyline points="16 7 22 7 22 13" />
					</svg>
					<span>Investments</span>
					{#if isActive('/investments')}
						<span class="active-dot" in:fade={{ duration: 100, delay: 40 }} out:fade={{ duration: 60 }}></span>
					{/if}
				</a>
			</li>
			<li>
				<a href="/loans" class="nav-link" class:active={isActive('/loans')} onclick={closeSidebar}>
					<svg aria-hidden="true" focusable="false" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M2 7h20" />
						<path d="M7 2v20" />
						<path d="M14 12h8" />
						<path d="M18 8v8" />
					</svg>
					<span>Loans</span>
					{#if isActive('/loans')}
						<span class="active-dot" in:fade={{ duration: 100, delay: 40 }} out:fade={{ duration: 60 }}></span>
					{/if}
				</a>
			</li>
			<li>
				<a href="/wishlist" class="nav-link" class:active={isActive('/wishlist')} onclick={closeSidebar}>
					<svg aria-hidden="true" focusable="false" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 21s-7-4.35-9.5-8.2C.76 9.98 2.2 6.5 5.5 5.6c2.2-.6 4.2.2 5.5 2 1.3-1.8 3.3-2.6 5.5-2 3.3.9 4.74 4.38 3 7.2C19 16.65 12 21 12 21Z" />
					</svg>
					<span>Wishlist</span>
					{#if isActive('/wishlist')}
						<span class="active-dot" in:fade={{ duration: 100, delay: 40 }} out:fade={{ duration: 60 }}></span>
					{/if}
				</a>
			</li>
			<li>
				<a href="/imports" class="nav-link" class:active={isActive('/imports')} onclick={closeSidebar}>
					<svg aria-hidden="true" focusable="false" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 3v12" />
						<path d="m7 10 5 5 5-5" />
						<path d="M4 21h16" />
					</svg>
					<span>Imports</span>
					{#if isActive('/imports')}
						<span class="active-dot" in:fade={{ duration: 100, delay: 40 }} out:fade={{ duration: 60 }}></span>
					{/if}
				</a>
			</li>
		</ul>
	</nav>

	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	.shell {
		display: grid;
		grid-template-columns: 208px minmax(0, 1fr);
		height: 100dvh;
		overflow: hidden;
	}

	.sidebar {
		background:
			linear-gradient(180deg, var(--ds-glass-bg-strong), transparent 30%),
			var(--ds-bg-1);
		border-right: 1px solid var(--ds-glass-border);
		box-shadow: inset -1px 0 0 var(--ds-glass-edge), 4px 0 24px rgba(0, 0, 0, 0.3);
		padding: 20px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		position: sticky;
		top: 0;
		height: 100dvh;
		overflow-y: auto;
	}

	.logo-area {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 10px 18px;
	}

	.logo-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 8px;
		background: var(--app-accent-glow);
		color: var(--app-accent-light);
		flex-shrink: 0;
	}

	.logo-text {
		font-family: var(--ds-font-display);
		font-size: 0.98rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--app-text-primary);
	}

	.nav-section-label {
		font-family: var(--ds-font-display);
		font-size: 0.66rem;
		font-weight: 600;
		color: var(--app-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding: 0 10px;
		margin-bottom: 2px;
	}

	.nav-items {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
		position: relative;
	}

	.nav-slider {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: calc((100% - (var(--nav-count) - 1) * 2px) / var(--nav-count));
		transform: translateY(calc(var(--nav-active-index) * (100% + 2px)));
		border-radius: var(--app-radius-sm);
		background: color-mix(in oklab, var(--ds-accent) 14%, var(--ds-glass-bg));
		border: 1px solid rgba(34, 197, 94, 0.30);
		box-shadow: inset 0 0.5px 0 var(--ds-glass-edge);
		transition:
			transform 165ms cubic-bezier(0.26, 0.9, 0.32, 1),
			opacity 165ms cubic-bezier(0.26, 0.9, 0.32, 1);
		z-index: 0;
		pointer-events: none;
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 9px 10px;
		border-radius: var(--app-radius-sm);
		color: var(--app-text-secondary);
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 600;
		transition:
			background 0.16s var(--ds-ease),
			color 165ms cubic-bezier(0.26, 0.9, 0.32, 1),
			border-color 0.16s var(--ds-ease),
			transform 120ms cubic-bezier(0.26, 0.9, 0.32, 1);
		border: 1px solid transparent;
		position: relative;
		z-index: 1;
	}

	.nav-link span:first-of-type {
		flex: 1;
	}

	.nav-link:hover {
		background: var(--app-bg-card);
		color: var(--app-text-primary);
	}

	.nav-link:focus-visible {
		outline: none;
		border-color: color-mix(in oklab, var(--app-accent) 58%, transparent);
		box-shadow: 0 0 0 3px var(--app-accent-glow);
		color: var(--app-text-primary);
	}

	.nav-link.active {
		background: transparent;
		color: var(--app-accent-light);
		border-color: transparent;
		box-shadow: none;
	}

.content {
		overflow-y: auto;
		min-width: 0;
		height: 100dvh;
	}

	.hamburger {
		display: none;
		position: fixed;
		top: 16px;
		left: 16px;
		z-index: 200;
		width: 40px;
		height: 40px;
		background: var(--app-bg-card);
		border: 1px solid var(--app-border);
		border-radius: var(--app-radius-sm);
		color: var(--app-text-primary);
		cursor: pointer;
		align-items: center;
		justify-content: center;
		transition: background 0.16s var(--ds-ease), border-color 0.16s var(--ds-ease);
	}

	.hamburger:hover {
		background: var(--app-bg-card-hover);
	}

	.hamburger:focus-visible {
		outline: none;
		border-color: color-mix(in oklab, var(--app-accent) 55%, transparent);
		box-shadow: 0 0 0 3px var(--app-accent-glow);
	}

	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 150;
	}

	@media (max-width: 768px) {
		.shell {
			grid-template-columns: 1fr;
		}

		.sidebar {
			position: fixed;
			left: 0;
			top: 0;
			height: 100dvh;
			z-index: 180;
			transform: translateX(-100%);
			transition: transform 0.25s var(--ds-ease);
			width: 208px;
			box-shadow: var(--app-shadow-lg);
		}

		.sidebar.open {
			transform: translateX(0);
		}

		.hamburger {
			display: flex;
		}
	}
</style>
