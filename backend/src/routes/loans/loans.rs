//! CRUD for loans (money lent and borrowed).
//!
//! `loans.id` is `INTEGER PRIMARY KEY AUTOINCREMENT` and the only other table
//! that references it is `planned_purchases.linked_loan_id` (also INTEGER).
//!
//! Frontend contract: `src/lib/schema/loans.ts` (`LoanSchema`,
//! `CreateLoanInputSchema`, `UpdateLoanInputSchema`, `ListLoansQuerySchema`).

use crate::{db::Db, errors::AppError};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, patch, post},
    Json, Router,
};
// serde_html_form-backed Query handles optional/missing params the same
// way stock axum Query does; axum_extra for consistency with the sibling
// modules (costs.rs, items.rs) that already use it.
use axum_extra::extract::Query;
use serde::{Deserialize, Serialize};
use sqlx::{QueryBuilder, Sqlite};

// Mirrors the frontend literal unions. The DB also has matching CHECK
// constraints; the explicit lists here let us return a clean 400 before
// sqlx surfaces a CHECK violation.
const DIRECTIONS: &[&str] = &["lent", "borrowed"];
const STATUSES: &[&str] = &["open", "paid", "overdue"];

// Mirrors `Schema.maxLength(160)` on `CreateLoanInputSchema.counterparty`.
const MAX_COUNTERPARTY_LENGTH: usize = 160;
// Mirrors `PositiveAmountSchema` bounds in src/lib/schema/common.ts.
const MAX_AMOUNT: f64 = 1_000_000_000.0;
// Mirrors `CurrencySchema` (ISO-4217 is always 3 letters).
const CURRENCY_CODE_LENGTH: usize = 3;

// Defaults applied on create when the frontend omits these fields.
const DEFAULT_STATUS: &str = "open";
const DEFAULT_CURRENCY: &str = "SEK";

#[derive(Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Loan {
    pub id: i64,
    pub direction: String,
    pub counterparty: String,
    pub principal_amount: f64,
    pub outstanding_amount: f64,
    pub currency: String,
    pub issue_date: String,
    pub due_date: Option<String>,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub direction: Option<String>,
    pub status: Option<String>,
}

// Create payload mirrors `CreateLoanInputSchema`. Service-side defaults:
// `outstandingAmount` → `principalAmount`, `status` → "open",
// `currency` → "SEK".
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLoan {
    pub direction: String,
    pub counterparty: String,
    pub principal_amount: f64,
    pub outstanding_amount: Option<f64>,
    pub currency: Option<String>,
    pub issue_date: String,
    pub due_date: Option<String>,
    pub status: Option<String>,
    pub notes: Option<String>,
}

// Full-replacement PATCH (matches `recurring/costs.rs` and
// `planned_purchases/items.rs`). `loans/+page.svelte`'s
// `createPayloadFromForm()` already ships every field on every edit, so
// this is a no-op on the wire.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLoan {
    pub direction: String,
    pub counterparty: String,
    pub principal_amount: f64,
    pub outstanding_amount: f64,
    pub currency: String,
    pub issue_date: String,
    pub due_date: Option<String>,
    pub status: String,
    pub notes: Option<String>,
}

pub fn router() -> Router<Db> {
    Router::new()
        .route("/", get(list))
        .route("/", post(create))
        .route("/{id}", patch(update))
        .route("/{id}", delete(remove))
}

// CAST amounts AS REAL for the same reason `recurring/costs.rs` does —
// SQLite's NUMERIC affinity can store integer-looking values as INTEGER,
// and sqlx refuses to decode those into f64 without an explicit cast.
const SELECT_COLUMNS: &str = "id, direction, counterparty, \
     CAST(principal_amount AS REAL) AS principal_amount, \
     CAST(outstanding_amount AS REAL) AS outstanding_amount, \
     currency, issue_date, due_date, status, notes, created_at, updated_at";

// Trimmed, defaults-applied, owned-currency form of the payload. We
// validate once and bind the normalized values so the DB row matches what
// we actually checked.
struct Normalized<'a> {
    direction: &'a str,
    counterparty: &'a str,
    principal_amount: f64,
    outstanding_amount: f64,
    // Owned because the caller's currency may need `.trim().to_uppercase()`
    // applied before binding.
    currency: String,
    issue_date: &'a str,
    due_date: Option<&'a str>,
    status: &'a str,
    notes: Option<&'a str>,
}

