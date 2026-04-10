<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import { cn } from '$lib/utils';

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

<!-- Sortable column header lives next to the shared table so pages only provide column intent. -->
<th scope="col" class={cn(align === 'right' ? 'text-right' : '', className)}>
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
				<ChevronsUpDownIcon size={15} strokeWidth={1.8} />
			{:else if direction === 'asc'}
				<ChevronUpIcon size={15} strokeWidth={1.8} />
			{:else}
				<ChevronDownIcon size={15} strokeWidth={1.8} />
			{/if}
		</span>
	</button>
</th>

<style>
	.sort-button {
		display: inline-flex;
		align-items: center;
		gap: 0.38rem;
		width: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition: color 0.16s var(--ds-ease);
	}

	.sort-button.align-right {
		justify-content: flex-end;
	}

	.sort-button:hover,
	.sort-button.active,
	.sort-button:focus-visible {
		color: var(--app-text-primary);
		outline: none;
	}

	.sort-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		opacity: 0.78;
	}
</style>
