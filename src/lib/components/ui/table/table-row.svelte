<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLTableRowElement>> = $props();
</script>

<tr
	bind:this={ref}
	data-slot="table-row"
	class={cn(
		"hover:[&,&>svelte-css-wrapper]:[&>th,td]:bg-[var(--app-bg-input)] data-[state=selected]:bg-[var(--app-bg-card)] border-b border-[var(--app-border)] transition-colors",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</tr>
