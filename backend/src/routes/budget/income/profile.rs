//! Financial profile (a.k.a. "income settings") CRUD.
//!
//! The backing table is `financial_profile`, a singleton row that holds the
//! knobs driving the budget projections UI at `/budget/income`: monthly
//! salary, salary growth %, municipal tax rate %, savings share of raise %,
//! and currency.
//!
//! `id` is `INTEGER PRIMARY KEY AUTOINCREMENT` since migration 0022 (the
//! row before that used TEXT `'default'`).
//!
//! Frontend contract: `src/lib/schema/finance.ts`
//! (`FinancialProfileSchema`, `UpdateFinancialProfileInputSchema`,
//! `DEFAULT_FINANCIAL_PROFILE_INPUT`).

use crate::{db::Db, errors::AppError};
use axum::{
    extract::State,
    routing::{get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};

// Lazy-seed defaults for the singleton row. Mirrors
// `DEFAULT_FINANCIAL_PROFILE_INPUT` in `src/lib/schema/finance.ts` and the
// column defaults in migration 0022 — kept in sync here so the Rust side
// can insert the first row without asking the DB to fall back on column
// defaults (which would require a no-column-list INSERT and still leave
// created_at/updated_at blank).
const DEFAULT_MONTHLY_SALARY: f64 = 40_000.0;
const DEFAULT_SALARY_GROWTH: f64 = 6.0;
const DEFAULT_MUNICIPAL_TAX_RATE: f64 = 32.41;
const DEFAULT_SAVINGS_SHARE_OF_RAISE: f64 = 50.0;
const DEFAULT_CURRENCY: &str = "SEK";

// Mirror `CurrencySchema` in src/lib/schema/common.ts — ISO-4217 currency
// codes are always 3 characters.
const CURRENCY_CODE_LENGTH: usize = 3;

#[derive(Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FinancialProfile {
    pub id: i64,
    pub monthly_salary: f64,
    // Percentages are stored as plain numbers (e.g. 32.41 means 32.41 %),
    // matching `PercentageSchema` on the frontend.
    pub salary_growth: f64,
    pub municipal_tax_rate: f64,
    pub savings_share_of_raise: f64,
    pub currency: String,
    pub created_at: String,
    pub updated_at: String,
}

// Partial-update shape: all fields optional, at least one required. Matches
// the TS `UpdateFinancialProfileInputSchema` and how the income-settings
// form in the UI ships "changed only" deltas.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFinancialProfile {
    pub monthly_salary: Option<f64>,
    pub salary_growth: Option<f64>,
    pub municipal_tax_rate: Option<f64>,
    pub savings_share_of_raise: Option<f64>,
    pub currency: Option<String>,
}

pub fn router() -> Router<Db> {
    Router::new()
        .route("/income", get(get_profile))
        .route("/income", put(update_profile))
}

// `monthly_salary` etc. are stored as REAL (NUMERIC with real defaults in
// migration 0022). The explicit CAST guards against the SQLite dynamic-
// typing surprise we hit in `recurring/costs.rs`, where integer-looking
// values round-trip as INTEGER and fail to decode into f64.
const SELECT_COLUMNS: &str = "id, \
     CAST(monthly_salary AS REAL) AS monthly_salary, \
     CAST(salary_growth AS REAL) AS salary_growth, \
     CAST(municipal_tax_rate AS REAL) AS municipal_tax_rate, \
     CAST(savings_share_of_raise AS REAL) AS savings_share_of_raise, \
     currency, created_at, updated_at";

// Ensures the singleton row exists and returns it. Uses ORDER BY id LIMIT 1
// rather than WHERE id = 1 because the AUTOINCREMENT sequence is an
// implementation detail we'd rather not pin queries to; in practice there's
// exactly one row.
async fn ensure_profile(db: &Db) -> Result<FinancialProfile, AppError> {
    let select_sql = format!("SELECT {SELECT_COLUMNS} FROM financial_profile ORDER BY id LIMIT 1");
    if let Some(profile) = sqlx::query_as::<_, FinancialProfile>(&select_sql)
        .fetch_optional(db)
        .await?
    {
        return Ok(profile);
    }

    // First run — lazy-seed with the defaults. Matches the TS
    // `ensureProfileExists()` helper.
    let now = crate::time::iso_timestamp_now();
    let insert_sql = format!(
        "INSERT INTO financial_profile \
         (monthly_salary, salary_growth, municipal_tax_rate, savings_share_of_raise, \
          currency, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?) \
         RETURNING {SELECT_COLUMNS}"
    );
    let profile: FinancialProfile = sqlx::query_as(&insert_sql)
        .bind(DEFAULT_MONTHLY_SALARY)
        .bind(DEFAULT_SALARY_GROWTH)
        .bind(DEFAULT_MUNICIPAL_TAX_RATE)
        .bind(DEFAULT_SAVINGS_SHARE_OF_RAISE)
        .bind(DEFAULT_CURRENCY)
        .bind(&now)
        .bind(&now)
        .fetch_one(db)
        .await?;

    Ok(profile)
}

