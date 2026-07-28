use crate::common::DbError;

/// Base-62 digits for lexicographic fractional ranks (LexoRank-style).
const DIGITS: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/// Rank strictly after `prev` (append to end of an ordered list).
pub fn after(prev: &str) -> Result<String, DbError> {
    between(Some(prev), None)
}

/// Generate a rank `r` such that `before < r < after` (open bounds when `None`).
pub fn between(before: Option<&str>, after: Option<&str>) -> Result<String, DbError> {
    if let Some(b) = before {
        validate(b)?;
    }
    if let Some(a) = after {
        validate(a)?;
    }
    if let (Some(b), Some(a)) = (before, after) {
        if b >= a {
            return Err(DbError::new(format!("invalid rank bounds: {b} >= {a}")));
        }
    }
    Ok(generate_key_between(before, after))
}

fn validate(s: &str) -> Result<(), DbError> {
    if s.is_empty() {
        return Err(DbError::new("rank must be non-empty"));
    }
    for &c in s.as_bytes() {
        if digit_index(c).is_none() {
            return Err(DbError::new(format!(
                "rank contains invalid character: {}",
                c as char
            )));
        }
    }
    // No trailing zero-digit (keeps keys canonical / avoids dead-ends).
    if s.as_bytes().last() == Some(&DIGITS[0]) {
        return Err(DbError::new("rank must not end with the lowest digit"));
    }
    Ok(())
}

fn digit_index(c: u8) -> Option<usize> {
    DIGITS.iter().position(|&d| d == c)
}

fn get_digit(s: &str, i: usize) -> Option<usize> {
    s.as_bytes().get(i).copied().and_then(digit_index)
}

/// Port of the common `generateKeyBetween` fractional-indexing algorithm.
fn generate_key_between(a: Option<&str>, b: Option<&str>) -> String {
    match (a, b) {
        (None, None) => mid_string("", ""),
        (Some(a), None) => increment_key(a),
        (None, Some(b)) => decrement_key(b),
        (Some(a), Some(b)) => mid_string(a, b),
    }
}

fn increment_key(a: &str) -> String {
    // Always valid and > a: append the middle digit.
    let mut out = a.to_string();
    out.push(DIGITS[DIGITS.len() / 2] as char);
    out
}

fn decrement_key(b: &str) -> String {
    // Prefer a midpoint between "" and b.
    mid_string("", b)
}

fn mid_string(a: &str, b: &str) -> String {
    let mut i = 0usize;
    let mut result = String::new();

    loop {
        let dig_a = get_digit(a, i).unwrap_or(0);
        let dig_b = get_digit(b, i).unwrap_or(DIGITS.len() - 1);

        if dig_a == dig_b {
            result.push(DIGITS[dig_a] as char);
            i += 1;
            continue;
        }

        if dig_b - dig_a > 1 {
            let mid = dig_a + (dig_b - dig_a) / 2;
            result.push(DIGITS[mid] as char);
            return trim_trailing_zeros(&result);
        }

        // Adjacent digits: take dig_a and continue one level deeper.
        result.push(DIGITS[dig_a] as char);
        i += 1;

        // If `a` is exhausted here, pick midpoint of (0, dig_b at next) via recursion-like append.
        if get_digit(a, i).is_none() {
            // Need something > a-prefix and < b. Append mid of range (0, dig_b) or open.
            let upper = get_digit(b, i).unwrap_or(DIGITS.len() - 1);
            if upper > 0 {
                let mid = upper / 2;
                if mid == 0 {
                    // Can't use 0 as terminal; keep descending.
                    result.push(DIGITS[0] as char);
                    // Force a non-zero continuation.
                    result.push(DIGITS[DIGITS.len() / 2] as char);
                    return result;
                }
                result.push(DIGITS[mid] as char);
                return trim_trailing_zeros(&result);
            }
            result.push(DIGITS[0] as char);
            result.push(DIGITS[DIGITS.len() / 2] as char);
            return result;
        }
    }
}

fn trim_trailing_zeros(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut end = bytes.len();
    while end > 1 && bytes[end - 1] == DIGITS[0] {
        end -= 1;
    }
    // Never return empty or ending with 0 — if trimmed to empty, use mid digit.
    let trimmed = &s[..end];
    if trimmed.is_empty() {
        return String::from(char::from(DIGITS[DIGITS.len() / 2]));
    }
    if trimmed.as_bytes().last() == Some(&DIGITS[0]) {
        let mut t = trimmed.to_string();
        t.push(DIGITS[DIGITS.len() / 2] as char);
        return t;
    }
    trimmed.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initial_is_stable() {
        let a = between(None, None).unwrap();
        assert!(!a.is_empty());
        validate(&a).unwrap();
    }

    #[test]
    fn append_stays_ordered() {
        let mut prev = between(None, None).unwrap();
        for _ in 0..50 {
            let next = after(&prev).unwrap();
            assert!(prev < next, "{prev} < {next}");
            prev = next;
        }
    }

    #[test]
    fn insert_between() {
        let a = between(None, None).unwrap();
        let c = after(&a).unwrap();
        let b = between(Some(&a), Some(&c)).unwrap();
        assert!(a < b && b < c, "{a} < {b} < {c}");
    }

    #[test]
    fn insert_before_first() {
        let first = between(None, None).unwrap();
        let before = between(None, Some(&first)).unwrap();
        assert!(before < first, "{before} < {first}");
    }

    #[test]
    fn dense_inserts() {
        let mut left = between(None, None).unwrap();
        let right = after(&left).unwrap();
        for _ in 0..40 {
            let mid = between(Some(&left), Some(&right)).unwrap();
            assert!(left < mid && mid < right, "{left} < {mid} < {right}");
            left = mid;
        }
    }
}
