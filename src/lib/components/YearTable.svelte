<script lang="ts">
	import type { YearResult } from '$lib/calculator';
	import { formatNumber } from '$lib/calculator';

	interface Props {
		results: YearResult[];
		retirementYear: number;
	}

	let { results, retirementYear }: Props = $props();

</script>

<div class="table-wrap">
	<div class="table-header">
		<h3>Årlig utveckling</h3>
	</div>
	<div class="table-scroll">
		<table>
			<thead>
				<tr>
					<th>År</th>
					<th>Månadsspar</th>
					<th>Insättningar</th>
					<th>Avkastning</th>
					<th>Hävstångskostnad</th>
					<th>Totalt</th>
				</tr>
			</thead>
			<tbody>
				{#each results as row}
					<tr class:retirement={row.year === retirementYear}>
						<td class="year-cell">
							{row.year}
							{#if row.year === retirementYear}
								<span class="fire-badge">FIRE</span>
							{/if}
						</td>
						<td>{formatNumber(row.monthlySaving)} kr</td>
						<td>{formatNumber(row.deposits)} kr</td>
						<td class="green">{formatNumber(row.returns)} kr</td>
						<td class="red">{row.leverageCost > 0 ? `-${formatNumber(row.leverageCost)} kr` : '—'}</td>
						<td class="total">{formatNumber(row.totalValue)} kr</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.table-wrap {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.008)),
			color-mix(in oklab, var(--ds-glass-surface) 86%, transparent);
		border: 1px solid var(--ds-glass-border);
		border-radius: 0.95rem;
		overflow: hidden;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.table-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.95rem 1.15rem;
		border-bottom: 1px solid var(--ds-glass-border);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 82%, transparent);
	}

	h3 {
		font-family: var(--ds-font-display);
		font-size: 0.74rem;
		font-weight: 700;
		color: var(--app-text-primary);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin: 0;
	}

.table-scroll {
		overflow-x: auto;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.94rem;
		font-variant-numeric: tabular-nums;
		font-family: var(--ds-font-mono);
	}

	thead {
		position: sticky;
		top: 0;
		z-index: 2;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.12));
	}

	th {
		padding: 0.95rem 1.15rem;
		text-align: right;
		font-family: var(--ds-font-display);
		font-weight: 700;
		font-size: 0.74rem;
		color: var(--app-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		white-space: nowrap;
	}

	th:first-child {
		text-align: left;
	}

	td {
		padding: 0.95rem 1.15rem;
		text-align: right;
		color: var(--app-text-secondary);
		border-bottom: 1px solid color-mix(in oklab, var(--ds-glass-border) 70%, transparent);
		white-space: nowrap;
	}

	td:first-child {
		text-align: left;
	}

	.year-cell {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--app-text-primary);
		font-weight: 700;
		font-family: var(--ds-font-body);
	}

	.fire-badge {
		font-size: 0.62rem;
		font-weight: 700;
		background: color-mix(in oklab, var(--app-amber) 18%, transparent);
		color: var(--app-amber);
		padding: 0.2rem 0.45rem;
		border-radius: 999px;
		border: 1px solid color-mix(in oklab, var(--app-amber) 36%, transparent);
		letter-spacing: 0.05em;
	}

	tr.retirement {
		background: color-mix(in oklab, var(--app-amber) 8%, transparent);
	}

	.green {
		color: var(--app-green);
	}

	.red {
		color: var(--app-red);
	}

	.total {
		color: var(--app-text-primary);
		font-weight: 600;
	}

	tbody tr:hover {
		background: color-mix(in oklab, var(--ds-glass-surface) 78%, rgba(255, 255, 255, 0.02));
	}

	tr.retirement:hover {
		background: var(--app-amber-glow);
	}
</style>
