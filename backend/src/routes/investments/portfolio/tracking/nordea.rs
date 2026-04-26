use crate::errors::AppError;
use chrono::{Datelike, NaiveDate, Utc};
use regex::Regex;
use std::sync::OnceLock;

// Per-holding result of a Nordea refresh. Shape matches the TS
// `NordeaQuote` so `refresh.rs` can treat both sources uniformly.
#[derive(Debug, PartialEq)]
pub struct NordeaQuote {
    pub unit_price: f64,
    // `YYYY-MM-DD` (matches `IsoDateSchema` on the frontend).
    pub price_date: String,
}

// Compiled once per process — Regex::new isn't cheap and this runs once
// per refresh-call per holding otherwise.
//
// Tag-agnostic: the Nordea page used `<div class="title">` / `<div
// class="value">` at the time tracking.ts was written, and as of 2026-04
// it's `<dt class="title">` / `<dd class="value">`. The regex only anchors
// on the class names and lets any `[a-z]+` tag wrap the content, so both
// renderings parse.
fn quote_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r#"(?i)Kurs \(per ([0-9]{2}\.[0-9]{2})\.\)\s*</[a-z]+>\s*<[a-z]+\s+class="value"[^>]*>\s*([0-9\s.,]+?)\s*</[a-z]+>"#,
        )
        .expect("nordea quote regex is valid")
    })
}

// Swedish number format: `1.234,56` → 1234.56. Strip thousand separators
// (`.`), drop whitespace (the HTML can contain NBSP / regular spaces), and
// swap `,` for `.` before parsing as f64.
fn parse_decimal(raw: &str) -> Result<f64, AppError> {
    let cleaned: String = raw
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '.')
        .map(|c| if c == ',' { '.' } else { c })
        .collect();
    cleaned
        .parse::<f64>()
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Could not parse Nordea price: {raw:?}")))
}

// Nordea prints dates as `DD.MM.` — no year. Assume current UTC year,
// matching `toIsoDate()` in tracking.ts.
fn to_iso_date(day_month: &str) -> Result<String, AppError> {
    let (day_str, month_str) = day_month
        .split_once('.')
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Invalid Nordea date: {day_month:?}")))?;
    let day: u32 = day_str
        .parse()
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Invalid day: {day_str:?}")))?;
    let month: u32 = month_str
        .parse()
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Invalid month: {month_str:?}")))?;
    let year = Utc::now().year();
    let date = NaiveDate::from_ymd_opt(year, month, day)
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Invalid date: {year}-{month}-{day}")))?;
    Ok(date.format("%Y-%m-%d").to_string())
}

// Parse the quote block out of a Nordea fund page. Split from `fetch_quote`
// so the HTTP side and the HTML side can be tested independently.
fn parse_quote(html: &str) -> Result<NordeaQuote, AppError> {
    let caps = quote_regex()
        .captures(html)
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Could not parse Nordea quote")))?;
    let day_month = caps.get(1).unwrap().as_str();
    let raw_price = caps.get(2).unwrap().as_str();

    Ok(NordeaQuote {
        price_date: to_iso_date(day_month)?,
        unit_price: parse_decimal(raw_price)?,
    })
}

// GET the Nordea fund page at `url` and return the parsed quote. The
// URL comes from the holding's `tracker_url` column — this function
// doesn't know about holdings, it just scrapes.
pub async fn fetch_quote(url: &str) -> Result<NordeaQuote, AppError> {
    // Nordea rejects requests without a real-looking UA; the TS version
    // uses the same "Mozilla/5.0 FinDash/1.0" string.
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 FinDash/1.0")
        .build()
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    let response = client
        .get(url)
        .header("accept", "text/html,application/xhtml+xml")
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    if !response.status().is_success() {
        return Err(AppError::Internal(anyhow::anyhow!(
            "Nordea request failed with {}",
            response.status()
        )));
    }

    let html = response
        .text()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    parse_quote(&html)
}
