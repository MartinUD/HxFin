<script lang="ts" module>
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";
	import { tv, type VariantProps } from "tailwind-variants";
	import { cn, type WithElementRef } from "$lib/shared/cn.js";

	export const buttonVariants = tv({
		base: "[font-family:var(--ds-font-body)] inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--app-radius-sm)] border border-transparent text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--app-accent-glow)] focus-visible:border-[var(--app-accent)] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		variants: {
			variant: {
				default:
					"bg-[var(--app-accent)] text-black hover:bg-[var(--app-accent-light)] shadow-[var(--app-shadow)]",
				destructive:
					"bg-[var(--app-red)] text-black hover:brightness-110 focus-visible:ring-[var(--app-red-glow)] focus-visible:border-[var(--app-red)] shadow-[var(--app-shadow)]",
				outline:
					"border-[var(--app-border)] bg-[var(--app-bg-input)] text-[var(--app-text-secondary)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent-light)]",
				secondary:
					"border-[var(--ds-glass-border)] bg-[var(--app-bg-card)] text-[var(--app-text-primary)] hover:bg-[var(--app-bg-card-hover)] shadow-[var(--app-shadow)]",
				ghost:
					"text-[var(--app-text-secondary)] hover:bg-[var(--app-accent-glow)] hover:text-[var(--app-accent-light)]",
				link: "text-[var(--app-accent-light)] underline-offset-4 hover:underline",
			},
			size: {
				default: "h-9 px-4 py-2 has-[>svg]:px-3",
				sm: "h-8 gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
				lg: "h-10 px-6 has-[>svg]:px-4",
				icon: "size-9",
				"icon-sm": "size-8",
				"icon-lg": "size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
	export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = "default",
		size = "default",
		ref = $bindable(null),
		href = undefined,
		type = "button",
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
