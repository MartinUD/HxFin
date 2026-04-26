//! CRUD for planned-purchase items.
//!
//! `id`, `category_id`, and `linked_loan_id` are all INTEGER.
//!
//! Frontend contract: `src/lib/schema/wishlist.ts` (`WishlistItemSchema`,
//! `CreateWishlistItemInputSchema`, `UpdateWishlistItemInputSchema`,
//! `ListWishlistItemsQuerySchema`).

use crate::{db::Db, errors::AppError};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, patch, post},
    Json, Router,
};
// serde_html_form-backed Query handles optional/missing params the same way
// stock axum Query does; we use axum_extra here for consistency with costs.rs.
use axum_extra::extract::Query;
use serde::{Deserialize, Serialize};
use sqlx::{QueryBuilder, Sqlite};

// Mirrors `CreateWishlistItemInputSchema.name.maxLength(160)` in wishlist.ts.
const MAX_NAME_LENGTH: usize = 160;

// Mirrors the frontend literal unions. These also have matching DB CHECK
// constraints (see migration 0020) — the explicit lists here just let us
// return a clean 400 before sqlx surfaces a CHECK violation.
const FUNDING_STRATEGIES: &[&str] = &["save", "loan", "mixed", "buy_outright"];
const TARGET_AMOUNT_TYPES: &[&str] = &["exact", "estimate"];

#[derive(Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PlannedPurchase {
    pub id: i64,
    pub name: String,
    pub target_amount: f64,
    pub target_amount_type: String,
    pub target_date: Option<String>,
    pub priority: i64,
    pub category_id: Option<i64>,
    pub funding_strategy: String,
    pub linked_loan_id: Option<i64>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    // Optional filter: `?fundingStrategy=save`.
    pub funding_strategy: Option<String>,
}

// Full-replacement POST/PATCH shape (matches `categories.rs`): every
// persistable field is always sent, which dodges the absent-vs-null
// ambiguity serde otherwise leaves us with for nullable columns.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchasePayload {
    pub name: String,
    pub target_amount: f64,
    pub target_amount_type: String,
    pub target_date: Option<String>,
    pub priority: i64,
    pub category_id: Option<i64>,
    pub funding_strategy: String,
    pub linked_loan_id: Option<i64>,
    pub notes: Option<String>,
}

pub fn router() -> Router<Db> {
    Router::new()
        .route("/planned-purchases", get(list))
        .route("/planned-purchases", post(create))
        .route("/planned-purchases/{id}", patch(update))
        .route("/planned-purchases/{id}", delete(remove))
}

// `currency` is hardcoded 'SEK' in storage and not part of the frontend
// schema, so it stays out of SELECT_COLUMNS / the response type entirely.
const SELECT_COLUMNS: &str = "id, name, CAST(target_amount AS REAL) AS target_amount, \
     target_amount_type, target_date, priority, category_id, funding_strategy, \
     linked_loan_id, notes, created_at, updated_at";

// Trimmed, empty-collapsed-to-None form of the incoming payload. We validate
// once and then bind the normalized values so the DB row matches what we
// actually checked.
struct Normalized<'a> {
    name: &'a str,
    target_amount: f64,
    target_amount_type: &'a str,
    target_date: Option<&'a str>,
    priority: i64,
    category_id: Option<i64>,
    funding_strategy: &'a str,
    linked_loan_id: Option<i64>,
    notes: Option<&'a str>,
}

// TS's `normalizeNullableText`: treat whitespace-only strings as null so a
// blank text input from the frontend doesn't persist as an empty `notes`.
fn blank_to_none(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|trimmed| !trimmed.is_empty())
}

fn validate(payload: &PurchasePayload) -> Result<Normalized<'_>, AppError> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::Validation("Name cannot be empty".into()));
    }
    // chars().count() — match the TS `Schema.maxLength(160)`, which counts
    // Unicode code points rather than bytes.
    if name.chars().count() > MAX_NAME_LENGTH {
        return Err(AppError::Validation(format!(
            "Name must be {MAX_NAME_LENGTH} characters or fewer"
        )));
    }

    // PositiveAmountSchema on the frontend; the DB has no CHECK on positivity.
    // Reject NaN/±Infinity here so they can't sneak into storage as NULL/0.
    if !payload.target_amount.is_finite() || payload.target_amount <= 0.0 {
        return Err(AppError::Validation(
            "Target amount must be a positive number".into(),
        ));
    }

    if !(0..=10).contains(&payload.priority) {
        return Err(AppError::Validation(
            "Priority must be between 0 and 10".into(),
        ));
    }

    let target_amount_type = payload.target_amount_type.as_str();
    if !TARGET_AMOUNT_TYPES.contains(&target_amount_type) {
        return Err(AppError::Validation(format!(
            "Invalid targetAmountType: {target_amount_type}"
        )));
    }

    let funding_strategy = payload.funding_strategy.as_str();
    if !FUNDING_STRATEGIES.contains(&funding_strategy) {
        return Err(AppError::Validation(format!(
            "Invalid fundingStrategy: {funding_strategy}"
        )));
    }

    let linked_loan_id = payload.linked_loan_id;
    let notes = blank_to_none(payload.notes.as_deref());
    let target_date = blank_to_none(payload.target_date.as_deref());

    // Business rule not enforced by the DB: "save" and "buy_outright" mean
    // no loan is involved, so a linkedLoanId wouldn't make sense. Matches
    // `assertFundingLoanCombination` in the old service.ts.
    if matches!(funding_strategy, "save" | "buy_outright") && linked_loan_id.is_some() {
        return Err(AppError::Validation(
            "linkedLoanId must be null when fundingStrategy does not use a loan".into(),
        ));
    }

    Ok(Normalized {
        name,
        target_amount: payload.target_amount,
        target_amount_type,
        target_date,
        priority: payload.priority,
        category_id: payload.category_id,
        funding_strategy,
        linked_loan_id,
        notes,
    })
}

