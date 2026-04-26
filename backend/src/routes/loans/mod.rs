pub mod loans;

use crate::db::Db;
use axum::Router;

// Routes for the loans feature. Mounted at `/loans` by the parent, so the
// URLs resolve to `/loans`, `/loans/{id}`. Only one resource today, but the
// subdirectory mirrors `budget/recurring/` and `budget/planned_purchases/`
// and leaves room for sibling resources (e.g. repayment schedules) without
// reshaping later.
pub fn router() -> Router<Db> {
    Router::new().merge(loans::router())
}
