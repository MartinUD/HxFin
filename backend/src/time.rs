//! ISO-8601 timestamp helpers shared by the route handlers.
//!
//! Standardized on `YYYY-MM-DDTHH:MM:SS.sssZ` (millisecond precision, `Z`
//! zone suffix). This matches the legacy TS seed rows in `data/budget.db`
//! and what the frontend's `IsoDateTimeSchema` produces, so the list
//! endpoints return one shape rather than a mix of millisecond-`Z` and
//! `chrono::to_rfc3339`'s nanosecond-`+00:00` form. See MartinUD/HxFin#8.

use chrono::{DateTime, Utc};

/// Current UTC time as a millisecond-precision `Z`-suffixed ISO-8601 string.
pub fn iso_timestamp_now() -> String {
    iso_timestamp(Utc::now())
}

/// Format an arbitrary `DateTime<Utc>` in the standard shape. Exposed as a
/// separate helper so tests can pass a fixed instant.
pub fn iso_timestamp(now: DateTime<Utc>) -> String {
    now.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Timelike};

    #[test]
    fn formats_with_millisecond_z_suffix() {
        let instant = Utc
            .with_ymd_and_hms(2026, 4, 26, 12, 34, 56)
            .unwrap()
            .with_nanosecond(789_123_456)
            .unwrap();
        assert_eq!(iso_timestamp(instant), "2026-04-26T12:34:56.789Z");
    }

    #[test]
    fn pads_milliseconds_to_three_digits() {
        let instant = Utc
            .with_ymd_and_hms(2026, 1, 2, 3, 4, 5)
            .unwrap()
            .with_nanosecond(1_000_000)
            .unwrap();
        assert_eq!(iso_timestamp(instant), "2026-01-02T03:04:05.001Z");
    }
}
