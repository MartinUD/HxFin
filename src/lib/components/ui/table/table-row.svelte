<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

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
