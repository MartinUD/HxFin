<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLTableSectionElement>> = $props();
</script>

<tfoot
	bind:this={ref}
	data-slot="table-footer"
	class={cn("bg-transparent border-t border-[var(--app-border)] font-medium [&>tr]:last:border-b-0", className)}
	style="background: var(--table-footer-bg, transparent);"
	{...restProps}
>
	{@render children?.()}
</tfoot>
