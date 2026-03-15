<script lang="ts">
	import InputField from '$lib/components/InputField.svelte';
	import LeverageSlider from '$lib/components/LeverageSlider.svelte';
	import SalaryGrowth from '$lib/components/SalaryGrowth.svelte';

	interface Props {
		startCapital: number;
		monthlySaving: number;
		monthlySalary: number;
		salaryGrowth: number;
		kommunalskatt: number;
		savingsShareOfRaise: number;
		avgReturn: number;
		leverage: number;
		years: number;
		withdrawalRate: number;
		profileSavePending?: boolean;
		profileSaveMessage?: string | null;
		onUsePortfolioTotal?: () => void;
		onSaveIncomeProfile?: () => void;
	}

	let {
		startCapital = $bindable(),
		monthlySaving = $bindable(),
		monthlySalary = $bindable(),
		salaryGrowth = $bindable(),
		kommunalskatt = $bindable(),
		savingsShareOfRaise = $bindable(),
		avgReturn = $bindable(),
		leverage = $bindable(),
		years = $bindable(),
		withdrawalRate = $bindable(),
		profileSavePending = false,
		profileSaveMessage = null,
		onUsePortfolioTotal = undefined,
		onSaveIncomeProfile = undefined
	}: Props = $props();
</script>

<div class="settings-panel">
	<div class="settings-header">
		<h2 class="settings-title">Projection</h2>
	</div>

	<div class="settings-body">
		<div class="section-divider"></div>
		<div class="section-fields">
			<div class="start-capital-row">
				<div class="start-capital-field">
					<InputField label="Startbelopp" bind:value={startCapital} suffix="kr" step={10000} />
				</div>
				<button class="inline-action-btn" type="button" onclick={onUsePortfolioTotal}>
					Use Portfolio
				</button>
			</div>
			<InputField label="Månadsparande" bind:value={monthlySaving} suffix="kr" step={500} />
			<InputField label="FIRE om" bind:value={years} min={1} max={50} suffix="år" />
			<InputField
				label="Avkastning"
				bind:value={avgReturn}
				suffix="%"
				step={0.5}
				min={0}
				max={30}
			/>
			<LeverageSlider bind:value={leverage} compact={true} />
		</div>

		<div class="section-divider"></div>
		<div class="section-fields">
			<SalaryGrowth
				bind:monthlySalary
				bind:salaryGrowth
				bind:kommunalskatt
				bind:savingsShareOfRaise
				{monthlySaving}
			/>
		</div>

		<div class="section-divider"></div>
		<div class="section-fields section-fields-compact">
			<InputField
				label="Årligt uttag"
				bind:value={withdrawalRate}
				min={0.5}
				max={10}
				step={0.1}
				suffix="%"
			/>
			<div class="profile-actions">
				<button type="button" class="profile-save-btn" onclick={onSaveIncomeProfile} disabled={profileSavePending}>
					{profileSavePending ? 'Saving...' : 'Save Income Profile'}
				</button>
				{#if profileSaveMessage}
					<p class="profile-save-message">{profileSaveMessage}</p>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.settings-panel {
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--ds-glass-border);
		overflow: hidden;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.006)),
			color-mix(in oklab, var(--ds-bg-1) 94%, rgba(12, 20, 14, 0.12));
	}

	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.7rem 1rem 0.55rem;
		border-bottom: 1px solid var(--ds-glass-border);
		flex-shrink: 0;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.008)),
			color-mix(in oklab, var(--ds-glass-surface) 78%, transparent);
	}

	.settings-title {
		font-family: var(--ds-font-display);
		font-size: 1rem;
		font-weight: 700;
		color: var(--app-text-primary);
		letter-spacing: -0.01em;
		margin: 0;
	}

	.settings-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.55rem 1rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.section-fields {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.start-capital-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: end;
	}

	.start-capital-field {
		min-width: 0;
	}

	.section-fields-compact {
		gap: 0.8rem;
	}

	.section-divider {
		height: 1px;
		background: color-mix(in oklab, var(--ds-glass-border) 72%, transparent);
	}

	.profile-actions {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 0.1rem;
	}

	.inline-action-btn,
	.profile-save-btn {
		padding: 0.8rem 0.95rem;
		border-radius: 0.85rem;
		border: 1px solid var(--ds-glass-border);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.16));
		color: var(--app-text-primary);
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.16s var(--ds-ease);
	}

	.profile-save-btn {
		width: 100%;
	}

	.inline-action-btn:hover,
	.profile-save-btn:hover:enabled {
		border-color: color-mix(in oklab, var(--app-accent) 50%, var(--ds-glass-border));
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
			color-mix(in oklab, var(--ds-glass-surface) 88%, rgba(12, 20, 14, 0.1));
	}

	.profile-save-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.profile-save-message {
		font-size: 0.72rem;
		color: var(--app-text-muted);
	}

	@media (max-width: 980px) {
		.settings-panel {
			border-right: none;
			border-bottom: 1px solid var(--ds-glass-border);
		}

		.settings-body {
			max-height: 48vh;
		}
	}

	@media (max-width: 640px) {
		.start-capital-row {
			grid-template-columns: 1fr;
		}
	}
</style>
