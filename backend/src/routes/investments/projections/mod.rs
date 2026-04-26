pub mod preset;

use crate::db::Db;
use axum::Router;

// Routes for the projections tab. Mounted at `/investments` by the parent,
// so URLs stay flat. Grouping mirrors `budget/income/` — a subdirectory
// that leaves room for sibling resources without reshaping later.
pub fn router() -> Router<Db> {
    Router::new().merge(preset::router())
}
