<script lang="ts">
	import { Tabs as TabsPrimitive } from "bits-ui";
	import { cn } from "$lib/shared/cn.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: TabsPrimitive.TriggerProps = $props();
</script>

<TabsPrimitive.Trigger
	bind:ref
	data-slot="tabs-trigger"
	class={cn(
		"[font-family:var(--ds-font-body)] data-[state=active]:bg-[var(--app-bg-card)] data-[state=active]:text-[var(--app-text-primary)] data-[state=active]:border-[var(--app-accent)] text-[var(--app-text-muted)] inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--app-radius-sm)-2px)] border border-transparent px-2 py-1 text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:ring-[3px] focus-visible:ring-[var(--app-accent-glow)] focus-visible:border-[var(--app-accent)] outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		className
	)}
	{...restProps}
/>
