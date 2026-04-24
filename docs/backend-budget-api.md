# Backend Budget API (SvelteKit)

This project now includes a backend-only budget planner API built in SvelteKit server routes.
It is intentionally decoupled from the current frontend investment calculator.

## What Was Added

- SQLite-backed budget data model
- CRUD endpoints for budget categories
- CRUD endpoints for recurring costs
- Summary endpoint with monthly/yearly totals
- Input validation and consistent JSON error responses

## File Structure

```txt
src/
  lib/
    server/
      db.ts
      schema.ts
      http.ts
      budget/
        types.ts
        validation.ts
        repository.ts
        service.ts
  routes/
    api/
      budget/
        categories/
          +server.ts
          [categoryId]/
            +server.ts
        costs/
          +server.ts
          [costId]/
            +server.ts
        summary/
          +server.ts
docs/
  backend-budget-api.md
```

## Storage

- SQLite database file: `data/budget.db`
- Override DB path with env var: `BUDGET_DB_PATH`

### Tables

`budget_categories`
- `id TEXT PRIMARY KEY`
- `name TEXT NOT NULL`
- `description TEXT`
- `color TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

`recurring_costs`
- `id TEXT PRIMARY KEY`
- `category_id TEXT NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE`
- `name TEXT NOT NULL`
- `amount NUMERIC NOT NULL`
- `period TEXT NOT NULL` (`weekly | monthly | yearly`)
- `start_date TEXT`
- `end_date TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

## API Endpoints

Base path: `/api/budget`

### Categories

1. `GET /categories`
- Response: `{ "categories": BudgetCategory[] }`

2. `POST /categories`
- Body:
```json
{
  "name": "Housing",
  "description": "Fixed home costs",
  "color": "#0ea5e9"
}
```
- Response: `{ "category": BudgetCategory }` (`201`)

3. `PATCH /categories/:categoryId`
- Body (partial):
```json
{
  "name": "Housing & Utilities",
  "description": null
}
```
- Response: `{ "category": BudgetCategory }`

4. `DELETE /categories/:categoryId`
- Response: `204 No Content`
- Note: related recurring costs are deleted by cascade.

### Recurring Costs

1. `GET /costs?categoryIds=<id>&categoryIds=<id>`
- `categoryIds` is a repeatable query param; omit entirely for no filter.
- Response: `{ "costs": RecurringCost[] }`

2. `POST /costs`
- Body:
```json
{
  "categoryId": 1,
  "name": "Rent",
  "amount": 1800,
  "period": "monthly",
  "kind": "expense",
  "isEssential": true,
  "startDate": "2026-01-01",
  "endDate": null
}
```
- Response: `{ "cost": RecurringCost }` (`201`)

3. `PATCH /costs/:costId`
- Body (partial):
```json
{
  "amount": 1850
}
```
- Response: `{ "cost": RecurringCost }`

4. `DELETE /costs/:costId`
- Response: `204 No Content`

### Summary

1. `GET /summary`
- Response:
```json
{
  "summary": {
    "totalMonthlyRecurring": 2450.67,
    "totalYearlyRecurring": 29408.04,
    "categories": [
      {
        "categoryId": "uuid",
        "categoryName": "Housing",
        "monthlyTotal": 2100.00,
        "yearlyTotal": 25200.00
      }
    ]
  }
}
```

## Recurrence Normalization

Used for totals:

- `monthly -> amount`
- `weekly -> amount * 52 / 12`
- `yearly -> amount / 12`

## Types

### BudgetCategory

```ts
{
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### RecurringCost

```ts
{
  id: string;
  categoryId: string;
  name: string;
  amount: number;
  period: "weekly" | "monthly" | "yearly";
  kind: "expense" | "investment";
  isEssential: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## Error Response Contract

All failures return:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {}
  }
}
```

Common codes:
- `INVALID_JSON`
- `VALIDATION_ERROR`
- `CATEGORY_NOT_FOUND`
- `COST_NOT_FOUND`
- `INTERNAL_ERROR`

## Frontend Integration Notes

- Load `GET /api/budget/categories` first.
- Load `GET /api/budget/costs` to build editable budget rows.
- Load `GET /api/budget/summary` for aggregate cards/charts.
- Refresh summary after create/update/delete mutations.
- Treat `204` delete responses as success with no response body.

## Run

```bash
npm install
npm run dev
```

SvelteKit serves these endpoints on the same host as the app.
