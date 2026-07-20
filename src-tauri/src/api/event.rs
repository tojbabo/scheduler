use tauri::State;

use crate::common::AppDatabase;
use crate::model::event::EventDto;

#[tauri::command]
pub fn list_events(db: State<'_, AppDatabase>) -> Result<Vec<EventDto>, String> {
    db.inner.list_events().map_err(|e| e.to_string())
}
