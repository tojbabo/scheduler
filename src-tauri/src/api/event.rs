use tauri::State;

use crate::common::AppDatabase;
use crate::model::event::{CreateEventInput, EventDto, UpdateEventInput};

#[tauri::command]
pub fn list_events(db: State<'_, AppDatabase>) -> Result<Vec<EventDto>, String> {
    db.inner.list_events().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_event(
    db: State<'_, AppDatabase>,
    input: CreateEventInput,
) -> Result<EventDto, String> {
    let new_event = input.into_new_event().map_err(|e| e.to_string())?;
    db.inner
        .create_event(&new_event)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_event(
    db: State<'_, AppDatabase>,
    input: UpdateEventInput,
) -> Result<EventDto, String> {
    let patch = input.into_patch().map_err(|e| e.to_string())?;
    db.inner.update_event(&patch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_event(db: State<'_, AppDatabase>, id: i64) -> Result<(), String> {
    if id <= 0 {
        return Err("id must be a positive integer".into());
    }
    db.inner.delete_event(id).map_err(|e| e.to_string())
}
