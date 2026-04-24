<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { primaryNavigation } from '$lib/navigation';

	let { children } = $props();

	let pathname = $derived(page.url.pathname);
	let sidebarOpen = $state(false);
	let openGroups = $state<Record<string, boolean>>(
		Object.fromEntries(primaryNavigation.filter((s) => s.children.length > 0).map((s) => [s.key, true]))
	);
	let activeSectionKey = $derived(
		primaryNavigation.find((section) => isSectionActive(section.href))?.key ?? null
	);

	function isSectionActive(href: string): boolean {
		return pathname === href || pathname.startsWith(`${href}/`);
	}

	function isChildActive(href: string): boolean {
		return pathname === href || pathname.startsWith(`${href}/`);
	}

	function isGroupOpen(key: string): boolean {
		return openGroups[key] ?? activeSectionKey === key;
	}

	function toggleGroup(key: string): void {
		openGroups = {
			...openGroups,
			[key]: !isGroupOpen(key)
		};
	}

	function closeSidebar(): void {
		sidebarOpen = false;
	}
</script>

<button
	type="button"
	class="hamburger"
	onclick={() => (sidebarOpen = !sidebarOpen)}
	aria-label="Toggle navigation"
	aria-expanded={sidebarOpen}
	aria-controls="main-sidebar"
