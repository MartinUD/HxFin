pub mod accounts;
pub mod holdings;
pub mod refresh;
pub mod tracking;

use crate::db::Db;
use axum::Router;

// Routes for the portfolio tab. Mounted at `/investments` by the parent,
// so URLs resolve to:
//   /investments/accounts
//   /investments/accounts/{id}
//   /investments/holdings
//   /investments/holdings/{id}
//   /investments/refresh
//
// `tracking` is declared here (source grouping) but not merged into the
// router — it exposes tracker-specific scraper helpers that `refresh.rs`
// calls into, not HTTP endpoints.
//
// Grouping here mirrors `budget/recurring/{categories,costs,summary}` —
// source grouping, flat URLs.
pub fn router() -> Router<Db> {
    Router::new()
        .merge(accounts::router())
        .merge(holdings::router())
        .merge(refresh::router())
}
