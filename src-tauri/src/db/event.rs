use tauri::State;

use crate::db::bootstrap::AppDatabase;
use crate::db::event_model::EventDto;

#[tauri::command]
pub fn list_events(db: State<'_, AppDatabase>) -> Result<Vec<EventDto>, String> {
    db.inner.list_events().map_err(|e| e.to_string())
}
