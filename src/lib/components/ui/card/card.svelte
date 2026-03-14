<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="card"
	class={cn(
		"glass-card text-[var(--app-text-primary)] flex flex-col gap-6 rounded-[var(--app-radius)] border border-[var(--ds-glass-border)] py-6",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>

<style>
	.glass-card {
		background:
			linear-gradient(180deg, var(--ds-glass-bg-strong), var(--ds-glass-bg)),
			var(--ds-glass-surface);
		backdrop-filter: blur(var(--ds-glass-blur));
		-webkit-backdrop-filter: blur(var(--ds-glass-blur));
		box-shadow: var(--ds-glass-shadow), inset 0 1px 0 var(--ds-glass-edge);
	}
</style>
