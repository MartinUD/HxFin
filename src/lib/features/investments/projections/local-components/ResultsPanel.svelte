<script lang="ts">
	import type { YearResult } from '$lib/features/investments/projections';
	import { calculateFireMonthly, formatCurrency, formatNumber } from '$lib/features/investments/projections';
	import Chart from '$lib/features/investments/projections/local-components/Chart.svelte';

	interface Props {
		results: YearResult[];
		retirementYear: number;
		withdrawalRate: number;
	}

	let { results, retirementYear, withdrawalRate }: Props = $props();

	let retirementResult = $derived(results.find((r) => r.year === retirementYear));
	let portfolioAtRetirement = $derived(retirementResult?.totalValue ?? 0);
	let monthlyWithdrawal = $derived(calculateFireMonthly(portfolioAtRetirement, withdrawalRate));
	let yearsOfSavings = $derived(
		retirementResult ? Math.round((retirementResult.deposits / retirementResult.totalValue) * 100) : 0
	);

	function formatPortfolio(value: number): string {
		if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M kr`;
		if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k kr`;
		return `${formatNumber(Math.round(value))} kr`;
	}
</script>

<div class="results-panel">
	<div class="chart-wrap">
		<Chart {results} {retirementYear} />
	</div>

	<div class="results-strip">
		<span class="results-strip-item">År <span class="results-val">{retirementYear}</span></span>
		<span class="results-strip-sep">·</span>
		<span class="results-strip-item">
			{withdrawalRate}% → <span class="results-val">{formatCurrency(monthlyWithdrawal)}/mån</span>
		</span>
		<span class="results-strip-sep">·</span>
		<span class="results-strip-item">
			Portfölj <span class="results-val">{formatPortfolio(portfolioAtRetirement)}</span>
		</span>
		<span class="results-strip-sep">·</span>
		<span class="results-strip-item">Insättningar <span class="results-val">{yearsOfSavings}%</span></span>
	</div>
</div>

<style>
	.results-panel {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 1rem 1.1rem 1.1rem;
		height: 100%;
		overflow: hidden;
		background: transparent;
	}

	.chart-wrap {
		flex: 1;
		min-height: 0;
		border-radius: 1rem;
		overflow: hidden;
		border: 1px solid var(--ds-glass-border);
		background: transparent;
	}

	.results-strip {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0.85rem 1rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.14));
		border: 1px solid var(--ds-glass-border);
		border-radius: 0.95rem;
		font-size: 0.9rem;
		color: var(--app-text-secondary);
		flex-shrink: 0;
		flex-wrap: wrap;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.results-strip-sep {
		color: var(--app-text-muted);
	}

	.results-strip-item {
		font-size: 0.9rem;
		color: var(--app-text-secondary);
	}

	.results-val {
		color: var(--app-text-primary);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		font-family: var(--ds-font-mono);
	}

	@media (max-width: 980px) {
		.results-panel {
			overflow: visible;
		}
	}

	@media (max-width: 640px) {
		.results-panel {
			padding: 12px;
		}
	}
</style>
