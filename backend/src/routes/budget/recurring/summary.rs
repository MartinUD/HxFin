use crate::{db::Db, errors::AppError};
use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;

// Internal FromRow shapes used only by `get_summary`. Kept private — the
// public response types are `BudgetSummary` / `BudgetSummaryCategory`
// further down.
#[derive(sqlx::FromRow)]
struct CategoryRow {
    id: i64,
    name: String,
}

#[derive(sqlx::FromRow)]
struct CostRow {
    category_id: i64,
    amount: f64,
    period: String,
    kind: String,
    is_essential: bool,
}

#[derive(sqlx::FromRow)]
struct ProfileRow {
    monthly_salary: f64,
    municipal_tax_rate: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetSummaryCategory {
    category_id: i64,
    category_name: String,
    monthly_total: f64,
    yearly_total: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetSummary {
    total_monthly_recurring: f64,
    total_yearly_recurring: f64,
    monthly_essential: f64,
    monthly_non_essential: f64,
    monthly_investing: f64,
    monthly_net_income: f64,
    monthly_unallocated: f64,
    savings_rate: f64,
    categories: Vec<BudgetSummaryCategory>,
}

pub fn router() -> Router<Db> {
    Router::new().route("/summary", get(get_summary))
}

fn to_monthly_amount(amount: f64, period: &str) -> f64 {
    match period {
        "weekly" => (amount * 52.0) / 12.0,
        "yearly" => amount / 12.0,
        _ => amount, // monthly or unknown fallback
    }
}

fn round_cents(value: f64) -> f64 {
    // Matches the TS helper — round half-away-from-zero at the cent.
    (value * 100.0).round() / 100.0
}

// Mirrors the kommunalskatt-based Swedish tax math in src/lib/tax.ts so the
// Rust backend produces the same netMonthly as the TypeScript one.
const STATLIG_RATE: f64 = 20.0;
const STATLIG_BREAKPOINT_YEARLY: f64 = 598_500.0;
const PBB: f64 = 57_300.0;

fn grundavdrag(gross_yearly: f64) -> f64 {
    if gross_yearly <= 0.0 {
        0.0
    } else if gross_yearly <= 46_200.0 {
        gross_yearly
    } else if gross_yearly <= 150_600.0 {
        46_200.0
    } else if gross_yearly <= 385_400.0 {
        46_200.0 - 0.1 * (gross_yearly - 150_600.0)
    } else if gross_yearly <= 519_300.0 {
        22_700.0
    } else {
        (22_700.0 - 0.05 * (gross_yearly - 519_300.0)).max(16_800.0)
    }
}

fn jobbskatteavdrag(taxable: f64, kommunalskatt: f64) -> f64 {
    let rate = kommunalskatt / 100.0;
    if taxable <= 0.91 * PBB {
        taxable * rate
    } else if taxable <= 3.24 * PBB {
        0.91 * PBB * rate + (taxable - 0.91 * PBB) * 0.332
    } else if taxable <= 8.08 * PBB {
        0.91 * PBB * rate + (3.24 * PBB - 0.91 * PBB) * 0.332 + (taxable - 3.24 * PBB) * 0.111
    } else {
        0.91 * PBB * rate + (3.24 * PBB - 0.91 * PBB) * 0.332 + (8.08 * PBB - 3.24 * PBB) * 0.111
    }
}

fn calculate_net_monthly(gross_monthly: f64, kommunalskatt: f64) -> f64 {
    let gross_yearly = gross_monthly * 12.0;
    let taxable = (gross_yearly - grundavdrag(gross_yearly)).max(0.0);
    let kommunal_tax = taxable * (kommunalskatt / 100.0);
    let statlig_tax = (gross_yearly - STATLIG_BREAKPOINT_YEARLY).max(0.0) * (STATLIG_RATE / 100.0);
    let total_tax_yearly =
        (kommunal_tax + statlig_tax - jobbskatteavdrag(taxable, kommunalskatt)).max(0.0);
    // Match TS: netMonthly = gross - Math.round(totalTaxMonthly).
    let total_tax_monthly = (total_tax_yearly / 12.0).round();
    gross_monthly - total_tax_monthly
}

// GET /budget/summary
async fn get_summary(State(db): State<Db>) -> Result<Json<BudgetSummary>, AppError> {
    // Load categories (id → name) for the breakdown labels.
    let category_rows: Vec<CategoryRow> = sqlx::query_as("SELECT id, name FROM budget_categories")
        .fetch_all(&db)
        .await?;
    let mut category_name_by_id: std::collections::HashMap<i64, String> =
        std::collections::HashMap::with_capacity(category_rows.len());
    for row in category_rows {
        category_name_by_id.insert(row.id, row.name);
    }

    // CAST AS REAL because the NUMERIC columns can be stored as INTEGER by
    // SQLite (dynamic typing) and sqlx refuses to decode those into f64.
    let cost_rows: Vec<CostRow> = sqlx::query_as(
        "SELECT category_id, CAST(amount AS REAL) AS amount, period, kind, is_essential \
         FROM recurring_costs",
    )
    .fetch_all(&db)
    .await?;

    // Load the (single-row) financial profile for the tax calc.
    let profile_row: Option<ProfileRow> = sqlx::query_as(
        "SELECT CAST(monthly_salary AS REAL) AS monthly_salary, \
         CAST(municipal_tax_rate AS REAL) AS municipal_tax_rate \
         FROM financial_profile LIMIT 1",
    )
    .fetch_optional(&db)
    .await?;
    let (monthly_salary, municipal_tax_rate) = match profile_row {
        Some(p) => (p.monthly_salary, p.municipal_tax_rate),
        // No profile row yet — treat as zero income so the page still renders.
        None => (0.0, 32.41),
    };

    // Walk the costs once, tallying per-category and by essential/investing buckets.
    let mut monthly_by_category: std::collections::HashMap<i64, f64> =
        std::collections::HashMap::new();
    let mut monthly_essential = 0.0_f64;
    let mut monthly_non_essential = 0.0_f64;
    let mut monthly_investing = 0.0_f64;

    for cost in &cost_rows {
        let monthly = to_monthly_amount(cost.amount, &cost.period);
        *monthly_by_category.entry(cost.category_id).or_insert(0.0) += monthly;

        if cost.kind == "investment" {
            monthly_investing += monthly;
        } else if cost.is_essential {
            monthly_essential += monthly;
        } else {
            monthly_non_essential += monthly;
        }
    }

    // Build per-category breakdown, sorted by monthly total descending.
    let mut categories: Vec<BudgetSummaryCategory> = monthly_by_category
        .into_iter()
        .map(|(category_id, monthly_total)| {
            let rounded_monthly = round_cents(monthly_total);
            BudgetSummaryCategory {
                category_id,
                category_name: category_name_by_id
                    .get(&category_id)
                    .cloned()
                    .unwrap_or_else(|| "Uncategorized".into()),
                monthly_total: rounded_monthly,
                yearly_total: round_cents(rounded_monthly * 12.0),
            }
        })
        .collect();
    categories.sort_by(|a, b| {
        b.monthly_total
            .partial_cmp(&a.monthly_total)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let total_monthly_recurring = round_cents(categories.iter().map(|c| c.monthly_total).sum());
    let rounded_monthly_essential = round_cents(monthly_essential);
    let rounded_monthly_non_essential = round_cents(monthly_non_essential);
    let rounded_monthly_investing = round_cents(monthly_investing);
    let monthly_net_income = round_cents(calculate_net_monthly(monthly_salary, municipal_tax_rate));
    let monthly_unallocated = round_cents(monthly_net_income - total_monthly_recurring);
    let savings_rate = if monthly_net_income > 0.0 {
        round_cents((rounded_monthly_investing / monthly_net_income) * 100.0)
    } else {
        0.0
    };

    Ok(Json(BudgetSummary {
        total_monthly_recurring,
        total_yearly_recurring: round_cents(total_monthly_recurring * 12.0),
        monthly_essential: rounded_monthly_essential,
        monthly_non_essential: rounded_monthly_non_essential,
        monthly_investing: rounded_monthly_investing,
        monthly_net_income,
        monthly_unallocated,
        savings_rate,
        categories,
    }))
}
