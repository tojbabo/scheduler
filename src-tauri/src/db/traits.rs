use crate::db::error::DbError;

/// Backend-agnostic database handle.
/// Swap SQLite for another engine by implementing this trait.
pub trait Database: Send + Sync {
    /// Apply DDL from a schema script (expected to be idempotent, e.g. IF NOT EXISTS).
    fn apply_schema(&self, schema_sql: &str) -> Result<(), DbError>;

    /// Backend identifier for diagnostics (e.g. "sqlite").
    fn backend_name(&self) -> &'static str;

    /// Connection / file location summary for diagnostics.
    fn location(&self) -> String;
}
