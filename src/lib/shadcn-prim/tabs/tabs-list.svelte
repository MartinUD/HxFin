<script lang="ts">
	import { Tabs as TabsPrimitive } from "bits-ui";
	import { cn } from "$lib/shared/cn.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: TabsPrimitive.ListProps = $props();
</script>

<TabsPrimitive.List
	bind:ref
	data-slot="tabs-list"
	class={cn(
		"bg-[var(--app-bg-input)] text-[var(--app-text-muted)] inline-flex h-9 w-fit items-center justify-center rounded-[var(--app-radius-sm)] border border-[var(--app-border)] p-[3px]",
		className
	)}
	{...restProps}
/>
