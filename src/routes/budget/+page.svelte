<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { withApiClient } from "$lib/api/client";
    import {
        COST_KIND_OPTIONS,
        DEFAULT_COLOR,
        formatCurrency,
        PERIOD_OPTIONS,
    } from "$lib/budget";
    import ColorPicker from "$lib/components/budget/ColorPicker.svelte";
    import CostsTable from "$lib/components/budget/CostsTable.svelte";
    import ToggleGroup from "$lib/components/ToggleGroup.svelte";
    import * as Alert from "$lib/components/ui/alert";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import * as Select from "$lib/components/ui/select";
    import * as Tabs from "$lib/components/ui/tabs";
    import { toUserMessage } from "$lib/effect/errors";
    import { runUiEffect } from "$lib/effect/runtime/browser";
    import {
        buildCategoryMap,
        buildCreateCostInput,
        buildSummaryByCategory,
        buildUpdateCostInput,
        createCostDialogStateFromCost,
        createEmptyCostDialogState,
        filterActiveCosts,
        getFilteredMonthlyTotal,
        toBudgetErrorMessage,
    } from "$lib/features/budget/page-logic";
    import type { BudgetCategory, RecurringCost } from "$lib/schema/budget";
    import type { PageData } from "./$types";

    interface Props {
        data: PageData;
    }
    let { data }: Props = $props();

    let categories = $derived(data.categories as BudgetCategory[]);
    let costs = $derived(data.costs as RecurringCost[]);
    let summary = $derived(data.summary);

    let addingCategory = $state(false);
    let editingCategoryId = $state<string | null>(null);
    let selectedCategoryFilter = $state("all");
    let submitting = $state(false);
    let errorMessage = $state<string | null>(null);

    let costDialogOpen = $state(false);
    let costDialogMode = $state<"add" | "edit">("add");
    let categoriesDialogOpen = $state(false);

    let newCatName = $state("");
    let newCatDescription = $state("");
    let newCatColor = $state(DEFAULT_COLOR);

    let editCatName = $state("");
    let editCatDescription = $state("");
    let editCatColor = $state(DEFAULT_COLOR);

    let dialogCostId = $state("");
    let dialogCostName = $state("");
    let dialogCostAmount = $state<number>(0);
    let dialogCostPeriod = $state<"weekly" | "monthly" | "yearly">("monthly");
    let dialogCostKind = $state<"expense" | "investment">("expense");
    let dialogCostCategoryId = $state("");
    let dialogCostIsEssential = $state(false);
    let dialogCostIsActive = $state(true);

    let filteredCosts = $derived(
        filterActiveCosts(costs, selectedCategoryFilter),
    );
    let categoryMap = $derived(buildCategoryMap(categories));
    let summaryByCategory = $derived(buildSummaryByCategory(summary));
    let filteredMonthlyTotal = $derived(getFilteredMonthlyTotal(filteredCosts));

    let costDialogCategoryName = $derived(
        categoryMap.get(dialogCostCategoryId)?.name ?? "",
    );

    function setCostDialogState(
        nextState: ReturnType<typeof createEmptyCostDialogState>,
    ): void {
        dialogCostId = nextState.id;
        dialogCostName = nextState.name;
        dialogCostAmount = nextState.amount;
        dialogCostPeriod = nextState.period;
        dialogCostKind = nextState.kind;
        dialogCostCategoryId = nextState.categoryId;
        dialogCostIsEssential = nextState.isEssential;
        dialogCostIsActive = nextState.isActive;
    }

    $effect(() => {
        if (dialogCostKind === "investment" && dialogCostIsEssential) {
            dialogCostIsEssential = false;
        }
    });

    function openAddCostDialog() {
        costDialogMode = "add";
        setCostDialogState(
            createEmptyCostDialogState(
                selectedCategoryFilter !== "all"
                    ? selectedCategoryFilter
                    : (categories[0]?.id ?? ""),
            ),
        );
        costDialogOpen = true;
    }

    function openEditCostDialog(cost: RecurringCost) {
        costDialogMode = "edit";
        setCostDialogState(createCostDialogStateFromCost(cost));
        costDialogOpen = true;
    }

    function openAddCategory() {
        addingCategory = true;
        editingCategoryId = null;
        newCatName = "";
        newCatDescription = "";
        newCatColor = DEFAULT_COLOR;
    }

    function beginEditCategory(cat: BudgetCategory) {
        editingCategoryId = cat.id;
        addingCategory = false;
        editCatName = cat.name;
        editCatDescription = cat.description ?? "";
        editCatColor = cat.color ?? DEFAULT_COLOR;
    }

    async function runMutation(
        action: () => Promise<void>,
        fallbackMessage: string,
    ): Promise<void> {
        submitting = true;
        errorMessage = null;

        try {
            await action();
        } catch (e) {
            errorMessage =
                toBudgetErrorMessage(e, fallbackMessage) ??
                toUserMessage(e, fallbackMessage);
        } finally {
            submitting = false;
        }
    }

    async function handleAddCategory() {
        if (!newCatName.trim()) return;
        await runMutation(async () => {
            await runUiEffect(
                withApiClient(fetch, (client) =>
                    client.budget.createBudgetCategory({
                        payload: {
                            name: newCatName.trim(),
                            description: newCatDescription.trim() || null,
                            color: newCatColor,
                        },
                    }),
                ),
            );
            addingCategory = false;
            await invalidateAll();
        }, "Failed to add category");
    }

    async function handleSaveEditCategory() {
        if (!editingCategoryId || !editCatName.trim()) return;
        const categoryId = editingCategoryId;
        await runMutation(async () => {
            await runUiEffect(
                withApiClient(fetch, (client) =>
                    client.budget.updateBudgetCategory({
                        path: { categoryId },
                        payload: {
                            name: editCatName.trim(),
                            description: editCatDescription.trim() || null,
                            color: editCatColor,
                        },
                    }),
                ),
            );
            editingCategoryId = null;
            await invalidateAll();
        }, "Failed to update category");
    }

    async function handleDeleteCategory(id: string) {
        if (!confirm("Delete this category and all its costs?")) return;
        await runMutation(async () => {
            await runUiEffect(
                withApiClient(fetch, (client) =>
                    client.budget.deleteBudgetCategory({
                        path: { categoryId: id },
                    }),
                ),
            );
            if (selectedCategoryFilter === id) selectedCategoryFilter = "all";
            await invalidateAll();
        }, "Failed to delete category");
    }

    async function handleAddCost() {
        if (
            !dialogCostName.trim() ||
            !dialogCostCategoryId ||
            dialogCostAmount <= 0
        )
            return;
        await runMutation(async () => {
            await runUiEffect(
                withApiClient(fetch, (client) =>
                    client.budget.createRecurringCost({
                        payload: buildCreateCostInput({
                            id: "",
                            name: dialogCostName,
                            amount: dialogCostAmount,
                            period: dialogCostPeriod,
                            kind: dialogCostKind,
                            categoryId: dialogCostCategoryId,
                            isEssential: dialogCostIsEssential,
                            isActive: dialogCostIsActive,
                        }),
                    }),
                ),
            );
            costDialogOpen = false;
            await invalidateAll();
        }, "Failed to add cost");
    }

    async function handleSaveEditCost() {
        if (!dialogCostId || !dialogCostName.trim() || dialogCostAmount <= 0)
            return;
        await runMutation(async () => {
            await runUiEffect(
                withApiClient(fetch, (client) =>
                    client.budget.updateRecurringCost({
                        path: { costId: dialogCostId },
                        payload: buildUpdateCostInput({
                            id: dialogCostId,
                            name: dialogCostName,
                            amount: dialogCostAmount,
                            period: dialogCostPeriod,
                            kind: dialogCostKind,
                            categoryId: dialogCostCategoryId,
                            isEssential: dialogCostIsEssential,
                            isActive: dialogCostIsActive,
                        }),
                    }),
                ),
            );
            costDialogOpen = false;
            await invalidateAll();
        }, "Failed to update cost");
    }

    async function handleDeleteCost(id: string) {
        if (!confirm("Delete this recurring cost?")) return;
        await runMutation(async () => {
            await runUiEffect(
                withApiClient(fetch, (client) =>
                    client.budget.deleteRecurringCost({
                        path: { costId: id },
                    }),
                ),
            );
            await invalidateAll();
        }, "Failed to delete cost");
    }
