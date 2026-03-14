<script lang="ts">
	interface Props {
		label: string;
		value: number;
		suffix?: string;
		min?: number;
		max?: number;
		step?: number;
		help?: string;
	}

	let {
		label,
		value = $bindable(),
		suffix = '',
		min = 0,
		max,
		step = 1,
		help = ''
	}: Props = $props();
</script>

<label class="field">
	<span class="field-label">
		{label}
		{#if help}
			<span class="help-icon" title={help}>?</span>
		{/if}
	</span>
	<div class="field-input-wrap">
		<input
			type="number"
			bind:value
			{min}
			{max}
			{step}
			class="field-input"
		/>
		{#if suffix}
			<span class="field-suffix">{suffix}</span>
		{/if}
	</div>
</label>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-family: var(--ds-font-display);
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--app-text-secondary);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.help-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--app-bg-input);
		border: 1px solid var(--app-border);
		color: var(--app-text-muted);
		font-size: 0.6rem;
		font-weight: 700;
		cursor: help;
		flex-shrink: 0;
		text-transform: none;
		letter-spacing: 0;
	}

	.field-input-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	.field-input {
		width: 100%;
		padding: 10px 14px;
		padding-right: 48px;
		background: var(--app-bg-input);
		border: 1px solid var(--app-border);
		border-radius: var(--app-radius-sm);
		color: var(--app-text-primary);
		font-size: 1rem;
		font-family: var(--ds-font-mono);
		font-weight: 500;
		transition: border-color 0.2s, box-shadow 0.2s;
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.field-input::-webkit-outer-spin-button,
	.field-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--app-border-focus);
		box-shadow: 0 0 0 3px var(--app-accent-glow);
	}

	.field-suffix {
		position: absolute;
		right: 14px;
		color: var(--app-text-muted);
		font-size: 0.85rem;
		font-weight: 500;
		font-family: var(--ds-font-display);
		pointer-events: none;
	}

</style>
