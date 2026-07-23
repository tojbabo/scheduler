use crate::common::DbError;
use crate::model::event::{EventDto, EventPatch, NewEvent};
use crate::model::task::{NewTask, TaskDto, TaskPatch};

/// Backend-agnostic database handle.
/// Swap SQLite for another engine by implementing this trait.
pub trait Database: Send + Sync {
    /// Apply DDL from a schema script (expected to be idempotent, e.g. IF NOT EXISTS).
    fn apply_schema(&self, schema_sql: &str) -> Result<(), DbError>;

    /// Ensure reference rows (e.g. categories) exist for FKs.
    fn seed_reference_data(&self) -> Result<(), DbError>;

    /// Backend identifier for diagnostics (e.g. "sqlite").
    fn backend_name(&self) -> &'static str;

    /// Connection / file location summary for diagnostics.
    fn location(&self) -> String;

    /// All tasks, ordered by id ascending (stable tree-friendly order).
    fn list_tasks(&self) -> Result<Vec<TaskDto>, DbError>;

    /// Insert a task; `id` is assigned by AUTOINCREMENT.
    fn create_task(&self, task: &NewTask) -> Result<TaskDto, DbError>;

    /// Replace task fields by id.
    fn update_task(&self, patch: &TaskPatch) -> Result<TaskDto, DbError>;

    /// Delete a task by id (children cascade).
    fn delete_task(&self, id: i64) -> Result<(), DbError>;

    /// All events, ordered by starts_at (nulls last), then id.
    fn list_events(&self) -> Result<Vec<EventDto>, DbError>;

    /// Insert an event; `id` AUTOINCREMENT, timestamps set to local now.
    fn create_event(&self, event: &NewEvent) -> Result<EventDto, DbError>;

    /// Replace event fields by id (`created_at` unchanged).
    fn update_event(&self, patch: &EventPatch) -> Result<EventDto, DbError>;

    /// Delete an event by id.
    fn delete_event(&self, id: i64) -> Result<(), DbError>;
}
