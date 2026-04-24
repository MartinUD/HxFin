<script lang="ts">
	import {
		BarController,
		BarElement,
		CategoryScale,
		Chart,
		Filler,
		Legend, 
		LinearScale,
		LineController,
		LineElement,
		PointElement,
		Tooltip
	} from 'chart.js';
	import { onDestroy, onMount } from 'svelte';
	import type { YearResult } from '$lib/calculator';
	import { formatNumber } from '$lib/calculator';

	Chart.register(
		LineController,
		BarController,
		LineElement,
		BarElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Filler,
		Tooltip,
		Legend
	);

	interface Props {
		results: YearResult[];
		retirementYear?: number;
	}

	let { results, retirementYear = 0 }: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	function withAlpha(color: string, alpha: number): string {
		const c = color.trim();
		const rgb = c.match(/^rgb\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*\)$/i);
		if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;

		const rgba = c.match(/^rgba\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)[,\s]+[\d.]+\s*\)$/i);
		if (rgba) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${alpha})`;

		const hex = c.replace('#', '');
		if (/^[0-9a-f]{6}$/i.test(hex)) {
			const r = Number.parseInt(hex.slice(0, 2), 16);
			const g = Number.parseInt(hex.slice(2, 4), 16);
			const b = Number.parseInt(hex.slice(4, 6), 16);
			return `rgba(${r}, ${g}, ${b}, ${alpha})`;
		}
		return c;
	}

	function buildChart() {
		if (chart) chart.destroy();
		if (!canvas || results.length === 0) return;

		const styles = getComputedStyle(document.documentElement);
		const fontBody = styles.getPropertyValue('--ds-font-body').trim() || 'sans-serif';
		const textStrong = styles.getPropertyValue('--app-text-primary').trim() || '#f0f0f0';
		const textSoft = styles.getPropertyValue('--app-text-secondary').trim() || '#8a8a8a';
		const textFaint = styles.getPropertyValue('--app-text-muted').trim() || '#5d5d5d';
		const border = styles.getPropertyValue('--app-border').trim() || '#2a2a2a';
		const bgCard = styles.getPropertyValue('--app-bg-card').trim() || '#1a1a1a';
		const accent = styles.getPropertyValue('--app-accent').trim() || '#22c55e';
		const info = styles.getPropertyValue('--app-cyan').trim() || '#06b6d4';

		const labels = results.map((r) => `År ${r.year}`);
		const retirementIndex = Math.max(0, labels.findIndex((_l, i) => results[i]?.year === retirementYear));

		const startCapitalData = results.map((r) => r.startCapital);
		const monthlyDepositsData = results.map((r) => r.monthlyDeposits);
		const netReturnsData = results.map((r) => r.returns - r.leverageCost);
		const totalData = results.map((r) => r.totalValue);

		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels,
				datasets: [
					{
						type: 'line',
						label: 'Totalt värde',
						data: totalData,
						borderColor: textStrong,
						backgroundColor: 'transparent',
						borderWidth: 2,
						pointRadius: (ctx) => (ctx.dataIndex === retirementIndex ? 4 : 0),
						pointHoverRadius: 5,
						pointBackgroundColor: (ctx) => (ctx.dataIndex === retirementIndex ? accent : textStrong),
						pointHoverBackgroundColor: textStrong,
						tension: 0.3,
						order: 0
					},
					{
						type: 'bar',
						label: 'Startbelopp',
						data: startCapitalData,
						backgroundColor: 'oklch(0.35 0.06 155)',
						borderColor: 'transparent',
						borderWidth: 0,
						borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 3, bottomRight: 3 },
						stack: 'stack',
						order: 3
					},
					{
						type: 'bar',
						label: 'Insättningar',
						data: monthlyDepositsData,
						backgroundColor: 'oklch(0.55 0.14 152)',
						borderColor: 'transparent',
						borderWidth: 0,
						borderRadius: 0,
						stack: 'stack',
						order: 2
					},
					{
						type: 'bar',
						label: 'Avkastning (netto)',
						data: netReturnsData,
						backgroundColor: 'oklch(0.78 0.2 149)',
						borderColor: 'transparent',
						borderWidth: 0,
						borderRadius: { topLeft: 3, topRight: 3, bottomLeft: 0, bottomRight: 0 },
						stack: 'stack',
						order: 1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					legend: {
						display: true,
						position: 'top',
						align: 'end',
						labels: {
							color: textSoft,
							font: { family: fontBody, size: 11, weight: 600 },
							boxWidth: 12,
							boxHeight: 12,
							borderRadius: 3,
							useBorderRadius: true,
							padding: 16
						}
					},
					tooltip: {
						backgroundColor: bgCard,
						titleColor: textStrong,
						bodyColor: textSoft,
						borderColor: border,
						borderWidth: 1,
						padding: 12,
						cornerRadius: 8,
						titleFont: { family: fontBody, size: 13, weight: 700 },
						bodyFont: { family: fontBody, size: 12 },
						callbacks: {
							label: (ctx) => {
								const i = ctx.dataIndex;
								if (ctx.datasetIndex === 0)
									return ` Totalt värde: ${formatNumber(totalData[i])} kr`;
								if (ctx.datasetIndex === 1)
									return ` Startbelopp: ${formatNumber(startCapitalData[i])} kr`;
								if (ctx.datasetIndex === 2)
									return ` Insättningar: ${formatNumber(monthlyDepositsData[i])} kr`;
								return ` Avkastning (netto): ${formatNumber(netReturnsData[i])} kr`;
							}
						}
					}
				},
				scales: {
					x: {
						stacked: true,
						grid: { color: withAlpha(border, 0.5), lineWidth: 0.5 },
						ticks: {
							color: textFaint,
							font: { family: fontBody, size: 11, weight: 600 },
							maxRotation: 0,
							autoSkip: true,
							maxTicksLimit: 15
						},
						border: { display: false }
					},
					y: {
						stacked: true,
						grid: { color: withAlpha(border, 0.5), lineWidth: 0.5 },
						ticks: {
							color: textFaint,
							font: { family: fontBody, size: 11, weight: 600 },
							callback: (v) => {
								const num = v as number;
								if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
								if (num >= 1_000) return `${(num / 1_000).toFixed(0)}k`;
								return `${num}`;
							}
						},
						border: { display: false }
					}
				}
			}
		});
	}

	onMount(() => {
		buildChart();
	});

	$effect(() => {
		results;
		retirementYear;
		buildChart();
	});

	onDestroy(() => {
		if (chart) chart.destroy();
	});
</script>

<div class="chart-container">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.chart-container {
		position: relative;
		width: 100%;
		height: 100%;
		padding: 16px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.16));
		border: 1px solid var(--ds-glass-border);
		border-radius: var(--ds-radius);
	}
</style>
