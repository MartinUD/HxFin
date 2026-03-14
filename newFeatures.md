# Product Integration Plan (Gradual Rollout)

## Core flow
This app should follow one consistent money flow:
1. Income
2. Budget allocations (essential, non-essential, investing)
3. Investments (current portfolio + projections)
4. Loans and wishlist (planned obligations and goals)
5. Monthly transactions import (actual spending feedback into budget)

Everything new should connect to this flow.

## What changed in this plan
- Added CSV monthly purchase import.
- Added categorization pipeline:
  - exact auto-match from previous categorized purchases
  - AI suggested category for unclear purchases
  - manual category override
- Reframed FIRE page into a general Investments page with editable current portfolio.
- Structured rollout into small releases with ease scores.

## Ease scoring model
- `Ease 10`: very easy, low risk, small change
- `Ease 7-9`: moderate change, clear implementation path
- `Ease 4-6`: larger cross-layer change
- `Ease 1-3`: hardest, high complexity/risk

## Feature scoring (by ease of implementation)
| Feature | Ease | Why |
|---|---:|---|
| AI category suggestion pipeline + review queue | 3 | model integration, confidence handling, fallback UX |

## Dependency order (must-follow)
1. Migration framework first (safe schema evolution).
2. AI suggestion layer last.

## Gradual rollout plan

### Release 0: Schema migration safety
Scope:
- Introduce `schema_migrations` and ordered migrations.
- Keep compatibility with current `data/budget.db`.

Why first:
- Every later feature adds tables/columns.

Done when:
- Existing DB upgrades automatically.
- Fresh DB installs cleanly.

---

### Release 6: AI category suggestions
Scope:
- Add AI suggestion step only for `needs_review` transactions.
- Store:
  - suggested category
  - confidence score
  - explanation snippet
- Human must confirm before finalizing category.

Safety rules:
- Never auto-apply low-confidence AI output.
- Manual category always wins.
- Accepted manual/AI decisions can create reusable merchant rules.

Done when:
- Review queue is faster and suggestions improve over time.

## Technical notes for this repo
- Follow existing server pattern:
  - `types.ts`, `validation.ts`, `repository.ts`, route handlers.
- Keep `handleApiError` contract unchanged for new APIs.
- Extend `src/lib/budget.ts` style with clients for finance, investments, loans, wishlist, imports.
- Update nav in `src/routes/+layout.svelte` gradually as each page ships.

## Incremental shipping checklist
Ship each release only when:
1. Schema migration passes on existing and fresh DB.
2. API contracts are validated.
3. Page can load and mutate data end-to-end.
4. Existing budget behavior is not regressed.

## Suggested implementation sequence (smallest useful slices)
1. Release 0
2. Release 6
