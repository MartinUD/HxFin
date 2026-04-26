//! Refresh tracked investment holdings.
//!
//! POST /investments/refresh re-fetches unit prices for every holding whose
//! `tracker_source` is `nordea` or `avanza`, writes a new snapshot row, and
//! returns the refreshed holdings plus a per-holding outcome list.
//!
//! This is the Rust port of the old SvelteKit implementation in
//! `src/lib/server/investments/tracking.ts`.
//!
//! Frontend contract: `src/lib/schema/investments.ts`
//! (`InvestmentRefreshReportSchema`, `InvestmentRefreshOutcomeSchema`).
//!
use crate::{db::Db, errors::AppError};
use axum::{extract::State, routing::post, Json, Router};
use chrono::Utc;
use serde::Serialize;

use crate::routes::investments::portfolio::{
    holdings::{list_holdings, InvestmentHolding, ListQuery},
    tracking::{avanza, nordea},
};

const NORDEA_URLS_BY_HOLDING_NAME: &[(&str, &str)] = &[
    (
        "Nordea Emerging Markets Enhanced BP",
        "https://www.nordeafunds.com/sv/fonder/emerging-markets-enhanced-bp",
    ),
    (
        "Nordea Europa Index Select A",
        "https://www.nordeafunds.com/sv/fonder/europa-index-select-a",
    ),
    (
        "Nordea Global Index Select A",
        "https://www.nordeafunds.com/sv/fonder/global-index-select-a",
    ),
    (
        "Nordea Sverige Passiv",
        "https://www.nordeafunds.com/sv/fonder/sverige-passiv-a-a",
    ),
];

