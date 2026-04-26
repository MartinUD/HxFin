use crate::errors::AppError;
use regex::Regex;
use serde::Deserialize;
use std::sync::OnceLock;

// Per-holding result of an Avanza refresh. Shape matches the TS
// `RefreshHoldingResult` subset so `refresh.rs` can treat both sources
// uniformly.
#[derive(Debug, PartialEq)]
pub struct AvanzaQuote {
    pub unit_price: f64,
    // `YYYY-MM-DD` (matches `IsoDateSchema` on the frontend).
    pub price_date: String,
    pub tracker_url: String,
}

// Subset of the `/_api/search/filtered-search` response we care about.
// `#[serde(rename_all = "camelCase")]` so `orderBookId` in the payload
// maps to `order_book_id` here.
#[derive(Deserialize)]
struct SearchResponse {
    hits: Vec<SearchHit>,
}

// `orderBookId` is optional because Avanza's search also returns non-fund
// hits (e.g. FAQ pages with `type != "FUND"`) that carry a null here
// despite our `instrumentType: "FUND"` filter. We skip those when picking
// a hit rather than fail the deserialization.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchHit {
    title: String,
    order_book_id: Option<String>,
    url_slug_name: Option<String>,
}

// Subset of the `/_api/fund-guide/guide/{orderBookId}` response.
// `navDate` comes back as a full ISO-8601 timestamp; we slice off the
// date portion in `parse_guide`, matching the TS `navDate.slice(0, 10)`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GuideResponse {
    nav: f64,
    nav_date: String,
}

// Extracts the slug after `avanza.se/`. Matches what the TS
// `resolveAvanzaSlug` does — we only need the slug to build a search
// query, not to look anything up.
fn slug_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"(?i)avanza\.se/([^/?#]+)"#).expect("avanza slug regex"))
}

fn slug_from_url(url: &str) -> Option<&str> {
    slug_regex()
        .captures(url)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str())
}

// Parse the guide JSON. Split from `fetch_quote` so the HTTP side and the
// JSON-decoding side can be tested independently.
fn parse_guide(json: &str, tracker_url: String) -> Result<AvanzaQuote, AppError> {
    let payload: GuideResponse = serde_json::from_str(json)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Could not parse Avanza guide: {e}")))?;
    Ok(AvanzaQuote {
        unit_price: payload.nav,
        // Guard against unexpectedly short values — `chars().take(10)` just
        // truncates if the string is already short, so assert the prefix
        // length instead.
        price_date: if payload.nav_date.len() >= 10 {
            payload.nav_date[..10].to_string()
        } else {
            return Err(AppError::Internal(anyhow::anyhow!(
                "Avanza navDate too short: {:?}",
                payload.nav_date
            )));
        },
        tracker_url,
    })
}

// Resolve the holding to Avanza's `orderBookId` via the filtered-search
// endpoint. Split out so the live test can probe it independently.
async fn search_for_hit(client: &reqwest::Client, query: &str) -> Result<SearchHit, AppError> {
    let body = serde_json::json!({
        "query": query,
        "instrumentType": "FUND",
        "limit": 10,
    });

    let response = client
        .post("https://www.avanza.se/_api/search/filtered-search")
        .header("content-type", "application/json")
        .header("accept", "application/json")
        .body(body.to_string())
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    if !response.status().is_success() {
        return Err(AppError::Internal(anyhow::anyhow!(
            "Avanza search failed with {}",
            response.status()
        )));
    }

    let text = response
        .text()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;
    let payload: SearchResponse = serde_json::from_str(&text)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Could not parse Avanza search: {e}")))?;

    // Only consider hits that actually have an orderBookId (see the
    // `SearchHit::order_book_id` comment). Prefer an exact title match
    // (case-insensitive, matching the TS `.toLowerCase()` compare); fall
    // back to the first usable hit.
    let usable = payload.hits.iter().filter(|h| h.order_book_id.is_some());
    let hit = usable
        .clone()
        .find(|h| h.title.eq_ignore_ascii_case(query))
        .or_else(|| usable.clone().next())
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("No Avanza hits for {query:?}")))?;

    Ok(SearchHit {
        title: hit.title.clone(),
        order_book_id: hit.order_book_id.clone(),
        url_slug_name: hit.url_slug_name.clone(),
    })
}

// GET the Avanza fund quote for the holding at `tracker_url`. The URL
// comes from the holding's `tracker_url` column — this function doesn't
// know about holdings, it just scrapes.
pub async fn fetch_quote(tracker_url: &str) -> Result<AvanzaQuote, AppError> {
    let slug = slug_from_url(tracker_url).ok_or_else(|| {
        AppError::Internal(anyhow::anyhow!(
            "Could not extract Avanza slug from URL: {tracker_url}"
        ))
    })?;
    // Search query is the unslugified slug (`avanza-global` → `avanza global`)
    // so Avanza's full-text matcher handles it the same way the UI does.
    let query = slug.replace('-', " ");

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 FinDash/1.0")
        .build()
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    let hit = search_for_hit(&client, &query).await?;
    let order_book_id = hit.order_book_id.expect("filtered to Some above");
    let resolved_url = format!(
        "https://www.avanza.se/{}",
        hit.url_slug_name.as_deref().unwrap_or(slug)
    );

    let guide_url = format!(
        "https://www.avanza.se/_api/fund-guide/guide/{}",
        order_book_id
    );
    let response = client
        .get(&guide_url)
        .header("accept", "application/json")
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    if !response.status().is_success() {
        return Err(AppError::Internal(anyhow::anyhow!(
            "Avanza guide request failed with {}",
            response.status()
        )));
    }

    let body = response
        .text()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    parse_guide(&body, resolved_url)
}
