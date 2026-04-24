pub mod categories;
pub mod items;

use axum::Router;
use crate::db::Db;

// Routes for the planned-purchases feature (formerly "wishlist").
// Mounted by the parent at `/budget`, so paths resolve to:
//   /budget/planned-purchases
//   /budget/planned-purchases/{id}
//   /budget/planned-purchases/categories
//   /budget/planned-purchases/categories/{id}
pub fn router() -> Router<Db> {
    Router::new()
        .merge(items::router())
        .merge(categories::router())
}