// GET /budget/income
async fn get_profile(State(db): State<Db>) -> Result<Json<FinancialProfile>, AppError> {
    Ok(Json(ensure_profile(&db).await?))
}

// Same bounds as `PercentageSchema` in src/lib/schema/common.ts.
fn validate_percentage(label: &str, value: f64) -> Result<(), AppError> {
    if !value.is_finite() || !(0.0..=100.0).contains(&value) {
        return Err(AppError::Validation(format!(
            "{label} must be between 0 and 100"
        )));
    }
    Ok(())
}

// Same bounds as `PositiveAmountSchema` in src/lib/schema/common.ts
// (0..=1_000_000_000 inclusive). Infinity and NaN rejected up front so they
// can't sneak into storage.
fn validate_amount(label: &str, value: f64) -> Result<(), AppError> {
    if !value.is_finite() || !(0.0..=1_000_000_000.0).contains(&value) {
        return Err(AppError::Validation(format!(
            "{label} must be between 0 and 1,000,000,000"
        )));
    }
    Ok(())
}

// PUT /budget/income
//
// Partial update — every field optional, at least one required. Matches the
// TS semantics even though PUT is unusual for that (kept to minimise the
// API-group diff; could flip to PATCH in a follow-up).
async fn update_profile(
    State(db): State<Db>,
    Json(payload): Json<UpdateFinancialProfile>,
) -> Result<Json<FinancialProfile>, AppError> {
    // Validate each supplied field against the same bounds the frontend
    // enforces. A malformed request that skips the client schema still gets
    // a clean 400.
    if let Some(v) = payload.monthly_salary {
        validate_amount("monthlySalary", v)?;
    }
    if let Some(v) = payload.salary_growth {
        validate_percentage("salaryGrowth", v)?;
    }
    if let Some(v) = payload.municipal_tax_rate {
        validate_percentage("municipalTaxRate", v)?;
    }
    if let Some(v) = payload.savings_share_of_raise {
        validate_percentage("savingsShareOfRaise", v)?;
    }
    // Trim + upper-case once so the stored value matches what we validated.
    // ISO-4217 currency codes are 3 letters exactly.
    let normalized_currency = payload
        .currency
        .as_deref()
        .map(|raw| raw.trim().to_ascii_uppercase());
    if let Some(currency) = normalized_currency.as_deref() {
        if currency.chars().count() != CURRENCY_CODE_LENGTH {
            return Err(AppError::Validation(format!(
                "currency must be a {CURRENCY_CODE_LENGTH}-letter ISO-4217 code"
            )));
        }
    }

    // "At least one field" check — mirrors the TS `ensureNonEmpty` guard.
    let has_any = payload.monthly_salary.is_some()
        || payload.salary_growth.is_some()
        || payload.municipal_tax_rate.is_some()
        || payload.savings_share_of_raise.is_some()
        || normalized_currency.is_some();
    if !has_any {
        return Err(AppError::Validation(
            "At least one financial profile field must be provided".into(),
        ));
    }

    // Make sure the singleton row exists before we try to UPDATE it — this
    // handles the "first interaction is a PUT" case without a separate
    // seed step.
    let existing = ensure_profile(&db).await?;

    let now = crate::time::iso_timestamp_now();
    let sql = format!(
        "UPDATE financial_profile \
         SET monthly_salary = COALESCE(?, monthly_salary), \
             salary_growth = COALESCE(?, salary_growth), \
             municipal_tax_rate = COALESCE(?, municipal_tax_rate), \
             savings_share_of_raise = COALESCE(?, savings_share_of_raise), \
             currency = COALESCE(?, currency), \
             updated_at = ? \
         WHERE id = ? \
         RETURNING {SELECT_COLUMNS}"
    );

    let profile: FinancialProfile = sqlx::query_as(&sql)
        .bind(payload.monthly_salary)
        .bind(payload.salary_growth)
        .bind(payload.municipal_tax_rate)
        .bind(payload.savings_share_of_raise)
        .bind(normalized_currency)
        .bind(&now)
        .bind(existing.id)
        .fetch_one(&db)
        .await?;

    Ok(Json(profile))
}
