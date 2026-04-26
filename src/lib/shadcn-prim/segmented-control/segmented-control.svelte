<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';

	export interface SegmentedControlOption {
		value: string;
		label: string;
		meta?: string;
		dotColor?: string | null;
	}

	export const segmentedControlVariants = tv({
		slots: {
			root: 'inline-flex items-center gap-1',
			item: 'inline-flex items-center justify-center gap-1.5 border font-[var(--ds-font-body)] font-semibold transition-[background,color,border-color,box-shadow,transform] duration-120 ease-[cubic-bezier(0.26,0.9,0.32,1)]',
			activeItem: 'text-[var(--app-accent-light)]',
			inactiveItem: 'text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]',
			dot: 'size-2 shrink-0 rounded-full',
			meta: 'text-[0.68rem] opacity-60',
		},
		variants: {
			variant: {
				grouped: {
					root: 'rounded-[0.95rem] p-1',
					item: 'rounded-[0.8rem] border-transparent bg-transparent px-4',
					activeItem: '',
				},
				pills: {
					root: 'flex-wrap gap-1.5 rounded-[0.95rem] p-1',
					item: 'rounded-[0.95rem] px-4',
					activeItem: '',
				},
			},
			size: {
				md: {
					item: 'h-11 text-[0.92rem]',
				},
				lg: {
					root: 'rounded-[1rem]',
					item: 'h-12 px-5 text-[0.98rem]',
				},
			},
		},
		defaultVariants: {
			variant: 'grouped',
			size: 'md',
		},
	});

	export type SegmentedControlSize = VariantProps<typeof segmentedControlVariants>['size'];
	export type SegmentedControlVariant = VariantProps<typeof segmentedControlVariants>['variant'];
	export type SegmentedControlSelectionMode = 'single' | 'multiple';
</script>

<script lang="ts">
	import { cn } from '$lib/shared/cn.js';

	let {
		options,
		value = $bindable(),
		selectionMode = 'single',
		variant = 'grouped',
		size = 'md',
		class: className,
		itemClass,
		ariaLabel,
		onValueChange,
	}: {
		options: SegmentedControlOption[];
		value: string | string[];
		selectionMode?: SegmentedControlSelectionMode;
		variant?: SegmentedControlVariant;
		size?: SegmentedControlSize;
		class?: string;
		itemClass?: string;
		ariaLabel?: string;
		onValueChange?: (value: string | string[], changedValue: string) => void;
	} = $props();

	let styles = $derived(segmentedControlVariants({ variant, size }));
	let selectedValues = $derived(
		selectionMode === 'multiple'
			? Array.isArray(value)
				? value
				: value
					? [value]
					: []
			: Array.isArray(value)
				? [value[0] ?? '']
				: [value]
	);
	let activeIndex = $derived(
		Math.max(0, options.findIndex((option) => option.value === selectedValues[0]))
	);
	let rootStyle = $derived(
		variant === 'grouped' && selectionMode === 'single'
			? `--segment-count:${options.length};--segment-index:${activeIndex};grid-template-columns:repeat(${options.length},minmax(0,1fr));`
			: undefined
	);

	function isSelected(optionValue: string): boolean {
		return selectedValues.includes(optionValue);
	}

	function selectOption(nextValue: string): void {
		if (selectionMode === 'multiple') {
			const currentValues = Array.isArray(value)
				? value.slice()
				: value
					? [value]
					: [];
			const nextValues = currentValues.includes(nextValue)
				? currentValues.filter((currentValue) => currentValue !== nextValue)
				: [...currentValues, nextValue];
			value = nextValues;
			onValueChange?.(nextValues, nextValue);
			return;
		}

		value = nextValue;
		onValueChange?.(nextValue, nextValue);
	}
</script>

<div
	class={cn(styles.root(), className)}
	role="group"
	aria-label={ariaLabel}
	data-variant={variant}
	data-size={size}
	data-selection-mode={selectionMode}
	style={rootStyle}
