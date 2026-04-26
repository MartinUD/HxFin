<script lang="ts">
	import { getLeverageRate, getLeverageTier } from '$lib/features/investments/projections';

	interface Props {
		value: number;
		compact?: boolean;
	}

	let { value = $bindable(), compact = false }: Props = $props();

	let rate = $derived(getLeverageRate(value));
	let tier = $derived(getLeverageTier(value));

	let tierColor = $derived(
		value <= 0
			? 'var(--app-text-muted)'
			: value <= 10
				? 'var(--app-green)'
				: value <= 25
					? 'var(--app-amber)'
					: 'var(--app-red)'
	);

	let tierGlow = $derived(
		value <= 0
			? 'transparent'
			: value <= 10
				? 'var(--app-green-glow)'
				: value <= 25
					? 'var(--app-amber-glow)'
					: 'var(--app-red-glow)'
	);

	let fillPercent = $derived((value / 50) * 100);
</script>

<div class="leverage" class:compact>
	<div class="leverage-header">
		<span class="leverage-label">Hävstång (Värdepapperskredit)</span>
		<div class="leverage-value-wrap">
			<span class="leverage-value" style="color: {tierColor}">{value}%</span>
		</div>
	</div>

	<div class="slider-track-container">
		<input
			type="range"
			bind:value
			min={0}
			max={50}
			step={1}
			class="leverage-slider"
			style="--fill: {fillPercent}%; --track-color: {tierColor}"
		/>
		<div class="tier-markers">
			<div class="tier-mark" style="left: 0%"></div>
			<div class="tier-mark" style="left: 20%"></div>
			<div class="tier-mark" style="left: 50%"></div>
			<div class="tier-mark" style="left: 100%"></div>
		</div>
	</div>

	{#if !compact}
	<div class="tier-labels">
		<span>0%</span>
		<span>10%</span>
		<span>25%</span>
		<span>50%</span>
	</div>
	{/if}

	{#if value > 0}
		<div class="leverage-info" style="background: {tierGlow}; border-color: {tierColor}30">
			<div class="info-row">
				<span class="info-label">Räntenivå</span>
				<span class="info-value" style="color: {tierColor}">{tier}</span>
			</div>
			<div class="info-row">
				<span class="info-label">Aktuell ränta</span>
				<span class="info-value" style="color: {tierColor}">{rate.toFixed(2)}%</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.leverage {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.leverage.compact {
		gap: 4px;
	}

	.leverage-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.leverage-label {
		font-family: var(--ds-font-display);
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--app-text-secondary);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.leverage-value-wrap {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.leverage-value {
		font-size: 1.1rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		font-family: var(--ds-font-mono);
	}

	.slider-track-container {
		position: relative;
		padding: 8px 0;
	}

	.leverage-slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 6px;
		border-radius: 3px;
		background: linear-gradient(
			to right,
			var(--track-color) 0%,
			var(--track-color) var(--fill),
			var(--app-border) var(--fill),
			var(--app-border) 100%
		);
		outline: none;
		cursor: pointer;
	}

	.leverage-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--app-text-primary);
		border: 3px solid var(--track-color);
		cursor: pointer;
		transition: box-shadow 0.2s;
	}

	.leverage-slider::-webkit-slider-thumb:hover {
		box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.08);
	}

	.leverage-slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--app-text-primary);
		border: 3px solid var(--track-color);
		cursor: pointer;
	}

	.tier-markers {
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.tier-mark {
		position: absolute;
		width: 2px;
		height: 12px;
		background: var(--app-text-muted);
		transform: translate(-50%, -50%);
		opacity: 0.3;
	}

	.tier-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.7rem;
		color: var(--app-text-muted);
		padding: 0 2px;
	}

	.leverage-info {
		display: flex;
		justify-content: space-between;
		padding: 10px 14px;
		border-radius: var(--app-radius-sm);
		border: 1px solid;
		margin-top: 4px;
	}

	.info-row {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.info-label {
		font-size: 0.7rem;
		color: var(--app-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.info-value {
		font-size: 0.95rem;
		font-weight: 600;
		font-family: var(--ds-font-mono);
	}
</style>
