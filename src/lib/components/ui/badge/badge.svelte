<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";

	export const badgeVariants = tv({
		base: "[font-family:var(--ds-font-display)] inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.07em] whitespace-nowrap transition-[color,background-color,border-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-[var(--app-accent-glow)] focus-visible:border-[var(--app-accent)] [&>svg]:pointer-events-none [&>svg]:size-3",
		variants: {
			variant: {
				default:
					"bg-[var(--app-accent-glow)] text-[var(--app-accent-light)] border-[var(--app-accent)] [a&]:hover:bg-[var(--app-accent)] [a&]:hover:text-black",
				secondary:
					"bg-[var(--app-bg-input)] text-[var(--app-text-secondary)] border-[var(--app-border)] [a&]:hover:text-[var(--app-text-primary)]",
				destructive:
					"bg-[var(--app-red-glow)] text-[var(--app-red)] border-[var(--app-red)] [a&]:hover:bg-[var(--app-red)] [a&]:hover:text-black focus-visible:ring-[var(--app-red-glow)] focus-visible:border-[var(--app-red)]",
				outline: "text-[var(--app-text-secondary)] border-[var(--app-border)] [a&]:hover:bg-[var(--app-bg-input)] [a&]:hover:text-[var(--app-text-primary)]",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
</script>

<script lang="ts">
	import type { HTMLAnchorAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		href,
		class: className,
		variant = "default",
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes> & {
		variant?: BadgeVariant;
	} = $props();
</script>

<svelte:element
	this={href ? "a" : "span"}
	bind:this={ref}
	data-slot="badge"
	{href}
	class={cn(badgeVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