// TS's `normalizeNullableText`: whitespace-only strings treated as null so
// a blank `notes` / `due_date` input doesn't persist as an empty string.
fn blank_to_none(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|t| !t.is_empty())
}

fn validate_enum<'a>(field: &str, value: &'a str, allowed: &[&str]) -> Result<&'a str, AppError> {
    if allowed.contains(&value) {
        Ok(value)
    } else {
        Err(AppError::Validation(format!("Invalid {field}: {value}")))
    }
}

fn validate_amount(label: &str, value: f64) -> Result<(), AppError> {
    if !value.is_finite() || !(0.0..=MAX_AMOUNT).contains(&value) {
        return Err(AppError::Validation(format!(
            "{label} must be between 0 and 1,000,000,000"
        )));
    }
    Ok(())
}

// Shared validator invoked from both create and update. Callers pass raw
// (possibly default-filled) &str slices; we trim/normalize and return a
// struct that borrows from the same lifetime — except `currency`, which is
// owned so we can store the uppercased form.
fn validate<'a>(
    direction: &'a str,
    counterparty: &'a str,
    principal_amount: f64,
    outstanding_amount: f64,
    currency: &str,
    issue_date: &'a str,
    due_date: Option<&'a str>,
    status: &'a str,
    notes: Option<&'a str>,
) -> Result<Normalized<'a>, AppError> {
    let direction = validate_enum("direction", direction, DIRECTIONS)?;
    let status = validate_enum("status", status, STATUSES)?;

    let counterparty = counterparty.trim();
    if counterparty.is_empty() {
        return Err(AppError::Validation("Counterparty cannot be empty".into()));
    }
    // chars().count() — match `Schema.maxLength(160)` which counts Unicode
    // code points rather than bytes.
    if counterparty.chars().count() > MAX_COUNTERPARTY_LENGTH {
        return Err(AppError::Validation(format!(
            "Counterparty must be {MAX_COUNTERPARTY_LENGTH} characters or fewer"
        )));
    }

    validate_amount("principalAmount", principal_amount)?;
    validate_amount("outstandingAmount", outstanding_amount)?;

    let currency_trimmed = currency.trim();
    if currency_trimmed.chars().count() != CURRENCY_CODE_LENGTH {
        return Err(AppError::Validation(format!(
            "currency must be a {CURRENCY_CODE_LENGTH}-letter ISO-4217 code"
        )));
    }
    let currency = currency_trimmed.to_ascii_uppercase();

    let due_date = blank_to_none(due_date);
    let notes = blank_to_none(notes);

    // Business rule not enforced by the DB: a dueDate before issueDate
    // doesn't make sense. Mirrors `assertDateRange` in the old service.ts.
    // Both dates are lexicographically-comparable ISO `YYYY-MM-DD` strings,
    // so string compare matches calendar compare.
    if let Some(due) = due_date {
        if due < issue_date {
            return Err(AppError::Validation(
                "dueDate must be greater than or equal to issueDate".into(),
            ));
        }
    }

    // Business rule not enforced by the DB: once a loan is paid, its
    // outstanding should be zero. Mirrors `assertStatusAmount`.
    if status == "paid" && outstanding_amount != 0.0 {
        return Err(AppError::Validation(
            "outstandingAmount must be 0 when status is paid".into(),
        ));
    }

    Ok(Normalized {
        direction,
        counterparty,
        principal_amount,
        outstanding_amount,
        currency,
        issue_date,
        due_date,
        status,
        notes,
    })
}