</script>

<svelte:head>
    <title>Budget Tracker — FinDash</title>
</svelte:head>

<div class="budget-page">
    <!-- Filters + actions -->
    <div class="budget-toolbar">
        {#if categories.length > 0}
            <div class="budget-toolbar-filters">
                <Tabs.Root bind:value={selectedCategoryFilter}>
                    <Tabs.List class="budget-category-list">
                        <Tabs.Trigger value="all" class="budget-category-chip">
                            All
                            <span class="ml-1.5 opacity-60 text-[10px]"
                                >{costs.filter((c: RecurringCost) => c.isActive)
                                    .length}</span
                            >
                        </Tabs.Trigger>
                        {#each categories as cat}
                            <Tabs.Trigger
                                value={cat.id}
                                class="budget-category-chip flex items-center gap-1.5"
                            >
                                <span
                                    class="w-2 h-2 rounded-full flex-shrink-0"
                                    style="background: {cat.color ??
                                        DEFAULT_COLOR}"
                                ></span>
                                {cat.name}
                            </Tabs.Trigger>
                        {/each}
                    </Tabs.List>
                </Tabs.Root>
            </div>
        {/if}

        <div class="budget-actions">
            <Button
                variant="outline"
                size="sm"
                onclick={() => {
                    addingCategory = false;
                    editingCategoryId = null;
                    categoriesDialogOpen = true;
                }}
                class="bg-[rgba(0,0,0,0.34)] hover:bg-[rgba(0,0,0,0.46)] border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
            >
                Manage Categories
            </Button>
            <Button
                size="sm"
                onclick={openAddCostDialog}
                disabled={categories.length === 0}
            >
                + Add Cost
            </Button>
        </div>
    </div>

    <!-- Error -->
    {#if errorMessage}
        <Alert.Root class="border-destructive/50 bg-destructive/10">
            <Alert.Description
                class="flex items-center justify-between text-destructive"
            >
                {errorMessage}
                <button
                    type="button"
                    onclick={() => (errorMessage = null)}
                    class="ml-4 opacity-70 hover:opacity-100 text-sm leading-none"
                    >✕</button
                >
            </Alert.Description>
        </Alert.Root>
    {/if}

    <CostsTable
        {filteredCosts}
        categoriesCount={categories.length}
        {selectedCategoryFilter}
        {categoryMap}
        {filteredMonthlyTotal}
        onEditCost={openEditCostDialog}
        onDeleteCost={handleDeleteCost}
    />
</div>

<!-- ── Add / Edit Cost Dialog ── -->
<Dialog.Root bind:open={costDialogOpen}>
    <Dialog.Content class="bg-card border-border sm:max-w-[440px]">
        <Dialog.Header>
            <Dialog.Title class="text-foreground"
                >{costDialogMode === "add"
                    ? "Add Cost"
                    : "Edit Cost"}</Dialog.Title
            >
            <Dialog.Description class="text-muted-foreground text-sm">
                {costDialogMode === "add"
                    ? "Add a new recurring expense."
                    : "Update this recurring expense."}
            </Dialog.Description>
        </Dialog.Header>

        <div class="flex flex-col gap-4 py-2">
            <!-- Name -->
            <div class="flex flex-col gap-1.5">
                <Label
                    class="text-xs uppercase tracking-wide text-muted-foreground"
                    >Name</Label
                >
                <Input
                    bind:value={dialogCostName}
                    placeholder="e.g. Netflix"
                    class="bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
                />
            </div>

            <!-- Amount -->
            <div class="flex flex-col gap-1.5">
                <Label
                    class="text-xs uppercase tracking-wide text-muted-foreground"
                    >Amount</Label
                >
                <Input
                    type="number"
                    min="0"
                    step="0.01"
                    bind:value={dialogCostAmount}
                    placeholder="0"
                    class="bg-muted border-border text-foreground focus-visible:border-primary focus-visible:ring-primary/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
            </div>

            <!-- Period -->
            <div class="flex flex-col gap-1.5">
                <ToggleGroup
                    label="Period"
                    options={[...PERIOD_OPTIONS]}
                    bind:value={dialogCostPeriod}
                />
            </div>

            <!-- Type -->
            <div class="flex flex-col gap-1.5">
                <ToggleGroup
                    label="Type"
                    options={[...COST_KIND_OPTIONS]}
                    bind:value={dialogCostKind}
                />
            </div>

            <!-- Essential -->
            <div
                class="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2"
            >
                <div class="flex flex-col">
                    <Label
                        class="text-xs uppercase tracking-wide text-muted-foreground"
                        >Essential</Label
                    >
                    <p class="text-xs text-muted-foreground">
                        {dialogCostKind === "investment"
                            ? "Essential is only used for expenses"
                            : "Mark as must-pay monthly baseline"}
                    </p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={dialogCostIsEssential}
                    aria-label="Essential recurring cost"
                    class="essential-switch"
                    class:essential-switch-on={dialogCostIsEssential}
                    disabled={dialogCostKind === "investment"}
                    onclick={() =>
                        (dialogCostIsEssential = !dialogCostIsEssential)}
                >
                    <span
                        class="essential-switch-thumb"
                        class:essential-switch-thumb-on={dialogCostIsEssential}
                    ></span>
                </button>
            </div>

            <!-- Category -->
            <div class="flex flex-col gap-1.5">
                <Label
                    class="text-xs uppercase tracking-wide text-muted-foreground"
                    >Category</Label
                >
                <Select.Root
                    type="single"
                    value={dialogCostCategoryId}
                    onValueChange={(v: string) => {
                        dialogCostCategoryId = v ?? "";
                    }}
                >
                    <Select.Trigger
                        class="w-full bg-muted border-border text-foreground"
                    >
                        {costDialogCategoryName || "Select category"}
                    </Select.Trigger>
                    <Select.Content class="bg-card border-border">
                        {#each categories as cat}
                            <Select.Item
                                value={cat.id}
                                class="text-foreground cursor-pointer"
                            >
                                <span class="flex items-center gap-2">
                                    <span
                                        class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style="background: {cat.color ??
                                            DEFAULT_COLOR}"
                                    ></span>
                                    {cat.name}
                                </span>
                            </Select.Item>
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>
        </div>

        <Dialog.Footer>
            <Button
                variant="ghost"
                onclick={() => (costDialogOpen = false)}
                class="text-muted-foreground"
            >
                Cancel
            </Button>
            <Button
                onclick={costDialogMode === "add"
                    ? handleAddCost
                    : handleSaveEditCost}
                disabled={submitting ||
                    !dialogCostName.trim() ||
                    dialogCostAmount <= 0 ||
                    !dialogCostCategoryId}
                class="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
                {costDialogMode === "add" ? "Add Cost" : "Save"}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<!-- ── Manage Categories Dialog ── -->
<Dialog.Root bind:open={categoriesDialogOpen}>
    <Dialog.Content class="bg-card border-border sm:max-w-[500px]">
        <Dialog.Header>
            <Dialog.Title class="text-foreground">Categories</Dialog.Title>
            <Dialog.Description class="text-muted-foreground text-sm">
                Manage your budget categories and view their monthly totals.
            </Dialog.Description>
        </Dialog.Header>

        <div class="flex flex-col gap-1 max-h-[380px] overflow-y-auto py-1">
            {#each categories as cat (cat.id)}
                {#if editingCategoryId === cat.id}
                    <div class="cat-edit-form">
                        <div class="flex items-center gap-2">
                            <span
                                class="w-3 h-3 rounded-full flex-shrink-0"
                                style="background: {editCatColor}"
                            ></span>
                            <Input
                                bind:value={editCatName}
                                placeholder="Category name"
                                class="flex-1 bg-muted border-border text-foreground text-sm focus-visible:border-primary focus-visible:ring-primary/20"
                            />
                        </div>
                        <ColorPicker bind:value={editCatColor} />
                        <Input
                            bind:value={editCatDescription}
                            placeholder="Description (optional)"
                            class="bg-muted border-border text-foreground text-sm focus-visible:border-primary focus-visible:ring-primary/20"
                        />
                        <div class="flex gap-2">
                            <Button
                                size="sm"
                                onclick={handleSaveEditCategory}
                                disabled={submitting || !editCatName.trim()}
                                class="bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                                >Save</Button
                            >
                            <Button
                                size="sm"
                                variant="ghost"
                                onclick={() => (editingCategoryId = null)}
                                class="text-muted-foreground text-xs"
                                >Cancel</Button
                            >
                        </div>
                    </div>
                {:else}
                    <div class="cat-row">
                        <span
                            class="w-3 h-3 rounded-full flex-shrink-0"
                            style="background: {cat.color ?? DEFAULT_COLOR}"
                        ></span>
                        <div class="flex-1 min-w-0">
                            <p class="cat-row-name">{cat.name}</p>
                            {#if cat.description}
                                <p class="cat-row-desc">{cat.description}</p>
                            {/if}
                        </div>
                        <span class="cat-row-amount"
                            >{formatCurrency(
                                summaryByCategory.get(cat.id) ?? 0,
                            )}/mo</span
                        >
                        <div class="flex gap-1">
                            <button
                                type="button"
                                class="cat-action-btn"
                                onclick={() => beginEditCategory(cat)}
                                title="Edit"
                                aria-label={`Edit category ${cat.name}`}
                            >
                                <svg
                                    aria-hidden="true"
                                    focusable="false"
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path
                                        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                                    />
                                    <path
                                        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                                    />
                                </svg>
                            </button>
                            <button
                                type="button"
                                class="cat-action-btn danger"
                                onclick={() => handleDeleteCategory(cat.id)}
                                title="Delete"
                                aria-label={`Delete category ${cat.name}`}
                            >
                                <svg
                                    aria-hidden="true"
                                    focusable="false"
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path
                                        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                {/if}
            {:else}
                <p class="text-center text-muted-foreground text-sm py-6">
                    No categories yet.
                </p>
            {/each}
        </div>

        {#if addingCategory}
            <div class="cat-edit-form mt-2">
                <Input
                    bind:value={newCatName}
                    placeholder="Category name"
                    class="bg-muted border-border text-foreground text-sm focus-visible:border-primary focus-visible:ring-primary/20"
                />
                <ColorPicker bind:value={newCatColor} />
                <Input
                    bind:value={newCatDescription}
                    placeholder="Description (optional)"
                    class="bg-muted border-border text-foreground text-sm focus-visible:border-primary focus-visible:ring-primary/20"
                />
                <div class="flex gap-2">
                    <Button
                        size="sm"
                        onclick={handleAddCategory}
                        disabled={submitting || !newCatName.trim()}
                        class="bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                        >Add Category</Button
                    >
                    <Button
                        size="sm"
                        variant="ghost"
                        onclick={() => (addingCategory = false)}
                        class="text-muted-foreground text-xs">Cancel</Button
                    >
                </div>
            </div>
        {:else}
            <button
                type="button"
                class="add-cat-trigger"
                onclick={openAddCategory}
            >
                <svg
                    aria-hidden="true"
                    focusable="false"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <line x1="12" y1="5" x2="12" y2="19" /><line
                        x1="5"
                        y1="12"
                        x2="19"
                        y2="12"
                    />
                </svg>
                Add Category
            </button>
        {/if}

        <Dialog.Footer>
            <Button
                onclick={() => {
                    categoriesDialogOpen = false;
                    editingCategoryId = null;
                    addingCategory = false;
                }}
                class="bg-primary text-primary-foreground hover:bg-primary/90"
            >
                Done
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<style>
    .budget-page {
        width: 100%;
        max-width: none;
        margin: 0;
        padding: 14px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex: 1 1 auto;
        min-height: 0;
        height: 100%;
        overflow: hidden;
    }

    .budget-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        padding: 8px 6px 10px;
        border-radius: 12px;
    }

    .budget-toolbar-filters {
        flex: 1 1 340px;
        min-width: 0;
    }

    .budget-actions {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin-left: auto;
        flex: 0 0 auto;
    }

    :global(.budget-actions button) {
        height: 3rem;
        padding-inline: 1.15rem;
        font-size: 0.96rem;
        font-weight: 700;
        border-radius: 0.95rem;
    }

    :global(.budget-table-shell) {
        flex: 1 1 auto;
        min-height: 0;
    }

    :global(.budget-category-list) {
        height: auto;
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        padding: 0;
        background: transparent;
        border: 0;
        border-radius: 0;
        box-shadow: none;
    }

    :global([data-slot="tabs-trigger"].budget-category-chip) {
        height: 3rem;
        background:
            linear-gradient(
                180deg,
                rgba(255, 255, 255, 0.035),
                rgba(255, 255, 255, 0.01)
            ),
            color-mix(
                in oklab,
                var(--ds-glass-surface) 84%,
                rgba(12, 20, 14, 0.18)
            );
        border: 1px solid var(--ds-glass-border);
        border-radius: 999px;
        color: var(--app-text-secondary);
        font-size: 0.98rem;
        font-weight: 600;
        padding: 0.65rem 1.3rem;
        box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.04);
        transition:
            color 0.16s var(--ds-ease),
            border-color 0.16s var(--ds-ease),
            background-color 0.16s var(--ds-ease);
    }

    :global([data-slot="tabs-trigger"].budget-category-chip:hover) {
        color: var(--app-text-primary);
        background:
            linear-gradient(
                180deg,
                rgba(255, 255, 255, 0.05),
                rgba(255, 255, 255, 0.015)
            ),
            color-mix(
                in oklab,
                var(--ds-glass-surface) 88%,
                rgba(12, 20, 14, 0.12)
            );
    }

    :global(
        [data-slot="tabs-trigger"].budget-category-chip[data-state="active"]
    ) {
        background:
            linear-gradient(
                180deg,
                rgba(255, 255, 255, 0.045),
                rgba(255, 255, 255, 0.01)
            ),
            color-mix(
                in oklab,
                var(--ds-accent) 14%,
                color-mix(
                    in oklab,
                    var(--ds-glass-surface) 82%,
                    rgba(12, 20, 14, 0.1)
                )
            );
        color: var(--app-accent-light);
        border-color: color-mix(
            in oklab,
            var(--app-accent) 75%,
            var(--ds-glass-border)
        );
        box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.06);
    }

    :global(.budget-actions button) {
        background:
            linear-gradient(
                180deg,
                rgba(255, 255, 255, 0.04),
                rgba(255, 255, 255, 0.01)
            ),
            color-mix(
                in oklab,
                var(--ds-glass-surface) 84%,
                rgba(12, 20, 14, 0.16)
            );
        border-color: var(--ds-glass-border);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        color: var(--app-text-primary);
    }

    :global(.budget-actions button:hover) {
        background:
            linear-gradient(
                180deg,
                rgba(255, 255, 255, 0.05),
                rgba(255, 255, 255, 0.015)
            ),
            color-mix(
                in oklab,
                var(--ds-glass-surface) 88%,
                rgba(12, 20, 14, 0.1)
            );
    }

    /* Category dialog rows */
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

    /* Category edit form inside dialog */
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

    /* Add category trigger */
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
        border-color: color-mix(
            in oklab,
            var(--app-accent) 55%,
            var(--app-border)
        );
        box-shadow: 0 0 0 3px var(--app-accent-glow);
    }

    .essential-switch-on {
        background: color-mix(
            in oklab,
            var(--app-accent) 26%,
            rgba(0, 0, 0, 0.7)
        );
        border-color: color-mix(
            in oklab,
            var(--app-accent) 70%,
            var(--app-border)
        );
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

    @media (max-width: 768px) {
        .budget-page {
            padding-top: 72px;
        }
    }

    @media (max-width: 640px) {
        .budget-page {
            padding: 20px 16px 20px;
        }

        .budget-toolbar {
            align-items: stretch;
            padding: 8px;
        }

        .budget-actions {
            width: 100%;
            margin-left: 0;
            justify-content: flex-end;
        }
    }
</style>
