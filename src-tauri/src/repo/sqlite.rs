use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};

use crate::common::rank::{self, between};
use crate::common::time::SQLITE_NOW_LOCAL_ISO;
use crate::common::{Category, DbError};
use crate::model::event::{EventDto, EventPatch, NewEvent};
use crate::model::task::{NewTask, TaskDto, TaskPatch, TaskReorder};
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
        rank: row.get(6)?,
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

const TASK_SELECT: &str =
    "SELECT id, title, description, created_at, parent_id, state, rank FROM tasks";

impl Database for SqliteDatabase {
    fn apply_schema(&self, schema_sql: &str) -> Result<(), DbError> {
        let conn = self.conn.lock()?;
        conn.execute_batch(schema_sql)?;
        migrate_tasks_rank(&conn)?;
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
        let mut stmt = conn.prepare(&format!(
            "{TASK_SELECT}
             ORDER BY parent_id IS NOT NULL, parent_id ASC, rank ASC, id ASC"
        ))?;
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

        let rank = next_rank_at_end(&conn, task.parent_id)?;

        conn.execute(
            "INSERT INTO tasks (title, description, created_at, parent_id, state, rank)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                task.title,
                task.description,
                task.created_at,
                task.parent_id,
                task.state,
                rank,
            ],
        )?;

        let id = conn.last_insert_rowid();
        fetch_task(&conn, id)
    }

    fn update_task(&self, patch: &TaskPatch) -> Result<TaskDto, DbError> {
        let conn = self.conn.lock()?;

        let existing = fetch_task(&conn, patch.id)?;

        if let Some(parent_id) = patch.parent_id {
            ensure_task_exists(&conn, parent_id, "parent_id")?;
        }

        let parent_changed = existing.parent_id != patch.parent_id;
        let rank = if parent_changed {
            next_rank_at_end(&conn, patch.parent_id)?
        } else {
            existing.rank
        };

        let updated = conn.execute(
            "UPDATE tasks
             SET title = ?1, description = ?2, created_at = ?3,
                 parent_id = ?4, state = ?5, rank = ?6
             WHERE id = ?7",
            params![
                patch.title,
                patch.description,
                patch.created_at,
                patch.parent_id,
                patch.state,
                rank,
                patch.id,
            ],
        )?;
        if updated == 0 {
            return Err(DbError::new(format!("task {} not found", patch.id)));
        }

        fetch_task(&conn, patch.id)
    }

    fn reorder_task(&self, reorder: &TaskReorder) -> Result<TaskDto, DbError> {
        let conn = self.conn.lock()?;
        let moving = fetch_task(&conn, reorder.id)?;

        let after_rank = if let Some(after_id) = reorder.after_id {
            let after = fetch_task(&conn, after_id)?;
            if after.parent_id != moving.parent_id {
                return Err(DbError::new(
                    "after_id must be a sibling (same parent_id)",
                ));
            }
            Some(after.rank)
        } else {
            None
        };

        let before_rank = next_sibling_rank(
            &conn,
            moving.parent_id,
            after_rank.as_deref(),
            reorder.after_id,
            moving.id,
        )?;

        let new_rank = match between(after_rank.as_deref(), before_rank.as_deref()) {
            Ok(r) => r,
            Err(_) => {
                // Ranks too tight (rare): rebalance siblings then retry once.
                rebalance_siblings(&conn, moving.parent_id)?;
                let after_rank = if let Some(after_id) = reorder.after_id {
                    Some(fetch_task(&conn, after_id)?.rank)
                } else {
                    None
                };
                let before_rank = next_sibling_rank(
                    &conn,
                    moving.parent_id,
                    after_rank.as_deref(),
                    reorder.after_id,
                    moving.id,
                )?;
                between(after_rank.as_deref(), before_rank.as_deref())?
            }
        };

        conn.execute(
            "UPDATE tasks SET rank = ?1 WHERE id = ?2",
            params![new_rank, reorder.id],
        )?;

        fetch_task(&conn, reorder.id)
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

        let sql = format!(
            "UPDATE events
             SET updated_at = {SQLITE_NOW_LOCAL_ISO},
                 starts_at = ?1, ends_at = ?2,
                 title = ?3, description = ?4, category_id = ?5
             WHERE id = ?6"
        );
        let updated = conn.execute(
            &sql,
            params![
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

fn migrate_tasks_rank(conn: &Connection) -> Result<(), DbError> {
    let mut stmt = conn.prepare("PRAGMA table_info(tasks)")?;
    let cols: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;

    if cols.iter().any(|c| c == "rank") {
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE tasks ADD COLUMN rank TEXT NOT NULL DEFAULT 'V'",
        [],
    )?;
    backfill_ranks(conn)?;
    Ok(())
}

fn backfill_ranks(conn: &Connection) -> Result<(), DbError> {
    // Distinct parent groups (NULL roots + each parent_id).
    let mut parents: Vec<Option<i64>> = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT DISTINCT parent_id FROM tasks ORDER BY parent_id IS NOT NULL, parent_id",
        )?;
        let rows = stmt.query_map([], |row| row.get::<_, Option<i64>>(0))?;
        for row in rows {
            parents.push(row?);
        }
    }

    for parent_id in parents {
        rebalance_siblings(conn, parent_id)?;
    }
    Ok(())
}

fn rebalance_siblings(conn: &Connection, parent_id: Option<i64>) -> Result<(), DbError> {
    let ids = sibling_ids_ordered(conn, parent_id, None)?;
    let mut prev: Option<String> = None;
    for id in ids {
        let rank = match &prev {
            None => between(None, None)?,
            Some(p) => rank::after(p)?,
        };
        conn.execute(
            "UPDATE tasks SET rank = ?1 WHERE id = ?2",
            params![rank, id],
        )?;
        prev = Some(rank);
    }
    Ok(())
}

fn sibling_ids_ordered(
    conn: &Connection,
    parent_id: Option<i64>,
    exclude_id: Option<i64>,
) -> Result<Vec<i64>, DbError> {
    let mut out = Vec::new();
    match parent_id {
        Some(pid) => {
            let mut stmt = conn.prepare(
                "SELECT id FROM tasks
                 WHERE parent_id = ?1
                 ORDER BY rank ASC, id ASC",
            )?;
            let rows = stmt.query_map(params![pid], |row| row.get::<_, i64>(0))?;
            for row in rows {
                let id = row?;
                if exclude_id != Some(id) {
                    out.push(id);
                }
            }
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT id FROM tasks
                 WHERE parent_id IS NULL
                 ORDER BY rank ASC, id ASC",
            )?;
            let rows = stmt.query_map([], |row| row.get::<_, i64>(0))?;
            for row in rows {
                let id = row?;
                if exclude_id != Some(id) {
                    out.push(id);
                }
            }
        }
    }
    Ok(out)
}

