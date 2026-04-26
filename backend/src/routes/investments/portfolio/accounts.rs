use crate::{db::Db, errors::AppError};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, patch, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};

// Defaults applied on create when the frontend omits these fields. Mirrors
// `CurrencySchema` default + the TS service's `|| 'SEK'` fallback.
const DEFAULT_CURRENCY: &str = "SEK";

#[derive(Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct InvestmentAccount {
    pub id: i64,
    pub name: String,
    pub institution: Option<String>,
    pub currency: String,
    pub total_value: f64,
    pub created_at: String,
    pub updated_at: String,
}

// Create payload. `currency` is optional on the wire (defaults to "SEK"),
// matching `CreateInvestmentAccountInputSchema`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvestmentAccount {
    pub name: String,
    pub institution: Option<String>,
    pub currency: Option<String>,
    pub total_value: f64,
}

// Full-replacement PATCH shape (matches `loans.rs` and the budget CRUD
// files): every persistable field is always sent, which dodges the
// absent-vs-null ambiguity serde otherwise leaves us with for nullable
// columns.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInvestmentAccount {
    pub name: String,
    pub institution: Option<String>,
    pub currency: String,
    pub total_value: f64,
}

pub fn router() -> Router<Db> {
    Router::new()
        .route("/accounts", get(list))
        .route("/accounts", post(create))
        .route("/accounts/{id}", patch(update))
        .route("/accounts/{id}", delete(remove))
}

// CAST total_value AS REAL — same reason `loans/loans.rs` and
// `recurring/costs.rs` do. SQLite's NUMERIC affinity can store
// integer-looking values as INTEGER, and sqlx refuses to decode those
// into f64 without an explicit cast.
const SELECT_COLUMNS: &str = "id, name, institution, currency, \
     CAST(total_value AS REAL) AS total_value, created_at, updated_at";

// Normalized, trimmed, owned-currency form of the payload. The Effect
// Schemas enforce bounds on the frontend; we only do the string-level
// normalization (trim, blank→None, uppercase currency) the TS service
// does so the DB row matches what the frontend expects back.
struct Normalized<'a> {
    name: &'a str,
    institution: Option<&'a str>,
    // Owned because `.trim().to_uppercase()` produces a new String.
    currency: String,
    total_value: f64,
}

// TS's `normalizeNullableText`: whitespace-only strings treated as null so
// a blank `institution` input doesn't persist as an empty string.
fn blank_to_none(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|t| !t.is_empty())
}

fn normalize<'a>(
    name: &'a str,
    institution: Option<&'a str>,
    currency: &str,
    total_value: f64,
) -> Normalized<'a> {
    Normalized {
        name: name.trim(),
        institution: blank_to_none(institution),
        currency: currency.trim().to_ascii_uppercase(),
        total_value,
    }
}

// GET /investments/accounts
//
// Sort order mirrors the TS repository: by creation time, oldest first,
// so the UI's left-hand account list has a stable order.
async fn list(State(db): State<Db>) -> Result<Json<Vec<InvestmentAccount>>, AppError> {
    let sql = format!("SELECT {SELECT_COLUMNS} FROM investment_accounts ORDER BY created_at ASC");
    let accounts: Vec<InvestmentAccount> = sqlx::query_as(&sql).fetch_all(&db).await?;

    Ok(Json(accounts))
}

// POST /investments/accounts
async fn create(
    State(db): State<Db>,
    Json(payload): Json<CreateInvestmentAccount>,
) -> Result<(StatusCode, Json<InvestmentAccount>), AppError> {
    let currency = payload.currency.as_deref().unwrap_or(DEFAULT_CURRENCY);
    let n = normalize(
        &payload.name,
        payload.institution.as_deref(),
        currency,
        payload.total_value,
    );

    // id is INTEGER PRIMARY KEY AUTOINCREMENT — SQLite assigns it on INSERT.
    let now = crate::time::iso_timestamp_now();
    let sql = format!(
        "INSERT INTO investment_accounts \
         (name, institution, currency, total_value, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?) \
         RETURNING {SELECT_COLUMNS}"
    );
    let account: InvestmentAccount = sqlx::query_as(&sql)
        .bind(n.name)
        .bind(n.institution)
        .bind(&n.currency)
        .bind(n.total_value)
        .bind(&now)
        .bind(&now)
        .fetch_one(&db)
        .await?;

    Ok((StatusCode::CREATED, Json(account)))
}

// PATCH /investments/accounts/{id}
//
// Full-replacement update — see `UpdateInvestmentAccount` for the rationale.
async fn update(
    State(db): State<Db>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateInvestmentAccount>,
) -> Result<Json<InvestmentAccount>, AppError> {
    let n = normalize(
        &payload.name,
        payload.institution.as_deref(),
        &payload.currency,
        payload.total_value,
    );

    let now = crate::time::iso_timestamp_now();
    let sql = format!(
        "UPDATE investment_accounts \
         SET name = ?, institution = ?, currency = ?, total_value = ?, \
             updated_at = ? \
         WHERE id = ? \
         RETURNING {SELECT_COLUMNS}"
    );
    let account: InvestmentAccount = sqlx::query_as(&sql)
        .bind(n.name)
        .bind(n.institution)
        .bind(&n.currency)
        .bind(n.total_value)
        .bind(&now)
        .bind(id)
        .fetch_optional(&db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Investment account {id} not found")))?;

    Ok(Json(account))
}

// DELETE /investments/accounts/{id}
//
// `investment_holdings.account_id` has `ON DELETE CASCADE`, so dependent
// holdings (and their snapshot history, cascading further) disappear
// alongside the account — the DB handles cleanup for us.
async fn remove(State(db): State<Db>, Path(id): Path<i64>) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM investment_accounts WHERE id = ?")
        .bind(id)
        .execute(&db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Investment account {id} not found"
        )));
    }

    Ok(StatusCode::NO_CONTENT)
}
