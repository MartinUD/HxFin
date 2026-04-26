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
	data-slot="card-title"
	class={cn("[font-family:var(--ds-font-display)] leading-none font-semibold tracking-[0.01em]", className)}
	{...restProps}
>
	{@render children?.()}
</div>
