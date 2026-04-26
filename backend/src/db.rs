use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

pub type Db = SqlitePool;

pub async fn connect(path: &str) -> anyhow::Result<Db> {
    let url = format!("sqlite:{path}?mode=rwc");

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;

    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA journal_mode = WAL")
        .execute(&pool)
        .await?;
    repair_empty_investment_holdings(&pool).await?;

    Ok(pool)
}

async fn repair_empty_investment_holdings(pool: &Db) -> anyhow::Result<()> {
    let account_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM investment_accounts")
        .fetch_one(pool)
        .await?;
    let holding_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM investment_holdings")
        .fetch_one(pool)
        .await?;

    if account_count == 0 || holding_count > 0 {
        return Ok(());
    }

    let account_id: i64 = sqlx::query_scalar(
        "SELECT id FROM investment_accounts ORDER BY created_at ASC, id ASC LIMIT 1",
    )
    .fetch_one(pool)
    .await?;

    let timestamp = "2026-03-06T13:00:00.000Z";
    let mut tx = pool.begin().await?;
    let holdings = [
        (
            "Nordea Global Index Select A",
            60.0,
            408_176.23,
            685.8,
            595.19,
            "nordea",
            "https://www.nordeafunds.com/sv/fonder/global-index-select-a",
            "2026-03-06",
            0_i64,
        ),
        (
            "Nordea Sverige Passiv",
            20.0,
            131_513.44,
            244.18,
            538.59,
            "nordea",
            "https://www.nordeafunds.com/sv/fonder/sverige-passiv-a-a",
            "2026-03-06",
            1,
        ),
        (
            "Nordea Europa Index Select A",
            10.0,
            79_800.31,
            698.78,
            114.2,
            "nordea",
            "https://www.nordeafunds.com/sv/fonder/europa-index-select-a",
            "2026-03-06",
            2,
        ),
        (
            "Nordea Emerging Markets Enhanced BP",
            10.0,
            76_484.17,
            40.28,
            1898.67,
            "nordea",
            "https://www.nordeafunds.com/sv/fonder/emerging-markets-enhanced-bp",
            "2026-03-06",
            3,
        ),
        (
            "Avanza Global",
            70.0,
            3023.0,
            13.364279,
            226.2,
            "avanza",
            "https://www.avanza.se/avanza-global",
            "2026-03-05",
            10,
        ),
        (
            "Avanza Emerging Markets",
            30.0,
            1018.0,
            6.304186,
            161.48,
            "avanza",
            "https://www.avanza.se/avanza-emerging-markets",
            "2026-03-05",
            11,
        ),
    ];

    for (
        name,
        allocation_percent,
        current_value,
        units,
        unit_price,
        tracker_source,
        tracker_url,
        price_date,
        sort_order,
    ) in holdings
    {
        let holding_id: i64 = sqlx::query_scalar(
            "INSERT INTO investment_holdings \
                (account_id, name, allocation_percent, current_value, units, latest_unit_price, \
                 tracker_source, tracker_url, latest_price_date, last_synced_at, sort_order, \
                 created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) \
             RETURNING id",
        )
        .bind(account_id)
        .bind(name)
        .bind(allocation_percent)
        .bind(current_value)
        .bind(units)
        .bind(unit_price)
        .bind(tracker_source)
        .bind(tracker_url)
        .bind(price_date)
        .bind(timestamp)
        .bind(sort_order)
        .bind(timestamp)
        .bind(timestamp)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
            "INSERT INTO investment_holding_snapshots \
                (holding_id, current_value, unit_price, units, captured_at) \
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(holding_id)
        .bind(current_value)
        .bind(unit_price)
        .bind(units)
        .bind(timestamp)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}