// Explicit existence checks so we can return a clean 404 with the right
// resource name instead of a generic FK-violation 500. The DB's FK enforcement
// (PRAGMA foreign_keys = ON) still acts as a last line of defense.
async fn ensure_category_exists(db: &Db, id: i64) -> Result<(), AppError> {
    let exists = sqlx::query_scalar::<_, i64>("SELECT 1 FROM purchase_categories WHERE id = ?")
        .bind(id)
        .fetch_optional(db)
        .await?
        .is_some();

    if !exists {
        return Err(AppError::NotFound(format!(
            "Purchase category {id} not found"
        )));
    }
    Ok(())
}

async fn ensure_loan_exists(db: &Db, id: i64) -> Result<(), AppError> {
    let exists = sqlx::query_scalar::<_, i64>("SELECT 1 FROM loans WHERE id = ?")
        .bind(id)
        .fetch_optional(db)
        .await?
        .is_some();

    if !exists {
        return Err(AppError::NotFound(format!("Loan {id} not found")));
    }
    Ok(())
}

async fn ensure_fk_targets_exist(db: &Db, n: &Normalized<'_>) -> Result<(), AppError> {
    if let Some(cat_id) = n.category_id {
        ensure_category_exists(db, cat_id).await?;
    }
    if let Some(loan_id) = n.linked_loan_id {
        ensure_loan_exists(db, loan_id).await?;
    }
    Ok(())
}

// GET /budget/planned-purchases
//
// Sort order mirrors the old service.ts: highest priority first, then by
// target date (NULLS LAST — `IS NULL ASC` puts 0/false rows before 1/true),
// then by creation time so freshly-added items win ties.
async fn list(
    State(db): State<Db>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<PlannedPurchase>>, AppError> {
    let mut qb: QueryBuilder<Sqlite> =
        QueryBuilder::new(format!("SELECT {SELECT_COLUMNS} FROM planned_purchases"));

    if let Some(strategy) = query.funding_strategy.as_deref() {
        // Bogus values simply return an empty list — no need to validate a
        // read-only filter; the DB CHECK protects writes.
        qb.push(" WHERE funding_strategy = ").push_bind(strategy);
    }

    qb.push(" ORDER BY priority DESC, target_date IS NULL ASC, target_date ASC, created_at DESC");

    let items: Vec<PlannedPurchase> = qb.build_query_as().fetch_all(&db).await?;

    Ok(Json(items))
}

// POST /budget/planned-purchases
async fn create(
    State(db): State<Db>,
    Json(payload): Json<PurchasePayload>,
) -> Result<(StatusCode, Json<PlannedPurchase>), AppError> {
    let n = validate(&payload)?;
    ensure_fk_targets_exist(&db, &n).await?;

    // id is INTEGER PRIMARY KEY AUTOINCREMENT — SQLite assigns it on INSERT.
    // currency hardcoded to 'SEK' to satisfy the NOT NULL DEFAULT column;
    // it isn't part of the frontend schema.
    let now = crate::time::iso_timestamp_now();
    let sql = format!(
        "INSERT INTO planned_purchases \
         (name, target_amount, target_amount_type, target_date, priority, \
          category_id, funding_strategy, linked_loan_id, currency, notes, \
          created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SEK', ?, ?, ?) \
         RETURNING {SELECT_COLUMNS}"
    );

    let item: PlannedPurchase = sqlx::query_as(&sql)
        .bind(n.name)
        .bind(n.target_amount)
        .bind(n.target_amount_type)
        .bind(n.target_date)
        .bind(n.priority)
        .bind(n.category_id)
        .bind(n.funding_strategy)
        .bind(n.linked_loan_id)
        .bind(n.notes)
        .bind(&now)
        .bind(&now)
        .fetch_one(&db)
        .await?;

    Ok((StatusCode::CREATED, Json(item)))
}

// PATCH /budget/planned-purchases/{id}
//
// Full-replacement update — see `PurchasePayload` for the rationale.
async fn update(
    State(db): State<Db>,
    Path(id): Path<i64>,
    Json(payload): Json<PurchasePayload>,
) -> Result<Json<PlannedPurchase>, AppError> {
    let n = validate(&payload)?;
    ensure_fk_targets_exist(&db, &n).await?;

    let now = crate::time::iso_timestamp_now();
    let sql = format!(
        "UPDATE planned_purchases \
         SET name = ?, target_amount = ?, target_amount_type = ?, target_date = ?, \
             priority = ?, category_id = ?, funding_strategy = ?, linked_loan_id = ?, \
             notes = ?, updated_at = ? \
         WHERE id = ? \
         RETURNING {SELECT_COLUMNS}"
    );

    let item: PlannedPurchase = sqlx::query_as(&sql)
        .bind(n.name)
        .bind(n.target_amount)
        .bind(n.target_amount_type)
        .bind(n.target_date)
        .bind(n.priority)
        .bind(n.category_id)
        .bind(n.funding_strategy)
        .bind(n.linked_loan_id)
        .bind(n.notes)
        .bind(&now)
        .bind(id)
        .fetch_optional(&db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Planned purchase {id} not found")))?;

    Ok(Json(item))
}

// DELETE /budget/planned-purchases/{id}
async fn remove(State(db): State<Db>, Path(id): Path<i64>) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM planned_purchases WHERE id = ?")
        .bind(id)
        .execute(&db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Planned purchase {id} not found"
        )));
    }

    Ok(StatusCode::NO_CONTENT)
}
