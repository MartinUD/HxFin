<script lang="ts">
	import { COST_KIND_OPTIONS, DEFAULT_COLOR, PERIOD_OPTIONS } from '$lib/budget';
	import ToggleGroup from '$lib/components/ToggleGroup.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { toUserMessage } from '$lib/effect/errors';
	import type {
		BudgetCategory,
		CreateRecurringCostInput,
		RecurringCost,
		RecurringCostKind,
		RecurrencePeriod,
		UpdateRecurringCostInput,
	} from '$lib/schema/budget';
	import { createRecurringCost, updateRecurringCost } from '../api';

	interface Props {
		categories: BudgetCategory[];
		selectedCategoryFilter: string[];
		onSaved: () => void | Promise<void>;
		onError: (message: string) => void;
	}

	interface CostForm {
		id: string;
		name: string;
		amount: number;
		period: RecurrencePeriod;
		kind: RecurringCostKind;
		categoryId: string;
		isEssential: boolean;
		isActive: boolean;
	}

	let { categories, selectedCategoryFilter, onSaved, onError }: Props = $props();

	let dialogOpen = $state(false);
	let mode = $state<'add' | 'edit'>('add');
	let submitting = $state(false);
	let form = $state<CostForm>(createEmptyForm());

	let costDialogCategoryName = $derived(
		categories.find((category) => category.id === form.categoryId)?.name ?? '',
	);

	function createEmptyForm(defaultCategoryId = ''): CostForm {
		return {
			id: '',
			name: '',
			amount: 0,
			period: 'monthly',
			kind: 'expense',
			categoryId: defaultCategoryId,
			isEssential: false,
			isActive: true,
		};
	}

	function createFormFromCost(cost: RecurringCost): CostForm {
		return {
			id: cost.id,
			name: cost.name,
			amount: cost.amount,
			period: cost.period,
			kind: cost.kind,
			categoryId: cost.categoryId,
			isEssential: cost.kind === 'investment' ? false : cost.isEssential,
			isActive: cost.isActive,
		};
	}

	function normalizeForm(nextForm: CostForm): CostForm {
		return {
			...nextForm,
			name: nextForm.name.trim(),
			isEssential: nextForm.kind === 'investment' ? false : nextForm.isEssential,
		};
	}

	function isValid(nextForm: CostForm): boolean {
		return nextForm.name.trim().length > 0 && nextForm.amount > 0 && nextForm.categoryId.length > 0;
	}

	function toCreatePayload(nextForm: CostForm): CreateRecurringCostInput {
		const normalized = normalizeForm(nextForm);

		return {
			name: normalized.name,
			amount: normalized.amount,
			period: normalized.period,
			kind: normalized.kind,
			categoryId: normalized.categoryId,
			isEssential: normalized.isEssential,
			startDate: new Date().toISOString().split('T')[0],
			endDate: null,
			isActive: true,
		};
	}

	function toUpdatePayload(nextForm: CostForm): UpdateRecurringCostInput {
		const normalized = normalizeForm(nextForm);

		return {
			name: normalized.name,
			amount: normalized.amount,
			period: normalized.period,
			kind: normalized.kind,
			categoryId: normalized.categoryId,
			isEssential: normalized.isEssential,
			isActive: normalized.isActive,
		};
	}

	export function openAdd(): void {
		const defaultCategoryId =
			selectedCategoryFilter.find((categoryId) => categoryId !== 'all') ?? (categories[0]?.id ?? '');
		mode = 'add';
		form = createEmptyForm(defaultCategoryId);
		dialogOpen = true;
	}

	export function openEdit(cost: RecurringCost): void {
		mode = 'edit';
		form = createFormFromCost(cost);
		dialogOpen = true;
	}

	export function close(): void {
		dialogOpen = false;
		mode = 'add';
		submitting = false;
		form = createEmptyForm();
	}

	async function handleSubmit(): Promise<void> {
		const normalized = normalizeForm(form);
		form = normalized;
		if (!isValid(normalized)) {
			return;
		}

		submitting = true;

		try {
			if (mode === 'add') {
				await createRecurringCost(fetch, toCreatePayload(normalized));
			} else if (normalized.id) {
				await updateRecurringCost(fetch, normalized.id, toUpdatePayload(normalized));
			}

			close();
			await onSaved();
		} catch (error) {
			onError(toUserMessage(error, mode === 'add' ? 'Failed to add cost' : 'Failed to update cost'));
		} finally {
			submitting = false;
		}
	}

