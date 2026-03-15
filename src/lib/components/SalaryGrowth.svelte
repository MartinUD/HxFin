<script lang="ts">
	import { formatNumber } from '$lib/calculator';
	import { calculateSwedishTax, netRaiseFromGrossRaise } from '$lib/tax';
	import InputField from './InputField.svelte';

	interface Props {
		monthlySalary: number;
		salaryGrowth: number;
		kommunalskatt: number;
		savingsShareOfRaise: number;
		monthlySaving: number;
	}

	let {
		monthlySalary = $bindable(),
		salaryGrowth = $bindable(),
		kommunalskatt = $bindable(),
		savingsShareOfRaise = $bindable(),
		monthlySaving
	}: Props = $props();

	// Current tax situation
	let currentTax = $derived(calculateSwedishTax(monthlySalary, kommunalskatt));

	// Preview: what happens after year 1
	let grossRaise = $derived(monthlySalary * (salaryGrowth / 100));
	let netRaise = $derived(netRaiseFromGrossRaise(monthlySalary, grossRaise, kommunalskatt));
	let taxOnRaise = $derived(grossRaise - netRaise);
	let monthlySavingsIncrease = $derived(netRaise * (savingsShareOfRaise / 100));
	let savingsYear2 = $derived(monthlySaving + monthlySavingsIncrease);

	let fillPercent = $derived(savingsShareOfRaise);
	let showPreview = $state(false);
</script>

<div class="salary-growth">
	<div class="fields">
		<InputField
			label="Månadslön (brutto)"
			bind:value={monthlySalary}
			suffix="kr"
			step={1000}
			help="Bruttolön före skatt"
		/>
		<div class="row-fields">
			<InputField
				label="Löneökning"
				bind:value={salaryGrowth}
				suffix="%"
				step={0.5}
				min={0}
				max={20}
				help="Årlig bruttohöjning"
			/>
			<InputField
				label="Kommunalskatt"
				bind:value={kommunalskatt}
				suffix="%"
				step={0.01}
				min={28}
				max={36}
				help="Snitt Sverige: 32.41%"
			/>
		</div>
	</div>

	<div class="share-section">
		<div class="share-header">
			<span class="share-label">Andel av nettohöjning till sparande</span>
			<span class="share-value">{savingsShareOfRaise}%</span>
		</div>
		<input
			type="range"
			bind:value={savingsShareOfRaise}
			min={0}
			max={100}
			step={5}
			class="share-slider"
			style="--fill: {fillPercent}%"
		/>
		<div class="share-labels">
			<span>0%</span>
			<span>50%</span>
			<span>100%</span>
		</div>
	</div>

	{#if grossRaise > 0}
		<button type="button" class="preview-toggle" onclick={() => showPreview = !showPreview}>
			Effekt efter år 1 {showPreview ? '▲' : '▼'}
		</button>
		{#if showPreview}
		<div class="preview">
			<div class="preview-title">
				<svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
				</svg>
				Effekt efter år 1
			</div>
			<div class="preview-rows">
				<div class="preview-row">
					<span>Bruttohöjning</span>
					<span class="preview-val">+{formatNumber(Math.round(grossRaise))} kr/mån</span>
				</div>
				<div class="preview-row dimmed">
					<span>Skatt (marginal {currentTax.marginalTaxRate}%)</span>
					<span class="preview-val red">-{formatNumber(Math.round(taxOnRaise))} kr/mån</span>
				</div>
				<div class="preview-row">
					<span>Nettohöjning</span>
					<span class="preview-val">+{formatNumber(Math.round(netRaise))} kr/mån</span>
				</div>
				<div class="preview-row">
					<span>Ökat sparande ({savingsShareOfRaise}%)</span>
					<span class="preview-val accent">+{formatNumber(Math.round(monthlySavingsIncrease))} kr/mån</span>
				</div>
				<div class="preview-row highlight">
					<span>Nytt månadsparande</span>
					<span class="preview-val">{formatNumber(Math.round(savingsYear2))} kr/mån</span>
				</div>
			</div>
		</div>
		{/if}
	{/if}
</div>

<style>
	.salary-growth {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.row-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.preview-toggle {
		background: transparent;
		border: 1px solid var(--app-border);
		color: var(--app-text-muted);
		font-size: 0.75rem;
		font-weight: 500;
		font-family: inherit;
		padding: 5px 10px;
		border-radius: var(--app-radius-sm);
		cursor: pointer;
		transition: all 0.15s;
		text-align: left;
	}

	.preview-toggle:hover {
		border-color: var(--app-accent);
		color: var(--app-accent-light);
	}

	.share-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.share-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.share-label {
		font-family: var(--ds-font-display);
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--app-text-secondary);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.share-value {
		font-size: 1rem;
		font-weight: 700;
		color: var(--app-accent-light);
		font-variant-numeric: tabular-nums;
		font-family: var(--ds-font-mono);
	}

	.share-slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 6px;
		border-radius: 3px;
		background: linear-gradient(
			to right,
			var(--app-accent) 0%,
			var(--app-accent) var(--fill),
			var(--app-border) var(--fill),
			var(--app-border) 100%
		);
		outline: none;
		cursor: pointer;
	}

	.share-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--app-text-primary);
		border: 3px solid var(--app-accent);
		cursor: pointer;
		transition: box-shadow 0.2s;
	}

	.share-slider::-webkit-slider-thumb:hover {
		box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.12);
	}

	.share-slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--app-text-primary);
		border: 3px solid var(--app-accent);
		cursor: pointer;
	}

	.share-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.7rem;
		color: var(--app-text-muted);
	}

	.preview {
		background: var(--app-bg-input);
		border: 1px solid var(--app-border);
		border-radius: var(--app-radius-sm);
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.preview-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--app-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.preview-rows {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.preview-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.82rem;
		color: var(--app-text-secondary);
	}

	.preview-row.dimmed {
		color: var(--app-text-muted);
	}

	.preview-row.highlight {
		padding-top: 6px;
		border-top: 1px solid var(--app-border);
		color: var(--app-text-primary);
		font-weight: 600;
	}

	.preview-val {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		font-family: var(--ds-font-mono);
	}

	.preview-val.accent {
		color: var(--app-accent-light);
	}

	.preview-val.red {
		color: var(--app-red);
	}
</style>
