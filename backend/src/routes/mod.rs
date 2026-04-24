pub mod budget;
pub mod loans;

use axum::Router;
use crate::db::Db;

pub fn router() -> Router<Db> {
    Router::new()
        .nest("/budget", budget::router())
        .nest("/loans", loans::router())
}
