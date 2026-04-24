use crate::{db::Db, errors::AppError};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, patch, post},
    Json, Router,
};
// axum_extra::extract::Query is backed by serde_html_form, which decodes
// repeated keys like `?categoryIds=1&categoryIds=2` into a Vec. The stock
// axum Query uses serde_urlencoded and would only keep the last value.
use axum_extra::extract::Query;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{QueryBuilder, Row, Sqlite};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringCost {
    id: i64,
    category_id: i64,
    name: String,
    amount: f64,
    period: String,
    kind: String,
    is_essential: bool,
    start_date: Option<String>,
    end_date: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    // Repeated query params: `?categoryIds=1&categoryIds=2`.
    // Empty = no category filter.
    #[serde(default)]
    category_ids: Vec<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecurringCost {
    category_id: i64,
    name: String,
    amount: f64,
    period: String,
    kind: String,
    is_essential: bool,
    start_date: Option<String>,
    end_date: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecurringCost {
    category_id: i64,
    name: String,
    amount: f64,
    period: String,
    kind: String,
    is_essential: bool,
    start_date: Option<String>,
    end_date: Option<String>,
}

pub fn router() -> Router<Db> {
    Router::new()
        .route("/costs", get(list))
        .route("/costs", post(create))
        .route("/costs/{id}", patch(update))
        .route("/costs/{id}", delete(remove))
}

fn row_to_cost(row: sqlx::sqlite::SqliteRow) -> Result<RecurringCost, sqlx::Error> {
    Ok(RecurringCost {
        id: row.try_get("id")?,
        category_id: row.try_get("category_id")?,
        name: row.try_get("name")?,
        amount: row.try_get("amount")?,
        period: row.try_get("period")?,
        kind: row.try_get("kind")?,
        is_essential: row.try_get("is_essential")?,
        start_date: row.try_get("start_date")?,
        end_date: row.try_get("end_date")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

// CAST amount AS REAL because NUMERIC columns can be stored as INTEGER under
// SQLite's dynamic typing and sqlx refuses to decode those into f64.
const SELECT_COLUMNS: &str =
    "id, category_id, name, CAST(amount AS REAL) AS amount, period, kind, is_essential, start_date, end_date, created_at, updated_at";

// GET /budget/costs
async fn list(
    State(db): State<Db>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<RecurringCost>>, AppError> {
    let mut qb: QueryBuilder<Sqlite> =
        QueryBuilder::new(format!("SELECT {SELECT_COLUMNS} FROM recurring_costs"));

    if !query.category_ids.is_empty() {
        qb.push(" WHERE category_id IN (");
        let mut ids = qb.separated(", ");
        for id in &query.category_ids {
            ids.push_bind(id);
        }
        qb.push(")");
    }

    qb.push(" ORDER BY created_at DESC");

    let rows = qb.build().fetch_all(&db).await?;
    let costs = rows
        .into_iter()
        .map(row_to_cost)
        .collect::<Result<Vec<_>, sqlx::Error>>()?;

    Ok(Json(costs))
}

// POST /budget/costs
async fn create(
    State(db): State<Db>,
    Json(payload): Json<CreateRecurringCost>,
) -> Result<(StatusCode, Json<RecurringCost>), AppError> {
    if payload.name.trim().is_empty() {
        return Err(AppError::Validation("Name cannot be empty".into()));
    }

    // Investments can't be flagged essential — keeps the summary math honest.
    let is_essential = if payload.kind == "investment" {
        false
    } else {
        payload.is_essential
    };

    // id is INTEGER PRIMARY KEY AUTOINCREMENT — SQLite assigns it on INSERT.
    let now = Utc::now().to_rfc3339();

    let sql = format!(
        "INSERT INTO recurring_costs \
         (category_id, name, amount, period, kind, is_essential, start_date, end_date, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) \
         RETURNING {SELECT_COLUMNS}"
    );

    let row = sqlx::query(&sql)
        .bind(payload.category_id)
        .bind(&payload.name)
        .bind(payload.amount)
        .bind(&payload.period)
        .bind(&payload.kind)
        .bind(is_essential)
        .bind(&payload.start_date)
        .bind(&payload.end_date)
        .bind(&now)
        .bind(&now)
        .fetch_one(&db)
        .await?;

    Ok((StatusCode::CREATED, Json(row_to_cost(row)?)))
}

// PATCH /budget/costs/{id}
async fn update(
    State(db): State<Db>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateRecurringCost>,
) -> Result<Json<RecurringCost>, AppError> {
    if payload.name.trim().is_empty() {
        return Err(AppError::Validation("Name cannot be empty".into()));
    }

    let is_essential = if payload.kind == "investment" {
        false
    } else {
        payload.is_essential
    };
    let now = Utc::now().to_rfc3339();

    let sql = format!(
        "UPDATE recurring_costs \
         SET category_id = ?, name = ?, amount = ?, period = ?, kind = ?, is_essential = ?, \
             start_date = ?, end_date = ?, updated_at = ? \
         WHERE id = ? \
         RETURNING {SELECT_COLUMNS}"
    );

    let row = sqlx::query(&sql)
        .bind(payload.category_id)
        .bind(&payload.name)
        .bind(payload.amount)
        .bind(&payload.period)
        .bind(&payload.kind)
        .bind(is_essential)
        .bind(&payload.start_date)
        .bind(&payload.end_date)
        .bind(&now)
        .bind(id)
        .fetch_optional(&db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Recurring cost {id} not found")))?;

    Ok(Json(row_to_cost(row)?))
}

// DELETE /budget/costs/{id}
async fn remove(State(db): State<Db>, Path(id): Path<i64>) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM recurring_costs WHERE id = ?")
        .bind(id)
        .execute(&db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Recurring cost {id} not found")));
    }

    Ok(StatusCode::NO_CONTENT)
}
