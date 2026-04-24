pub mod income;
pub mod planned_purchases;
pub mod recurring;

use axum::Router;
use crate::db::Db;

pub fn router() -> Router<Db> {
    Router::new()
        .merge(recurring::router())
        .merge(planned_purchases::router())
        .merge(income::router())
}
