use serde::{Deserialize, Serialize};

use crate::db::error::DbError;

/// Values allowed by `tasks.state` CHECK constraint.
pub const TASK_STATE_MIN: i64 = 0;
pub const TASK_STATE_MAX: i64 = 4;
/// Default when the UI omits state: 예정.
pub const TASK_STATE_DEFAULT: i64 = 3;

/// Row returned after insert / for list APIs.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDto {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub created_at: String,
    pub parent_id: Option<i64>,
    pub state: i64,
}

/// Payload for inserting a task (`id` is AUTOINCREMENT — not accepted).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub parent_id: Option<i64>,
    /// Omit or null → [`TASK_STATE_DEFAULT`] (예정).
    #[serde(default)]
    pub state: Option<i64>,
}

/// Validated fields ready for the DB backend.
#[derive(Debug, Clone)]
pub struct NewTask {
    pub title: String,
    pub description: Option<String>,
    pub created_at: String,
    pub parent_id: Option<i64>,
    pub state: i64,
}

impl CreateTaskInput {
    pub fn into_new_task(self) -> Result<NewTask, DbError> {
        let title = self.title.trim().to_string();
        if title.is_empty() {
            return Err(DbError::new("title is required"));
        }

        let description = self
            .description
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let created_at = normalize_created_at(&self.created_at)?;

        if let Some(parent_id) = self.parent_id {
            if parent_id <= 0 {
                return Err(DbError::new("parent_id must be a positive integer"));
            }
        }

        let state = self.state.unwrap_or(TASK_STATE_DEFAULT);
        if !(TASK_STATE_MIN..=TASK_STATE_MAX).contains(&state) {
            return Err(DbError::new(format!(
                "state must be between {TASK_STATE_MIN} and {TASK_STATE_MAX}"
            )));
        }

        Ok(NewTask {
            title,
            description,
            created_at,
            parent_id: self.parent_id,
            state,
        })
    }
}

/// Accept `YYYY-MM-DDTHH:MM` (datetime-local) or full ISO with seconds.
fn normalize_created_at(raw: &str) -> Result<String, DbError> {
    let s = raw.trim();
    if s.is_empty() {
        return Err(DbError::new("created_at is required"));
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
        "created_at must look like 2026-07-19T17:16 or 2026-07-19T17:16:00",
    ))
}
