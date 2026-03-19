<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLTableAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	interface Props extends WithElementRef<HTMLTableAttributes, HTMLTableElement> {
		children?: Snippet;
		footer?: Snippet;
		showFooter?: boolean;
		fill?: boolean;
		size?: 'compact' | 'comfortable';
		stickyHeader?: boolean;
		variant?: 'glass' | 'plain';
		shellClass?: string;
		scrollClass?: string;
	}

	let {
		ref = $bindable(null),
		class: className,
		children,
		footer,
		showFooter = true,
		fill = false,
		size = 'comfortable',
		stickyHeader = true,
		variant = 'glass',
		shellClass = '',
		scrollClass = '',
		...restProps
	}: Props = $props();
</script>

<!-- Shared table frame so route pages only define columns, rows, and optional footer content. -->
<div
	data-slot="table-shell"
	data-size={size}
	data-variant={variant}
	data-fill={fill ? '' : undefined}
	class={cn('rounded-lg border overflow-hidden', shellClass)}
>
	<!-- Scroll container owns the sticky-header context. -->
	<div data-slot="table-scroll" class={cn('relative w-full overflow-auto', scrollClass)}>
		<table
			bind:this={ref}
			data-slot="table"
			data-sticky={stickyHeader ? '' : undefined}
			class={cn('[font-family:var(--ds-font-body)] w-full caption-bottom text-sm', className)}
			{...restProps}
		>
			{@render children?.()}
		</table>
	</div>

	<!-- Optional footer is rendered inside the shared frame so totals stay visually attached. -->
	{#if footer && showFooter}
		<div data-slot="table-summary">
			{@render footer()}
		</div>
	{/if}
</div>

<style>
	:global([data-slot='table-shell']) {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-color: var(--table-border, var(--ds-glass-border));
		background:
			var(--table-shell-gradient, linear-gradient(180deg, var(--ds-glass-bg-strong), var(--ds-glass-bg))),
			var(--table-shell-bg, var(--ds-glass-surface));
		backdrop-filter: blur(var(--table-shell-blur, var(--ds-glass-blur)));
		-webkit-backdrop-filter: blur(var(--table-shell-blur, var(--ds-glass-blur)));
		box-shadow:
			var(--table-shell-shadow, var(--ds-glass-shadow)),
			inset 0 1px 0 var(--table-shell-edge, var(--ds-glass-edge));
	}

	:global([data-slot='table-shell'][data-fill]) {
		flex: 1 1 auto;
		height: 100%;
	}

	:global([data-slot='table-shell'][data-variant='plain']) {
		background: var(--table-shell-bg, var(--app-bg-card));
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
		box-shadow: none;
	}

	:global([data-slot='table-scroll']) {
		flex: 1 1 auto;
		min-height: 0;
		overscroll-behavior: contain;
		scrollbar-gutter: stable;
		background: var(--table-scroll-bg, rgba(0, 0, 0, 0.08));
	}

	:global([data-slot='table']) {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		background: var(--table-bg, transparent);
	}

	:global([data-slot='table'] caption) {
		margin-top: 1rem;
		font-size: 0.875rem;
		color: var(--app-text-secondary);
	}

	:global([data-slot='table'] thead) {
		isolation: isolate;
	}

	:global([data-slot='table'] thead th) {
		background:
			var(--table-head-gradient, linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012))),
			var(--table-head-bg, color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.14)));
		box-shadow:
			inset 0 -1px 0 var(--table-border, var(--ds-glass-border)),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	:global([data-slot='table'][data-sticky] thead th) {
		position: sticky;
		top: 0;
		z-index: 3;
	}

	:global([data-slot='table'] tbody tr) {
		transition: color 0.16s var(--ds-ease), background-color 0.16s var(--ds-ease);
	}

	:global([data-slot='table'] tbody tr[data-state='selected'] > td) {
		background: var(--table-row-selected, var(--app-bg-card));
	}

	:global([data-slot='table'] tbody tr:hover > td) {
		background: var(--table-row-hover, color-mix(in oklab, var(--app-bg-input) 80%, transparent));
	}

	:global([data-slot='table'] tbody td) {
		border-top: 1px solid var(--table-row-border, var(--app-border));
	}

	:global([data-slot='table'] th) {
		font-family: var(--ds-font-display);
		color: var(--app-text-secondary);
		background-clip: padding-box;
		text-align: left;
		vertical-align: middle;
		font-weight: 600;
		white-space: nowrap;
	}

	:global([data-slot='table'] td) {
		color: var(--app-text-primary);
		background-clip: padding-box;
		vertical-align: middle;
		white-space: nowrap;
	}

	:global([data-slot='table-shell'][data-size='comfortable'] [data-slot='table'] th) {
		height: 3.7rem;
		padding: 1.05rem 1.25rem;
		font-size: 0.82rem;
		letter-spacing: 0;
		text-transform: none;
	}

	:global([data-slot='table-shell'][data-size='comfortable'] [data-slot='table'] td) {
		padding: 1.05rem 1.25rem;
		font-size: 1rem;
	}

	:global([data-slot='table-shell'][data-size='compact'] [data-slot='table'] th) {
		height: 2.9rem;
		padding: 0.7rem 0.9rem;
		font-size: 0.74rem;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	:global([data-slot='table-shell'][data-size='compact'] [data-slot='table'] td) {
		padding: 0.75rem 0.9rem;
		font-size: 0.88rem;
	}

	:global([data-slot='table'] tfoot) {
		border-top: 1px solid var(--table-row-border, var(--app-border));
		font-weight: 500;
		background: var(--table-footer-bg, transparent);
	}

	:global([data-slot='table-summary']) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.95rem 1.25rem 1rem;
		border-top: 1px solid var(--table-border, var(--ds-glass-border));
		background:
			var(--table-summary-gradient, linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.12))),
			var(--table-summary-bg, color-mix(in oklab, var(--ds-glass-surface) 92%, transparent));
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	:global([data-slot='table-summary'] .table-summary-copy) {
		display: flex;
		align-items: baseline;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	:global([data-slot='table-summary'] .table-summary-label) {
		font-family: var(--ds-font-display);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--app-text-muted);
	}

	:global([data-slot='table-summary'] .table-summary-value) {
		font-family: var(--ds-font-mono);
		font-size: var(--table-summary-value-size, 1.15rem);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--app-accent-light);
	}

	:global([data-slot='table'] .table-empty-state) {
		padding: 4.5rem 1.25rem;
		text-align: center;
		font-size: 0.95rem;
		color: var(--app-text-muted);
	}

	@media (max-width: 640px) {
		:global([data-slot='table-summary']) {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
