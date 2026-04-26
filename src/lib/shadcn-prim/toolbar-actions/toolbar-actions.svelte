<script lang="ts">
	import { cn } from '$lib/shared/cn';
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children?: Snippet;
	}

	let { class: className, children }: Props = $props();
</script>

<div class={cn('toolbar-actions', className)}>
	{@render children?.()}
</div>

<style>
	.toolbar-actions {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		margin-left: auto;
		flex: 0 0 auto;
	}

	@media (max-width: 640px) {
		.toolbar-actions {
			width: 100%;
			margin-left: 0;
			justify-content: flex-end;
		}
	}
</style>
