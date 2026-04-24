mod db;
mod errors;
mod routes;

use std::env;

use axum::Router;
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let db_path = env::var("BUDGET_DB_PATH").unwrap_or_else(|_| "../data/budget.db".to_string());
    let pool = db::connect(&db_path).await?;

    let app = Router::new()
        .nest("/api", routes::router())
        .layer(CorsLayer::permissive())
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await?;
    println!("Rust backend listening on http://localhost:3001");
    axum::serve(listener, app).await?;

    Ok(())
}
