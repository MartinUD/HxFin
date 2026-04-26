<script lang="ts">
	import { Button, type ButtonProps } from '$lib/shadcn-prim/button';
	import { cn } from '$lib/shared/cn';

	export type ToolbarActionButtonTone = 'primary' | 'muted';

	type Props = ButtonProps & {
		tone?: ToolbarActionButtonTone;
	};

	let {
		class: className,
		tone = 'primary',
		size = 'sm',
		variant = 'outline',
		children,
		...restProps
	}: Props = $props();
</script>

<Button
	{variant}
	{size}
	class={cn(
		'toolbar-action-button',
		tone === 'muted' ? 'toolbar-action-button-muted' : 'toolbar-action-button-primary',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</Button>

<style>
	:global(.toolbar-action-button) {
		height: 3rem;
		padding-inline: 1.15rem;
		font-size: 0.96rem;
		font-weight: 700;
		border-radius: 0.95rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.16));
		border-color: var(--ds-glass-border);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
		color: var(--app-text-primary);
	}

	:global(.toolbar-action-button:hover) {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
			color-mix(in oklab, var(--ds-glass-surface) 88%, rgba(12, 20, 14, 0.1));
	}

	:global(.toolbar-action-button-muted) {
		color: var(--app-text-secondary);
	}

	:global(.toolbar-action-button-muted:hover) {
		color: var(--app-text-primary);
	}
</style>
