<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import type * as Effect from 'effect/Effect';
	import { type ApiClient, withApiClient } from '$lib/api/client';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		SegmentedControl,
		type SegmentedControlOption
	} from '$lib/components/ui/segmented-control';
	import * as Select from '$lib/components/ui/select';
	import {
		ToolbarActionButton,
		ToolbarActions
	} from '$lib/components/ui/toolbar-actions';
	import {
		Table,
		SortableTableHead,
		type SortDirection,
		sortAlphabetical,
		sortValue,
		toggleSort as toggleTableSort
	} from '$lib/components/ui/table';
	import { toUserMessage } from '$lib/effect/errors';
	import { runUiEffect } from '$lib/effect/runtime/browser';
	import { formatLocalizedNumber } from '$lib/finance/format';
	import type { CreateLoanInput, Loan, LoanDirection, LoanStatus } from '$lib/schema/loans';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const DIRECTION_LABELS: Record<LoanDirection, string> = {
		lent: 'Lent',
		borrowed: 'Borrowed'
	};

	const STATUS_LABELS: Record<LoanStatus, string> = {
		open: 'Open',
		paid: 'Paid',
		overdue: 'Overdue'
	};

	const statusFilterOptions: SegmentedControlOption[] = [
		{ value: 'all', label: 'All' },
		{ value: 'open', label: 'Open' },
		{ value: 'overdue', label: 'Overdue' },
		{ value: 'paid', label: 'Paid' }
	];

	const directionFilterOptions: SegmentedControlOption[] = [
		{ value: 'all', label: 'All' },
		{ value: 'lent', label: 'Lent' },
		{ value: 'borrowed', label: 'Borrowed' }
	];

	let hydratedFromLoad = $state(false);
	let loans = $state<Loan[]>([]);
	let pending = $state(false);
	let errorMessage = $state<string | null>(null);
	let dialogOpen = $state(false);
	let dialogMode = $state<'add' | 'edit'>('add');
	// Loan ids are INTEGER since migration 0021; null means "no loan selected".
	let editingLoanId = $state<number | null>(null);
	let statusFilter = $state<'all' | LoanStatus>('all');
	let directionFilter = $state<'all' | LoanDirection>('all');
	let loanSort = $state<{ key: LoanSortKey; direction: SortDirection }>({
		key: 'timeline',
		direction: 'asc'
	});

	let formDirection = $state<LoanDirection>('borrowed');
	let formCounterparty = $state('');
	let formPrincipalAmount = $state<number>(0);
	let formOutstandingAmount = $state<number>(0);
	let formCurrency = $state('SEK');
	let formIssueDate = $state(new Date().toISOString().slice(0, 10));
	let formDueDate = $state('');
	let formStatus = $state<LoanStatus>('open');
	let formNotes = $state('');

	type LoanSortKey = 'direction' | 'counterparty' | 'timeline' | 'principal' | 'outstanding' | 'status';

	let timelineSortedLoans = $derived(loans.slice().sort(sortLoansByTimeline));
	let sortedLoans = $derived(loans.slice().sort(sortLoans));
	let filteredLoans = $derived(
		sortedLoans.filter((loan) => {
			const passesStatus = statusFilter === 'all' || loan.status === statusFilter;
			const passesDirection = directionFilter === 'all' || loan.direction === directionFilter;
			return passesStatus && passesDirection;
		})
	);
	let filteredOutstandingTotal = $derived(
		filteredLoans.reduce((sum, loan) => sum + loan.outstandingAmount, 0)
	);
	let netOpenBalance = $derived(
		loans.reduce((sum, loan) => {
			if (loan.status === 'paid') return sum;
			return loan.direction === 'lent'
				? sum + loan.outstandingAmount
				: sum - loan.outstandingAmount;
		}, 0)
	);
	let overdueCount = $derived(loans.filter((loan) => loan.status === 'overdue').length);
	let nearestDue = $derived(
		timelineSortedLoans.find((loan) => loan.status !== 'paid' && loan.dueDate) ?? null
	);

	$effect(() => {
		if (hydratedFromLoad) return;
		loans = ((data.loans as Loan[]) ?? []).slice();
		hydratedFromLoad = true;
	});

	function toggleLoanSort(key: LoanSortKey): void {
		loanSort = toggleTableSort(loanSort, key);
	}

	function sortLoans(left: Loan, right: Loan): number {
		switch (loanSort.key) {
			case 'direction':
				return withCreatedAtTiebreak(
					sortAlphabetical(left.direction, right.direction, loanSort.direction),
					left,
					right
				);
			case 'counterparty':
				return withCreatedAtTiebreak(
					sortAlphabetical(left.counterparty, right.counterparty, loanSort.direction),
					left,
					right
				);
			case 'timeline':
				return withCreatedAtTiebreak(
					sortValue(sortLoansByTimeline(left, right), 0, loanSort.direction),
					left,
					right
				);
			case 'principal':
				return withCreatedAtTiebreak(
					sortValue(left.principalAmount, right.principalAmount, loanSort.direction),
					left,
					right
				);
			case 'outstanding':
				return withCreatedAtTiebreak(
					sortValue(left.outstandingAmount, right.outstandingAmount, loanSort.direction),
					left,
					right
				);
			case 'status':
				return withCreatedAtTiebreak(
					sortValue(compareLoanStatus(left.status, right.status), 0, loanSort.direction),
					left,
					right
				);
		}
	}

	function sortLoansByTimeline(left: Loan, right: Loan): number {
		if (left.dueDate === null && right.dueDate !== null) return 1;
		if (left.dueDate !== null && right.dueDate === null) return -1;
		if (left.dueDate !== null && right.dueDate !== null && left.dueDate !== right.dueDate) {
			return left.dueDate.localeCompare(right.dueDate);
		}
		if (left.issueDate !== right.issueDate) {
			return left.issueDate.localeCompare(right.issueDate);
		}
		return right.createdAt.localeCompare(left.createdAt);
	}

	function compareLoanStatus(left: LoanStatus, right: LoanStatus): number {
		const rank: Record<LoanStatus, number> = {
			open: 0,
			overdue: 1,
			paid: 2
		};

		return rank[left] - rank[right];
	}

	function withCreatedAtTiebreak(comparison: number, left: Loan, right: Loan): number {
		return comparison !== 0 ? comparison : right.createdAt.localeCompare(left.createdAt);
	}

	function formatAmount(amount: number, currency: string): string {
		const normalizedCurrency = (currency || 'SEK').toUpperCase();
		if (normalizedCurrency === 'SEK') {
			return `${formatLocalizedNumber(Math.round(amount))} kr`;
		}
		return `${formatLocalizedNumber(Math.round(amount))} ${normalizedCurrency}`;
	}

	function formatCompactAmount(amount: number): string {
		const absolute = Math.abs(amount);
		const prefix = amount > 0 ? '+' : amount < 0 ? '-' : '';
		return `${prefix}${formatLocalizedNumber(Math.round(absolute))} kr`;
	}

	function formatDate(date: string | null): string {
		return date ?? '-';
	}

	function toErrorMessage(error: unknown, fallbackMessage: string): string {
		return toUserMessage(error, fallbackMessage);
	}

	function apiRun<A, E, R>(work: (client: ApiClient) => Effect.Effect<A, E, R>): Promise<A> {
		return runUiEffect(withApiClient(fetch, work));
	}

	async function refreshLoans(): Promise<void> {
		loans = (await apiRun((client) => client.loans.listLoans({ urlParams: {} }))).slice();
	}

	async function runMutation(action: () => Promise<void>, fallbackMessage: string): Promise<void> {
		pending = true;
		errorMessage = null;

		try {
			await action();
		} catch (error) {
			errorMessage = toErrorMessage(error, fallbackMessage);
		} finally {
			pending = false;
		}
	}

	function createPayloadFromForm(): CreateLoanInput {
		return {
			direction: formDirection,
			counterparty: formCounterparty.trim(),
			principalAmount: formPrincipalAmount,
			outstandingAmount: formOutstandingAmount,
			currency: (formCurrency.trim() || 'SEK').toUpperCase(),
			issueDate: formIssueDate,
			dueDate: formDueDate.trim() || null,
			status: formStatus,
			notes: formNotes.trim() || null
		};
	}

	function resetForm(defaults?: Partial<Loan>): void {
		formDirection = defaults?.direction ?? 'borrowed';
		formCounterparty = defaults?.counterparty ?? '';
		formPrincipalAmount = defaults?.principalAmount ?? 0;
		formOutstandingAmount = defaults?.outstandingAmount ?? defaults?.principalAmount ?? 0;
		formCurrency = defaults?.currency ?? 'SEK';
		formIssueDate = defaults?.issueDate ?? new Date().toISOString().slice(0, 10);
		formDueDate = defaults?.dueDate ?? '';
		formStatus = defaults?.status ?? 'open';
		formNotes = defaults?.notes ?? '';
	}

	function openAddDialog(): void {
		dialogMode = 'add';
		editingLoanId = null;
		resetForm();
		dialogOpen = true;
	}

	function openEditDialog(loan: Loan): void {
		dialogMode = 'edit';
		editingLoanId = loan.id;
		resetForm(loan);
		dialogOpen = true;
	}

	async function handleSave(): Promise<void> {
		if (!formCounterparty.trim() || formPrincipalAmount < 0 || formOutstandingAmount < 0) return;

		await runMutation(async () => {
			const payload = createPayloadFromForm();
			if (dialogMode === 'add') {
				await apiRun((client) => client.loans.createLoan({ payload }));
			} else if (editingLoanId !== null) {
				const loanId = editingLoanId;
				await apiRun((client) =>
					client.loans.updateLoan({
						path: { loanId },
						payload
					})
				);
			}

			await refreshLoans();
			dialogOpen = false;
		}, 'Failed to save loan');
	}

	async function handleDelete(loanId: number): Promise<void> {
		if (!confirm('Delete this loan?')) return;

		await runMutation(async () => {
			await apiRun((client) =>
				client.loans.deleteLoan({
					path: { loanId }
				})
			);
			await refreshLoans();
		}, 'Failed to delete loan');
	}
