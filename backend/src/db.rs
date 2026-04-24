use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

pub type Db = SqlitePool;

pub async fn connect(path: &str) -> anyhow::Result<Db> {
    let url = format!("sqlite:{path}?mode=rwc");

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;

    sqlx::query("PRAGMA foreign_keys = ON").execute(&pool).await?;
    sqlx::query("PRAGMA journal_mode = WAL").execute(&pool).await?;

    Ok(pool)
}
