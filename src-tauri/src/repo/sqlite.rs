use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};

use crate::common::time::SQLITE_NOW_LOCAL_ISO;
use crate::common::{Category, DbError};
use crate::model::event::{EventDto, EventPatch, NewEvent};
use crate::model::task::{NewTask, TaskDto, TaskPatch};
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

fn map_task_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TaskDto> {
    Ok(TaskDto {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        created_at: row.get(3)?,
        parent_id: row.get(4)?,
        state: row.get(5)?,
    })
}

fn map_event_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<EventDto> {
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
}

impl Database for SqliteDatabase {
    fn apply_schema(&self, schema_sql: &str) -> Result<(), DbError> {
        let conn = self.conn.lock()?;
        conn.execute_batch(schema_sql)?;
        Ok(())
    }

    fn seed_reference_data(&self) -> Result<(), DbError> {
        let conn = self.conn.lock()?;
        let sql = format!(
            "INSERT INTO categories (id, name, created_at, updated_at)
             VALUES (?1, ?2, {SQLITE_NOW_LOCAL_ISO}, {SQLITE_NOW_LOCAL_ISO})
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               updated_at = excluded.updated_at"
        );
        for category in Category::ALL {
            conn.execute(&sql, params![category.id(), category.to_string()])?;
        }
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
        let rows = stmt.query_map([], map_task_row)?;

        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    }

    fn create_task(&self, task: &NewTask) -> Result<TaskDto, DbError> {
        let conn = self.conn.lock()?;

        if let Some(parent_id) = task.parent_id {
            ensure_task_exists(&conn, parent_id, "parent_id")?;
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

    fn update_task(&self, patch: &TaskPatch) -> Result<TaskDto, DbError> {
        let conn = self.conn.lock()?;

        ensure_task_exists(&conn, patch.id, "id")?;

        if let Some(parent_id) = patch.parent_id {
            ensure_task_exists(&conn, parent_id, "parent_id")?;
        }

        let updated = conn.execute(
            "UPDATE tasks
             SET title = ?1, description = ?2, created_at = ?3, parent_id = ?4, state = ?5
             WHERE id = ?6",
            params![
                patch.title,
                patch.description,
                patch.created_at,
                patch.parent_id,
                patch.state,
                patch.id,
            ],
        )?;
        if updated == 0 {
            return Err(DbError::new(format!("task {} not found", patch.id)));
        }

        conn.query_row(
            "SELECT id, title, description, created_at, parent_id, state
             FROM tasks WHERE id = ?1",
            params![patch.id],
            map_task_row,
        )
        .map_err(DbError::from)
    }

    fn delete_task(&self, id: i64) -> Result<(), DbError> {
        let conn = self.conn.lock()?;
        let deleted = conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
        if deleted == 0 {
            return Err(DbError::new(format!("task {id} not found")));
        }
        Ok(())
    }

    fn list_events(&self) -> Result<Vec<EventDto>, DbError> {
        let conn = self.conn.lock()?;
        let mut stmt = conn.prepare(
            "SELECT id, created_at, updated_at, starts_at, ends_at, title, description, category_id
             FROM events
             ORDER BY starts_at IS NULL, starts_at ASC, id ASC",
        )?;
        let rows = stmt.query_map([], map_event_row)?;

        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    }

    fn create_event(&self, event: &NewEvent) -> Result<EventDto, DbError> {
        let conn = self.conn.lock()?;

        let sql = format!(
            "INSERT INTO events
               (created_at, updated_at, starts_at, ends_at, title, description, category_id)
             VALUES
               ({SQLITE_NOW_LOCAL_ISO}, {SQLITE_NOW_LOCAL_ISO}, ?1, ?2, ?3, ?4, ?5)"
        );
        conn.execute(
            &sql,
            params![
                event.starts_at,
                event.ends_at,
                event.title,
                event.description,
                event.category_id,
            ],
        )?;

        let id = conn.last_insert_rowid();
        conn.query_row(
            "SELECT id, created_at, updated_at, starts_at, ends_at, title, description, category_id
             FROM events WHERE id = ?1",
            params![id],
            map_event_row,
        )
        .map_err(DbError::from)
    }

    fn update_event(&self, patch: &EventPatch) -> Result<EventDto, DbError> {
        let conn = self.conn.lock()?;

        let exists: Option<i64> = conn
            .query_row(
                "SELECT id FROM events WHERE id = ?1",
                params![patch.id],
                |row| row.get(0),
            )
            .optional()?;
        if exists.is_none() {
            return Err(DbError::new(format!("event {} not found", patch.id)));
        }

        let updated = conn.execute(
            "UPDATE events
             SET updated_at = ?1, starts_at = ?2, ends_at = ?3,
                 title = ?4, description = ?5, category_id = ?6
             WHERE id = ?7",
            params![
                patch.updated_at,
                patch.starts_at,
                patch.ends_at,
                patch.title,
                patch.description,
                patch.category_id,
                patch.id,
            ],
        )?;
        if updated == 0 {
            return Err(DbError::new(format!("event {} not found", patch.id)));
        }

        conn.query_row(
            "SELECT id, created_at, updated_at, starts_at, ends_at, title, description, category_id
             FROM events WHERE id = ?1",
            params![patch.id],
            map_event_row,
        )
        .map_err(DbError::from)
    }

    fn delete_event(&self, id: i64) -> Result<(), DbError> {
        let conn = self.conn.lock()?;
        let deleted = conn.execute("DELETE FROM events WHERE id = ?1", params![id])?;
        if deleted == 0 {
            return Err(DbError::new(format!("event {id} not found")));
        }
        Ok(())
    }
}

fn ensure_task_exists(
    conn: &Connection,
    id: i64,
    label: &str,
) -> Result<(), DbError> {
    let exists: Option<i64> = conn
        .query_row(
            "SELECT id FROM tasks WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()?;
    if exists.is_none() {
        return Err(DbError::new(format!("{label} {id} does not exist")));
    }
    Ok(())
}
