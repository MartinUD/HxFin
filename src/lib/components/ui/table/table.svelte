<script lang="ts">
	import type { HTMLTableAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLTableAttributes> = $props();
</script>

<div
	data-slot="table-container"
	class="relative w-full overflow-x-auto"
	style="background: var(--table-container-bg, transparent);"
>
	<table
		bind:this={ref}
		data-slot="table"
		class={cn("[font-family:var(--ds-font-body)] w-full caption-bottom text-sm", className)}
		style="background: var(--table-bg, transparent);"
		{...restProps}
	>
		{@render children?.()}
	</table>
</div>
