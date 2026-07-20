use crate::common::DbError;

/// Accept `YYYY-MM-DDTHH:MM` (datetime-local) or full ISO with seconds.
pub fn normalize_iso_timestamp(raw: &str) -> Result<String, DbError> {
    let s = raw.trim();
    if s.is_empty() {
        return Err(DbError::new("timestamp is required"));
    }

    // datetime-local: 2026-07-20T23:38
    if s.len() == 16 && s.as_bytes().get(10) == Some(&b'T') {
        return Ok(format!("{s}:00"));
    }

    // Already has seconds (or longer ISO): 2026-07-19T17:16:00
    if s.len() >= 19 && s.as_bytes().get(10) == Some(&b'T') {
        return Ok(s[..19].to_string());
    }

    Err(DbError::new(
        "timestamp must look like 2026-07-19T17:16 or 2026-07-19T17:16:00",
    ))
}

/// Optional timestamp: empty/None → None, otherwise normalized.
pub fn normalize_optional_iso_timestamp(
    raw: Option<&str>,
) -> Result<Option<String>, DbError> {
    match raw {
        None => Ok(None),
        Some(s) if s.trim().is_empty() => Ok(None),
        Some(s) => Ok(Some(normalize_iso_timestamp(s)?)),
    }
}
