pub mod portfolio;
pub mod projections;

use crate::db::Db;
use axum::Router;

// Routes for the investments feature. Mounted at `/investments` by the
// parent; the source is split to mirror the two tabs in
// `src/routes/investments/+page.svelte` (`portfolio` and `projections`).
// URLs stay flat under `/investments/*` — the subfolders are a source-tree
// grouping, same pattern as `budget/{income,planned_purchases,recurring}`.
pub fn router() -> Router<Db> {
    Router::new()
        .merge(portfolio::router())
        .merge(projections::router())
}
