<script lang="ts">
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		label: string;
		options: Option[];
		value: string;
		onValueChange?: (value: string) => void;
	}

	let { label, options, value = $bindable(), onValueChange }: Props = $props();
</script>

<div class="toggle-group">
	<span class="toggle-label">{label}</span>
	<div class="toggle-options">
		{#each options as option (option.value)}
			<button
				type="button"
				class="toggle-btn"
				class:active={value === option.value}
				onclick={() => {
					value = option.value;
					onValueChange?.(option.value);
				}}
			>
				{option.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.toggle-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.toggle-label {
		font-family: var(--ds-font-display);
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--app-text-secondary);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.toggle-options {
		display: flex;
		background: var(--app-bg-input);
		border: 1px solid var(--app-border);
		border-radius: var(--app-radius-sm);
		overflow: hidden;
	}

	.toggle-btn {
		flex: 1;
		padding: 10px 16px;
		background: transparent;
		border: none;
		color: var(--app-text-muted);
		font-size: 0.85rem;
		font-weight: 600;
		font-family: var(--ds-font-body);
		cursor: pointer;
		transition: all 0.2s;
	}

	.toggle-btn:hover {
		color: var(--app-text-secondary);
	}

	.toggle-btn.active {
		background: var(--app-accent);
		color: #000;
	}
</style>
