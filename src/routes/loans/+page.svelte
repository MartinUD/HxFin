<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import type * as Effect from 'effect/Effect';
	import { type ApiClient, withApiClient } from '$lib/api/client';
	import SortableTableHead from '$lib/components/SortableTableHead.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import * as Table from '$lib/components/ui/table';
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

	let hydratedFromLoad = $state(false);
	let loans = $state<Loan[]>([]);
	let pending = $state(false);
	let errorMessage = $state<string | null>(null);
	let dialogOpen = $state(false);
	let dialogMode = $state<'add' | 'edit'>('add');
	let editingLoanId = $state('');
	let statusFilter = $state<'all' | LoanStatus>('all');
	let directionFilter = $state<'all' | LoanDirection>('all');
	let loanSort = $state<{ key: LoanSortKey; direction: 'asc' | 'desc' }>({
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
		if (loanSort.key === key) {
			loanSort = {
				key,
				direction: loanSort.direction === 'asc' ? 'desc' : 'asc'
			};
			return;
		}

		loanSort = {
			key,
			direction: key === 'timeline' ? 'asc' : 'desc'
		};
	}

	function sortLoans(left: Loan, right: Loan): number {
		const factor = loanSort.direction === 'asc' ? 1 : -1;
		let comparison = 0;

		switch (loanSort.key) {
			case 'direction':
				comparison = left.direction.localeCompare(right.direction);
				break;
			case 'counterparty':
				comparison = left.counterparty.localeCompare(right.counterparty, undefined, { sensitivity: 'base' });
				break;
			case 'timeline':
				comparison = sortLoansByTimeline(left, right);
				break;
			case 'principal':
				comparison = left.principalAmount - right.principalAmount;
				break;
			case 'outstanding':
				comparison = left.outstandingAmount - right.outstandingAmount;
				break;
			case 'status':
				comparison = compareLoanStatus(left.status, right.status);
				break;
		}

		if (comparison === 0) {
			comparison = right.createdAt.localeCompare(left.createdAt);
		}

		return comparison * factor;
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
		editingLoanId = '';
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
			} else if (editingLoanId) {
				await apiRun((client) =>
					client.loans.updateLoan({
						path: { loanId: editingLoanId },
						payload
					})
				);
			}

			await refreshLoans();
			dialogOpen = false;
		}, 'Failed to save loan');
	}

	async function handleDelete(loanId: string): Promise<void> {
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
	<title>Loans — FinDash</title>
</svelte:head>

<div class="loans-page">
	<div class="topbar">
		<div class="topbar-left">
			<h1 class="page-title">Loans</h1>

			<div class="filter-group" role="group" aria-label="Filter by status">
				<button type="button" class="filter-chip" class:active={statusFilter === 'all'} onclick={() => (statusFilter = 'all')}>All</button>
				<button type="button" class="filter-chip" class:active={statusFilter === 'open'} onclick={() => (statusFilter = 'open')}>Open</button>
				<button type="button" class="filter-chip" class:active={statusFilter === 'overdue'} onclick={() => (statusFilter = 'overdue')}>Overdue</button>
				<button type="button" class="filter-chip" class:active={statusFilter === 'paid'} onclick={() => (statusFilter = 'paid')}>Paid</button>
			</div>

			<div class="topbar-divider" aria-hidden="true"></div>

			<div class="filter-group" role="group" aria-label="Filter by direction">
				<button type="button" class="filter-chip" class:active={directionFilter === 'all'} onclick={() => (directionFilter = 'all')}>All directions</button>
				<button type="button" class="filter-chip" class:active={directionFilter === 'lent'} onclick={() => (directionFilter = 'lent')}>Lent</button>
				<button type="button" class="filter-chip" class:active={directionFilter === 'borrowed'} onclick={() => (directionFilter = 'borrowed')}>Borrowed</button>
			</div>
		</div>

		<div class="topbar-right">
			<Button size="sm" variant="outline" class="toolbar-action-btn" onclick={openAddDialog}>
				+ Loan
			</Button>
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

	<div class="table-shell rounded-lg border border-border overflow-hidden">
		<div class="table-scroll">
			<Table.Root class="loans-table">
				<Table.Header>
					<Table.Row class="loans-header-row border-border hover:bg-transparent">
						<SortableTableHead class="loans-head w-[13%]" label="Direction" active={loanSort.key === 'direction'} direction={loanSort.direction} onToggle={() => toggleLoanSort('direction')} />
						<SortableTableHead class="loans-head w-[29%]" label="Counterparty" active={loanSort.key === 'counterparty'} direction={loanSort.direction} onToggle={() => toggleLoanSort('counterparty')} />
						<SortableTableHead class="loans-head w-[20%]" label="Timeline" active={loanSort.key === 'timeline'} direction={loanSort.direction} onToggle={() => toggleLoanSort('timeline')} />
						<SortableTableHead class="loans-head w-[13%]" label="Principal" align="right" active={loanSort.key === 'principal'} direction={loanSort.direction} onToggle={() => toggleLoanSort('principal')} />
						<SortableTableHead class="loans-head w-[13%]" label="Outstanding" align="right" active={loanSort.key === 'outstanding'} direction={loanSort.direction} onToggle={() => toggleLoanSort('outstanding')} />
						<SortableTableHead class="loans-head w-[12%]" label="Status" active={loanSort.key === 'status'} direction={loanSort.direction} onToggle={() => toggleLoanSort('status')} />
						<Table.Head class="loans-head actions-head"></Table.Head>
					</Table.Row>
				</Table.Header>

				<Table.Body>
					{#each filteredLoans as loan (loan.id)}
						<Table.Row class="border-border group">
							<Table.Cell class="loan-cell">
								<span class="direction-pill" class:direction-pill-lent={loan.direction === 'lent'}>
									{DIRECTION_LABELS[loan.direction]}
								</span>
							</Table.Cell>

							<Table.Cell class="loan-cell counterparty-cell">
								<div class="counterparty-name">{loan.counterparty}</div>
								<div class="counterparty-meta">
									<span>{loan.currency}</span>
									{#if loan.notes}
										<span class="meta-separator" aria-hidden="true"></span>
										<span class="counterparty-note">{loan.notes}</span>
									{/if}
								</div>
							</Table.Cell>

							<Table.Cell class="loan-cell timeline-cell">
								<div class="timeline-primary">{formatDate(loan.dueDate)}</div>
								<div class="timeline-secondary">Issued {formatDate(loan.issueDate)}</div>
							</Table.Cell>

							<Table.Cell class="loan-cell amount-cell text-right">
								<div class="amount-primary">{formatAmount(loan.principalAmount, loan.currency)}</div>
							</Table.Cell>

							<Table.Cell class="loan-cell amount-cell text-right">
								<div class="amount-primary outstanding-amount">{formatAmount(loan.outstandingAmount, loan.currency)}</div>
							</Table.Cell>

							<Table.Cell class="loan-cell">
								<span
									class="status-pill"
									class:status-pill-paid={loan.status === 'paid'}
									class:status-pill-overdue={loan.status === 'overdue'}
								>
									{STATUS_LABELS[loan.status]}
								</span>
							</Table.Cell>

							<Table.Cell class="loan-cell actions-cell">
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
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={7} class="empty-state">
								No loans match the current filters.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="table-total">
			<div class="table-total-copy">
				<span class="table-total-label">Filtered outstanding</span>
				<span class="table-total-count">{filteredLoans.length} records</span>
			</div>
			<span class="table-total-value">{formatAmount(filteredOutstandingTotal, 'SEK')}</span>
		</div>
	</div>
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
				class="toolbar-action-btn"
			>
				{dialogMode === 'add' ? 'Add loan' : 'Save'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.loans-page {
		width: 100%;
		max-width: none;
		margin: 0;
		padding: 14px 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-height: 0;
		height: 100%;
		overflow: hidden;
	}

	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		flex-wrap: wrap;
		padding: 4px 2px 10px;
		background: linear-gradient(180deg, color-mix(in oklab, var(--app-bg) 94%, transparent), transparent 92%);
	}

	.topbar-left,
	.topbar-right {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.topbar-left {
		flex: 1 1 auto;
		min-width: 0;
	}

	.topbar-right {
		flex: 0 0 auto;
		justify-content: flex-end;
	}

	.page-title {
		margin: 0;
		font-family: var(--ds-font-display);
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--app-text-primary);
	}

	.topbar-divider {
		width: 1px;
		height: 2rem;
		background: var(--ds-glass-border);
		flex: 0 0 auto;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.filter-chip {
		height: 2.5rem;
		padding: 0.55rem 1rem;
		border-radius: 999px;
		border: 1px solid var(--ds-glass-border);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.14));
		color: var(--app-text-secondary);
		font-size: 0.88rem;
		font-weight: 600;
		transition: color 0.16s var(--ds-ease), border-color 0.16s var(--ds-ease), background-color 0.16s var(--ds-ease);
	}

	.filter-chip:hover {
		color: var(--app-text-primary);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
			color-mix(in oklab, var(--ds-glass-surface) 88%, rgba(12, 20, 14, 0.1));
	}

	.filter-chip.active {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-accent) 14%, color-mix(in oklab, var(--ds-glass-surface) 82%, rgba(12, 20, 14, 0.1)));
		color: var(--app-accent-light);
		border-color: color-mix(in oklab, var(--app-accent) 75%, var(--ds-glass-border));
	}

	.table-shell {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		background:
			linear-gradient(180deg, var(--ds-glass-bg-strong), var(--ds-glass-bg)),
			var(--ds-glass-surface);
		backdrop-filter: blur(var(--ds-glass-blur));
		-webkit-backdrop-filter: blur(var(--ds-glass-blur));
		box-shadow: var(--ds-glass-shadow), inset 0 1px 0 var(--ds-glass-edge);
		border-color: var(--ds-glass-border);
		--table-container-bg: rgba(0, 0, 0, 0.08);
		--table-bg: transparent;
		--table-header-bg: rgba(0, 0, 0, 0.06);
	}

	.table-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
	}

	:global(.loans-header-row) {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.14));
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		box-shadow:
			inset 0 -1px 0 var(--ds-glass-border),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	:global(.loans-head) {
		height: 3.7rem;
		padding: 1.15rem 1.25rem;
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0;
		text-transform: none;
		color: var(--app-text-secondary);
	}

	:global(.actions-head) {
		width: 88px;
	}

	:global(.loan-cell) {
		padding: 1.15rem 1.25rem;
		vertical-align: middle;
		font-size: 1.06rem;
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

	.table-total {
		position: sticky;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 1.1rem 1rem;
		border-top: 1px solid var(--ds-glass-border);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.12)),
			color-mix(in oklab, var(--ds-glass-surface) 92%, transparent);
	}

	.table-total-copy {
		display: flex;
		align-items: baseline;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.table-total-label {
		font-family: var(--ds-font-display);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--app-text-muted);
	}

	.table-total-count {
		font-size: 0.8rem;
		color: var(--app-text-secondary);
	}

	.table-total-value {
		font-family: var(--ds-font-mono);
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--app-accent-light);
		font-variant-numeric: tabular-nums;
	}

	:global(.empty-state) {
		padding: 4.5rem 1rem;
		text-align: center;
		font-size: 0.92rem;
		color: var(--app-text-muted);
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

	:global(.toolbar-action-btn) {
		height: 2.8rem;
		padding-inline: 1rem;
		border-radius: 0.9rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
			color-mix(in oklab, var(--ds-glass-surface) 84%, rgba(12, 20, 14, 0.16));
		border-color: var(--ds-glass-border);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
		color: var(--app-text-primary);
		font-weight: 600;
	}

	:global(.toolbar-action-btn:hover) {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
			color-mix(in oklab, var(--ds-glass-surface) 88%, rgba(12, 20, 14, 0.1));
	}

	@media (max-width: 960px) {
		.topbar-left,
		.topbar-right {
			width: 100%;
		}

		.topbar-right {
			justify-content: flex-start;
		}

		.topbar-divider {
			display: none;
		}
	}

	@media (max-width: 768px) {
		.loans-page {
			padding-top: 68px;
		}

		.row-actions {
			opacity: 1;
		}
	}

	@media (max-width: 640px) {
		.loans-page {
			padding: 16px 14px 32px;
		}

		.dialog-grid {
			grid-template-columns: 1fr;
		}

		.table-total {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