</script>

<svelte:head>
	<title>Loans — HxFin</title>
</svelte:head>

<div class="app-page loans-page">
	<div class="app-toolbar">
		<div class="app-toolbar-left">
			<h1 class="app-page-title">Loans</h1>

			<SegmentedControl
				bind:value={statusFilter}
				options={statusFilterOptions}
				ariaLabel="Filter loans by status"
				class="loan-filter"
			/>

			<div class="app-toolbar-divider" aria-hidden="true"></div>

			<SegmentedControl
				bind:value={directionFilter}
				options={directionFilterOptions}
				ariaLabel="Filter loans by direction"
				class="loan-filter"
			/>
		</div>

		<div class="app-toolbar-right">
			<ToolbarActions>
				<ToolbarActionButton onclick={openAddDialog}>+ Loan</ToolbarActionButton>
			</ToolbarActions>
		</div>
	</div>

	{#if errorMessage}
		<Alert.Root class="border-destructive/50 bg-destructive/10">
			<Alert.Description class="flex items-center justify-between text-destructive text-xs">
				{errorMessage}
				<button type="button" onclick={() => (errorMessage = null)} class="ml-4 opacity-60 hover:opacity-100 text-xs">✕</button>
			</Alert.Description>
		</Alert.Root>
	{/if}

	<Table fill class="loans-table">
		{#snippet footer()}
			<div class="table-summary-copy">
				<span class="table-summary-label">Filtered outstanding</span>
				<span class="table-total-count">{filteredLoans.length} records</span>
			</div>
			<span class="table-summary-value">{formatAmount(filteredOutstandingTotal, 'SEK')}</span>
		{/snippet}
		<thead>
			<tr>
				<SortableTableHead class="w-[13%]" label="Direction" active={loanSort.key === 'direction'} direction={loanSort.direction} onToggle={() => toggleLoanSort('direction')} />
				<SortableTableHead class="w-[29%]" label="Counterparty" active={loanSort.key === 'counterparty'} direction={loanSort.direction} onToggle={() => toggleLoanSort('counterparty')} />
				<SortableTableHead class="w-[20%]" label="Timeline" active={loanSort.key === 'timeline'} direction={loanSort.direction} onToggle={() => toggleLoanSort('timeline')} />
				<SortableTableHead class="w-[13%]" label="Principal" align="right" active={loanSort.key === 'principal'} direction={loanSort.direction} onToggle={() => toggleLoanSort('principal')} />
				<SortableTableHead class="w-[13%]" label="Outstanding" align="right" active={loanSort.key === 'outstanding'} direction={loanSort.direction} onToggle={() => toggleLoanSort('outstanding')} />
				<SortableTableHead class="w-[12%]" label="Status" active={loanSort.key === 'status'} direction={loanSort.direction} onToggle={() => toggleLoanSort('status')} />
				<th class="actions-head"></th>
			</tr>
		</thead>

		<tbody>
			{#each filteredLoans as loan (loan.id)}
				<tr class="group">
					<td class="loan-cell">
						<span class="direction-pill" class:direction-pill-lent={loan.direction === 'lent'}>
							{DIRECTION_LABELS[loan.direction]}
						</span>
					</td>

					<td class="loan-cell counterparty-cell">
						<div class="counterparty-name">{loan.counterparty}</div>
						<div class="counterparty-meta">
							<span>{loan.currency}</span>
							{#if loan.notes}
								<span class="meta-separator" aria-hidden="true"></span>
								<span class="counterparty-note">{loan.notes}</span>
							{/if}
						</div>
					</td>

					<td class="loan-cell timeline-cell">
						<div class="timeline-primary">{formatDate(loan.dueDate)}</div>
						<div class="timeline-secondary">Issued {formatDate(loan.issueDate)}</div>
					</td>

					<td class="loan-cell amount-cell text-right">
						<div class="amount-primary">{formatAmount(loan.principalAmount, loan.currency)}</div>
					</td>

					<td class="loan-cell amount-cell text-right">
						<div class="amount-primary outstanding-amount">{formatAmount(loan.outstandingAmount, loan.currency)}</div>
					</td>

					<td class="loan-cell">
						<span
							class="status-pill"
							class:status-pill-paid={loan.status === 'paid'}
							class:status-pill-overdue={loan.status === 'overdue'}
						>
							{STATUS_LABELS[loan.status]}
						</span>
					</td>

					<td class="loan-cell actions-cell">
						<div class="row-actions">
							<button
								type="button"
								class="row-action"
								onclick={() => openEditDialog(loan)}
								aria-label="Edit loan"
								title="Edit loan"
							>
								<PencilIcon size={12} strokeWidth={1.8} />
							</button>
							<button
								type="button"
								class="row-action danger"
								onclick={() => handleDelete(loan.id)}
								aria-label="Delete loan"
								title="Delete loan"
							>
								<Trash2Icon size={12} strokeWidth={1.8} />
							</button>
						</div>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan={7} class="table-empty-state">
						No loans match the current filters.
					</td>
				</tr>
			{/each}
		</tbody>
	</Table>
</div>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="bg-card border-border sm:max-w-[520px]">
		<Dialog.Header>
			<Dialog.Title class="text-foreground">{dialogMode === 'add' ? 'Add loan' : 'Edit loan'}</Dialog.Title>
			<Dialog.Description class="text-muted-foreground text-sm">
				{dialogMode === 'add' ? 'Create a new loan record.' : 'Update this loan record.'}
			</Dialog.Description>
		</Dialog.Header>

		<div class="dialog-grid">
			<div class="form-field">
				<Label class="field-label">Direction</Label>
				<Select.Root
					type="single"
					value={formDirection}
					onValueChange={(value: string) => (formDirection = value as LoanDirection)}
				>
					<Select.Trigger class="w-full bg-muted border-border text-foreground">{DIRECTION_LABELS[formDirection]}</Select.Trigger>
					<Select.Content class="bg-card border-border">
						<Select.Item value="lent" class="text-foreground cursor-pointer">Lent</Select.Item>
						<Select.Item value="borrowed" class="text-foreground cursor-pointer">Borrowed</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>

			<div class="form-field">
				<Label class="field-label">Status</Label>
				<Select.Root
					type="single"
					value={formStatus}
					onValueChange={(value: string) => (formStatus = value as LoanStatus)}
				>
					<Select.Trigger class="w-full bg-muted border-border text-foreground">{STATUS_LABELS[formStatus]}</Select.Trigger>
					<Select.Content class="bg-card border-border">
						<Select.Item value="open" class="text-foreground cursor-pointer">Open</Select.Item>
						<Select.Item value="overdue" class="text-foreground cursor-pointer">Overdue</Select.Item>
						<Select.Item value="paid" class="text-foreground cursor-pointer">Paid</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>

			<div class="form-field full">
				<Label class="field-label">Counterparty</Label>
				<Input bind:value={formCounterparty} placeholder="Name or organization" class="bg-muted border-border text-foreground" />
			</div>

			<div class="form-field">
				<Label class="field-label">Principal</Label>
				<Input type="number" min="0" step="0.01" bind:value={formPrincipalAmount} class="bg-muted border-border text-foreground" />
			</div>

			<div class="form-field">
				<Label class="field-label">Outstanding</Label>
				<Input type="number" min="0" step="0.01" bind:value={formOutstandingAmount} class="bg-muted border-border text-foreground" />
			</div>

			<div class="form-field">
				<Label class="field-label">Issue date</Label>
				<Input type="date" bind:value={formIssueDate} class="bg-muted border-border text-foreground" />
			</div>

			<div class="form-field">
				<Label class="field-label">Due date</Label>
				<Input type="date" bind:value={formDueDate} class="bg-muted border-border text-foreground" />
			</div>

			<div class="form-field">
				<Label class="field-label">Currency</Label>
				<Input bind:value={formCurrency} maxlength={3} class="bg-muted border-border text-foreground uppercase" />
			</div>

			<div class="form-field full">
				<Label class="field-label">Notes</Label>
				<Input bind:value={formNotes} placeholder="Optional note" class="bg-muted border-border text-foreground" />
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="ghost" onclick={() => (dialogOpen = false)} class="text-muted-foreground">Cancel</Button>
			<Button
				onclick={handleSave}
				disabled={pending || !formCounterparty.trim() || formPrincipalAmount < 0 || formOutstandingAmount < 0}
				class="app-action-btn"
			>
				{dialogMode === 'add' ? 'Add loan' : 'Save'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	:global(.loan-filter) {
		margin-left: 4px;
		max-width: 100%;
	}

	.actions-head {
		width: 88px;
	}

	:global(.counterparty-cell) {
		min-width: 220px;
	}

	.counterparty-name {
		font-size: 1.16rem;
		font-weight: 700;
		color: var(--app-text-primary);
	}

	.counterparty-meta {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.24rem;
		font-size: 0.76rem;
		color: var(--app-text-muted);
		min-width: 0;
	}

	.counterparty-note {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta-separator {
		width: 3px;
		height: 3px;
		border-radius: 999px;
		background: currentColor;
		opacity: 0.55;
		flex: 0 0 auto;
	}

	.timeline-primary,
	.amount-primary {
		font-family: var(--ds-font-mono);
		font-size: 0.92rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--app-text-primary);
	}

	.timeline-secondary {
		margin-top: 0.24rem;
		font-size: 0.76rem;
		color: var(--app-text-muted);
	}

	.outstanding-amount {
		color: var(--app-accent-light);
	}

	.direction-pill,
	.status-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.22rem 0.6rem;
		border-radius: 999px;
		border: 1px solid var(--app-border);
		font-size: 0.69rem;
		font-weight: 700;
	}

	.direction-pill {
		color: var(--app-text-secondary);
		background: rgba(255, 255, 255, 0.04);
	}

	.direction-pill-lent {
		color: var(--app-accent-light);
		background: var(--app-accent-glow);
		border-color: color-mix(in oklab, var(--app-accent) 55%, var(--app-border));
	}

	.status-pill {
		color: var(--app-text-secondary);
		background: rgba(255, 255, 255, 0.03);
	}

	.status-pill-paid {
		color: var(--app-accent-light);
		background: color-mix(in oklab, var(--app-accent) 18%, transparent);
		border-color: color-mix(in oklab, var(--app-accent) 50%, var(--app-border));
	}

	.status-pill-overdue {
		color: var(--app-red);
		background: color-mix(in oklab, var(--app-red) 10%, transparent);
		border-color: color-mix(in oklab, var(--app-red) 38%, var(--app-border));
	}

	.row-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.35rem;
		opacity: 0;
		transition: opacity 0.16s var(--ds-ease);
	}

	:global(.group:hover) .row-actions,
	:global(.group:focus-within) .row-actions {
		opacity: 1;
	}

	.row-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 0.55rem;
		border: 1px solid var(--app-border);
		background: rgba(255, 255, 255, 0.025);
		color: var(--app-text-secondary);
		transition: color 0.16s var(--ds-ease), border-color 0.16s var(--ds-ease), background-color 0.16s var(--ds-ease);
	}

	.row-action:hover {
		color: var(--app-text-primary);
		border-color: var(--app-border-focus);
		background: rgba(255, 255, 255, 0.05);
	}

	.row-action.danger:hover {
		color: var(--app-red);
		border-color: color-mix(in oklab, var(--app-red) 60%, var(--app-border));
	}

	.table-total-count {
		font-size: 0.8rem;
		color: var(--app-text-secondary);
	}

	.dialog-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.38rem;
	}

	.form-field.full {
		grid-column: 1 / -1;
	}

	:global(.field-label) {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--app-text-secondary);
	}

	@media (max-width: 768px) {
		.row-actions {
			opacity: 1;
		}
	}

	@media (max-width: 640px) {
		.dialog-grid {
			grid-template-columns: 1fr;
		}
	}
</style>

