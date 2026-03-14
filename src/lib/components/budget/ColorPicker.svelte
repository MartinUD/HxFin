<script lang="ts">
	import { COLOR_PALETTE } from '$lib/budget';

	interface Props {
		value: string;
		palette?: string[];
	}

	let { value = $bindable(), palette = COLOR_PALETTE }: Props = $props();
</script>

<div class="color-picker">
	{#each palette as color}
		<button
			class="swatch"
			class:selected={value === color}
			style="background: {color}"
			onclick={() => (value = color)}
			aria-label="Select color {color}"
			type="button"
		></button>
	{/each}
</div>

<style>
	.color-picker {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.swatch {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition: transform 0.15s, outline 0.15s;
		outline: 2px solid transparent;
		outline-offset: 2px;
		padding: 0;
	}

	.swatch.selected {
		outline: 2px solid var(--app-text-primary);
		transform: scale(1.1);
	}

	.swatch:hover:not(.selected) {
		transform: scale(1.15);
	}
</style>
