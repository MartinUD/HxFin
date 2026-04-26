<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import type * as Effect from 'effect/Effect';
	import { type ApiClient, withApiClient } from '$lib/api/client';
	import * as Alert from '$lib/shadcn-prim/alert';
	import { Button } from '$lib/shadcn-prim/button';
	import * as Dialog from '$lib/shadcn-prim/dialog';
	import { Input } from '$lib/shadcn-prim/input';
	import { Label } from '$lib/shadcn-prim/label';
	import {
		SegmentedControl,
		type SegmentedControlOption
	} from '$lib/shadcn-prim/segmented-control';
	import * as Select from '$lib/shadcn-prim/select';
	import {
		ToolbarActionButton,
		ToolbarActions
	} from '$lib/shadcn-prim/toolbar-actions';
	import {
		Table,
		SortableTableHead,
		type SortDirection,
		sortAlphabetical,
		sortValue,
		toggleSort as toggleTableSort
	} from '$lib/shadcn-prim/table';
	import { toUserMessage } from '$lib/effect/errors';
	import { runUiEffect } from '$lib/effect/runtime/browser';
	import { formatSekAmount } from '$lib/shared/format';
	import type { Loan } from '$lib/schema/loans';
	import type {
		CreateWishlistItemInput,
		WishlistCategory,
		WishlistFundingStrategy,
		WishlistItem,
		WishlistTargetAmountType
	} from '$lib/schema/wishlist';

	interface Props {
		data: {
			items: WishlistItem[];
			loans: Loan[];
			categories: WishlistCategory[];
		};
	}

	let { data }: Props = $props();

	const STRATEGY_LABELS: Record<WishlistFundingStrategy, string> = {
		save: 'Save',
		loan: 'Loan',
		mixed: 'Mixed',
		buy_outright: 'Buy outright'
	};
	const AMOUNT_TYPE_LABELS: Record<WishlistTargetAmountType, string> = {
		exact: 'Exact',
		estimate: 'Estimate'
	};

	const strategyFilterOptions: SegmentedControlOption[] = [
		{ value: 'all', label: 'All' },
		{ value: 'save', label: 'Save' },
		{ value: 'loan', label: 'Loan' },
		{ value: 'mixed', label: 'Mixed' },
		{ value: 'buy_outright', label: 'Buy outright' }
	];

	let hydrated = $state(false);
	let items = $state<WishlistItem[]>([]);
	let loans = $state<Loan[]>([]);
	let categories = $state<WishlistCategory[]>([]);
	let pending = $state(false);
	let errorMessage = $state<string | null>(null);
	let dialogOpen = $state(false);
	let categoriesDialogOpen = $state(false);
	let dialogMode = $state<'add' | 'edit'>('add');
	// ids come back from the Rust backend as numbers; null means "no item selected".
	let editingItemId = $state<number | null>(null);
	let strategyFilter = $state<'all' | WishlistFundingStrategy>('all');
	// Segmented control values must be strings — store the category id as a
	// string here ('all' | stringified number) and coerce back to number when
	// comparing against `item.categoryId`.
	let selectedCategoryFilter = $state('all');
	let itemSort = $state<{ key: WishlistSortKey; direction: SortDirection }>({
		key: 'priority',
		direction: 'desc'
	});

	let formName = $state('');
	let formTargetAmount = $state<number>(0);
	let formTargetAmountType = $state<WishlistTargetAmountType>('exact');
	let formTargetDate = $state('');
	let formPriority = $state(5);
	let formFundingStrategy = $state<WishlistFundingStrategy>('save');
	let formCategoryId = $state<number | null>(null);
	let formLinkedLoanId = $state<number | null>(null);
	let formNotes = $state('');

	let addingCategory = $state(false);
	let editingCategoryId = $state<number | null>(null);
	let newCategoryName = $state('');
	let newCategoryDescription = $state('');
	let editCategoryName = $state('');
	let editCategoryDescription = $state('');

	type WishlistSortKey =
		| 'item'
		| 'category'
		| 'amount'
		| 'priority'
		| 'plan'
		| 'targetDate'
		| 'linkedLoan';

	let sortedItems = $derived(items.slice().sort(sortItems));
	let categoryMap = $derived(new Map(categories.map((category) => [category.id, category])));
	let loanById = $derived(new Map(loans.map((loan) => [loan.id, loan])));
	let categoryFilterOptions = $derived<SegmentedControlOption[]>([
		{ value: 'all', label: 'All categories' },
		...categories.map((category) => ({
			value: String(category.id),
			label: category.name
		}))
	]);
	let filteredItems = $derived(
		sortedItems.filter((item) => {
			const passesStrategy = strategyFilter === 'all' || item.fundingStrategy === strategyFilter;
			const passesCategory =
				selectedCategoryFilter === 'all' ||
				item.categoryId === Number(selectedCategoryFilter);
			return passesStrategy && passesCategory;
		})
	);
	let filteredTargetTotal = $derived(
		filteredItems.reduce((sum, item) => sum + item.targetAmount, 0)
	);
	let selectedCategoryName = $derived(
		formCategoryId === null ? '' : (categoryMap.get(formCategoryId)?.name ?? '')
	);

	$effect(() => {
		if (hydrated) return;
		items = (data.items as WishlistItem[]) ?? [];
		loans = (data.loans as Loan[]) ?? [];
		categories = (data.categories as WishlistCategory[]) ?? [];
		hydrated = true;
	});

	$effect(() => {
		if (
			(formFundingStrategy === 'save' || formFundingStrategy === 'buy_outright') &&
			formLinkedLoanId !== null
		) {
			formLinkedLoanId = null;
		}
	});

	function sortItems(left: WishlistItem, right: WishlistItem): number {
		switch (itemSort.key) {
			case 'item':
				return withCreatedAtTiebreak(
					sortAlphabetical(left.name, right.name, itemSort.direction),
					left,
					right
				);
			case 'category':
				return withCreatedAtTiebreak(
					sortAlphabetical(
						getCategoryName(left.categoryId),
						getCategoryName(right.categoryId),
						itemSort.direction
					),
					left,
					right
				);
			case 'amount':
				return withCreatedAtTiebreak(
					sortValue(left.targetAmount, right.targetAmount, itemSort.direction),
					left,
					right
				);
			case 'priority':
				return withCreatedAtTiebreak(
					sortValue(left.priority, right.priority, itemSort.direction),
					left,
					right
				);
			case 'plan':
				return withCreatedAtTiebreak(
					sortAlphabetical(
						STRATEGY_LABELS[left.fundingStrategy],
						STRATEGY_LABELS[right.fundingStrategy],
						itemSort.direction
					),
					left,
					right
				);
			case 'targetDate':
				return withCreatedAtTiebreak(
					sortAlphabetical(left.targetDate ?? '', right.targetDate ?? '', itemSort.direction),
					left,
					right
				);
			case 'linkedLoan':
				return withCreatedAtTiebreak(
					sortAlphabetical(
						getLinkedLoanLabel(left.linkedLoanId),
						getLinkedLoanLabel(right.linkedLoanId),
						itemSort.direction
					),
					left,
					right
				);
		}
	}

	function toggleItemSort(key: WishlistSortKey): void {
		itemSort = toggleTableSort(itemSort, key);
	}

	function withCreatedAtTiebreak(
		comparison: number,
		left: WishlistItem,
		right: WishlistItem
	): number {
		return comparison !== 0 ? comparison : right.createdAt.localeCompare(left.createdAt);
	}

	function formatTargetAmount(item: Pick<WishlistItem, 'targetAmount' | 'targetAmountType'>): string {
		return `${item.targetAmountType === 'estimate' ? '~' : ''}${formatSekAmount(item.targetAmount)}`;
	}

	function formatDate(value: string | null): string {
		return value ?? '-';
	}

	function getCategoryName(categoryId: number | null): string {
		return categoryId === null ? '-' : (categoryMap.get(categoryId)?.name ?? 'Missing category');
	}

	function getLinkedLoanLabel(linkedLoanId: number | null): string {
		if (linkedLoanId === null) return 'No linked loan';
		const loan = loanById.get(linkedLoanId);
		return loan ? `${loan.counterparty} (${loan.status})` : 'Missing loan';
	}

	function toErrorMessage(error: unknown, fallback: string): string {
		return toUserMessage(error, fallback);
	}

	function apiRun<A, E, R>(work: (client: ApiClient) => Effect.Effect<A, E, R>): Promise<A> {
		return runUiEffect(withApiClient(fetch, work));
	}

	async function refreshData(): Promise<void> {
		const [nextItems, nextLoans, nextCategories] = await Promise.all([
			apiRun((client) => client.wishlist.listWishlistItems({ urlParams: {} })),
			apiRun((client) => client.loans.listLoans({ urlParams: {} })),
			apiRun((client) => client.wishlist.listWishlistCategories())
		]);
		items = nextItems.slice();
		loans = nextLoans.slice();
		categories = nextCategories.slice();
	}

	async function runMutation(action: () => Promise<void>, fallback: string): Promise<void> {
		pending = true;
		errorMessage = null;
		try {
			await action();
		} catch (error) {
			errorMessage = toErrorMessage(error, fallback);
		} finally {
			pending = false;
		}
	}

	function resetForm(defaults?: Partial<WishlistItem>): void {
		formName = defaults?.name ?? '';
		formTargetAmount = defaults?.targetAmount ?? 0;
		formTargetAmountType = defaults?.targetAmountType ?? 'exact';
		formTargetDate = defaults?.targetDate ?? '';
		formPriority = defaults?.priority ?? 5;
		formFundingStrategy = defaults?.fundingStrategy ?? 'save';
		formCategoryId = defaults?.categoryId ?? (categories[0]?.id ?? null);
		formLinkedLoanId = defaults?.linkedLoanId ?? null;
		formNotes = defaults?.notes ?? '';
	}

	function openAddDialog(): void {
		dialogMode = 'add';
		editingItemId = null;
		resetForm();
		dialogOpen = true;
	}

	function openEditDialog(item: WishlistItem): void {
		dialogMode = 'edit';
		editingItemId = item.id;
		resetForm(item);
		dialogOpen = true;
	}

	function openAddCategory(): void {
		addingCategory = true;
		editingCategoryId = null;
		newCategoryName = '';
		newCategoryDescription = '';
	}

	function beginEditCategory(category: WishlistCategory): void {
		editingCategoryId = category.id;
		addingCategory = false;
		editCategoryName = category.name;
		editCategoryDescription = category.description ?? '';
	}

	function buildPayload(): CreateWishlistItemInput {
		return {
			name: formName.trim(),
			targetAmount: formTargetAmount,
			targetAmountType: formTargetAmountType,
			targetDate: formTargetDate.trim() || null,
			priority: formPriority,
			fundingStrategy: formFundingStrategy,
			categoryId: formCategoryId,
			linkedLoanId:
				formFundingStrategy === 'loan' || formFundingStrategy === 'mixed'
					? formLinkedLoanId
					: null,
			notes: formNotes.trim() || null
		};
	}

	async function handleSave(): Promise<void> {
		if (!formName.trim() || formTargetAmount < 0) return;
		await runMutation(async () => {
			const payload = buildPayload();
			if (dialogMode === 'add') {
				await apiRun((client) => client.wishlist.createWishlistItem({ payload }));
			} else if (editingItemId !== null) {
				const itemId = editingItemId;
				await apiRun((client) =>
					client.wishlist.updateWishlistItem({
						path: { itemId },
						payload
					})
				);
			}
			await refreshData();
			dialogOpen = false;
		}, 'Failed to save planned purchase');
	}

	async function handleDelete(itemId: number): Promise<void> {
		if (!confirm('Delete this planned purchase?')) return;
		await runMutation(async () => {
			await apiRun((client) =>
				client.wishlist.deleteWishlistItem({
					path: { itemId }
				})
			);
			await refreshData();
		}, 'Failed to delete planned purchase');
	}

	async function handleAddCategory(): Promise<void> {
		if (!newCategoryName.trim()) return;
		await runMutation(async () => {
			const category = await apiRun((client) =>
				client.wishlist.createWishlistCategory({
					payload: {
						name: newCategoryName.trim(),
						description: newCategoryDescription.trim() || null
					}
				})
			);
			await refreshData();
			formCategoryId = category.id;
			addingCategory = false;
		}, 'Failed to create purchase category');
	}

	async function handleSaveCategoryEdit(): Promise<void> {
		if (editingCategoryId === null || !editCategoryName.trim()) return;
		const categoryId = editingCategoryId;
		await runMutation(async () => {
			await apiRun((client) =>
				client.wishlist.updateWishlistCategory({
					path: { categoryId },
					payload: {
						name: editCategoryName.trim(),
						description: editCategoryDescription.trim() || null
					}
				})
			);
			await refreshData();
			editingCategoryId = null;
		}, 'Failed to update purchase category');
	}

	async function handleDeleteCategory(categoryId: number): Promise<void> {
		if (!confirm('Delete this category? Existing purchases will lose their category.')) return;
		await runMutation(async () => {
			await apiRun((client) =>
				client.wishlist.deleteWishlistCategory({
					path: { categoryId }
				})
			);
			// selectedCategoryFilter is the stringified id (or 'all'), so compare strings.
			if (selectedCategoryFilter === String(categoryId)) selectedCategoryFilter = 'all';
			await refreshData();
		}, 'Failed to delete purchase category');
	}
