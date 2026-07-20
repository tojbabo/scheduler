use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};

use crate::common::DbError;
use crate::model::event::EventDto;
use crate::model::task::{NewTask, TaskDto};
use crate::repo::Database;

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

    fn list_tasks(&self) -> Result<Vec<TaskDto>, DbError> {
        let conn = self.conn.lock()?;
        let mut stmt = conn.prepare(
            "SELECT id, title, description, created_at, parent_id, state
             FROM tasks
             ORDER BY id ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(TaskDto {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                created_at: row.get(3)?,
                parent_id: row.get(4)?,
                state: row.get(5)?,
            })
        })?;

        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
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

    fn list_events(&self) -> Result<Vec<EventDto>, DbError> {
        let conn = self.conn.lock()?;
        let mut stmt = conn.prepare(
            "SELECT id, created_at, updated_at, starts_at, ends_at, title, description, category_id
             FROM events
             ORDER BY starts_at IS NULL, starts_at ASC, id ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(EventDto {
                id: row.get(0)?,
                created_at: row.get(1)?,
                updated_at: row.get(2)?,
                starts_at: row.get(3)?,
                ends_at: row.get(4)?,
                title: row.get(5)?,
                description: row.get(6)?,
                category_id: row.get(7)?,
            })
        })?;

        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    }
}
