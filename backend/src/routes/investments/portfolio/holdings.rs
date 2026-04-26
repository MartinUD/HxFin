use crate::{db::Db, errors::AppError};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, patch, post},
    Json, Router,
};
// serde_html_form-backed Query handles optional/missing params the same
// way stock axum Query does; axum_extra for consistency with the sibling
// modules (costs.rs, items.rs, loans.rs) that already use it.
use axum_extra::extract::Query;
use serde::{Deserialize, Serialize};
use sqlx::{QueryBuilder, Sqlite};

// `InvestmentHolding` carries two derived fields (`change_amount_…` /
// `change_percent_…`) that aren't selected directly — they're computed in
// Rust from the latest two snapshot values. So we decode straight from the
// row into `HoldingRow` (which mirrors the SELECT) and then `.into()`-convert
// to `InvestmentHolding`. See the `From` impl below.

// Mirrors the frontend `InvestmentTrackerSourceSchema` literal union. The
// DB also has a matching CHECK constraint; the explicit list here just
// lets us return a clean 400 before sqlx surfaces a CHECK violation.
const TRACKER_SOURCES: &[&str] = &["manual", "nordea", "avanza"];

// Server-side defaults on create, mirroring the TS service.
const DEFAULT_TRACKER_SOURCE: &str = "manual";
const DEFAULT_SORT_ORDER: i64 = 0;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvestmentHolding {
    pub id: i64,
    pub account_id: i64,
    pub name: String,
    pub allocation_percent: f64,
    pub current_value: f64,
    pub units: Option<f64>,
    pub latest_unit_price: Option<f64>,
    pub tracker_source: String,
    pub tracker_url: Option<String>,
    pub latest_price_date: Option<String>,
    pub last_synced_at: Option<String>,
    // Derived from the two most recent snapshots for this holding. Null
    // when fewer than two snapshots exist (or the older snapshot's value
    // is 0, which makes the percent undefined).
    pub change_amount_since_last_snapshot: Option<f64>,
    pub change_percent_since_last_snapshot: Option<f64>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    // Optional filter: `?accountId=<id>`.
    pub account_id: Option<i64>,
}

// Create payload. Server-side defaults (trackerSource → "manual",
// sortOrder → 0) match the TS service so the UI can omit those without
// the DB row diverging from frontend expectations.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvestmentHolding {
    pub account_id: i64,
    pub name: String,
    pub allocation_percent: f64,
    pub current_value: f64,
    pub units: Option<f64>,
    pub latest_unit_price: Option<f64>,
    pub tracker_source: Option<String>,
    pub tracker_url: Option<String>,
    pub sort_order: Option<i64>,
}

// Full-replacement PATCH shape (matches `loans.rs` and the budget CRUD
// files). `latest_price_date` and `last_synced_at` are included for full
// replacement even though user-facing edits don't usually touch them;
// the refresh path (`refresh.rs`) writes them directly via its own SQL
// rather than going through this PATCH.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInvestmentHolding {
    pub account_id: i64,
    pub name: String,
    pub allocation_percent: f64,
    pub current_value: f64,
    pub units: Option<f64>,
    pub latest_unit_price: Option<f64>,
    pub tracker_source: String,
    pub tracker_url: Option<String>,
    pub latest_price_date: Option<String>,
    pub last_synced_at: Option<String>,
    pub sort_order: i64,
}

pub fn router() -> Router<Db> {
    Router::new()
        .route("/holdings", get(list))
        .route("/holdings", post(create))
        .route("/holdings/{id}", patch(update))
        .route("/holdings/{id}", delete(remove))
}

// Correlated-subquery approach: for each holding row we look up the two
// most recent snapshots and expose their `current_value`s as two scalar
// columns. `change_amount` / `change_percent` are computed in Rust from
// those values.
//
// Keeps list() a single round-trip (vs. the TS implementation's N+1); the
// tradeoff is a slightly denser SELECT.
const SELECT_COLUMNS: &str = "h.id, h.account_id, h.name, \
     CAST(h.allocation_percent AS REAL) AS allocation_percent, \
     CAST(h.current_value AS REAL) AS current_value, \
     CAST(h.units AS REAL) AS units, \
     CAST(h.latest_unit_price AS REAL) AS latest_unit_price, \
     h.tracker_source, h.tracker_url, h.latest_price_date, h.last_synced_at, \
     h.sort_order, h.created_at, h.updated_at, \
     ( SELECT CAST(s.current_value AS REAL) \
         FROM investment_holding_snapshots s \
        WHERE s.holding_id = h.id \
        ORDER BY s.captured_at DESC LIMIT 1 \
     ) AS latest_snapshot_value, \
     ( SELECT CAST(s.current_value AS REAL) \
         FROM investment_holding_snapshots s \
        WHERE s.holding_id = h.id \
        ORDER BY s.captured_at DESC LIMIT 1 OFFSET 1 \
     ) AS previous_snapshot_value";