const AVANZA_SLUGS_BY_HOLDING_NAME: &[(&str, &str)] = &[
    ("Avanza Global", "avanza-global"),
    ("Avanza Emerging Markets", "avanza-emerging-markets"),
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvestmentRefreshOutcome {
    pub holding_id: i64,
    pub name: String,
    // Literal union: "refreshed" | "skipped" | "failed".
    pub status: String,
    pub message: Option<String>,
    pub current_value: Option<f64>,
    pub unit_price: Option<f64>,
    pub price_date: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvestmentRefreshReport {
    pub holdings: Vec<InvestmentHolding>,
    pub outcomes: Vec<InvestmentRefreshOutcome>,
}

#[derive(sqlx::FromRow)]
struct TrackedHolding {
    id: i64,
    name: String,
    current_value: f64,
    units: Option<f64>,
    tracker_source: String,
    tracker_url: Option<String>,
}

struct RefreshedHolding {
    holding_id: i64,
    name: String,
    current_value: f64,
    unit_price: f64,
    price_date: String,
}

pub fn router() -> Router<Db> {
    Router::new().route("/refresh", post(refresh))
}

// POST /investments/refresh
async fn refresh(State(db): State<Db>) -> Result<Json<InvestmentRefreshReport>, AppError> {
    let tracked_holdings: Vec<TrackedHolding> = sqlx::query_as(
        "SELECT id, name, CAST(current_value AS REAL) AS current_value, \
                CAST(units AS REAL) AS units, tracker_source, tracker_url \
           FROM investment_holdings \
          WHERE tracker_source IN ('nordea', 'avanza') \
          ORDER BY account_id ASC, sort_order ASC, created_at ASC",
    )
    .fetch_all(&db)
    .await?;

    let mut outcomes = Vec::with_capacity(tracked_holdings.len());

    for holding in tracked_holdings {
        let outcome = match refresh_holding(&db, &holding).await {
            Ok(Some(refreshed)) => InvestmentRefreshOutcome {
                holding_id: refreshed.holding_id,
                name: refreshed.name,
                status: "refreshed".to_string(),
                message: None,
                current_value: Some(refreshed.current_value),
                unit_price: Some(refreshed.unit_price),
                price_date: Some(refreshed.price_date),
            },
            Ok(None) => InvestmentRefreshOutcome {
                holding_id: holding.id,
                name: holding.name,
                status: "skipped".to_string(),
                message: Some(
                    "Holding is missing a positive current value or tracker URL".to_string(),
                ),
                current_value: None,
                unit_price: None,
                price_date: None,
            },
            Err(error) => InvestmentRefreshOutcome {
                holding_id: holding.id,
                name: holding.name,
                status: "failed".to_string(),
                message: Some(format!("{error:?}")),
                current_value: None,
                unit_price: None,
                price_date: None,
            },
        };

        outcomes.push(outcome);
    }

    let holdings = list_holdings(&db, ListQuery::default()).await?;
    Ok(Json(InvestmentRefreshReport { holdings, outcomes }))
}

async fn refresh_holding(
    db: &Db,
    holding: &TrackedHolding,
) -> Result<Option<RefreshedHolding>, AppError> {
    if holding.current_value <= 0.0 {
        return Ok(None);
    }

    let quote = match holding.tracker_source.as_str() {
        "nordea" => {
            let tracker_url = nordea_tracker_url(holding);
            let Some(tracker_url) = tracker_url else {
                return Ok(None);
            };
            let quote = nordea::fetch_quote(&tracker_url).await?;
            Quote {
                unit_price: quote.unit_price,
                price_date: quote.price_date,
                tracker_url,
            }
        }
        "avanza" => {
            let tracker_url = avanza_tracker_url(holding);
            let Some(tracker_url) = tracker_url else {
                return Ok(None);
            };
            let quote = avanza::fetch_quote(&tracker_url).await?;
            Quote {
                unit_price: quote.unit_price,
                price_date: quote.price_date,
                tracker_url: quote.tracker_url,
            }
        }
        _ => return Ok(None),
    };

    if quote.unit_price <= 0.0 {
        return Err(AppError::Internal(anyhow::anyhow!(
            "Tracker returned a non-positive unit price for holding {}",
            holding.id
        )));
    }

    let units = holding
        .units
        .unwrap_or_else(|| round_to(holding.current_value / quote.unit_price, 6));
    let current_value = round_to(quote.unit_price * units, 2);
    let synced_at = Utc::now().to_rfc3339();

    let mut tx = db.begin().await?;
    sqlx::query(
        "UPDATE investment_holdings \
            SET current_value = ?, units = ?, latest_unit_price = ?, tracker_url = ?, \
                latest_price_date = ?, last_synced_at = ?, updated_at = ? \
          WHERE id = ?",
    )
    .bind(current_value)
    .bind(units)
    .bind(quote.unit_price)
    .bind(&quote.tracker_url)
    .bind(&quote.price_date)
    .bind(&synced_at)
    .bind(&synced_at)
    .bind(holding.id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO investment_holding_snapshots \
            (holding_id, current_value, unit_price, units, captured_at) \
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(holding.id)
    .bind(current_value)
    .bind(quote.unit_price)
    .bind(units)
    .bind(&synced_at)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Some(RefreshedHolding {
        holding_id: holding.id,
        name: holding.name.clone(),
        current_value,
        unit_price: quote.unit_price,
        price_date: quote.price_date,
    }))
}

struct Quote {
    unit_price: f64,
    price_date: String,
    tracker_url: String,
}

fn nordea_tracker_url(holding: &TrackedHolding) -> Option<String> {
    NORDEA_URLS_BY_HOLDING_NAME
        .iter()
        .find_map(|(name, url)| (*name == holding.name).then_some((*url).to_string()))
        .or_else(|| holding.tracker_url.clone())
}

fn avanza_tracker_url(holding: &TrackedHolding) -> Option<String> {
    holding.tracker_url.clone().or_else(|| {
        AVANZA_SLUGS_BY_HOLDING_NAME
            .iter()
            .find_map(|(name, slug)| {
                (*name == holding.name).then_some(format!("https://www.avanza.se/{slug}"))
            })
    })
}

fn round_to(value: f64, decimals: i32) -> f64 {
    let factor = 10_f64.powi(decimals);
    (value * factor).round() / factor
}
