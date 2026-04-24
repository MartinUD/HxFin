<script lang="ts">
	import type * as Effect from 'effect/Effect';
	import { type ApiClient, withApiClient } from '$lib/api/client';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { toUserMessage } from '$lib/effect/errors';
	import { runUiEffect } from '$lib/effect/runtime/browser';
	import type { FinancialProfile } from '$lib/schema/finance';

	interface Props {
		data: {
			profile: FinancialProfile;
		};
	}

	let { data }: Props = $props();

	// Single field for now — salary-growth / tax-rate / savings-share still
	// live on the profile in the DB (and the PUT payload is partial), so
	// they can be exposed later without a shape change.
	let hydrated = $state(false);
	let monthlySalary = $state(0);
	let pending = $state(false);
	let message = $state<string | null>(null);
	let messageTone = $state<'success' | 'error'>('success');

	$effect(() => {
		if (hydrated) return;
		monthlySalary = data.profile.monthlySalary;
		hydrated = true;
	});

	function apiRun<A, E, R>(work: (client: ApiClient) => Effect.Effect<A, E, R>): Promise<A> {
		return runUiEffect(withApiClient(fetch, work));
	}

	async function save(): Promise<void> {
		pending = true;
		message = null;

		try {
			await apiRun((client) =>
				client.finance.updateFinancialProfile({
					payload: { monthlySalary }
				})
			);
			messageTone = 'success';
			message = 'Income saved';
		} catch (error) {
			messageTone = 'error';
			message = toUserMessage(error, 'Failed to save income');
		} finally {
			pending = false;
		}
	}
</script>

<div class="app-page income-page">
	{#if message}
		<Alert.Root
			class={messageTone === 'error'
				? 'border-destructive/50 bg-destructive/10'
				: 'border-[var(--app-border)] bg-[var(--app-accent-glow)]'}
		>
			<Alert.Description
				class={messageTone === 'error'
					? 'flex items-center justify-between text-destructive text-xs'
					: 'flex items-center justify-between text-[var(--app-accent-light)] text-xs'}
			>
				{message}
				<button
					type="button"
					onclick={() => (message = null)}
					class="ml-4 opacity-60 hover:opacity-100 text-xs"
				>
					✕
				</button>
			</Alert.Description>
		</Alert.Root>
	{/if}

	<form
		class="income-form"
		onsubmit={(event) => {
			event.preventDefault();
			save();
		}}
	>
		<div class="form-field">
			<Label class="field-label">Monthly gross salary</Label>
			<Input
				type="number"
				min="0"
				step="100"
				bind:value={monthlySalary}
				class="bg-muted border-border text-foreground"
			/>
		</div>

		<div class="form-actions">
			<Button type="submit" class="app-action-btn" disabled={pending}>
				{pending ? 'Saving...' : 'Save'}
			</Button>
		</div>
	</form>
</div>

<style>
	.income-page {
		gap: 14px;
	}

	.income-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-width: 420px;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	:global(.field-label) {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--app-text-secondary);
	}

	.form-actions {
		margin-top: 4px;
	}
</style>