// GET /loans
//
// Sort order mirrors the old service.ts: dated loans first by earliest-
// due (`due_date IS NULL ASC` puts 0/false rows before 1/true, i.e. NULLS
// LAST), then creation time as the tiebreak.
async fn list(
    State(db): State<Db>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<Loan>>, AppError> {
    let mut qb: QueryBuilder<Sqlite> =
        QueryBuilder::new(format!("SELECT {SELECT_COLUMNS} FROM loans"));

    // Bogus filter values just yield empty results — no need to validate a
    // read-only filter; the DB CHECK still protects writes.
    let mut has_where = false;
    if let Some(direction) = query.direction.as_deref() {
        qb.push(" WHERE direction = ").push_bind(direction);
        has_where = true;
    }
    if let Some(status) = query.status.as_deref() {
        qb.push(if has_where { " AND " } else { " WHERE " });
        qb.push("status = ").push_bind(status);
    }

    qb.push(" ORDER BY due_date IS NULL ASC, due_date ASC, created_at DESC");

    let loans: Vec<Loan> = qb.build_query_as().fetch_all(&db).await?;

    Ok(Json(loans))
}

// POST /loans
async fn create(
    State(db): State<Db>,
    Json(payload): Json<CreateLoan>,
) -> Result<(StatusCode, Json<Loan>), AppError> {
    let outstanding = payload
        .outstanding_amount
        .unwrap_or(payload.principal_amount);
    let status = payload.status.as_deref().unwrap_or(DEFAULT_STATUS);
    let currency = payload.currency.as_deref().unwrap_or(DEFAULT_CURRENCY);

    let n = validate(
        &payload.direction,
        &payload.counterparty,
        payload.principal_amount,
        outstanding,
        currency,
        &payload.issue_date,
        payload.due_date.as_deref(),
        status,
        payload.notes.as_deref(),
    )?;

    // id is INTEGER PRIMARY KEY AUTOINCREMENT — SQLite assigns it on INSERT.
    let now = crate::time::iso_timestamp_now();
    let sql = format!(
        "INSERT INTO loans \
         (direction, counterparty, principal_amount, outstanding_amount, \
          currency, issue_date, due_date, status, notes, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) \
         RETURNING {SELECT_COLUMNS}"
    );
    let loan: Loan = sqlx::query_as(&sql)
        .bind(n.direction)
        .bind(n.counterparty)
        .bind(n.principal_amount)
        .bind(n.outstanding_amount)
        .bind(&n.currency)
        .bind(n.issue_date)
        .bind(n.due_date)
        .bind(n.status)
        .bind(n.notes)
        .bind(&now)
        .bind(&now)
        .fetch_one(&db)
        .await?;

    Ok((StatusCode::CREATED, Json(loan)))
}

// PATCH /loans/{id}
//
// Full replacement — see `UpdateLoan` for the rationale.
async fn update(
    State(db): State<Db>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateLoan>,
) -> Result<Json<Loan>, AppError> {
    let n = validate(
        &payload.direction,
        &payload.counterparty,
        payload.principal_amount,
        payload.outstanding_amount,
        &payload.currency,
        &payload.issue_date,
        payload.due_date.as_deref(),
        &payload.status,
        payload.notes.as_deref(),
    )?;

    let now = crate::time::iso_timestamp_now();
    let sql = format!(
        "UPDATE loans \
         SET direction = ?, counterparty = ?, principal_amount = ?, \
             outstanding_amount = ?, currency = ?, issue_date = ?, \
             due_date = ?, status = ?, notes = ?, updated_at = ? \
         WHERE id = ? \
         RETURNING {SELECT_COLUMNS}"
    );
    let loan: Loan = sqlx::query_as(&sql)
        .bind(n.direction)
        .bind(n.counterparty)
        .bind(n.principal_amount)
        .bind(n.outstanding_amount)
        .bind(&n.currency)
        .bind(n.issue_date)
        .bind(n.due_date)
        .bind(n.status)
        .bind(n.notes)
        .bind(&now)
        .bind(id)
        .fetch_optional(&db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Loan {id} not found")))?;

    Ok(Json(loan))
}

// DELETE /loans/{id}
//
// `planned_purchases.linked_loan_id` has `ON DELETE SET NULL`, so any linked
// planned purchase survives the deletion with a null reference — the DB
// handles cleanup for us.
async fn remove(State(db): State<Db>, Path(id): Path<i64>) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM loans WHERE id = ?")
        .bind(id)
        .execute(&db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Loan {id} not found")));
    }

    Ok(StatusCode::NO_CONTENT)
}