// FromRow-decoded mirror of the SELECT shape. Kept private; converted to the
// public `InvestmentHolding` via the `From` impl below, which fills in the
// two derived snapshot-change fields.
#[derive(sqlx::FromRow)]
struct HoldingRow {
    id: i64,
    account_id: i64,
    name: String,
    allocation_percent: f64,
    current_value: f64,
    units: Option<f64>,
    latest_unit_price: Option<f64>,
    tracker_source: String,
    tracker_url: Option<String>,
    latest_price_date: Option<String>,
    last_synced_at: Option<String>,
    sort_order: i64,
    created_at: String,
    updated_at: String,
    latest_snapshot_value: Option<f64>,
    previous_snapshot_value: Option<f64>,
}

impl From<HoldingRow> for InvestmentHolding {
    fn from(r: HoldingRow) -> Self {
        let change_amount = match (r.latest_snapshot_value, r.previous_snapshot_value) {
            (Some(l), Some(p)) => Some(l - p),
            _ => None,
        };
        // Guard against divide-by-zero: when the earlier snapshot was 0, the
        // percent is undefined. Matches the TS `previousSnapshotValue !== 0`
        // check.
        let change_percent = match (change_amount, r.previous_snapshot_value) {
            (Some(a), Some(p)) if p != 0.0 => Some((a / p) * 100.0),
            _ => None,
        };

        InvestmentHolding {
            id: r.id,
            account_id: r.account_id,
            name: r.name,
            allocation_percent: r.allocation_percent,
            current_value: r.current_value,
            units: r.units,
            latest_unit_price: r.latest_unit_price,
            tracker_source: r.tracker_source,
            tracker_url: r.tracker_url,
            latest_price_date: r.latest_price_date,
            last_synced_at: r.last_synced_at,
            change_amount_since_last_snapshot: change_amount,
            change_percent_since_last_snapshot: change_percent,
            sort_order: r.sort_order,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

// Normalized, trimmed, blank-collapsed-to-None form of the incoming
// payload. Same shape as `planned_purchases/items.rs::Normalized`:
// validate once and bind the normalized values so the DB row matches
// what we actually checked.
struct Normalized<'a> {
    account_id: i64,
    name: &'a str,
    allocation_percent: f64,
    current_value: f64,
    units: Option<f64>,
    latest_unit_price: Option<f64>,
    tracker_source: &'a str,
    tracker_url: Option<&'a str>,
    latest_price_date: Option<&'a str>,
    last_synced_at: Option<&'a str>,
    sort_order: i64,
}

fn blank_to_none(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|t| !t.is_empty())
}

fn validate_tracker_source(value: &str) -> Result<&str, AppError> {
    if TRACKER_SOURCES.contains(&value) {
        Ok(value)
    } else {
        Err(AppError::Validation(format!(
            "Invalid trackerSource: {value}"
        )))
    }
}

// Explicit existence check so we can return a clean 404 with the right
// resource name instead of a generic FK-violation 500. The DB's FK
// enforcement (PRAGMA foreign_keys = ON) still acts as a last line of
// defense. Same pattern as `ensure_category_exists` in
// `planned_purchases/items.rs`.
async fn ensure_account_exists(db: &Db, id: i64) -> Result<(), AppError> {
    let exists = sqlx::query_scalar::<_, i64>("SELECT 1 FROM investment_accounts WHERE id = ?")
        .bind(id)
        .fetch_optional(db)
        .await?
        .is_some();

    if !exists {
        return Err(AppError::NotFound(format!(
            "Investment account {id} not found"
        )));
    }
    Ok(())
}

// GET /investments/holdings
//
// Sort order mirrors the TS repository: by account, then explicit
// sort_order, then creation time — matches how the UI groups holdings
// under their account and lets users reorder within.
pub(crate) async fn list_holdings(
    db: &Db,
    query: ListQuery,
) -> Result<Vec<InvestmentHolding>, AppError> {
    let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new(format!(
        "SELECT {SELECT_COLUMNS} FROM investment_holdings h"
    ));

    if let Some(account_id) = query.account_id {
        // Bogus filter values simply return an empty list — no need to
        // validate a read-only filter; the DB FK still protects writes.
        qb.push(" WHERE h.account_id = ").push_bind(account_id);
    }

    qb.push(" ORDER BY h.account_id ASC, h.sort_order ASC, h.created_at ASC");

    let rows: Vec<HoldingRow> = qb.build_query_as().fetch_all(db).await?;
    Ok(rows.into_iter().map(InvestmentHolding::from).collect())
}

async fn list(
    State(db): State<Db>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<InvestmentHolding>>, AppError> {
    let holdings = list_holdings(&db, query).await?;

    Ok(Json(holdings))
}

// Single-row fetch with the same derived-columns shape as list(). Used by
// create/update to build the response: the INSERT/UPDATE can RETURNING
// the base columns, but the snapshot-derived columns need a second pass.
async fn fetch_holding(db: &Db, id: i64) -> Result<InvestmentHolding, AppError> {
    let sql = format!("SELECT {SELECT_COLUMNS} FROM investment_holdings h WHERE h.id = ?");
    let row: HoldingRow = sqlx::query_as(&sql)
        .bind(id)
        .fetch_optional(db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Investment holding {id} not found")))?;

    Ok(row.into())
}

// POST /investments/holdings
async fn create(
    State(db): State<Db>,
    Json(payload): Json<CreateInvestmentHolding>,
) -> Result<(StatusCode, Json<InvestmentHolding>), AppError> {
    let tracker_source = payload
        .tracker_source
        .as_deref()
        .unwrap_or(DEFAULT_TRACKER_SOURCE);
    let tracker_source = validate_tracker_source(tracker_source)?;

    let n = Normalized {
        account_id: payload.account_id,
        name: payload.name.trim(),
        allocation_percent: payload.allocation_percent,
        current_value: payload.current_value,
        units: payload.units,
        latest_unit_price: payload.latest_unit_price,
        tracker_source,
        tracker_url: blank_to_none(payload.tracker_url.as_deref()),
        // Create doesn't accept these — they're only set by the refresh
        // path, and we explicitly NULL them here so the row is consistent.
        latest_price_date: None,
        last_synced_at: None,
        sort_order: payload.sort_order.unwrap_or(DEFAULT_SORT_ORDER),
    };

    ensure_account_exists(&db, n.account_id).await?;

    // id is INTEGER PRIMARY KEY AUTOINCREMENT — SQLite assigns it on
    // INSERT. We INSERT then re-read via fetch_holding so the response
    // includes the snapshot-derived columns (which RETURNING on INSERT
    // can't produce — the correlated subqueries live in SELECT).
    let now = crate::time::iso_timestamp_now();
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO investment_holdings \
         (account_id, name, allocation_percent, current_value, units, \
          latest_unit_price, tracker_source, tracker_url, latest_price_date, \
          last_synced_at, sort_order, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) \
         RETURNING id",
    )
    .bind(n.account_id)
    .bind(n.name)
    .bind(n.allocation_percent)
    .bind(n.current_value)
    .bind(n.units)
    .bind(n.latest_unit_price)
    .bind(n.tracker_source)
    .bind(n.tracker_url)
    .bind(n.latest_price_date)
    .bind(n.last_synced_at)
    .bind(n.sort_order)
    .bind(&now)
    .bind(&now)
    .fetch_one(&db)
    .await?;

    Ok((StatusCode::CREATED, Json(fetch_holding(&db, id).await?)))
}

// PATCH /investments/holdings/{id}
//
// Full-replacement update — see `UpdateInvestmentHolding` for the rationale.
async fn update(
    State(db): State<Db>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateInvestmentHolding>,
) -> Result<Json<InvestmentHolding>, AppError> {
    let tracker_source = validate_tracker_source(&payload.tracker_source)?;

    let n = Normalized {
        account_id: payload.account_id,
        name: payload.name.trim(),
        allocation_percent: payload.allocation_percent,
        current_value: payload.current_value,
        units: payload.units,
        latest_unit_price: payload.latest_unit_price,
        tracker_source,
        tracker_url: blank_to_none(payload.tracker_url.as_deref()),
        latest_price_date: blank_to_none(payload.latest_price_date.as_deref()),
        last_synced_at: blank_to_none(payload.last_synced_at.as_deref()),
        sort_order: payload.sort_order,
    };

    ensure_account_exists(&db, n.account_id).await?;

    let now = crate::time::iso_timestamp_now();
    let result = sqlx::query(
        "UPDATE investment_holdings \
         SET account_id = ?, name = ?, allocation_percent = ?, current_value = ?, \
             units = ?, latest_unit_price = ?, tracker_source = ?, tracker_url = ?, \
             latest_price_date = ?, last_synced_at = ?, sort_order = ?, \
             updated_at = ? \
         WHERE id = ?",
    )
    .bind(n.account_id)
    .bind(n.name)
    .bind(n.allocation_percent)
    .bind(n.current_value)
    .bind(n.units)
    .bind(n.latest_unit_price)
    .bind(n.tracker_source)
    .bind(n.tracker_url)
    .bind(n.latest_price_date)
    .bind(n.last_synced_at)
    .bind(n.sort_order)
    .bind(&now)
    .bind(id)
    .execute(&db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Investment holding {id} not found"
        )));
    }

    Ok(Json(fetch_holding(&db, id).await?))
}

// DELETE /investments/holdings/{id}
//
// `investment_holding_snapshots.holding_id` has ON DELETE CASCADE, so the
// snapshot history disappears with the holding.
async fn remove(State(db): State<Db>, Path(id): Path<i64>) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM investment_holdings WHERE id = ?")
        .bind(id)
        .execute(&db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Investment holding {id} not found"
        )));
    }

    Ok(StatusCode::NO_CONTENT)
}
