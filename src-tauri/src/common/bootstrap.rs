use std::path::PathBuf;
use std::sync::Arc;

use tauri::{AppHandle, Manager, State};

use crate::common::DbError;
use crate::repo::{Database, SqliteDatabase};

/// Compiled-in schema. Edit `src-tauri/schema/schema.sql` to change tables.
const SCHEMA_SQL: &str = include_str!("../../schema/schema.sql");

/// Managed app state: trait object so the backend can be swapped later.
pub struct AppDatabase {
    pub inner: Arc<dyn Database>,
}

pub fn init_database(app: &AppHandle) -> Result<AppDatabase, DbError> {
    let db_path = resolve_db_path(app)?;
    // Concrete backend today: SQLite. Replace this line to swap engines.
    let db: Arc<dyn Database> = Arc::new(SqliteDatabase::open(&db_path)?);
    db.apply_schema(SCHEMA_SQL)?;
    db.seed_reference_data()?;
    Ok(AppDatabase { inner: db })
}

fn resolve_db_path(app: &AppHandle) -> Result<PathBuf, DbError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| DbError::new(format!("app data dir: {e}")))?;
    Ok(dir.join("scheduler.db"))
}

#[tauri::command]
pub fn db_status(db: State<'_, AppDatabase>) -> Result<DbStatusDto, String> {
    Ok(DbStatusDto {
        backend: db.inner.backend_name().to_string(),
        location: db.inner.location(),
        schema_applied: true,
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbStatusDto {
    pub backend: String,
    pub location: String,
    pub schema_applied: bool,
}