>
	{#if variant === 'grouped' && selectionMode === 'single'}
		<div class="segmented-control-slider" aria-hidden="true"></div>
	{/if}
	{#each options as option (option.value)}
		<button
			type="button"
			class={cn(
				'segmented-control-item',
				styles.item(),
				isSelected(option.value) ? styles.activeItem() : styles.inactiveItem(),
				itemClass
			)}
			data-variant={variant}
			data-size={size}
			data-state={isSelected(option.value) ? 'active' : 'inactive'}
			aria-pressed={isSelected(option.value)}
			style={`--segment-accent:${option.dotColor ?? 'var(--app-accent)'}`}
			onclick={() => selectOption(option.value)}
		>
			{#if option.dotColor}
				<span class={styles.dot()} style={`background:${option.dotColor}`}></span>
			{/if}
			<span>{option.label}</span>
			{#if option.meta}
				<span class={styles.meta()}>{option.meta}</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	div[role='group'] {
		border: 1px solid var(--ds-glass-border);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.16));
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
	}

	div[role='group'][data-variant='grouped'] {
		display: grid;
		position: relative;
		align-items: stretch;
	}

	div[role='group'][data-variant='pills'] {
		gap: 0.5rem;
		border: 0;
		background: transparent;
		box-shadow: none;
	}

	.segmented-control-slider {
		position: absolute;
		left: 4px;
		top: 4px;
		bottom: 4px;
		width: calc((100% - 8px - ((var(--segment-count) - 1) * 4px)) / var(--segment-count));
		border: 1px solid color-mix(in oklab, var(--app-accent) 50%, var(--app-border));
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.01)),
			color-mix(
				in oklab,
				var(--app-accent) 14%,
				color-mix(in oklab, var(--ds-glass-surface) 82%, rgba(12, 20, 14, 0.1))
			);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.08),
			0 0 0 1px color-mix(in oklab, var(--app-accent) 10%, transparent);
		border-radius: 0.8rem;
		transform:
			translateX(calc(var(--segment-index) * (100% + 4px)))
			translateY(-1px);
		transition:
			transform 135ms cubic-bezier(0.26, 0.9, 0.32, 1),
			box-shadow 135ms cubic-bezier(0.26, 0.9, 0.32, 1);
	}

	.segmented-control-item {
		position: relative;
		z-index: 1;
	}

	.segmented-control-item[data-variant='grouped'] {
		grid-row: 1;
		width: 100%;
	}

	.segmented-control-item[data-variant='grouped'][data-state='active'] {
		background: transparent;
		border-color: transparent;
		box-shadow: none;
	}

	.segmented-control-item[data-variant='grouped']:hover {
		transform: translateY(-1px);
	}

	.segmented-control-item[data-variant='grouped']:active {
		transform: translateY(0) scale(0.985);
		transition-duration: 55ms;
	}

	.segmented-control-item[data-variant='grouped']:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 3px var(--app-accent-glow),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
	}

	.segmented-control-item[data-variant='pills'] {
		border-color: color-mix(in oklab, var(--ds-glass-border) 90%, rgba(255, 255, 255, 0.04));
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.18));
		box-shadow:
			inset 0 0.5px 0 rgba(255, 255, 255, 0.04),
			0 0 0 1px rgba(255, 255, 255, 0.015);
	}

	.segmented-control-item[data-variant='pills']:hover {
		transform: translateY(-1px);
	}

	.segmented-control-item[data-variant='pills'][data-state='active'] {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.012)),
			color-mix(in oklab, var(--segment-accent) 18%, var(--ds-glass-surface));
		border-color: color-mix(in oklab, var(--segment-accent) 72%, var(--ds-glass-border));
		box-shadow:
			inset 0 0.5px 0 rgba(255, 255, 255, 0.07),
			0 0 0 1px color-mix(in oklab, var(--segment-accent) 24%, transparent);
		color: color-mix(in oklab, var(--segment-accent) 86%, white);
	}
</style>
