<script lang="ts">
	import { COLOR_PALETTE, DEFAULT_COLOR, formatCurrency } from '$lib/budget';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { toUserMessage } from '$lib/effect/errors';
	import type { BudgetCategory } from '$lib/schema/budget';
	import {
		createBudgetCategory,
		deleteBudgetCategory,
		updateBudgetCategory,
	} from '../api';
	import type { CategoryFilter } from '../selectors';

	interface Props {
		categories: BudgetCategory[];
		summaryByCategory: Map<number, number>;
		selectedCategoryFilter: CategoryFilter[];
		onSaved: () => void | Promise<void>;
		onError: (message: string) => void;
		onCategoryDeleted: (categoryId: number) => void;
	}

	interface CategoryForm {
		name: string;
		description: string;
		color: string;
	}

	let {
		categories,
		summaryByCategory,
		selectedCategoryFilter,
		onSaved,
		onError,
		onCategoryDeleted,
	}: Props = $props();

	let dialogOpen = $state(false);
	let submitting = $state(false);
	let addingCategory = $state(false);
	let editingCategoryId = $state<number | null>(null);
	let newCategoryForm = $state<CategoryForm>(createEmptyCategoryForm());
	let editCategoryForm = $state<CategoryForm>(createEmptyCategoryForm());

	function createEmptyCategoryForm(defaultColor = DEFAULT_COLOR): CategoryForm {
		return {
			name: '',
			description: '',
			color: defaultColor,
		};
	}

	function createFormFromCategory(category: BudgetCategory): CategoryForm {
		return {
			name: category.name,
			description: category.description ?? '',
			color: category.color ?? DEFAULT_COLOR,
		};
	}

	function normalizeCategoryPayload(form: CategoryForm) {
		return {
			name: form.name.trim(),
			description: form.description.trim() || null,
			color: form.color,
		};
	}

	function isValid(form: CategoryForm): boolean {
		return form.name.trim().length > 0;
	}

	function resetDialogState(): void {
		submitting = false;
		addingCategory = false;
		editingCategoryId = null;
		newCategoryForm = createEmptyCategoryForm();
		editCategoryForm = createEmptyCategoryForm();
	}

	export function open(): void {
		resetDialogState();
		dialogOpen = true;
	}

	export function close(): void {
		dialogOpen = false;
		resetDialogState();
	}

	function beginEditCategory(category: BudgetCategory): void {
		editingCategoryId = category.id;
		addingCategory = false;
		editCategoryForm = createFormFromCategory(category);
	}

	async function handleAddCategory(): Promise<void> {
		if (!isValid(newCategoryForm)) {
			return;
		}

		submitting = true;

		try {
			await createBudgetCategory(fetch, normalizeCategoryPayload(newCategoryForm));
			addingCategory = false;
			newCategoryForm = createEmptyCategoryForm();
			await onSaved();
		} catch (error) {
			onError(toUserMessage(error, 'Failed to add category'));
		} finally {
			submitting = false;
		}
	}

	async function handleSaveEditCategory(): Promise<void> {
		if (!editingCategoryId || !isValid(editCategoryForm)) {
			return;
		}

		submitting = true;

		try {
			await updateBudgetCategory(
				fetch,
				editingCategoryId,
				normalizeCategoryPayload(editCategoryForm),
			);
			editingCategoryId = null;
			editCategoryForm = createEmptyCategoryForm();
			await onSaved();
		} catch (error) {
			onError(toUserMessage(error, 'Failed to update category'));
		} finally {
			submitting = false;
		}
	}

	async function handleDeleteCategory(categoryId: number): Promise<void> {
		if (!confirm('Delete this category and all its costs?')) {
			return;
		}

		submitting = true;

		try {
			await deleteBudgetCategory(fetch, categoryId);
			if (selectedCategoryFilter.includes(categoryId)) {
				onCategoryDeleted(categoryId);
			}
			await onSaved();
		} catch (error) {
			onError(toUserMessage(error, 'Failed to delete category'));
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="bg-card border-border sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title class="text-foreground">Categories</Dialog.Title>
			<Dialog.Description class="text-muted-foreground text-sm">
				Manage your budget categories and view their monthly totals.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-1 max-h-[380px] overflow-y-auto py-1">
			{#each categories as category (category.id)}
				{#if editingCategoryId === category.id}
					<div class="cat-edit-form">
						<div class="flex items-center gap-2">
							<span
								class="w-3 h-3 rounded-full flex-shrink-0"
								style="background: {editCategoryForm.color}"
							></span>
							<Input
								bind:value={editCategoryForm.name}
								placeholder="Category name"
								class="flex-1 bg-muted border-border text-foreground text-sm focus-visible:border-primary focus-visible:ring-primary/20"
							/>
						</div>
						<div class="color-picker">
							{#each COLOR_PALETTE as color (color)}
								<button
									type="button"
									class="swatch"
									class:selected={editCategoryForm.color === color}
									style="background: {color}"
									onclick={() => (editCategoryForm.color = color)}
									aria-label={`Select color ${color}`}
								></button>
							{/each}
						</div>
						<Input
							bind:value={editCategoryForm.description}
							placeholder="Description (optional)"
							class="bg-muted border-border text-foreground text-sm focus-visible:border-primary focus-visible:ring-primary/20"
						/>
						<div class="flex gap-2">
							<Button
								size="sm"
								onclick={handleSaveEditCategory}
								disabled={submitting || !isValid(editCategoryForm)}
								class="bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
							>
								Save
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onclick={() => {
									editingCategoryId = null;
									editCategoryForm = createEmptyCategoryForm();
								}}
								class="text-muted-foreground text-xs"
							>
								Cancel
							</Button>
						</div>
					</div>
				{:else}
					<div class="cat-row">
						<span
							class="w-3 h-3 rounded-full flex-shrink-0"
							style="background: {category.color ?? DEFAULT_COLOR}"
						></span>
						<div class="flex-1 min-w-0">
							<p class="cat-row-name">{category.name}</p>
							{#if category.description}
								<p class="cat-row-desc">{category.description}</p>
							{/if}
						</div>
						<span class="cat-row-amount">{formatCurrency(summaryByCategory.get(category.id) ?? 0)}/mo</span>
						<div class="flex gap-1">
							<button
								type="button"
								class="cat-action-btn"
								onclick={() => beginEditCategory(category)}
								title="Edit"
								aria-label={`Edit category ${category.name}`}
							>
								<svg aria-hidden="true" focusable="false" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
									<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
								</svg>
							</button>
							<button
								type="button"
								class="cat-action-btn danger"
								onclick={() => handleDeleteCategory(category.id)}
								title="Delete"
								aria-label={`Delete category ${category.name}`}
							>
								<svg aria-hidden="true" focusable="false" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="3 6 5 6 21 6" />
									<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
								</svg>
							</button>
						</div>
					</div>
				{/if}
			{:else}
				<p class="text-center text-muted-foreground text-sm py-6">No categories yet.</p>
			{/each}
		</div>

		{#if addingCategory}
			<div class="cat-edit-form mt-2">
				<Input
					bind:value={newCategoryForm.name}
					placeholder="Category name"
					class="bg-muted border-border text-foreground text-sm focus-visible:border-primary focus-visible:ring-primary/20"
				/>
				<div class="color-picker">
					{#each COLOR_PALETTE as color (color)}
						<button
							type="button"
							class="swatch"
							class:selected={newCategoryForm.color === color}
							style="background: {color}"
							onclick={() => (newCategoryForm.color = color)}
							aria-label={`Select color ${color}`}
						></button>
					{/each}
				</div>
				<Input
					bind:value={newCategoryForm.description}
					placeholder="Description (optional)"
					class="bg-muted border-border text-foreground text-sm focus-visible:border-primary focus-visible:ring-primary/20"
				/>
				<div class="flex gap-2">
					<Button
						size="sm"
						onclick={handleAddCategory}
						disabled={submitting || !isValid(newCategoryForm)}
						class="bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
					>
						Add Category
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onclick={() => {
							addingCategory = false;
							newCategoryForm = createEmptyCategoryForm();
						}}
						class="text-muted-foreground text-xs"
					>
						Cancel
					</Button>
				</div>
			</div>
		{:else}
			<button
				type="button"
				class="add-cat-trigger"
				onclick={() => {
					addingCategory = true;
					editingCategoryId = null;
					newCategoryForm = createEmptyCategoryForm();
				}}
			>
				<svg aria-hidden="true" focusable="false" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				Add Category
			</button>
		{/if}

		<Dialog.Footer>
			<Button onclick={close} class="bg-primary text-primary-foreground hover:bg-primary/90">
				Done
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.cat-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		border-radius: 8px;
		transition: background 0.15s;
	}

	.cat-row:hover {
		background: var(--app-bg-input);
	}

	.cat-row-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--app-text-primary);
	}

	.cat-row-desc {
		font-size: 0.75rem;
		color: var(--app-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cat-row-amount {
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--app-text-muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.cat-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		color: var(--app-text-muted);
		cursor: pointer;
		transition: all 0.16s var(--ds-ease);
		padding: 0;
	}

	.cat-action-btn:hover {
		background: var(--app-bg-input);
		border-color: var(--app-border);
		color: var(--app-text-secondary);
	}

	.cat-action-btn:focus-visible {
		outline: none;
		border-color: color-mix(in oklab, var(--app-accent) 60%, transparent);
		box-shadow: 0 0 0 3px var(--app-accent-glow);
		color: var(--app-text-primary);
	}

	.cat-action-btn.danger:hover {
		background: var(--app-red-glow);
		border-color: var(--app-red);
		color: var(--app-red);
	}

	.cat-action-btn.danger:focus-visible {
		border-color: color-mix(in oklab, var(--app-red) 60%, transparent);
		box-shadow: 0 0 0 3px var(--app-red-glow);
		color: var(--app-red);
	}

	.cat-edit-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		background: var(--app-bg-input);
		border: 1px solid var(--app-border-focus);
		border-radius: 10px;
		box-shadow: 0 0 0 3px var(--app-accent-glow);
	}

	.color-picker {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.swatch {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition:
			transform 0.15s,
			outline 0.15s;
		outline: 2px solid transparent;
		outline-offset: 2px;
		padding: 0;
	}

	.swatch.selected {
		outline: 2px solid var(--app-text-primary);
		transform: scale(1.1);
	}

	.swatch:hover:not(.selected) {
		transform: scale(1.15);
	}

	.add-cat-trigger {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		margin-top: 8px;
		padding: 9px;
		border: 1px dashed var(--app-border);
		border-radius: 8px;
		background: transparent;
		color: var(--app-text-muted);
		font-size: 0.82rem;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.16s var(--ds-ease);
	}

	.add-cat-trigger:hover {
		border-color: var(--app-accent);
		color: var(--app-accent-light);
		background: var(--app-accent-glow);
	}

	.add-cat-trigger:focus-visible {
		outline: none;
		border-color: var(--app-accent);
		box-shadow: 0 0 0 3px var(--app-accent-glow);
	}
</style>
