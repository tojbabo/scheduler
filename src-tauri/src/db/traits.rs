use crate::db::error::DbError;
use crate::db::event_model::EventDto;
use crate::db::task_model::{NewTask, TaskDto};

/// Backend-agnostic database handle.
/// Swap SQLite for another engine by implementing this trait.
pub trait Database: Send + Sync {
    /// Apply DDL from a schema script (expected to be idempotent, e.g. IF NOT EXISTS).
    fn apply_schema(&self, schema_sql: &str) -> Result<(), DbError>;

    /// Backend identifier for diagnostics (e.g. "sqlite").
    fn backend_name(&self) -> &'static str;

    /// Connection / file location summary for diagnostics.
    fn location(&self) -> String;

    /// All tasks, ordered by id ascending (stable tree-friendly order).
    fn list_tasks(&self) -> Result<Vec<TaskDto>, DbError>;

    /// Insert a task; `id` is assigned by AUTOINCREMENT.
    fn create_task(&self, task: &NewTask) -> Result<TaskDto, DbError>;

    /// All events, ordered by starts_at (nulls last), then id.
    fn list_events(&self) -> Result<Vec<EventDto>, DbError>;
}
