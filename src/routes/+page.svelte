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

<style>
	.page-shell {
		display: grid;
		grid-template-columns: 276px minmax(0, 1fr);
		height: 100%;
		overflow: hidden;
	}

	@media (max-width: 980px) {
		.page-shell {
			grid-template-columns: 1fr;
			height: auto;
			min-height: 100%;
		}
	}
</style>
