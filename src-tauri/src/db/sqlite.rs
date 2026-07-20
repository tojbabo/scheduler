use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};

use crate::db::error::DbError;
use crate::db::task_model::{NewTask, TaskDto};
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

    fn create_task(&self, task: &NewTask) -> Result<TaskDto, DbError> {
        let conn = self.conn.lock()?;

        if let Some(parent_id) = task.parent_id {
            let exists: Option<i64> = conn
                .query_row(
                    "SELECT id FROM tasks WHERE id = ?1",
                    params![parent_id],
                    |row| row.get(0),
                )
                .optional()?;
            if exists.is_none() {
                return Err(DbError::new(format!(
                    "parent_id {parent_id} does not exist"
                )));
            }
        }

        conn.execute(
            "INSERT INTO tasks (title, description, created_at, parent_id, state)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                task.title,
                task.description,
                task.created_at,
                task.parent_id,
                task.state,
            ],
        )?;

        let id = conn.last_insert_rowid();
        Ok(TaskDto {
            id,
            title: task.title.clone(),
            description: task.description.clone(),
            created_at: task.created_at.clone(),
            parent_id: task.parent_id,
            state: task.state,
        })
    }
}
