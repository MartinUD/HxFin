//! Projection preset CRUD (the FIRE-calculator knobs on the `projections`
//! tab under `src/routes/investments/+page.svelte`).
//!
//! Singleton row in `projection_preset`, created by migration 0023. The
//! shape matches the old `fin:investments:projection-preset` localStorage
//! blob 1:1 — same field set, same defaults — so the frontend can flip
//! from localStorage to HTTP without any UI-side mapping.
//!
//! Salary/tax knobs (`monthlySalary`, `salaryGrowth`, `kommunalskatt`,
//! `savingsShareOfRaise`) intentionally duplicate columns in
//! `financial_profile`. The projections form saves them together with the
//! projection-specific knobs; splitting would mean two PUTs per save for
//! no user-visible win. If the UI is ever changed to only POST deltas per
//! domain, we can peel these off and source them from `/budget/income`.
//!
//! Frontend contract: no `ProjectionPresetSchema` exists yet in
//! `src/lib/schema/investments.ts`. Field set below is taken from
//! `saveProjectionPreset()` in the Svelte page; add the matching schema
//! when the UI is wired up to call this endpoint.

use crate::{db::Db, errors::AppError};
use axum::{
    extract::State,
    routing::{get, put},
    Json, Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};

// Mirror the initial $state(...) values in +page.svelte. Kept here (and in
// the 0023 migration's DEFAULT clauses) so the Rust side can seed the
// first row without relying on a no-column-list INSERT that'd leave
// created_at/updated_at blank.
const DEFAULT_START_CAPITAL: f64 = 100_000.0;
const DEFAULT_MONTHLY_SAVING: f64 = 5_000.0;
const DEFAULT_MONTHLY_SALARY: f64 = 40_000.0;
const DEFAULT_SALARY_GROWTH: f64 = 6.0;
const DEFAULT_KOMMUNALSKATT: f64 = 32.41;
const DEFAULT_SAVINGS_SHARE_OF_RAISE: f64 = 50.0;
const DEFAULT_AVG_RETURN: f64 = 8.0;
const DEFAULT_LEVERAGE: f64 = 0.0;
const DEFAULT_YEARS: i64 = 20;
const DEFAULT_WITHDRAWAL_RATE: f64 = 4.0;

#[derive(Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionPreset {
    pub id: i64,
    pub start_capital: f64,
    pub monthly_saving: f64,
    pub monthly_salary: f64,
    pub salary_growth: f64,
    pub kommunalskatt: f64,
    pub savings_share_of_raise: f64,
    pub avg_return: f64,
    pub leverage: f64,
    pub years: i64,
    pub withdrawal_rate: f64,
    pub created_at: String,
    pub updated_at: String,
}

// Partial update — every field optional, at least one required. Same
// semantics as `UpdateFinancialProfile` in `budget/income/profile.rs`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectionPreset {
    pub start_capital: Option<f64>,
    pub monthly_saving: Option<f64>,
    pub monthly_salary: Option<f64>,
    pub salary_growth: Option<f64>,
    pub kommunalskatt: Option<f64>,
    pub savings_share_of_raise: Option<f64>,
    pub avg_return: Option<f64>,
    pub leverage: Option<f64>,
    pub years: Option<i64>,
    pub withdrawal_rate: Option<f64>,
}

pub fn router() -> Router<Db> {
    Router::new()
        .route("/projections/preset", get(get_preset))
        .route("/projections/preset", put(update_preset))
}

// Explicit CAST AS REAL for the same reason `recurring/costs.rs` and
// `budget/income/profile.rs` do — SQLite's NUMERIC affinity can store
// integer-looking values as INTEGER, and sqlx refuses to decode those
// into f64 without an explicit cast.
const SELECT_COLUMNS: &str = "id, \
     CAST(start_capital AS REAL) AS start_capital, \
     CAST(monthly_saving AS REAL) AS monthly_saving, \
     CAST(monthly_salary AS REAL) AS monthly_salary, \
     CAST(salary_growth AS REAL) AS salary_growth, \
     CAST(kommunalskatt AS REAL) AS kommunalskatt, \
     CAST(savings_share_of_raise AS REAL) AS savings_share_of_raise, \
     CAST(avg_return AS REAL) AS avg_return, \
     CAST(leverage AS REAL) AS leverage, \
     years, \
     CAST(withdrawal_rate AS REAL) AS withdrawal_rate, \
     created_at, updated_at";

