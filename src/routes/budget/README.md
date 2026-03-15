# Budget Route Patterns

This folder documents the current budget route pattern after the controller-based version was intentionally removed.

The guiding principle is:

- keep only shared route state in the page
- keep component-tied logic inside the component that uses it
- keep pure data derivation in a plain helper module
- keep transport details in a thin route-local API file

The budget route is now the reference for a lighter-weight feature slice where the page composes, the dialogs manage themselves, and the table owns its own sorting behavior.

## Folder layout

```text
src/routes/budget/
  +page.ts
  +page.svelte
  README.md
  api.ts
  selectors.ts
  components/
    CategoriesDialog.svelte
    CostDialog.svelte
    CostsTable.svelte
    ErrorAlert.svelte
    Toolbar.svelte
```

## Core pattern

### `+page.ts` owns canonical loading

[`+page.ts`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/+page.ts) is still the only source for canonical budget data:

- `categories`
- `costs`
- `summary`

The route continues to trust server-loaded data as the source of truth after mutations.

There is no optimistic client-side patching layer in this slice.

### `+page.svelte` owns only shared route state

[`+page.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/+page.svelte) is intentionally small.

It owns only state that is genuinely shared across multiple child components:

- `selectedCategoryFilter`
- shared page-level `errorMessage`
- route refresh via `invalidateAll()`
- route-level derived values:
  - `categoryMap`
  - `summaryByCategory`
  - `filteredCosts`
  - `filteredMonthlyTotal`
  - `activeCostCount`

It also binds to the two dialog component instances and calls their exported methods.

What does **not** belong in `+page.svelte`:

- table sort state
- dialog form fields
- dialog mode state
- dialog payload builders
- table comparator logic
- dialog reset logic

If new logic is only used by one component, it should not be promoted to the page.

### Components own their own behavior

This route no longer uses a dedicated controller file.

Instead:

- [`CostsTable.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/CostsTable.svelte) owns table sorting
- [`CostDialog.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/CostDialog.svelte) owns add/edit cost state and submit flow
- [`CategoriesDialog.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/CategoriesDialog.svelte) owns category management state and submit flow

The page coordinates those components, but it does not intermediate their local implementation details.

## Why there is no controller

The previous controller version improved file size but still over-centralized concerns that were tightly bound to specific components.

Examples:

- table sort logic only matters to the table
- dialog form reset rules only matter to the dialog
- add/edit mode inside a dialog only matters to that dialog

Pushing these concerns into a shared controller added extra indirection without creating real reuse.

The current rule is:

- shared route concern -> page
- component-local concern -> component

## Route-level data flow

The current route data flow is:

1. `+page.ts` loads canonical data
2. `+page.svelte` derives route-shared view data from the loaded result
3. the page passes those shared values into components
4. dialogs call `api.ts` directly for mutations
5. dialogs report failures back upward through `onError`
6. dialogs report success through `onSaved`
7. the page handles refresh by calling `invalidateAll()`
8. fresh route data flows back into the page and components

Important consequence:

- the page does not manually patch `categories`, `costs`, or `summary`

This is intentional. The route always rehydrates from the API load result.

## Shared state that stays in the page

The page keeps only what multiple components need.

### `selectedCategoryFilter`

Shared between:

- [`Toolbar.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/Toolbar.svelte)
- [`CostsTable.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/CostsTable.svelte)
- [`CostDialog.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/CostDialog.svelte)
- [`CategoriesDialog.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/CategoriesDialog.svelte)

This is route state because it defines the screen context, not a single component’s private behavior.

### `errorMessage`

The route keeps one shared error surface through [`ErrorAlert.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/ErrorAlert.svelte).

Dialogs and row-level actions do not render their own permanent error banners. They report failures upward through `onError(message)`, and the page decides how to display them.

### Refresh ownership

The page owns the shared refresh boundary through `invalidateAll()`.

This is shared because both dialogs and the page-level delete-cost action use the same refresh behavior.

## Pure helper pattern

[`selectors.ts`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/selectors.ts) remains the only plain helper module in the route.

Its purpose is narrow:

- derive route-shared view data from canonical budget data

Current helpers:

- `filterActiveCosts`
- `buildCategoryMap`
- `buildSummaryByCategory`
- `getFilteredMonthlyTotal`
- `getActiveCostCount`

Rules for this file:

- deterministic only
- no network calls
- no mutation orchestration
- no dialog state
- no table sorting
- no DOM logic

If logic needs `fetch`, dialog mode, or UI events, it does not belong here.

## API boundary pattern

[`api.ts`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/api.ts) is the route-local transport boundary.

It exists to keep raw `withApiClient(...)` calls out of the page and dialogs.

This file is allowed to know:

- which budget endpoint is called
- how payloads are passed
- how path parameters are passed
- how UI code executes the effect client

This file is not allowed to know:

- dialog mode
- local component state
- open/close behavior
- refresh strategy
- route filters

That separation keeps transport details simple and reusable while letting components own interaction flow.

## Component patterns

### `Toolbar.svelte`

[`Toolbar.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/Toolbar.svelte) is still a pure view component.

