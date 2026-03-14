<script lang="ts">
	import type { PageData } from './$types';
	import { withApiClient } from '$lib/api/client';
	import { toUserMessage } from '$lib/effect/errors';
	import { runUiEffect } from '$lib/effect/runtime/browser';
	import { formatSekAmount } from '$lib/finance/format';
	import type { Loan } from '$lib/schema/loans';
	import type {
		CreateWishlistItemInput,
		WishlistCategory,
		WishlistFundingStrategy,
		WishlistItem,
		WishlistTargetAmountType
	} from '$lib/schema/wishlist';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import SortableTableHead from '$lib/components/SortableTableHead.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import * as Table from '$lib/components/ui/table';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	interface Props { data: PageData; }
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

	let hydrated = $state(false);
	let items = $state<WishlistItem[]>([]);
	let loans = $state<Loan[]>([]);
	let categories = $state<WishlistCategory[]>([]);
	let pending = $state(false);
	let errorMessage = $state<string | null>(null);
	let dialogOpen = $state(false);
	let categoriesDialogOpen = $state(false);
	let dialogMode = $state<'add' | 'edit'>('add');
	let editingItemId = $state('');
	let strategyFilter = $state<'all' | WishlistFundingStrategy>('all');
	let selectedCategoryFilter = $state('all');
	let itemSort = $state<{ key: WishlistSortKey; direction: 'asc' | 'desc' }>({
		key: 'priority',
		direction: 'desc'
	});

	let formName = $state('');
	let formTargetAmount = $state<number>(0);
	let formTargetAmountType = $state<WishlistTargetAmountType>('exact');
	let formTargetDate = $state('');
	let formPriority = $state(5);
	let formFundingStrategy = $state<WishlistFundingStrategy>('save');
	let formCategoryId = $state('');
	let formLinkedLoanId = $state<string | null>(null);
	let formNotes = $state('');

	let addingCategory = $state(false);
	let editingCategoryId = $state<string | null>(null);
	let newCategoryName = $state('');
	let newCategoryDescription = $state('');
	let editCategoryName = $state('');
	let editCategoryDescription = $state('');

	type WishlistSortKey = 'item' | 'category' | 'amount' | 'priority' | 'plan' | 'targetDate' | 'linkedLoan';

	let sortedItems = $derived(items.slice().sort(sortItems));
	let categoryMap = $derived(new Map(categories.map((category) => [category.id, category])));
	let loanById = $derived(new Map(loans.map((loan) => [loan.id, loan])));
	let filteredItems = $derived(sortedItems.filter((item) => {
		const passesStrategy = strategyFilter === 'all' || item.fundingStrategy === strategyFilter;
		const passesCategory = selectedCategoryFilter === 'all' || item.categoryId === selectedCategoryFilter;
		return passesStrategy && passesCategory;
	}));
	let filteredTargetTotal = $derived(filteredItems.reduce((sum, item) => sum + item.targetAmount, 0));
	let selectedCategoryName = $derived(categoryMap.get(formCategoryId)?.name ?? '');

	$effect(() => {
		if (hydrated) return;
		items = (data.items as WishlistItem[]) ?? [];
		loans = (data.loans as Loan[]) ?? [];
		categories = (data.categories as WishlistCategory[]) ?? [];
		hydrated = true;
	});

	$effect(() => {
		if ((formFundingStrategy === 'save' || formFundingStrategy === 'buy_outright') && formLinkedLoanId !== null) {
			formLinkedLoanId = null;
		}
	});

	function sortItems(left: WishlistItem, right: WishlistItem): number {
		const factor = itemSort.direction === 'asc' ? 1 : -1;
		let comparison = 0;

		switch (itemSort.key) {
			case 'item':
				comparison = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
				break;
			case 'category':
				comparison = getCategoryName(left.categoryId).localeCompare(getCategoryName(right.categoryId), undefined, {
					sensitivity: 'base'
				});
				break;
			case 'amount':
				comparison = left.targetAmount - right.targetAmount;
				break;
			case 'priority':
				comparison = left.priority - right.priority;
				break;
			case 'plan':
				comparison = STRATEGY_LABELS[left.fundingStrategy].localeCompare(STRATEGY_LABELS[right.fundingStrategy], undefined, {
					sensitivity: 'base'
				});
				break;
			case 'targetDate':
				comparison = compareNullableDate(left.targetDate, right.targetDate);
				break;
			case 'linkedLoan':
				comparison = getLinkedLoanLabel(left.linkedLoanId).localeCompare(getLinkedLoanLabel(right.linkedLoanId), undefined, {
					sensitivity: 'base'
				});
				break;
		}

		if (comparison === 0) {
			comparison = right.createdAt.localeCompare(left.createdAt);
		}

		return comparison * factor;
	}

	function toggleItemSort(key: WishlistSortKey): void {
		if (itemSort.key === key) {
			itemSort = {
				key,
				direction: itemSort.direction === 'asc' ? 'desc' : 'asc'
			};
			return;
		}

		itemSort = {
			key,
			direction: key === 'item' || key === 'category' || key === 'plan' || key === 'linkedLoan' ? 'asc' : 'desc'
		};
	}

	function compareNullableDate(left: string | null, right: string | null): number {
		if (left === null && right !== null) return 1;
		if (left !== null && right === null) return -1;
		if (left !== null && right !== null && left !== right) return left.localeCompare(right);
		return 0;
	}

	function formatTargetAmount(item: Pick<WishlistItem, 'targetAmount' | 'targetAmountType'>): string {
		return `${item.targetAmountType === 'estimate' ? '~' : ''}${formatSekAmount(item.targetAmount)}`;
	}
	function formatDate(value: string | null): string { return value ?? '-'; }
	function getCategoryName(categoryId: string | null): string { return categoryId ? (categoryMap.get(categoryId)?.name ?? 'Missing category') : '-'; }
	function getLinkedLoanLabel(linkedLoanId: string | null): string {
		if (!linkedLoanId) return 'No linked loan';
		const loan = loanById.get(linkedLoanId);
		return loan ? `${loan.counterparty} (${loan.status})` : 'Missing loan';
	}
	function toErrorMessage(error: unknown, fallback: string): string {
		return toUserMessage(error, fallback);
	}

	function apiRun(work: (client: any) => any): Promise<any> {
		return runUiEffect(withApiClient(fetch, work));
	}

	async function refreshData(): Promise<void> {
		const [nextItems, nextLoans, nextCategories] = await Promise.all([
			apiRun((client) => client.wishlist.listWishlistItems()),
			apiRun((client) => client.loans.listLoans()),
			apiRun((client) => client.wishlist.listWishlistCategories())
		]);
		items = nextItems;
		loans = nextLoans;
		categories = nextCategories;
	}
	async function runMutation(action: () => Promise<void>, fallback: string): Promise<void> {
		pending = true;
		errorMessage = null;
		try { await action(); } catch (error) { errorMessage = toErrorMessage(error, fallback); } finally { pending = false; }
	}

	function resetForm(defaults?: Partial<WishlistItem>): void {
		formName = defaults?.name ?? '';
		formTargetAmount = defaults?.targetAmount ?? 0;
		formTargetAmountType = defaults?.targetAmountType ?? 'exact';
		formTargetDate = defaults?.targetDate ?? '';
		formPriority = defaults?.priority ?? 5;
		formFundingStrategy = defaults?.fundingStrategy ?? 'save';
		formCategoryId = defaults?.categoryId ?? (categories[0]?.id ?? '');
		formLinkedLoanId = defaults?.linkedLoanId ?? null;
		formNotes = defaults?.notes ?? '';
	}
	function openAddDialog(): void { dialogMode = 'add'; editingItemId = ''; resetForm(); dialogOpen = true; }
	function openEditDialog(item: WishlistItem): void { dialogMode = 'edit'; editingItemId = item.id; resetForm(item); dialogOpen = true; }
	function openAddCategory(): void { addingCategory = true; editingCategoryId = null; newCategoryName = ''; newCategoryDescription = ''; }
	function beginEditCategory(category: WishlistCategory): void { editingCategoryId = category.id; addingCategory = false; editCategoryName = category.name; editCategoryDescription = category.description ?? ''; }

	function buildPayload(): CreateWishlistItemInput {
		return {
			name: formName.trim(),
			targetAmount: formTargetAmount,
			targetAmountType: formTargetAmountType,
			targetDate: formTargetDate.trim() || null,
			priority: formPriority,
			fundingStrategy: formFundingStrategy,
			categoryId: formCategoryId || null,
			linkedLoanId: formFundingStrategy === 'loan' || formFundingStrategy === 'mixed' ? formLinkedLoanId : null,
			notes: formNotes.trim() || null
		};
	}

	async function handleSave(): Promise<void> {
		if (!formName.trim() || formTargetAmount < 0) return;
		await runMutation(async () => {
			const payload = buildPayload();
			if (dialogMode === 'add') {
				await apiRun((client) => client.wishlist.createWishlistItem({ payload }));
			} else if (editingItemId) {
				await apiRun((client) =>
					client.wishlist.updateWishlistItem({
						path: { itemId: editingItemId },
						payload
					})
				);
			}
			await refreshData();
			dialogOpen = false;
		}, 'Failed to save wishlist item');
	}
	async function handleDelete(itemId: string): Promise<void> {
		if (!confirm('Delete this wishlist item?')) return;
		await runMutation(async () => {
			await apiRun((client) =>
				client.wishlist.deleteWishlistItem({
					path: { itemId }
				})
			);
			await refreshData();
		}, 'Failed to delete wishlist item');
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
		}, 'Failed to create wishlist category');
	}
	async function handleSaveCategoryEdit(): Promise<void> {
		if (!editingCategoryId || !editCategoryName.trim()) return;
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
		}, 'Failed to update wishlist category');
	}
	async function handleDeleteCategory(categoryId: string): Promise<void> {
		if (!confirm('Delete this category? Existing items will lose their category.')) return;
		await runMutation(async () => {
			await apiRun((client) =>
				client.wishlist.deleteWishlistCategory({
					path: { categoryId }
				})
			);
			if (selectedCategoryFilter === categoryId) selectedCategoryFilter = 'all';
			await refreshData();
		}, 'Failed to delete wishlist category');
	}
