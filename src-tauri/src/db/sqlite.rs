use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;

use crate::db::error::DbError;
use crate::db::traits::Database;

/// SQLite-backed [`Database`] implementation.
pub struct SqliteDatabase {
    path: PathBuf,
    conn: Mutex<Connection>,
}

impl SqliteDatabase {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, DbError> {
        let path = path.as_ref().to_path_buf();

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&path)?;
        conn.pragma_update(None, "foreign_keys", "ON")?;

        Ok(Self {
            path,
            conn: Mutex::new(conn),
        })
    }
}

impl Database for SqliteDatabase {
    fn apply_schema(&self, schema_sql: &str) -> Result<(), DbError> {
        let conn = self.conn.lock()?;
        conn.execute_batch(schema_sql)?;
        Ok(())
    }

    fn backend_name(&self) -> &'static str {
        "sqlite"
    }

    fn location(&self) -> String {
        self.path.display().to_string()
    }
}
