<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';

	export const tagVariants = tv({
		base: 'inline-flex w-fit shrink-0 items-center justify-center rounded-full border px-3 py-1 text-[0.8rem] font-semibold whitespace-nowrap transition-[color,background-color,border-color] duration-150',
		variants: {
			variant: {
				neutral: 'border-[var(--app-border)] bg-[rgba(255,255,255,0.03)] text-[var(--app-text-secondary)]',
				subtle: 'border-[var(--app-border)] bg-[rgba(255,255,255,0.05)] text-[var(--app-text-muted)]',
				accent: 'border-[color-mix(in_oklab,var(--app-accent)_62%,var(--app-border))] bg-[color-mix(in_oklab,var(--app-accent)_24%,transparent)] text-[var(--app-accent-light)]',
				success: 'border-[color-mix(in_oklab,var(--app-accent)_60%,var(--app-border))] bg-[var(--app-accent-glow)] text-[var(--app-accent-light)]',
				warning: 'border-[color-mix(in_oklab,var(--app-amber)_55%,var(--app-border))] bg-[color-mix(in_oklab,var(--app-amber)_18%,transparent)] text-[var(--app-amber)]',
				danger: 'border-[color-mix(in_oklab,var(--app-red)_60%,var(--app-border))] bg-[var(--app-red-glow)] text-[var(--app-red)]',
			},
			size: {
				sm: 'px-2.5 py-0.75 text-[0.76rem]',
				md: 'px-3.5 py-[0.34rem] text-[0.84rem]',
			},
		},
		defaultVariants: {
			variant: 'neutral',
			size: 'md',
		},
	});

	export type TagVariant = VariantProps<typeof tagVariants>['variant'];
	export type TagSize = VariantProps<typeof tagVariants>['size'];
</script>

<script lang="ts">
	import { cn } from '$lib/shared/cn.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		class: className,
		variant = 'neutral',
		size = 'md',
		children,
		...restProps
	}: HTMLAttributes<HTMLSpanElement> & {
		variant?: TagVariant;
		size?: TagSize;
	} = $props();
</script>

<span class={cn(tagVariants({ variant, size }), className)} {...restProps}>
	{@render children?.()}
</span>
