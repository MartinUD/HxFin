//! CRUD for planned-purchase categories.
//!
//! Distinct from `budget_categories` (used by recurring costs) — purchases
//! have their own table. Table is still named `wishlist_categories`; rename
//! is tracked separately (see MartinUD/HxFin#6).
//!
//! Frontend contract lives in `src/lib/schema/wishlist.ts`
//! (`WishlistCategorySchema`, `CreateWishlistCategoryInputSchema`,
//! `UpdateWishlistCategoryInputSchema`).

use crate::{db::Db, errors::AppError};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, patch, post},
    Json, Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{error::ErrorKind, Row};

// Mirrors the client-side limit in `CreateWishlistCategoryInputSchema`
// (src/lib/schema/wishlist.ts) — enforced here too so a malformed request
// that skips the frontend validation still gets a clean 400.
const MAX_NAME_LENGTH: usize = 80;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseCategory {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreatePurchaseCategory {
    pub name: String,
    pub description: Option<String>,
}

// Full-replacement PATCH shape (matches `recurring/categories.rs`): both
// fields are always sent by the frontend. Making `name` required avoids the
// "absent vs. null" ambiguity serde otherwise leaves us with.
#[derive(Deserialize)]
pub struct UpdatePurchaseCategory {
    pub name: String,
    pub description: Option<String>,
}

pub fn router() -> Router<Db> {
    Router::new()
        .route("/planned-purchases/categories", get(list))
        .route("/planned-purchases/categories", post(create))
        .route("/planned-purchases/categories/{id}", patch(update))
        .route("/planned-purchases/categories/{id}", delete(remove))
}

const SELECT_COLUMNS: &str = "id, name, description, created_at, updated_at";

fn row_to_category(row: sqlx::sqlite::SqliteRow) -> Result<PurchaseCategory, sqlx::Error> {
    Ok(PurchaseCategory {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        description: row.try_get("description")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

// Validation shared by `create` and `update`. Returns the trimmed name so
// the caller binds the exact string that passed validation.
fn validate_name(raw: &str) -> Result<&str, AppError> {
    let name = raw.trim();
    if name.is_empty() {
        return Err(AppError::Validation("Name cannot be empty".into()));
    }
    // chars().count() — match the TS `Schema.maxLength(80)`, which counts
    // Unicode code points rather than bytes.
    if name.chars().count() > MAX_NAME_LENGTH {
        return Err(AppError::Validation(format!(
            "Name must be {MAX_NAME_LENGTH} characters or fewer"
        )));
    }
    Ok(name)
}

// `wishlist_categories.name` carries a UNIQUE constraint. Translate sqlx's
// constraint-violation error into a 400 Validation so the frontend toast
// path stays consistent with the other validation errors.
fn map_insert_error(err: sqlx::Error, name: &str) -> AppError {
    match err {
        sqlx::Error::Database(dbe) if dbe.kind() == ErrorKind::UniqueViolation => {
            AppError::Validation(format!(
                "A purchase category named \"{name}\" already exists"
            ))
        }
        other => other.into(),
    }
}

// GET /budget/planned-purchases/categories
//
// Returns every purchase category, alphabetically (case-insensitive) to match
// the order the dialog in PlannedPurchasesWorkspace.svelte renders them in.
async fn list(State(db): State<Db>) -> Result<Json<Vec<PurchaseCategory>>, AppError> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM wishlist_categories ORDER BY name COLLATE NOCASE"
    );
    let rows = sqlx::query(&sql).fetch_all(&db).await?;

    let categories = rows
        .into_iter()
        .map(row_to_category)
        .collect::<Result<Vec<_>, sqlx::Error>>()?;

    Ok(Json(categories))
}

// POST /budget/planned-purchases/categories
async fn create(
    State(db): State<Db>,
    Json(payload): Json<CreatePurchaseCategory>,
) -> Result<(StatusCode, Json<PurchaseCategory>), AppError> {
    let name = validate_name(&payload.name)?;

    // id is INTEGER PRIMARY KEY — SQLite assigns it on INSERT.
    let now = Utc::now().to_rfc3339();
    let sql = format!(
        "INSERT INTO wishlist_categories (name, description, created_at, updated_at) \
         VALUES (?, ?, ?, ?) \
         RETURNING {SELECT_COLUMNS}"
    );
    let row = sqlx::query(&sql)
        .bind(name)
        .bind(&payload.description)
        .bind(&now)
        .bind(&now)
        .fetch_one(&db)
        .await
        .map_err(|e| map_insert_error(e, name))?;

    Ok((StatusCode::CREATED, Json(row_to_category(row)?)))
}

// PATCH /budget/planned-purchases/categories/{id}
//
// Full-replacement update. A missing row is a 404; a duplicate name collides
// on the UNIQUE constraint and surfaces as a 400 (same mapping as `create`).
async fn update(
    State(db): State<Db>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdatePurchaseCategory>,
) -> Result<Json<PurchaseCategory>, AppError> {
    let name = validate_name(&payload.name)?;

    let now = Utc::now().to_rfc3339();
    let sql = format!(
        "UPDATE wishlist_categories \
         SET name = ?, description = ?, updated_at = ? \
         WHERE id = ? \
         RETURNING {SELECT_COLUMNS}"
    );
    let row = sqlx::query(&sql)
        .bind(name)
        .bind(&payload.description)
        .bind(&now)
        .bind(id)
        .fetch_optional(&db)
        .await
        .map_err(|e| map_insert_error(e, name))?
        .ok_or_else(|| AppError::NotFound(format!("Purchase category {id} not found")))?;

    Ok(Json(row_to_category(row)?))
}

// DELETE /budget/planned-purchases/categories/{id}
//
// `wishlist_items.category_id` has `ON DELETE SET NULL`, so linked purchases
// survive the deletion with a null category — the DB handles cleanup for us.
async fn remove(State(db): State<Db>, Path(id): Path<i64>) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM wishlist_categories WHERE id = ?")
        .bind(id)
        .execute(&db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Purchase category {id} not found")));
    }

    Ok(StatusCode::NO_CONTENT)
}