</script>

<svelte:head><title>Wishlist — FinDash</title></svelte:head>

<div class="wishlist-page">
	<div class="topbar">
		<div class="topbar-left">
			<h1 class="page-title">Wishlist</h1>
			<div class="filter-group" role="group" aria-label="Filter by strategy">
				{#each (['all', 'save', 'loan', 'mixed', 'buy_outright'] as const) as strategy (strategy)}
					<button class="filter-chip" class:active={strategyFilter === strategy} onclick={() => (strategyFilter = strategy)}>
						{strategy === 'all' ? 'All' : STRATEGY_LABELS[strategy]}
					</button>
				{/each}
			</div>
			{#if categories.length > 0}
				<div class="topbar-divider" aria-hidden="true"></div>
				<div class="filter-group" role="group" aria-label="Filter by category">
					<button class="filter-chip" class:active={selectedCategoryFilter === 'all'} onclick={() => (selectedCategoryFilter = 'all')}>All categories</button>
					{#each categories as category (category.id)}
						<button class="filter-chip" class:active={selectedCategoryFilter === category.id} onclick={() => (selectedCategoryFilter = category.id)}>{category.name}</button>
					{/each}
				</div>
			{/if}
		</div>
		<div class="topbar-right">
			<Button size="sm" variant="outline" class="toolbar-action-btn" onclick={() => { addingCategory = false; editingCategoryId = null; categoriesDialogOpen = true; }}>Manage categories</Button>
			<Button size="sm" variant="outline" class="toolbar-action-btn" onclick={openAddDialog}>+ Item</Button>
		</div>
	</div>

	{#if errorMessage}
		<Alert.Root class="border-destructive/50 bg-destructive/10">
			<Alert.Description class="flex items-center justify-between text-destructive text-xs">
				{errorMessage}
				<button onclick={() => (errorMessage = null)} class="ml-4 opacity-60 hover:opacity-100 text-xs">✕</button>
			</Alert.Description>
		</Alert.Root>
	{/if}

	<div class="table-shell rounded-lg border border-border overflow-hidden">
		<div class="table-scroll">
			<Table.Root>
				<Table.Header>
					<Table.Row class="header-row border-border hover:bg-transparent">
						<SortableTableHead class="head w-[25%]" label="Item" active={itemSort.key === 'item'} direction={itemSort.direction} onToggle={() => toggleItemSort('item')} />
						<SortableTableHead class="head w-[14%]" label="Category" active={itemSort.key === 'category'} direction={itemSort.direction} onToggle={() => toggleItemSort('category')} />
						<SortableTableHead class="head w-[12%]" label="Amount" active={itemSort.key === 'amount'} direction={itemSort.direction} onToggle={() => toggleItemSort('amount')} />
						<SortableTableHead class="head w-[11%]" label="Priority" align="right" active={itemSort.key === 'priority'} direction={itemSort.direction} onToggle={() => toggleItemSort('priority')} />
						<SortableTableHead class="head w-[14%]" label="Plan" active={itemSort.key === 'plan'} direction={itemSort.direction} onToggle={() => toggleItemSort('plan')} />
						<SortableTableHead class="head w-[10%]" label="Target date" active={itemSort.key === 'targetDate'} direction={itemSort.direction} onToggle={() => toggleItemSort('targetDate')} />
						<SortableTableHead class="head w-[14%]" label="Linked loan" active={itemSort.key === 'linkedLoan'} direction={itemSort.direction} onToggle={() => toggleItemSort('linkedLoan')} />
						<Table.Head class="head w-[72px]"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each filteredItems as item (item.id)}
						<Table.Row class="border-border group">
							<Table.Cell class="cell"><div class="item-name">{item.name}</div>{#if item.notes}<div class="muted-copy">{item.notes}</div>{/if}</Table.Cell>
							<Table.Cell class="cell"><span class="pill">{getCategoryName(item.categoryId)}</span></Table.Cell>
							<Table.Cell class="cell"><div class="mono">{formatTargetAmount(item)}</div><div class="muted-copy">{AMOUNT_TYPE_LABELS[item.targetAmountType]}</div></Table.Cell>
							<Table.Cell class="cell text-right"><div class="mono">{item.priority}</div></Table.Cell>
							<Table.Cell class="cell"><span class="pill" class:strategy-loan={item.fundingStrategy === 'loan'} class:strategy-mixed={item.fundingStrategy === 'mixed'} class:strategy-buy={item.fundingStrategy === 'buy_outright'}>{STRATEGY_LABELS[item.fundingStrategy]}</span></Table.Cell>
							<Table.Cell class="cell"><div class="muted-copy no-top-margin">{formatDate(item.targetDate)}</div></Table.Cell>
							<Table.Cell class="cell"><div class="mono small-mono">{getLinkedLoanLabel(item.linkedLoanId)}</div></Table.Cell>
							<Table.Cell class="cell">
								<div class="row-actions">
									<button class="row-action" onclick={() => openEditDialog(item)} aria-label="Edit wishlist item"><PencilIcon size={12} strokeWidth={1.8} /></button>
									<button class="row-action danger" onclick={() => handleDelete(item.id)} aria-label="Delete wishlist item"><Trash2Icon size={12} strokeWidth={1.8} /></button>
								</div>
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row><Table.Cell colspan={8} class="empty-state">No wishlist items match the current filters.</Table.Cell></Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
		<div class="table-total"><span class="table-total-label">Filtered target</span><span class="table-total-value">{formatSekAmount(filteredTargetTotal)}</span></div>
	</div>
</div>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="bg-card border-border sm:max-w-[560px]">
		<Dialog.Header>
			<Dialog.Title class="text-foreground">{dialogMode === 'add' ? 'Add wishlist item' : 'Edit wishlist item'}</Dialog.Title>
			<Dialog.Description class="text-muted-foreground text-sm">{dialogMode === 'add' ? 'Create a new wishlist target.' : 'Update this wishlist target.'}</Dialog.Description>
		</Dialog.Header>
		<div class="dialog-grid">
			<div class="form-field full"><Label class="field-label">Name</Label><Input bind:value={formName} placeholder="e.g. Bedroom storage upgrade" class="bg-muted border-border text-foreground" /></div>
			<div class="form-field"><Label class="field-label">Category</Label><Select.Root type="single" value={formCategoryId || '__none__'} onValueChange={(value: string) => (formCategoryId = value === '__none__' ? '' : value)}><Select.Trigger class="w-full bg-muted border-border text-foreground">{selectedCategoryName || 'No category'}</Select.Trigger><Select.Content class="bg-card border-border"><Select.Item value="__none__" class="text-foreground cursor-pointer">No category</Select.Item>{#each categories as category (category.id)}<Select.Item value={category.id} class="text-foreground cursor-pointer">{category.name}</Select.Item>{/each}</Select.Content></Select.Root></div>
			<div class="form-field"><Label class="field-label">Target amount</Label><Input type="number" min="0" step="0.01" bind:value={formTargetAmount} class="bg-muted border-border text-foreground" /></div>
			<div class="form-field full"><Label class="field-label">Amount type</Label><div class="toggle-group"><button type="button" class="toggle-chip" class:active={formTargetAmountType === 'exact'} onclick={() => (formTargetAmountType = 'exact')}>Exact</button><button type="button" class="toggle-chip" class:active={formTargetAmountType === 'estimate'} onclick={() => (formTargetAmountType = 'estimate')}>Estimate</button></div></div>
			<div class="form-field full"><div class="spread"><Label class="field-label">Priority</Label><span class="slider-value">{formPriority}/10</span></div><input bind:value={formPriority} type="range" min="0" max="10" step="1" class="priority-slider" /><div class="spread muted-copy no-top-margin"><span>Low</span><span>High</span></div></div>
			<div class="form-field"><Label class="field-label">Funding strategy</Label><Select.Root type="single" value={formFundingStrategy} onValueChange={(value: string) => (formFundingStrategy = value as WishlistFundingStrategy)}><Select.Trigger class="w-full bg-muted border-border text-foreground">{STRATEGY_LABELS[formFundingStrategy]}</Select.Trigger><Select.Content class="bg-card border-border"><Select.Item value="save" class="text-foreground cursor-pointer">Save</Select.Item><Select.Item value="loan" class="text-foreground cursor-pointer">Loan</Select.Item><Select.Item value="mixed" class="text-foreground cursor-pointer">Mixed</Select.Item><Select.Item value="buy_outright" class="text-foreground cursor-pointer">Buy outright</Select.Item></Select.Content></Select.Root></div>
			<div class="form-field"><div class="spread"><Label class="field-label">Target date</Label><button type="button" class="clear-link" onclick={() => (formTargetDate = '')}>Clear</button></div><Input type="date" bind:value={formTargetDate} class="bg-muted border-border text-foreground" /></div>
			<div class="form-field full"><Label class="field-label">Linked loan</Label><Select.Root type="single" value={formLinkedLoanId ?? '__none__'} onValueChange={(value: string) => (formLinkedLoanId = value === '__none__' ? null : value)}><Select.Trigger class="w-full bg-muted border-border text-foreground" disabled={formFundingStrategy === 'save' || formFundingStrategy === 'buy_outright'}>{formFundingStrategy === 'save' || formFundingStrategy === 'buy_outright' ? 'Not used for this strategy' : (formLinkedLoanId ? getLinkedLoanLabel(formLinkedLoanId) : 'No linked loan')}</Select.Trigger><Select.Content class="bg-card border-border"><Select.Item value="__none__" class="text-foreground cursor-pointer">No linked loan</Select.Item>{#each loans as loan (loan.id)}<Select.Item value={loan.id} class="text-foreground cursor-pointer">{loan.counterparty} ({loan.status})</Select.Item>{/each}</Select.Content></Select.Root></div>
			<div class="form-field full"><Label class="field-label">Notes</Label><Input bind:value={formNotes} placeholder="Optional note" class="bg-muted border-border text-foreground" /></div>
		</div>
		<Dialog.Footer><Button variant="ghost" onclick={() => (dialogOpen = false)} class="text-muted-foreground">Cancel</Button><Button onclick={handleSave} disabled={pending || !formName.trim() || formTargetAmount < 0} class="toolbar-action-btn">{dialogMode === 'add' ? 'Add item' : 'Save'}</Button></Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={categoriesDialogOpen}>
	<Dialog.Content class="bg-card border-border sm:max-w-[520px]">
		<Dialog.Header><Dialog.Title class="text-foreground">Wishlist categories</Dialog.Title><Dialog.Description class="text-muted-foreground text-sm">Manage the category list used by wishlist items.</Dialog.Description></Dialog.Header>
		<div class="category-manager">
			{#each categories as category (category.id)}
				{#if editingCategoryId === category.id}
					<div class="category-editor">
						<Input bind:value={editCategoryName} placeholder="Category name" class="bg-muted border-border text-foreground text-sm" />
						<Input bind:value={editCategoryDescription} placeholder="Description (optional)" class="bg-muted border-border text-foreground text-sm" />
						<div class="row-actions always-visible"><Button size="sm" onclick={handleSaveCategoryEdit} disabled={pending || !editCategoryName.trim()}>Save</Button><Button size="sm" variant="ghost" onclick={() => (editingCategoryId = null)}>Cancel</Button></div>
					</div>
				{:else}
					<div class="category-row"><div><div class="item-name category-name">{category.name}</div>{#if category.description}<div class="muted-copy">{category.description}</div>{/if}</div><div class="row-actions always-visible"><button class="row-action" onclick={() => beginEditCategory(category)} aria-label={`Edit ${category.name}`}><PencilIcon size={12} strokeWidth={1.8} /></button><button class="row-action danger" onclick={() => handleDeleteCategory(category.id)} aria-label={`Delete ${category.name}`}><Trash2Icon size={12} strokeWidth={1.8} /></button></div></div>
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
				<Button size="sm" variant="outline" class="toolbar-action-btn" onclick={openAddCategory}>+ Category</Button>
			{/if}
		</div>
		<Dialog.Footer><Button onclick={() => { categoriesDialogOpen = false; addingCategory = false; editingCategoryId = null; }}>Done</Button></Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.wishlist-page { width: 100%; max-width: none; margin: 0; padding: 14px 16px 18px; display: flex; flex-direction: column; gap: 12px; min-height: 0; height: 100%; overflow: hidden; }
	.topbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 4px 2px 10px; background: linear-gradient(180deg, color-mix(in oklab, var(--app-bg) 94%, transparent), transparent 92%); }
	.topbar-left, .topbar-right, .filter-group, .toggle-group, .spread { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
	.topbar-left { flex: 1 1 auto; min-width: 0; }
	.page-title { margin: 0; font-family: var(--ds-font-display); font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; color: var(--app-text-primary); }
	.topbar-divider { width: 1px; height: 2rem; background: var(--ds-glass-border); }
	.filter-chip, .toggle-chip { height: 2.5rem; padding: 0.55rem 1rem; border-radius: 999px; border: 1px solid var(--ds-glass-border); background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01)), color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12,20,14,.14)); color: var(--app-text-secondary); font-size: .88rem; font-weight: 600; }
	.filter-chip.active, .toggle-chip.active { color: var(--app-accent-light); border-color: color-mix(in oklab, var(--app-accent) 75%, var(--ds-glass-border)); background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.01)), color-mix(in oklab, var(--ds-accent) 14%, color-mix(in oklab, var(--ds-glass-surface) 82%, rgba(12,20,14,.1))); }
	.table-shell { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; background: linear-gradient(180deg, var(--ds-glass-bg-strong), var(--ds-glass-bg)), var(--ds-glass-surface); backdrop-filter: blur(var(--ds-glass-blur)); -webkit-backdrop-filter: blur(var(--ds-glass-blur)); box-shadow: var(--ds-glass-shadow), inset 0 1px 0 var(--ds-glass-edge); border-color: var(--ds-glass-border); --table-container-bg: rgba(0,0,0,.08); --table-bg: transparent; --table-header-bg: rgba(0,0,0,.06); }
	.table-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
	:global(.header-row) { background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.012)), color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12,20,14,.14)); }
	:global(.head) { height: 3.7rem; padding: 1.15rem 1.25rem; font-size: .82rem; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--app-text-secondary); }
	:global(.cell) { padding: 1.15rem 1.25rem; vertical-align: middle; font-size: 1.06rem; }
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
	.table-total { position: sticky; bottom: 0; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .9rem 1.1rem 1rem; border-top: 1px solid var(--ds-glass-border); background: linear-gradient(180deg, rgba(255,255,255,.02), rgba(0,0,0,.12)), color-mix(in oklab, var(--ds-glass-surface) 92%, transparent); }
	.table-total-label { font-family: var(--ds-font-display); font-size: .72rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--app-text-muted); }
	.table-total-value, .slider-value { font-family: var(--ds-font-mono); font-weight: 700; color: var(--app-accent-light); }
	.table-total-value { font-size: 1.15rem; }
	:global(.empty-state) { padding: 4.5rem 1rem; text-align: center; font-size: .92rem; color: var(--app-text-muted); }
	.dialog-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .85rem; }
	.form-field, .category-manager, .category-editor { display: flex; flex-direction: column; gap: .38rem; }
	.form-field.full { grid-column: 1 / -1; }
	.priority-slider { width: 100%; accent-color: var(--app-accent); }
	.clear-link { background: transparent; border: 0; padding: 0; font-size: .76rem; color: var(--app-text-muted); }
	.category-row, .category-editor { display: flex; justify-content: space-between; gap: .75rem; padding: .75rem .85rem; border: 1px solid var(--ds-glass-border); border-radius: .8rem; background: rgba(255,255,255,.02); }
	:global(.field-label) { font-size: .82rem; font-weight: 600; color: var(--app-text-secondary); }
	:global(.toolbar-action-btn) { height: 2.8rem; padding-inline: 1rem; border-radius: .9rem; background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01)), color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12,20,14,.16)); border-color: var(--ds-glass-border); color: var(--app-text-primary); font-weight: 600; }
	@media (max-width: 960px) { .topbar-left, .topbar-right { width: 100%; } .topbar-divider { display: none; } }
	@media (max-width: 768px) { .wishlist-page { padding-top: 68px; } .row-actions { opacity: 1; } }
	@media (max-width: 640px) { .wishlist-page { padding: 16px 14px 32px; } .dialog-grid { grid-template-columns: 1fr; } .table-total { align-items: flex-start; flex-direction: column; } }
</style>