It owns:

- category tabs
- active cost count display
- “Manage Categories” button
- “Add Cost” button

It does not own:

- filter derivation
- mutation logic
- dialog logic

The toolbar emits intent; the page decides which dialog method to call.

### `ErrorAlert.svelte`

[`ErrorAlert.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/ErrorAlert.svelte) remains deliberately tiny.

It renders:

- current page-level error text
- dismiss action

This keeps the page free from repeated alert markup.

### `CostsTable.svelte`

[`CostsTable.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/CostsTable.svelte) is now fully responsible for table behavior.

It owns:

- current sort state
- default sort directions
- comparator helpers
- sort definitions
- row action dispatch
- table empty states

It receives:

- already filtered rows
- `categoryMap`
- `filteredMonthlyTotal`
- edit callback
- delete callback

It does **not** decide which rows are visible; the page still defines screen-wide filtering through `selectedCategoryFilter`.

#### Sort pattern

The table intentionally does not use one giant `switch` statement anymore.

Instead it uses:

- small local comparator helpers:
  - text
  - number
  - boolean
  - nullable text
  - created-at tiebreak
  - direction application
- a `sortDefinitions` map keyed by sortable column

This pattern matters because many of the old sort branches were the same idea repeated with different fields.

The route is budget-first here: the sort helpers stay local to the table component for now instead of being promoted to a shared library.

#### Why sort stays in the table

Sort state is presentation-local.

Nothing outside the table needs to know:

- which column is active
- whether sort is ascending or descending

So this state stays inside the table component.

### `CostDialog.svelte`

[`CostDialog.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/CostDialog.svelte) is now a feature-smart component.

It owns:

- internal `open` state
- add/edit mode
- cost form state
- validation
- normalization
- payload construction
- submit behavior
- cancel/reset behavior

It exposes imperative methods to the page through `bind:this`:

- `openAdd()`
- `openEdit(cost)`
- `close()`

This avoids pushing dialog-local mode and form state into the page.

#### Why the dialog owns its own submit flow

The cost dialog is the only place that understands:

- how a cost form is initialized
- what values are editable
- how `investment` affects `isEssential`
- how to normalize that form into a create/update payload

That logic is dialog-specific, so it stays inside the dialog.

#### Dialog error and success pattern

The cost dialog:

- catches failures locally
- converts them to a user-facing message
- reports errors upward via `onError(message)`
- reports success upward via `onSaved()`

It does not know how the page refreshes; it only knows that success should trigger the callback.

### `CategoriesDialog.svelte`

[`CategoriesDialog.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/CategoriesDialog.svelte) follows the same pattern.

It owns:

- internal `open` state
- add-category form state
- edit-category form state
- `editingCategoryId`
- local validation
- submit/update/delete flows
- dialog reset behavior

It exposes:

- `open()`
- `close()`

through `bind:this`.

#### Why this dialog keeps both add and edit state

Category management is a single visual feature surface. The add flow and edit flow are both local to this dialog.

Splitting them into page-level state or an external controller adds indirection without reuse.

#### Delete flow pattern

On delete success, the dialog:

1. performs the API call
2. checks whether the deleted category matches `selectedCategoryFilter`
3. calls `onCategoryDeleted(categoryId)` when relevant
4. calls `onSaved()`

The page still decides what to do with that deletion signal.

Currently the page resets the selected filter to `all` if the deleted category was active.

The category color picker is now inlined inside [`CategoriesDialog.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/CategoriesDialog.svelte) because it is small and only exists to support that dialog.

The category badge is now inlined inside [`CostsTable.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/CostsTable.svelte) for the same reason.

## Imperative component API pattern

This route now uses `bind:this` for the dialogs.

That is intentional.

Why this is acceptable here:

- the dialogs are feature components, not generic primitives
- the page only needs to trigger a few explicit commands
- imperative open methods are simpler than route-owned dialog mode state

