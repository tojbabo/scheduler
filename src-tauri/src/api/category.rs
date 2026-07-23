use serde::Serialize;

use crate::common::Category;

/// Category option for UI selects (`id` + display `name`).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryDto {
    pub id: i64,
    pub name: String,
}

#[tauri::command]
pub fn list_categories() -> Vec<CategoryDto> {
    Category::ALL
        .iter()
        .map(|c| CategoryDto {
            id: c.id(),
            name: c.to_string(),
        })
        .collect()
}
