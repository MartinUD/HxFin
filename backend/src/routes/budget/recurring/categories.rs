use crate::{db::Db, errors::AppError};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, patch, post},
    Json, Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Deserialize)]
pub struct CreateCategory {
    name: String,
    description: Option<String>,
    color: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateCategory {
    name: String,
    description: Option<String>,
    color: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    id: i64,
    name: String,
    description: Option<String>,
    color: Option<String>,
    created_at: String,
    updated_at: String,
}

pub fn router() -> Router<Db> {
    Router::new()
        .route("/categories", get(list))
        .route("/categories", post(create))
        .route("/categories/{id}", patch(update))
        .route("/categories/{id}", delete(remove))
}

async fn list(State(db): State<Db>) -> Result<Json<Vec<Category>>, AppError> {
    // Return all categories, alphabetically (case-insensitive).
    let rows = sqlx::query(
        "SELECT id, name, description, color, created_at, updated_at \
         FROM budget_categories \
         ORDER BY name COLLATE NOCASE",
    )
    .fetch_all(&db)
    .await?;

    let categories = rows
        .into_iter()
        .map(|row| {
            Ok(Category {
                id: row.try_get("id")?,
                name: row.try_get("name")?,
                description: row.try_get("description")?,
                color: row.try_get("color")?,
                created_at: row.try_get("created_at")?,
                updated_at: row.try_get("updated_at")?,
            })
        })
        .collect::<Result<Vec<_>, sqlx::Error>>()?;

    Ok(Json(categories))
}

async fn create(
    State(db): State<Db>,
    Json(payload): Json<CreateCategory>,
) -> Result<(StatusCode, Json<Category>), AppError> {
    // Name is NOT NULL in the schema, so refuse empty/whitespace-only values.
    if payload.name.trim().is_empty() {
        return Err(AppError::Validation("Name cannot be empty".into()));
    }

    // id is INTEGER PRIMARY KEY — SQLite auto-assigns it when we omit it from the INSERT.
    let now = Utc::now().to_rfc3339();
    let row = sqlx::query(
        "INSERT INTO budget_categories (name, description, color, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?) \
         RETURNING id, name, description, color, created_at, updated_at",
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.color)
    .bind(&now)
    .bind(&now)
    .fetch_one(&db)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(Category {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            description: row.try_get("description")?,
            color: row.try_get("color")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        }),
    ))
}

async fn update(
    State(db): State<Db>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateCategory>,
) -> Result<Json<Category>, AppError> {
    // Name is NOT NULL in the schema, so refuse empty/whitespace-only values.
    if payload.name.trim().is_empty() {
        return Err(AppError::Validation("Name cannot be empty".into()));
    }

    // Update all columns and return the updated row in one round-trip.
    // fetch_optional gives us None if no row matched the id, which we map to 404.
    let now = Utc::now().to_rfc3339();
    let row = sqlx::query(
        "UPDATE budget_categories \
         SET name = ?, description = ?, color = ?, updated_at = ? \
         WHERE id = ? \
         RETURNING id, name, description, color, created_at, updated_at",
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.color)
    .bind(&now)
    .bind(id)
    .fetch_optional(&db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Category {id} not found")))?;

    Ok(Json(Category {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        description: row.try_get("description")?,
        color: row.try_get("color")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    }))
}

async fn remove(State(db): State<Db>, Path(id): Path<i64>) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM budget_categories WHERE id = ?")
        .bind(id)
        .execute(&db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Category {id} not found")));
    }

    Ok(StatusCode::NO_CONTENT)
}