fn next_rank_at_end(conn: &Connection, parent_id: Option<i64>) -> Result<String, DbError> {
    let max = max_sibling_rank(conn, parent_id)?;
    match max {
        None => between(None, None),
        Some(prev) => rank::after(&prev),
    }
}

fn max_sibling_rank(
    conn: &Connection,
    parent_id: Option<i64>,
) -> Result<Option<String>, DbError> {
    let result = match parent_id {
        Some(pid) => conn
            .query_row(
                "SELECT rank FROM tasks
                 WHERE parent_id = ?1
                 ORDER BY rank DESC, id DESC
                 LIMIT 1",
                params![pid],
                |row| row.get::<_, String>(0),
            )
            .optional()?,
        None => conn
            .query_row(
                "SELECT rank FROM tasks
                 WHERE parent_id IS NULL
                 ORDER BY rank DESC, id DESC
                 LIMIT 1",
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()?,
    };
    Ok(result)
}

/// Rank of the sibling that should sit immediately below the insertion point.
fn next_sibling_rank(
    conn: &Connection,
    parent_id: Option<i64>,
    after_rank: Option<&str>,
    after_id: Option<i64>,
    exclude_id: i64,
) -> Result<Option<String>, DbError> {
    let sql = match (parent_id, after_rank) {
        (Some(_), Some(_)) => {
            "SELECT rank FROM tasks
             WHERE parent_id = ?1
               AND id != ?2
               AND (rank > ?3 OR (rank = ?3 AND id > ?4))
             ORDER BY rank ASC, id ASC
             LIMIT 1"
        }
        (Some(_), None) => {
            "SELECT rank FROM tasks
             WHERE parent_id = ?1
               AND id != ?2
             ORDER BY rank ASC, id ASC
             LIMIT 1"
        }
        (None, Some(_)) => {
            "SELECT rank FROM tasks
             WHERE parent_id IS NULL
               AND id != ?1
               AND (rank > ?2 OR (rank = ?2 AND id > ?3))
             ORDER BY rank ASC, id ASC
             LIMIT 1"
        }
        (None, None) => {
            "SELECT rank FROM tasks
             WHERE parent_id IS NULL
               AND id != ?1
             ORDER BY rank ASC, id ASC
             LIMIT 1"
        }
    };

    let result = match (parent_id, after_rank, after_id) {
        (Some(pid), Some(ar), Some(aid)) => conn
            .query_row(sql, params![pid, exclude_id, ar, aid], |row| {
                row.get::<_, String>(0)
            })
            .optional()?,
        (Some(pid), None, _) => conn
            .query_row(sql, params![pid, exclude_id], |row| {
                row.get::<_, String>(0)
            })
            .optional()?,
        (None, Some(ar), Some(aid)) => conn
            .query_row(sql, params![exclude_id, ar, aid], |row| {
                row.get::<_, String>(0)
            })
            .optional()?,
        (None, None, _) => conn
            .query_row(sql, params![exclude_id], |row| row.get::<_, String>(0))
            .optional()?,
        // after_rank without after_id shouldn't happen
        (Some(pid), Some(ar), None) => conn
            .query_row(
                "SELECT rank FROM tasks
                 WHERE parent_id = ?1 AND id != ?2 AND rank > ?3
                 ORDER BY rank ASC, id ASC LIMIT 1",
                params![pid, exclude_id, ar],
                |row| row.get::<_, String>(0),
            )
            .optional()?,
        (None, Some(ar), None) => conn
            .query_row(
                "SELECT rank FROM tasks
                 WHERE parent_id IS NULL AND id != ?1 AND rank > ?2
                 ORDER BY rank ASC, id ASC LIMIT 1",
                params![exclude_id, ar],
                |row| row.get::<_, String>(0),
            )
            .optional()?,
    };
    Ok(result)
}

fn fetch_task(conn: &Connection, id: i64) -> Result<TaskDto, DbError> {
    conn.query_row(
        &format!("{TASK_SELECT} WHERE id = ?1"),
        params![id],
        map_task_row,
    )
    .map_err(|_| DbError::new(format!("task {id} not found")))
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
