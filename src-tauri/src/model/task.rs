use serde::{Deserialize, Serialize};

use crate::common::time::normalize_iso_timestamp;
use crate::common::DbError;

/// Values allowed by `tasks.state` CHECK constraint.
pub const TASK_STATE_MIN: i64 = 0;
pub const TASK_STATE_MAX: i64 = 3;
/// Default when the UI omits state: 완료 전 기본값과 별개 — create 경로에서는 보통 0을 보냄.
pub const TASK_STATE_DEFAULT: i64 = 0;

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
    /// Fractional order among siblings (lexicographic ascending = top → bottom).
    pub rank: String,
}

/// Payload for inserting a task (`id` / `rank` assigned server-side).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub parent_id: Option<i64>,
    /// Omit or null → [`TASK_STATE_DEFAULT`].
    #[serde(default)]
    pub state: Option<i64>,
}

/// Full update payload (PUT-style). Does not change `rank`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskInput {
    pub id: i64,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub parent_id: Option<i64>,
    pub state: i64,
}

/// Move a task among its siblings. Almost always a single-row `rank` update.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderTaskInput {
    pub id: i64,
    /// Place immediately after this sibling. `None` = move to top of the sibling list.
    #[serde(default)]
    pub after_id: Option<i64>,
}

/// Validated fields ready for the DB backend (insert).
#[derive(Debug, Clone)]
pub struct NewTask {
    pub title: String,
    pub description: Option<String>,
    pub created_at: String,
    pub parent_id: Option<i64>,
    pub state: i64,
}

/// Validated fields ready for the DB backend (update).
#[derive(Debug, Clone)]
pub struct TaskPatch {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub created_at: String,
    pub parent_id: Option<i64>,
    pub state: i64,
}

/// Validated reorder request.
#[derive(Debug, Clone)]
pub struct TaskReorder {
    pub id: i64,
    pub after_id: Option<i64>,
}

fn normalize_title(title: &str) -> Result<String, DbError> {
    let title = title.trim().to_string();
    if title.is_empty() {
        return Err(DbError::new("title is required"));
    }
    Ok(title)
}

fn normalize_description(description: Option<String>) -> Option<String> {
    description
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn validate_parent_id(parent_id: Option<i64>, self_id: Option<i64>) -> Result<(), DbError> {
    if let Some(parent_id) = parent_id {
        if parent_id <= 0 {
            return Err(DbError::new("parent_id must be a positive integer"));
        }
        if self_id == Some(parent_id) {
            return Err(DbError::new("parent_id cannot reference the task itself"));
        }
    }
    Ok(())
}

fn validate_state(state: i64) -> Result<(), DbError> {
    if !(TASK_STATE_MIN..=TASK_STATE_MAX).contains(&state) {
        return Err(DbError::new(format!(
            "state must be between {TASK_STATE_MIN} and {TASK_STATE_MAX}"
        )));
    }
    Ok(())
}

impl CreateTaskInput {
    pub fn into_new_task(self) -> Result<NewTask, DbError> {
        let title = normalize_title(&self.title)?;
        let description = normalize_description(self.description);
        let created_at = normalize_iso_timestamp(&self.created_at)?;
        validate_parent_id(self.parent_id, None)?;
        let state = self.state.unwrap_or(TASK_STATE_DEFAULT);
        validate_state(state)?;

        Ok(NewTask {
            title,
            description,
            created_at,
            parent_id: self.parent_id,
            state,
        })
    }
}

impl UpdateTaskInput {
    pub fn into_patch(self) -> Result<TaskPatch, DbError> {
        if self.id <= 0 {
            return Err(DbError::new("id must be a positive integer"));
        }
        let title = normalize_title(&self.title)?;
        let description = normalize_description(self.description);
        let created_at = normalize_iso_timestamp(&self.created_at)?;
        validate_parent_id(self.parent_id, Some(self.id))?;
        validate_state(self.state)?;

        Ok(TaskPatch {
            id: self.id,
            title,
            description,
            created_at,
            parent_id: self.parent_id,
            state: self.state,
        })
    }
}

impl ReorderTaskInput {
    pub fn into_reorder(self) -> Result<TaskReorder, DbError> {
        if self.id <= 0 {
            return Err(DbError::new("id must be a positive integer"));
        }
        if let Some(after_id) = self.after_id {
            if after_id <= 0 {
                return Err(DbError::new("after_id must be a positive integer"));
            }
            if after_id == self.id {
                return Err(DbError::new("after_id cannot be the same as id"));
            }
        }
        Ok(TaskReorder {
            id: self.id,
            after_id: self.after_id,
        })
    }
}
