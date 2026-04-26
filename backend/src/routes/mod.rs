pub mod budget;
pub mod investments;
pub mod loans;

use crate::db::Db;
use axum::Router;

pub fn router() -> Router<Db> {
    Router::new()
        .nest("/budget", budget::router())
        .nest("/loans", loans::router())
        .nest("/investments", investments::router())
}
