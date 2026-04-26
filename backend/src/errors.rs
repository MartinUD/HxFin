use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    Validation(String),
    Database(sqlx::Error),
    Internal(anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        // Shape matches the Effect AppErrorSchema (TaggedStruct with _tag, code, message)
        // in src/lib/effect/errors.ts so the client can deserialize 4xx/5xx bodies.
        let (status, tag, code, message) = match self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "NotFoundError", "NOT_FOUND", msg),
            AppError::Validation(msg) => (
                StatusCode::BAD_REQUEST,
                "ValidationError",
                "VALIDATION_ERROR",
                msg,
            ),
            AppError::Database(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "PersistenceError",
                "PERSISTENCE_ERROR",
                e.to_string(),
            ),
            AppError::Internal(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "InternalError",
                "INTERNAL_ERROR",
                e.to_string(),
            ),
        };

        (
            status,
            Json(json!({ "_tag": tag, "code": code, "message": message })),
        )
            .into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::Database(e)
    }
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        AppError::Internal(e)
    }
}
