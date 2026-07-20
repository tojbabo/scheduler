use tauri::State;

use crate::common::AppDatabase;
use crate::model::task::{CreateTaskInput, TaskDto};

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
