<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {} = $props();
</script>

<div
	bind:this={ref}
	data-slot="select-label"
	class={cn("[font-family:var(--ds-font-display)] text-[var(--app-text-muted)] px-2 py-1.5 text-[0.68rem] uppercase tracking-[0.08em]", className)}
	{...restProps}
>
	{@render children?.()}
</div>
