<script lang="ts">
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import { Select as SelectPrimitive } from "bits-ui";
	import { cn, type WithoutChild } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		size = "default",
		...restProps
	}: WithoutChild<SelectPrimitive.TriggerProps> & {
		size?: "sm" | "default";
	} = $props();
</script>

<SelectPrimitive.Trigger
	bind:ref
	data-slot="select-trigger"
	data-size={size}
	class={cn(
		"[font-family:var(--ds-font-body)] border-[var(--app-border)] data-[placeholder]:text-[var(--app-text-muted)] text-[var(--app-text-primary)] [&_svg:not([class*='text-'])]:text-[var(--app-text-muted)] flex w-fit items-center justify-between gap-2 rounded-[var(--app-radius-sm)] border bg-[var(--app-bg-input)] px-3 py-2 text-sm whitespace-nowrap transition-[color,background-color,border-color,box-shadow] outline-none select-none focus-visible:border-[var(--app-accent)] focus-visible:ring-[3px] focus-visible:ring-[var(--app-accent-glow)] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		className
	)}
	{...restProps}
>
	{@render children?.()}
	<ChevronDownIcon class="size-4 opacity-50" />
</SelectPrimitive.Trigger>
