pub mod categories;
pub mod costs;
pub mod summary;

use axum::Router;
use crate::db::Db;

// Routes for the recurring-costs feature. Mounted at `/budget` by the
// parent module so URLs stay flat: `/budget/categories`, `/budget/costs`,
// `/budget/summary`. Grouping the modules here keeps the source tree
// readable once sibling features (e.g. planned purchases) land.
pub fn router() -> Router<Db> {
    Router::new()
        .merge(categories::router())
        .merge(costs::router())
        .merge(summary::router())
}
