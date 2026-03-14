<script lang="ts">
	import type { YearResult } from '$lib/calculator';
	import { calculateFireMonthly, formatCurrency, formatNumber } from '$lib/calculator';
	import Chart from '$lib/components/Chart.svelte';

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

	<div class="fire-strip">
		<span class="fire-strip-label">FIRE</span>
		<span class="fire-strip-sep">·</span>
		<span class="fire-strip-item">År <span class="fire-val">{retirementYear}</span></span>
		<span class="fire-strip-sep">·</span>
		<span class="fire-strip-item">
			{withdrawalRate}% → <span class="fire-val">{formatCurrency(monthlyWithdrawal)}/mån</span>
		</span>
		<span class="fire-strip-sep">·</span>
		<span class="fire-strip-item">
			Portfölj <span class="fire-val">{formatPortfolio(portfolioAtRetirement)}</span>
		</span>
		<span class="fire-strip-sep">·</span>
		<span class="fire-strip-item">Insättningar <span class="fire-val">{yearsOfSavings}%</span></span>
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
		background:
			radial-gradient(100% 65% at 50% -10%, color-mix(in oklab, var(--app-accent) 6%, transparent), transparent 62%),
			transparent;
	}

	.chart-wrap {
		flex: 1;
		min-height: 0;
		border-radius: 1rem;
		overflow: hidden;
		border: 1px solid var(--ds-glass-border);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.006)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, transparent);
	}

	.fire-strip {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0.85rem 1rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 88%, rgba(245, 158, 11, 0.06));
		border: 1px solid color-mix(in oklab, var(--app-amber) 22%, var(--ds-glass-border));
		border-radius: 0.95rem;
		font-size: 0.9rem;
		color: var(--app-text-secondary);
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.fire-strip-label {
		font-family: var(--ds-font-display);
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--app-amber);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.fire-strip-sep {
		color: var(--app-text-muted);
	}

	.fire-val {
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
