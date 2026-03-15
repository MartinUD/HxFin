<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import type { ComponentProps } from "svelte";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: ComponentProps<typeof SelectPrimitive.GroupHeading> = $props();
</script>

<SelectPrimitive.GroupHeading
	bind:ref
	data-slot="select-group-heading"
	class={cn("[font-family:var(--ds-font-display)] text-[var(--app-text-muted)] px-2 py-1.5 text-[0.68rem] uppercase tracking-[0.08em]", className)}
	{...restProps}
>
	{@render children?.()}
</SelectPrimitive.GroupHeading>