Use this pattern when:

- the parent needs to start an interaction
- the child owns the interaction details

Avoid this pattern when:

- the child needs to be fully declarative and reusable across many features
- external state must control every part of the component

## What belongs where now

Use this decision guide for future budget changes.

### Put logic in `+page.svelte` if:

- multiple child components depend on it
- it defines screen-level context
- it coordinates refresh after mutation
- it owns the shared error surface

### Put logic in `CostsTable.svelte` if:

- it only affects sorting or row interaction presentation
- it is only used to render the table

### Put logic in `CostDialog.svelte` if:

- it only affects add/edit cost interactions
- it transforms cost form state
- it validates or submits cost data

### Put logic in `CategoriesDialog.svelte` if:

- it only affects add/edit/delete category interactions
- it resets category dialog state
- it validates or submits category data

### Put logic in `selectors.ts` if:

- it is pure
- it derives route-shared data
- it does not depend on component-local interaction state

### Put logic in `api.ts` if:

- it is just a typed client mutation helper
- it should be callable from multiple budget UI surfaces

## Anti-patterns this route avoids

The current budget slice is intentionally avoiding:

- a route-wide controller for component-local concerns
- route-level ownership of dialog form fields
- route-level ownership of table sort state
- per-column sort switches when generic comparators are enough
- components that are “dumb” views but still require a large external orchestration layer

## Relationship to the server budget slice

The route-local UI slice still maps cleanly to the server-local budget slice:

- [categories.repository.ts](/C:/Users/marti/Documents/projects/fin/src/lib/server/budget/categories.repository.ts)
- [costs.repository.ts](/C:/Users/marti/Documents/projects/fin/src/lib/server/budget/costs.repository.ts)
- [categories.service.ts](/C:/Users/marti/Documents/projects/fin/src/lib/server/budget/categories.service.ts)
- [costs.service.ts](/C:/Users/marti/Documents/projects/fin/src/lib/server/budget/costs.service.ts)
- [summary.service.ts](/C:/Users/marti/Documents/projects/fin/src/lib/server/budget/summary.service.ts)

The UI route does not mirror those files one-to-one anymore. That is also intentional.

The route is organized by UI ownership.

The server is organized by data and business responsibility.

Those are different boundaries and should not be forced to match mechanically.

## Testing pattern

The pure route helper tests now stay focused on the one remaining pure helper module:

- [tests/budget-selectors.test.ts](/C:/Users/marti/Documents/projects/fin/tests/budget-selectors.test.ts)

The cost/category form tests were removed because their logic now lives inside the dialog components that own it.

Current verification split:

- pure derivation logic -> direct unit tests
- Svelte structure and typing -> `svelte-check`
- interaction correctness -> manual feature scenarios

If a future dialog helper becomes large and clearly reusable, it can be extracted back into a plain `.ts` module and tested directly.

Until then, local dialog helper functions staying inside the component is the preferred tradeoff.

## How to extend this route

### Add a new sortable column

Update only [`CostsTable.svelte`](/C:/Users/marti/Documents/projects/fin/src/routes/budget/components/CostsTable.svelte):

1. add the key to `CostSortKey`
2. add a `sortDefinitions` entry
3. render a matching `SortableTableHead`
4. render the cell contents

Do not add a new switch branch elsewhere in the route.

### Add a new cost field

If the field is part of the cost dialog:

1. update `$lib/schema/budget`
2. update server handling
3. update the local form shape in `CostDialog.svelte`
4. update normalization and payload building in the same file
5. update the dialog markup

Do not reintroduce a route-wide form module unless the logic is reused by more than one UI surface.

### Add a new category behavior

If it is local to category management, keep it in `CategoriesDialog.svelte`.

Only promote it upward if another component also depends on the same state.

## Maintenance guardrails

Use these rules to keep the route from growing back into something over-abstracted:

- page owns shared state only
- table owns table state
- dialogs own dialog state
- selector module stays pure
- api module stays transport-only
- new abstractions should only be introduced when there is real reuse

If a future change introduces a new file, the first question should be:

- is this a real new responsibility, or are we just moving code around?

This route should stay easy to follow because each file answers one clear question:

- page: what is shared across the route?
- toolbar: what actions and filters are visible?
- table: how are rows presented and sorted?
- cost dialog: how do we add or edit a cost?
- categories dialog: how do we manage categories?
- api: how do we talk to the budget endpoints?
- selectors: what shared derived data does the route need?
