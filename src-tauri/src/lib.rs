mod api;
mod common;
mod model;
mod repo;

use api::{
    create_event, create_task, delete_event, delete_task, list_categories, list_events, list_tasks,
    reorder_task, update_event, update_task,
};
use common::{db_status, init_database};
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Rust 브리지 OK — {name}")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let database = init_database(app.handle())?;
            app.manage(database);

            // Release builds open maximized; keep a normal window size while developing.
            #[cfg(not(debug_assertions))]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.maximize();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            db_status,
            list_categories,
            list_tasks,
            create_task,
            update_task,
            reorder_task,
            delete_task,
            list_events,
            create_event,
            update_event,
            delete_event
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