>
	{#if sidebarOpen}
		<svg
			aria-hidden="true"
			focusable="false"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	{:else}
		<svg
			aria-hidden="true"
			focusable="false"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<line x1="3" y1="6" x2="21" y2="6" />
			<line x1="3" y1="12" x2="21" y2="12" />
			<line x1="3" y1="18" x2="21" y2="18" />
		</svg>
	{/if}
</button>

{#if sidebarOpen}
	<button
		type="button"
		class="overlay"
		onclick={closeSidebar}
		aria-label="Close navigation"
	></button>
{/if}

<div class="shell">
	<nav id="main-sidebar" class="sidebar" class:open={sidebarOpen}>
		<div class="logo-area">
			<span class="logo-text">HxFin</span>
		</div>

		<ul class="nav-groups">
			{#each primaryNavigation as section (section.key)}
				<li class="nav-group">
					{#if section.children.length > 0}
						<button
							type="button"
							class="nav-section-btn"
							class:is-active={isSectionActive(section.href)}
							aria-expanded={isGroupOpen(section.key)}
							aria-controls={`subnav-${section.key}`}
							onclick={() => toggleGroup(section.key)}
						>
							<span class="nav-section-icon" aria-hidden="true">
								{#if section.key === 'budget'}
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M3 6.5h18" /><path d="M7 3.5v6" /><path d="M17 3.5v6" />
										<rect x="3" y="5" width="18" height="15" rx="2" /><path d="M8 14h8" />
									</svg>
								{:else if section.key === 'investments'}
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M3 17 9 11l4 4 8-8" /><path d="M14 7h7v7" />
									</svg>
								{:else}
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" />
									</svg>
								{/if}
							</span>
							<span class="nav-section-label">{section.label}</span>
							<svg
								class="nav-chevron"
								class:is-open={isGroupOpen(section.key)}
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="9 6 15 12 9 18" />
							</svg>
						</button>

						{#if isGroupOpen(section.key)}
							<ul
								class="subnav-items"
								id={`subnav-${section.key}`}
								transition:slide={{ duration: 60, easing: cubicOut }}
							>
								{#each section.children as child, i (child.href)}
									<li transition:fly|global={{ x: -4, duration: 90, delay: i * 12, easing: cubicOut }}>
										<a
											href={child.href}
											class="subnav-link"
											class:is-active={isChildActive(child.href)}
											aria-current={isChildActive(child.href) ? 'page' : undefined}
											onclick={closeSidebar}
										>
											<span class="subnav-title">{child.label}</span>
											{#if child.state === 'planned'}
												<span class="subnav-state">Later</span>
											{/if}
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					{:else}
						<a
							href={section.href}
							class="nav-section-btn"
							class:is-active={isSectionActive(section.href)}
							onclick={closeSidebar}
						>
							<span class="nav-section-icon" aria-hidden="true">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<rect x="2" y="6" width="20" height="14" rx="2" />
									<path d="M12 6V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2" />
									<path d="M12 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
									<path d="M12 13v3" />
									<path d="M2 10h20" />
								</svg>
							</span>
							<span class="nav-section-label">{section.label}</span>
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>

	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	.shell {
		display: grid;
		grid-template-columns: 272px minmax(0, 1fr);
		height: 100dvh;
		overflow: hidden;
	}

	/* ---- Sidebar — glass panel matching table shell ---- */

	.sidebar {
		background:
			linear-gradient(180deg, var(--ds-glass-bg-strong), var(--ds-glass-bg)),
			var(--ds-glass-surface);
		backdrop-filter: blur(var(--ds-glass-blur));
		border-right: 1px solid var(--ds-glass-border);
		box-shadow: 4px 0 24px rgba(0, 0, 0, 0.18);
		padding: 20px 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		position: sticky;
		top: 0;
		height: 100dvh;
		overflow-y: auto;
	}

	/* ---- Logo ---- */

	.logo-area {
		padding: 4px 10px 18px;
	}

	.logo-text {
		font-family: var(--ds-font-display);
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--app-text-primary);
	}

	/* ---- Section groups ---- */

	.nav-groups {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 0;
		padding: 0;
	}

	.nav-group {
		display: flex;
		flex-direction: column;
	}

	/* ---- Section button / link ---- */

	.nav-section-btn {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 10px;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		background: transparent;
		color: inherit;
		text-decoration: none;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 0.14s var(--ds-ease),
			border-color 0.14s var(--ds-ease),
			color 0.14s var(--ds-ease);
	}

	a.nav-section-btn:hover {
		background: rgba(255, 255, 255, 0.03);
		border-color: rgba(255, 255, 255, 0.05);
	}

	/* Only childless sections (e.g. Loans) get the pill active style */
	a.nav-section-btn.is-active {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.008)),
			color-mix(in oklab, var(--app-accent) 8%, transparent);
		border-color: color-mix(in oklab, var(--app-accent) 50%, var(--ds-glass-border));
	}

	.nav-section-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--app-accent-glow);
	}

	/* ---- Section icon (no background) ---- */

	.nav-section-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		color: var(--app-text-muted);
		flex: 0 0 auto;
		transition: color 0.16s var(--ds-ease);
	}

	.nav-section-btn.is-active .nav-section-icon {
		color: var(--app-accent-light);
	}

	/* ---- Section label ---- */

	.nav-section-label {
		font-size: 0.97rem;
		font-weight: 600;
		color: var(--app-text-primary);
		flex: 1;
	}

	/* ---- Chevron ---- */

	.nav-chevron {
		color: var(--app-text-muted);
		transition: transform 0.16s var(--ds-ease);
		flex: 0 0 auto;
	}

	.nav-chevron.is-open {
		transform: rotate(90deg);
	}

	/* ---- Child items — tree lines with horizontal ticks ---- */

	.subnav-items {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0;
		margin: 2px 0 6px 33px;
		padding: 0;
	}

	.subnav-items li {
		position: relative;
		padding-left: 14px;
	}

	/* Vertical line segment */
	.subnav-items li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		border-left: 1px solid var(--ds-glass-border);
	}

	/* Horizontal tick */
	.subnav-items li::after {
		content: '';
		position: absolute;
		left: 0;
		top: 50%;
		width: 9px;
		border-top: 1px solid var(--ds-glass-border);
	}

	/* Last child: vertical line stops at center */
	.subnav-items li:last-child::before {
		bottom: 50%;
	}

	.subnav-link {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 10px;
		border-radius: 0.4rem;
		border: 1px solid transparent;
		text-decoration: none;
		color: inherit;
		transition:
			background-color 0.14s var(--ds-ease),
			border-color 0.14s var(--ds-ease),
			color 0.14s var(--ds-ease);
	}

	.subnav-link:hover {
		background: rgba(255, 255, 255, 0.03);
		border-color: rgba(255, 255, 255, 0.05);
	}

	.subnav-link.is-active {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.008)),
			color-mix(in oklab, var(--app-accent) 8%, transparent);
		border-color: color-mix(in oklab, var(--app-accent) 50%, var(--ds-glass-border));
	}

	.subnav-link:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--app-accent-glow);
		border-radius: 0.4rem;
	}

	.subnav-title {
		font-size: 0.92rem;
		font-weight: 500;
		color: var(--app-text-secondary);
	}

	.subnav-link.is-active .subnav-title {
		color: var(--app-text-primary);
		font-weight: 600;
	}

	.subnav-state {
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.05);
		color: var(--app-text-muted);
		font-size: 0.62rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* ---- Content area ---- */

	.content {
		overflow-y: auto;
		min-width: 0;
		height: 100dvh;
	}

	/* ---- Mobile hamburger ---- */

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
		transition:
			background 0.16s var(--ds-ease),
			border-color 0.16s var(--ds-ease);
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

	@media (max-width: 960px) {
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
			width: min(260px, calc(100vw - 32px));
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
