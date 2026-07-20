use serde::Serialize;

/// Row for events list / detail APIs.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventDto {
    pub id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub category_id: Option<i64>,
}
