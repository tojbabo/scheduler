use tauri::State;

use crate::db::bootstrap::AppDatabase;
use crate::db::task_model::CreateTaskInput;

#[tauri::command]
pub fn create_task(
    db: State<'_, AppDatabase>,
    input: CreateTaskInput,
) -> Result<crate::db::task_model::TaskDto, String> {
    let new_task = input.into_new_task().map_err(|e| e.to_string())?;
    db.inner
        .create_task(&new_task)
        .map_err(|e| e.to_string())
}
