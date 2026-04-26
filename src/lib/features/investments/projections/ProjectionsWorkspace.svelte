<script lang="ts">
	import type * as Effect from 'effect/Effect';
	import { browser } from '$app/environment';
	import { type ApiClient, withApiClient } from '$lib/api/client';
	import { calculate } from '$lib/features/investments/projections';
	import ResultsPanel from '$lib/features/investments/projections/local-components/ResultsPanel.svelte';
	import SettingsPanel from '$lib/features/investments/projections/local-components/SettingsPanel.svelte';
	import { toUserMessage } from '$lib/effect/errors';
	import { runUiEffect } from '$lib/effect/runtime/browser';
	import type { InvestmentAccount, InvestmentHolding } from '$lib/schema/investments';
	import type { FinancialProfile } from '$lib/schema/finance';

	interface Props {
		data: {
			profile: FinancialProfile;
			accounts: InvestmentAccount[];
			holdings: InvestmentHolding[];
		};
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
	let hydratedFromProfile = $state(false);
	let hasInitializedStartCapital = $state(false);

	const PROJECTION_PRESET_KEY = 'fin:investments:projection-preset';

	let portfolioTotal = $derived.by(() => {
		const accounts = (data.accounts ?? []) as InvestmentAccount[];
		const holdings = (data.holdings ?? []) as InvestmentHolding[];
		const overallHoldingsTotal = holdings.reduce((sum, h) => sum + h.currentValue, 0);
		const overallAccountRecordedTotal = accounts.reduce((sum, a) => sum + a.totalValue, 0);
		return overallHoldingsTotal > 0 ? overallHoldingsTotal : overallAccountRecordedTotal;
	});

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
		if (hydratedFromProfile) return;
		monthlySalary = data.profile.monthlySalary;
		salaryGrowth = data.profile.salaryGrowth;
		kommunalskatt = data.profile.municipalTaxRate;
		savingsShareOfRaise = data.profile.savingsShareOfRaise;
		hydratedFromProfile = true;
	});

	$effect(() => {
		if (hasInitializedStartCapital) return;
		if (portfolioTotal > 0) {
			startCapital = Math.round(portfolioTotal);
			hasInitializedStartCapital = true;
		}
	});

	$effect(() => {
		if (retirementYear !== years) {
			retirementYear = years;
		}
	});

	function apiRun<A, E, R>(work: (client: ApiClient) => Effect.Effect<A, E, R>): Promise<A> {
		return runUiEffect(withApiClient(fetch, work));
	}

	function setStartCapitalFromPortfolio(): void {
		if (portfolioTotal > 0) startCapital = Math.round(portfolioTotal);
	}

	function loadProjectionPreset(): void {
		if (!browser) return;
		const raw = window.localStorage.getItem(PROJECTION_PRESET_KEY);
		if (!raw) return;

		try {
			const preset = JSON.parse(raw) as Record<string, number | string>;
			startCapital = Number(preset.startCapital ?? startCapital);
			monthlySaving = Number(preset.monthlySaving ?? monthlySaving);
			monthlySalary = Number(preset.monthlySalary ?? monthlySalary);
			salaryGrowth = Number(preset.salaryGrowth ?? salaryGrowth);
			kommunalskatt = Number(preset.kommunalskatt ?? kommunalskatt);
			savingsShareOfRaise = Number(preset.savingsShareOfRaise ?? savingsShareOfRaise);
			avgReturn = Number(preset.avgReturn ?? avgReturn);
			leverage = Number(preset.leverage ?? leverage);
			years = Number(preset.years ?? years);
			withdrawalRate = Number(preset.withdrawalRate ?? withdrawalRate);
		} catch {
			window.localStorage.removeItem(PROJECTION_PRESET_KEY);
		}
	}

	async function saveIncomeProfile(): Promise<void> {
		profileSavePending = true;
		profileSaveMessage = null;
		try {
			await apiRun((client) =>
				client.finance.updateFinancialProfile({
					payload: {
						monthlySalary,
						salaryGrowth,
						municipalTaxRate: kommunalskatt,
						savingsShareOfRaise
					}
				})
			);
			profileSaveMessage = 'Income profile saved';
		} catch (error) {
			profileSaveMessage = toUserMessage(error, 'Failed to save income profile');
		} finally {
			profileSavePending = false;
		}
	}

	if (browser) {
		loadProjectionPreset();
	}
</script>

<div class="projections-fullscreen">
	<div class="calculator-shell">
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
			onUsePortfolioTotal={setStartCapitalFromPortfolio}
			onSaveIncomeProfile={saveIncomeProfile}
		/>
		<ResultsPanel {results} {retirementYear} {withdrawalRate} />
	</div>
</div>

<style>
	.projections-fullscreen {
		height: 100dvh;
		overflow: hidden;
		padding: 14px 16px 18px;
	}

	.calculator-shell {
		display: grid;
		grid-template-columns: 320px minmax(0, 1fr);
		min-height: 0;
		height: 100%;
		overflow: hidden;
		background:
			linear-gradient(180deg, var(--ds-glass-bg-strong), var(--ds-glass-bg)),
			var(--ds-glass-surface);
		backdrop-filter: blur(var(--ds-glass-blur));
		border-radius: var(--ds-radius-lg);
		border: 1px solid var(--ds-glass-border);
		box-shadow: var(--ds-glass-shadow), inset 0 1px 0 var(--ds-glass-edge);
	}

	@media (max-width: 980px) {
		.calculator-shell {
			grid-template-columns: 1fr;
			min-height: 0;
		}
	}
</style>