// Lazy-seed on first read. Uses ORDER BY id LIMIT 1 rather than WHERE id = 1
// because AUTOINCREMENT sequence pinning is an implementation detail; in
// practice there's exactly one row.
async fn ensure_preset(db: &Db) -> Result<ProjectionPreset, AppError> {
    let select_sql = format!("SELECT {SELECT_COLUMNS} FROM projection_preset ORDER BY id LIMIT 1");
    if let Some(preset) = sqlx::query_as::<_, ProjectionPreset>(&select_sql)
        .fetch_optional(db)
        .await?
    {
        return Ok(preset);
    }

    let now = Utc::now().to_rfc3339();
    let insert_sql = format!(
        "INSERT INTO projection_preset \
         (start_capital, monthly_saving, monthly_salary, salary_growth, \
          kommunalskatt, savings_share_of_raise, avg_return, leverage, \
          years, withdrawal_rate, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) \
         RETURNING {SELECT_COLUMNS}"
    );
    let preset: ProjectionPreset = sqlx::query_as(&insert_sql)
        .bind(DEFAULT_START_CAPITAL)
        .bind(DEFAULT_MONTHLY_SAVING)
        .bind(DEFAULT_MONTHLY_SALARY)
        .bind(DEFAULT_SALARY_GROWTH)
        .bind(DEFAULT_KOMMUNALSKATT)
        .bind(DEFAULT_SAVINGS_SHARE_OF_RAISE)
        .bind(DEFAULT_AVG_RETURN)
        .bind(DEFAULT_LEVERAGE)
        .bind(DEFAULT_YEARS)
        .bind(DEFAULT_WITHDRAWAL_RATE)
        .bind(&now)
        .bind(&now)
        .fetch_one(db)
        .await?;

    Ok(preset)
}

// GET /investments/projections/preset
async fn get_preset(State(db): State<Db>) -> Result<Json<ProjectionPreset>, AppError> {
    Ok(Json(ensure_preset(&db).await?))
}

// PUT /investments/projections/preset
//
// Partial update — every field optional, at least one required. Uses the
// same COALESCE(?, col) pattern as `update_profile` in
// `budget/income/profile.rs`, so NULL binds leave columns untouched.
//
// Field-level bound checks (0 ≤ x ≤ 100, etc.) are intentionally omitted:
// the frontend's Effect Schemas (`PositiveAmountSchema`, `PercentageSchema`)
// enforce them before serializing, and this endpoint has no other consumer.
// If we ever expose the API to third parties, add the bound checks back.
async fn update_preset(
    State(db): State<Db>,
    Json(payload): Json<UpdateProjectionPreset>,
) -> Result<Json<ProjectionPreset>, AppError> {
    let has_any = payload.start_capital.is_some()
        || payload.monthly_saving.is_some()
        || payload.monthly_salary.is_some()
        || payload.salary_growth.is_some()
        || payload.kommunalskatt.is_some()
        || payload.savings_share_of_raise.is_some()
        || payload.avg_return.is_some()
        || payload.leverage.is_some()
        || payload.years.is_some()
        || payload.withdrawal_rate.is_some();
    if !has_any {
        return Err(AppError::Validation(
            "At least one projection preset field must be provided".into(),
        ));
    }

    // Seed on first PUT so "the UI's first interaction is a save" works
    // without a separate bootstrap step. Same trick `update_profile` uses.
    let existing = ensure_preset(&db).await?;

    let now = Utc::now().to_rfc3339();
    let sql = format!(
        "UPDATE projection_preset \
         SET start_capital = COALESCE(?, start_capital), \
             monthly_saving = COALESCE(?, monthly_saving), \
             monthly_salary = COALESCE(?, monthly_salary), \
             salary_growth = COALESCE(?, salary_growth), \
             kommunalskatt = COALESCE(?, kommunalskatt), \
             savings_share_of_raise = COALESCE(?, savings_share_of_raise), \
             avg_return = COALESCE(?, avg_return), \
             leverage = COALESCE(?, leverage), \
             years = COALESCE(?, years), \
             withdrawal_rate = COALESCE(?, withdrawal_rate), \
             updated_at = ? \
         WHERE id = ? \
         RETURNING {SELECT_COLUMNS}"
    );

    let preset: ProjectionPreset = sqlx::query_as(&sql)
        .bind(payload.start_capital)
        .bind(payload.monthly_saving)
        .bind(payload.monthly_salary)
        .bind(payload.salary_growth)
        .bind(payload.kommunalskatt)
        .bind(payload.savings_share_of_raise)
        .bind(payload.avg_return)
        .bind(payload.leverage)
        .bind(payload.years)
        .bind(payload.withdrawal_rate)
        .bind(&now)
        .bind(existing.id)
        .fetch_one(&db)
        .await?;

    Ok(Json(preset))
}
