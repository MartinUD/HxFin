<script lang="ts">
	import { onMount } from 'svelte';
	import { withApiClient } from '$lib/api/client';
	import { calculate } from '$lib/calculator';
	import ResultsPanel from '$lib/components/fire/ResultsPanel.svelte';
	import SettingsPanel from '$lib/components/fire/SettingsPanel.svelte';
	import { toUserMessage } from '$lib/effect/errors';
	import { runUiEffect } from '$lib/effect/runtime/browser';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let startCapital = $state(100000);
	let monthlySaving = $state(5000);
	let monthlySalary = $state(40000);
	let salaryGrowth = $state(6);
	let kommunalskatt = $state(32.41);
	let savingsShareOfRaise = $state(50);
	let avgReturn = $state(8);
	let leverage = $state(0);
	let years = $state(20);

	let retirementYear = $state(20);
	let withdrawalRate = $state(4);
	let profileSavePending = $state(false);
	let profileSaveMessage = $state<string | null>(null);

	let results = $derived(
		calculate({
			startCapital,
			monthlySaving,
			monthlySalary,
			salaryGrowth,
			kommunalskatt,
			savingsShareOfRaise,
			avgReturn,
			leverage,
			years
		})
	);

	$effect(() => {
		if (retirementYear !== years) {
			retirementYear = years;
		}
	});

	onMount(() => {
		monthlySalary = data.profile.monthlySalary;
		salaryGrowth = data.profile.salaryGrowth;
		kommunalskatt = data.profile.municipalTaxRate;
		savingsShareOfRaise = data.profile.savingsShareOfRaise;
	});

	async function saveIncomeProfile(): Promise<void> {
		profileSavePending = true;
		profileSaveMessage = null;

		try {
			await runUiEffect(
				withApiClient(fetch, (client) =>
					client.finance.updateFinancialProfile({
						payload: {
							monthlySalary,
							salaryGrowth,
							municipalTaxRate: kommunalskatt,
							savingsShareOfRaise
						}
					})
				)
			);
			profileSaveMessage = 'Income profile saved';
		} catch (error) {
			profileSaveMessage = toUserMessage(error, 'Failed to save income profile');
		} finally {
			profileSavePending = false;
		}
	}
</script>

<svelte:head>
	<title>FIRE Calc — FinDash</title>
</svelte:head>

<div class="app-page fire-page">
	<div class="app-toolbar">
		<div class="app-toolbar-left">
			<h1 class="app-page-title">FIRE Calculator</h1>
		</div>
	</div>
	<div class="page-shell">
		<SettingsPanel
			bind:startCapital
			bind:monthlySaving
			bind:monthlySalary
			bind:salaryGrowth
			bind:kommunalskatt
			bind:savingsShareOfRaise
			bind:avgReturn
			bind:leverage
			bind:years
			bind:withdrawalRate
			{profileSavePending}
			{profileSaveMessage}
			onSaveIncomeProfile={saveIncomeProfile}
		/>
		<ResultsPanel {results} {retirementYear} {withdrawalRate} />
	</div>
</div>

<style>
	.fire-page {
		gap: 10px;
	}

	.page-shell {
		display: grid;
		grid-template-columns: 276px minmax(0, 1fr);
		height: calc(100% - 0px);
		min-height: 0;
		overflow: hidden;
		border: 1px solid var(--ds-glass-border);
		border-radius: 14px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.008)),
			color-mix(in oklab, var(--ds-bg-1) 90%, rgba(12, 20, 14, 0.18));
		box-shadow: var(--ds-glass-shadow), inset 0 1px 0 var(--ds-glass-edge);
	}

	@media (max-width: 980px) {
		.page-shell {
			grid-template-columns: 1fr;
			height: auto;
			min-height: 100%;
		}
	}
</style>
