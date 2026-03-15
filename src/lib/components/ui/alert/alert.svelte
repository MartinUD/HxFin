<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";

	export const alertVariants = tv({
		base: "[font-family:var(--ds-font-body)] relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
		variants: {
			variant: {
				default: "bg-[var(--app-bg-card)] text-[var(--app-text-primary)]",
				destructive:
					"text-[var(--app-red)] bg-[var(--app-red-glow)] border-[var(--app-red)] *:data-[slot=alert-description]:text-[var(--app-red)] [&>svg]:text-current",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	export type AlertVariant = VariantProps<typeof alertVariants>["variant"];
</script>

<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		variant = "default",
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		variant?: AlertVariant;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert"
	role="alert"
	class={cn(alertVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
