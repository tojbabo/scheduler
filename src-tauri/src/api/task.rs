use tauri::State;

use crate::common::AppDatabase;
use crate::model::task::{CreateTaskInput, TaskDto, UpdateTaskInput};

#[tauri::command]
pub fn list_tasks(db: State<'_, AppDatabase>) -> Result<Vec<TaskDto>, String> {
    db.inner.list_tasks().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_task(
    db: State<'_, AppDatabase>,
    input: CreateTaskInput,
) -> Result<TaskDto, String> {
    let new_task = input.into_new_task().map_err(|e| e.to_string())?;
    db.inner
        .create_task(&new_task)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_task(
    db: State<'_, AppDatabase>,
    input: UpdateTaskInput,
) -> Result<TaskDto, String> {
    let patch = input.into_patch().map_err(|e| e.to_string())?;
    db.inner.update_task(&patch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_task(db: State<'_, AppDatabase>, id: i64) -> Result<(), String> {
    if id <= 0 {
        return Err("id must be a positive integer".into());
    }
    db.inner.delete_task(id).map_err(|e| e.to_string())
}