</script>

<div class="app-page planned-purchases-page">
	<div class="app-toolbar">
		<div class="app-toolbar-left">
			<SegmentedControl
				bind:value={strategyFilter}
				options={strategyFilterOptions}
				ariaLabel="Filter planned purchases by strategy"
				class="planned-purchases-filter"
			/>
			{#if categories.length > 0}
				<div class="app-toolbar-divider" aria-hidden="true"></div>
				<SegmentedControl
					bind:value={selectedCategoryFilter}
					options={categoryFilterOptions}
					ariaLabel="Filter planned purchases by category"
					class="planned-purchases-filter"
				/>
			{/if}
		</div>
		<div class="app-toolbar-right">
			<ToolbarActions>
				<ToolbarActionButton
					tone="muted"
					onclick={() => {
						addingCategory = false;
						editingCategoryId = null;
						categoriesDialogOpen = true;
					}}
				>
					Manage categories
				</ToolbarActionButton>
				<ToolbarActionButton onclick={openAddDialog}>+ Purchase</ToolbarActionButton>
			</ToolbarActions>
		</div>
	</div>

	{#if errorMessage}
		<Alert.Root class="border-destructive/50 bg-destructive/10">
			<Alert.Description class="flex items-center justify-between text-destructive text-xs">
				{errorMessage}
				<button
					type="button"
					onclick={() => (errorMessage = null)}
					class="ml-4 opacity-60 hover:opacity-100 text-xs"
				>
					✕
				</button>
			</Alert.Description>
		</Alert.Root>
	{/if}

	<Table fill>
		{#snippet footer()}
			<span class="table-summary-label">Filtered target</span>
			<span class="table-summary-value">{formatSekAmount(filteredTargetTotal)}</span>
		{/snippet}
		<thead>
			<tr>
				<SortableTableHead class="w-[25%]" label="Item" active={itemSort.key === 'item'} direction={itemSort.direction} onToggle={() => toggleItemSort('item')} />
				<SortableTableHead class="w-[14%]" label="Category" active={itemSort.key === 'category'} direction={itemSort.direction} onToggle={() => toggleItemSort('category')} />
				<SortableTableHead class="w-[12%]" label="Amount" active={itemSort.key === 'amount'} direction={itemSort.direction} onToggle={() => toggleItemSort('amount')} />
				<SortableTableHead class="w-[11%]" label="Priority" align="right" active={itemSort.key === 'priority'} direction={itemSort.direction} onToggle={() => toggleItemSort('priority')} />
				<SortableTableHead class="w-[14%]" label="Plan" active={itemSort.key === 'plan'} direction={itemSort.direction} onToggle={() => toggleItemSort('plan')} />
				<SortableTableHead class="w-[10%]" label="Target date" active={itemSort.key === 'targetDate'} direction={itemSort.direction} onToggle={() => toggleItemSort('targetDate')} />
				<SortableTableHead class="w-[14%]" label="Linked loan" active={itemSort.key === 'linkedLoan'} direction={itemSort.direction} onToggle={() => toggleItemSort('linkedLoan')} />
				<th class="w-[72px]"></th>
			</tr>
		</thead>
		<tbody>
			{#each filteredItems as item (item.id)}
				<tr class="group">
					<td class="cell"><div class="item-name">{item.name}</div>{#if item.notes}<div class="muted-copy">{item.notes}</div>{/if}</td>
					<td class="cell"><span class="pill">{getCategoryName(item.categoryId)}</span></td>
					<td class="cell"><div class="mono">{formatTargetAmount(item)}</div><div class="muted-copy">{AMOUNT_TYPE_LABELS[item.targetAmountType]}</div></td>
					<td class="cell text-right"><div class="mono">{item.priority}</div></td>
					<td class="cell"><span class="pill" class:strategy-loan={item.fundingStrategy === 'loan'} class:strategy-mixed={item.fundingStrategy === 'mixed'} class:strategy-buy={item.fundingStrategy === 'buy_outright'}>{STRATEGY_LABELS[item.fundingStrategy]}</span></td>
					<td class="cell"><div class="muted-copy no-top-margin">{formatDate(item.targetDate)}</div></td>
					<td class="cell"><div class="mono small-mono">{getLinkedLoanLabel(item.linkedLoanId)}</div></td>
					<td class="cell">
						<div class="row-actions">
							<button type="button" class="row-action" onclick={() => openEditDialog(item)} aria-label="Edit planned purchase"><PencilIcon size={12} strokeWidth={1.8} /></button>
							<button type="button" class="row-action danger" onclick={() => handleDelete(item.id)} aria-label="Delete planned purchase"><Trash2Icon size={12} strokeWidth={1.8} /></button>
						</div>
					</td>
				</tr>
			{:else}
				<tr><td colspan={8} class="table-empty-state">No planned purchases match the current filters.</td></tr>
			{/each}
		</tbody>
	</Table>
</div>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="bg-card border-border sm:max-w-[560px]">
		<Dialog.Header>
			<Dialog.Title class="text-foreground">{dialogMode === 'add' ? 'Add planned purchase' : 'Edit planned purchase'}</Dialog.Title>
			<Dialog.Description class="text-muted-foreground text-sm">{dialogMode === 'add' ? 'Create a new planned purchase target.' : 'Update this planned purchase target.'}</Dialog.Description>
		</Dialog.Header>
		<div class="dialog-grid">
			<div class="form-field full"><Label class="field-label">Name</Label><Input bind:value={formName} placeholder="e.g. Bedroom storage upgrade" class="bg-muted border-border text-foreground" /></div>
			<div class="form-field"><Label class="field-label">Category</Label><Select.Root type="single" value={formCategoryId === null ? '__none__' : String(formCategoryId)} onValueChange={(value: string) => (formCategoryId = value === '__none__' ? null : Number(value))}><Select.Trigger class="w-full bg-muted border-border text-foreground">{selectedCategoryName || 'No category'}</Select.Trigger><Select.Content class="bg-card border-border"><Select.Item value="__none__" class="text-foreground cursor-pointer">No category</Select.Item>{#each categories as category (category.id)}<Select.Item value={String(category.id)} class="text-foreground cursor-pointer">{category.name}</Select.Item>{/each}</Select.Content></Select.Root></div>
			<div class="form-field"><Label class="field-label">Target amount</Label><Input type="number" min="0" step="0.01" bind:value={formTargetAmount} class="bg-muted border-border text-foreground" /></div>
			<div class="form-field full"><Label class="field-label">Amount type</Label><div class="toggle-group"><button type="button" class="toggle-chip" class:active={formTargetAmountType === 'exact'} onclick={() => (formTargetAmountType = 'exact')}>Exact</button><button type="button" class="toggle-chip" class:active={formTargetAmountType === 'estimate'} onclick={() => (formTargetAmountType = 'estimate')}>Estimate</button></div></div>
			<div class="form-field full"><div class="spread"><Label class="field-label">Priority</Label><span class="slider-value">{formPriority}/10</span></div><input bind:value={formPriority} type="range" min="0" max="10" step="1" class="priority-slider" /><div class="spread muted-copy no-top-margin"><span>Low</span><span>High</span></div></div>
			<div class="form-field"><Label class="field-label">Funding strategy</Label><Select.Root type="single" value={formFundingStrategy} onValueChange={(value: string) => (formFundingStrategy = value as WishlistFundingStrategy)}><Select.Trigger class="w-full bg-muted border-border text-foreground">{STRATEGY_LABELS[formFundingStrategy]}</Select.Trigger><Select.Content class="bg-card border-border"><Select.Item value="save" class="text-foreground cursor-pointer">Save</Select.Item><Select.Item value="loan" class="text-foreground cursor-pointer">Loan</Select.Item><Select.Item value="mixed" class="text-foreground cursor-pointer">Mixed</Select.Item><Select.Item value="buy_outright" class="text-foreground cursor-pointer">Buy outright</Select.Item></Select.Content></Select.Root></div>
			<div class="form-field"><div class="spread"><Label class="field-label">Target date</Label><button type="button" class="clear-link" onclick={() => (formTargetDate = '')}>Clear</button></div><Input type="date" bind:value={formTargetDate} class="bg-muted border-border text-foreground" /></div>
			<div class="form-field full"><Label class="field-label">Linked loan</Label><Select.Root type="single" value={formLinkedLoanId === null ? '__none__' : String(formLinkedLoanId)} onValueChange={(value: string) => (formLinkedLoanId = value === '__none__' ? null : Number(value))}><Select.Trigger class="w-full bg-muted border-border text-foreground" disabled={formFundingStrategy === 'save' || formFundingStrategy === 'buy_outright'}>{formFundingStrategy === 'save' || formFundingStrategy === 'buy_outright' ? 'Not used for this strategy' : (formLinkedLoanId !== null ? getLinkedLoanLabel(formLinkedLoanId) : 'No linked loan')}</Select.Trigger><Select.Content class="bg-card border-border"><Select.Item value="__none__" class="text-foreground cursor-pointer">No linked loan</Select.Item>{#each loans as loan (loan.id)}<Select.Item value={String(loan.id)} class="text-foreground cursor-pointer">{loan.counterparty} ({loan.status})</Select.Item>{/each}</Select.Content></Select.Root></div>
			<div class="form-field full"><Label class="field-label">Notes</Label><Input bind:value={formNotes} placeholder="Optional note" class="bg-muted border-border text-foreground" /></div>
		</div>
		<Dialog.Footer><Button variant="ghost" onclick={() => (dialogOpen = false)} class="text-muted-foreground">Cancel</Button><Button onclick={handleSave} disabled={pending || !formName.trim() || formTargetAmount < 0} class="app-action-btn">{dialogMode === 'add' ? 'Add purchase' : 'Save'}</Button></Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={categoriesDialogOpen}>
	<Dialog.Content class="bg-card border-border sm:max-w-[520px]">
		<Dialog.Header><Dialog.Title class="text-foreground">Purchase categories</Dialog.Title><Dialog.Description class="text-muted-foreground text-sm">Manage the category list used by planned purchases.</Dialog.Description></Dialog.Header>
		<div class="category-manager">
			{#each categories as category (category.id)}
				{#if editingCategoryId === category.id}
					<div class="category-editor">
						<Input bind:value={editCategoryName} placeholder="Category name" class="bg-muted border-border text-foreground text-sm" />
						<Input bind:value={editCategoryDescription} placeholder="Description (optional)" class="bg-muted border-border text-foreground text-sm" />
						<div class="row-actions always-visible"><Button size="sm" onclick={handleSaveCategoryEdit} disabled={pending || !editCategoryName.trim()}>Save</Button><Button size="sm" variant="ghost" onclick={() => (editingCategoryId = null)}>Cancel</Button></div>
					</div>
				{:else}
					<div class="category-row"><div><div class="item-name category-name">{category.name}</div>{#if category.description}<div class="muted-copy">{category.description}</div>{/if}</div><div class="row-actions always-visible"><button type="button" class="row-action" onclick={() => beginEditCategory(category)} aria-label={`Edit ${category.name}`}><PencilIcon size={12} strokeWidth={1.8} /></button><button type="button" class="row-action danger" onclick={() => handleDeleteCategory(category.id)} aria-label={`Delete ${category.name}`}><Trash2Icon size={12} strokeWidth={1.8} /></button></div></div>
				{/if}
			{:else}
				<p class="muted-copy no-top-margin">No categories yet.</p>
			{/each}
			{#if addingCategory}
				<div class="category-editor">
					<Input bind:value={newCategoryName} placeholder="Category name" class="bg-muted border-border text-foreground text-sm" />
					<Input bind:value={newCategoryDescription} placeholder="Description (optional)" class="bg-muted border-border text-foreground text-sm" />
					<div class="row-actions always-visible"><Button size="sm" onclick={handleAddCategory} disabled={pending || !newCategoryName.trim()}>Add category</Button><Button size="sm" variant="ghost" onclick={() => (addingCategory = false)}>Cancel</Button></div>
				</div>
			{:else}
				<Button size="sm" variant="outline" class="app-action-btn" onclick={openAddCategory}>+ Category</Button>
			{/if}
		</div>
		<Dialog.Footer><Button onclick={() => { categoriesDialogOpen = false; addingCategory = false; editingCategoryId = null; }}>Done</Button></Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	:global(.planned-purchases-filter) {
		margin-left: 4px;
		max-width: 100%;
	}

	.toggle-group, .spread { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
	.item-name { font-size: 1.16rem; font-weight: 700; color: var(--app-text-primary); }
	.category-name { font-size: .9rem; }
	.muted-copy { margin-top: .24rem; font-size: .76rem; color: var(--app-text-muted); }
	.no-top-margin { margin-top: 0; }
	.mono { font-family: var(--ds-font-mono); font-size: .95rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--app-text-primary); }
	.small-mono { font-size: .84rem; }
	.pill { display: inline-flex; align-items: center; justify-content: center; padding: .22rem .6rem; border-radius: 999px; border: 1px solid var(--app-border); font-size: .69rem; font-weight: 700; color: var(--app-text-secondary); background: rgba(255,255,255,.03); }
	.strategy-loan { color: var(--app-accent-light); border-color: color-mix(in oklab, var(--app-accent) 52%, var(--app-border)); background: color-mix(in oklab, var(--app-accent) 16%, transparent); }
	.strategy-mixed { color: #f59e0b; border-color: color-mix(in oklab, #f59e0b 46%, var(--app-border)); background: color-mix(in oklab, #f59e0b 10%, transparent); }
	.strategy-buy { color: #38bdf8; border-color: color-mix(in oklab, #38bdf8 46%, var(--app-border)); background: color-mix(in oklab, #38bdf8 10%, transparent); }
	.row-actions { display: flex; justify-content: flex-end; gap: .35rem; opacity: 0; transition: opacity .16s var(--ds-ease); }
	.always-visible { opacity: 1; }
	:global(.group:hover) .row-actions, :global(.group:focus-within) .row-actions { opacity: 1; }
	.row-action { display: inline-flex; align-items: center; justify-content: center; width: 1.9rem; height: 1.9rem; border-radius: .55rem; border: 1px solid var(--app-border); background: rgba(255,255,255,.025); color: var(--app-text-secondary); }
	.row-action.danger:hover { color: var(--app-red); border-color: color-mix(in oklab, var(--app-red) 60%, var(--app-border)); }
	.slider-value { font-family: var(--ds-font-mono); font-weight: 700; color: var(--app-accent-light); }
	.dialog-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .85rem; }
	.form-field, .category-manager, .category-editor { display: flex; flex-direction: column; gap: .38rem; }
	.form-field.full { grid-column: 1 / -1; }
	.priority-slider { width: 100%; accent-color: var(--app-accent); }
	.clear-link { background: transparent; border: 0; padding: 0; font-size: .76rem; color: var(--app-text-muted); }
	.category-row, .category-editor { display: flex; justify-content: space-between; gap: .75rem; padding: .75rem .85rem; border: 1px solid var(--ds-glass-border); border-radius: .8rem; background: rgba(255,255,255,.02); }
	:global(.field-label) { font-size: .82rem; font-weight: 600; color: var(--app-text-secondary); }
	@media (max-width: 768px) { .row-actions { opacity: 1; } }
	@media (max-width: 640px) { .dialog-grid { grid-template-columns: 1fr; } }
</style>
