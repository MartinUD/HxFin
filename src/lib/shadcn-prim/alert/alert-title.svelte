<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/shared/cn.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert-title"
	class={cn("[font-family:var(--ds-font-display)] col-start-2 line-clamp-1 min-h-4 text-[0.78rem] font-semibold tracking-[0.06em] uppercase", className)}
	{...restProps}
>
	{@render children?.()}
</div>
