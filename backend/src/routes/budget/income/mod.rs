pub mod profile;

use axum::Router;
use crate::db::Db;

// Routes for the income-settings feature (`financial_profile` table).
// Mounted at `/budget` by the parent, so the URL is `/budget/income`.
// Grouping in a subdirectory mirrors `recurring/` and `planned_purchases/`
// and leaves room for sibling resources (e.g. income sources, tax brackets)
// without reshaping later.
pub fn router() -> Router<Db> {
    Router::new().merge(profile::router())
}
