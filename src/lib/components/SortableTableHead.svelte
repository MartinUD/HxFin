<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import * as Table from '$lib/components/ui/table';

	interface Props {
		label: string;
		active?: boolean;
		direction?: 'asc' | 'desc';
		align?: 'left' | 'right';
		class?: string;
		onToggle: () => void;
	}

	let {
		label,
		active = false,
		direction = 'asc',
		align = 'left',
		class: className = '',
		onToggle
	}: Props = $props();
</script>

<Table.Head class={`${className} ${align === 'right' ? 'text-right' : ''}`.trim()}>
	<button
		type="button"
		class:active
		class:align-right={align === 'right'}
		class="sort-button"
		onclick={onToggle}
		aria-label={`Sort by ${label} ${active && direction === 'asc' ? 'descending' : 'ascending'}`}
	>
		<span>{label}</span>
		<span class="sort-icon" aria-hidden="true">
			{#if !active}
				<ChevronsUpDownIcon size={14} strokeWidth={1.8} />
			{:else if direction === 'asc'}
				<ChevronUpIcon size={14} strokeWidth={1.8} />
			{:else}
				<ChevronDownIcon size={14} strokeWidth={1.8} />
			{/if}
		</span>
	</button>
</Table.Head>

<style>
	.sort-button {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		width: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		cursor: pointer;
		transition: color 0.16s var(--ds-ease);
	}

	.sort-button.align-right {
		justify-content: flex-end;
	}

	.sort-button:hover,
	.sort-button.active {
		color: var(--app-text-primary);
	}

	.sort-button:focus-visible {
		outline: none;
		color: var(--app-text-primary);
	}

	.sort-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		opacity: 0.78;
		flex: 0 0 auto;
	}
</style>