</script>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="bg-card border-border sm:max-w-[440px]">
		<Dialog.Header>
			<Dialog.Title class="text-foreground">{mode === 'add' ? 'Add Cost' : 'Edit Cost'}</Dialog.Title>
			<Dialog.Description class="text-muted-foreground text-sm">
				{mode === 'add' ? 'Add a new recurring expense.' : 'Update this recurring expense.'}
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-4 py-2">
			<div class="flex flex-col gap-1.5">
				<Label class="text-xs uppercase tracking-wide text-muted-foreground">Name</Label>
				<Input
					bind:value={form.name}
					placeholder="e.g. Netflix"
					class="bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label class="text-xs uppercase tracking-wide text-muted-foreground">Amount</Label>
				<Input
					type="number"
					min="0"
					step="0.01"
					bind:value={form.amount}
					placeholder="0"
					class="bg-muted border-border text-foreground focus-visible:border-primary focus-visible:ring-primary/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<ToggleGroup label="Period" options={[...PERIOD_OPTIONS]} bind:value={form.period} />
			</div>

			<div class="flex flex-col gap-1.5">
				<ToggleGroup
					label="Type"
					options={[...COST_KIND_OPTIONS]}
					bind:value={form.kind}
					onValueChange={(nextKind) => {
						form.kind = nextKind as RecurringCostKind;
						if (form.kind === 'investment') {
							form.isEssential = false;
						}
					}}
				/>
			</div>

			<div class="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2">
				<div class="flex flex-col">
					<Label class="text-xs uppercase tracking-wide text-muted-foreground">Essential</Label>
					<p class="text-xs text-muted-foreground">
						{form.kind === 'investment'
							? 'Essential is only used for expenses'
							: 'Mark as must-pay monthly baseline'}
					</p>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={form.isEssential}
					aria-label="Essential recurring cost"
					class="essential-switch"
					class:essential-switch-on={form.isEssential}
					disabled={form.kind === 'investment'}
					onclick={() => (form.isEssential = !form.isEssential)}
				>
					<span
						class="essential-switch-thumb"
						class:essential-switch-thumb-on={form.isEssential}
					></span>
				</button>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label class="text-xs uppercase tracking-wide text-muted-foreground">Category</Label>
				<Select.Root
					type="single"
					value={form.categoryId}
					onValueChange={(value: string) => {
						form.categoryId = value ?? '';
					}}
				>
					<Select.Trigger class="w-full bg-muted border-border text-foreground">
						{costDialogCategoryName || 'Select category'}
					</Select.Trigger>
					<Select.Content class="bg-card border-border">
						{#each categories as category (category.id)}
							<Select.Item value={category.id} class="text-foreground cursor-pointer">
								<span class="flex items-center gap-2">
									<span
										class="w-2.5 h-2.5 rounded-full flex-shrink-0"
										style="background: {category.color ?? DEFAULT_COLOR}"
									></span>
									{category.name}
								</span>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="ghost" onclick={close} class="text-muted-foreground">Cancel</Button>
			<Button
				onclick={handleSubmit}
				disabled={submitting || !isValid(form)}
				class="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
			>
				{mode === 'add' ? 'Add Cost' : 'Save'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.essential-switch {
		position: relative;
		display: inline-flex;
		align-items: center;
		width: 44px;
		height: 24px;
		border-radius: 999px;
		border: 1px solid var(--app-border);
		background: rgba(0, 0, 0, 0.55);
		transition:
			background-color 0.16s var(--ds-ease),
			border-color 0.16s var(--ds-ease);
		padding: 2px;
	}

	.essential-switch:hover {
		border-color: var(--app-border-focus);
	}

	.essential-switch:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.essential-switch:focus-visible {
		outline: none;
		border-color: color-mix(in oklab, var(--app-accent) 55%, var(--app-border));
		box-shadow: 0 0 0 3px var(--app-accent-glow);
	}

	.essential-switch-on {
		background: color-mix(in oklab, var(--app-accent) 26%, rgba(0, 0, 0, 0.7));
		border-color: color-mix(in oklab, var(--app-accent) 70%, var(--app-border));
	}

	.essential-switch-thumb {
		display: inline-block;
		width: 18px;
		height: 18px;
		border-radius: 999px;
		background: var(--app-text-secondary);
		transform: translateX(0);
		transition:
			transform 0.16s var(--ds-ease),
			background-color 0.16s var(--ds-ease);
	}

	.essential-switch-thumb-on {
		transform: translateX(20px);
		background: var(--app-accent-light);
	}
</style>
