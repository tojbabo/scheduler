use serde::{Deserialize, Serialize};

use crate::common::time::{normalize_iso_timestamp, normalize_optional_iso_timestamp};
use crate::common::{Category, DbError};

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

/// Payload for inserting an event.
/// `id` is AUTOINCREMENT; `created_at` / `updated_at` are set server-side to now.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEventInput {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub starts_at: Option<String>,
    #[serde(default)]
    pub ends_at: Option<String>,
    #[serde(default)]
    pub category_id: Option<i64>,
}

/// Full update payload (PUT-style). `created_at` is not changed.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEventInput {
    pub id: i64,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub starts_at: Option<String>,
    #[serde(default)]
    pub ends_at: Option<String>,
    #[serde(default)]
    pub category_id: Option<i64>,
    /// Client-supplied update time (ISO).
    pub updated_at: String,
}

/// Validated fields ready for the DB backend (insert).
#[derive(Debug, Clone)]
pub struct NewEvent {
    pub title: String,
    pub description: Option<String>,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
    pub category_id: Option<i64>,
}

/// Validated fields ready for the DB backend (update).
#[derive(Debug, Clone)]
pub struct EventPatch {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
    pub category_id: Option<i64>,
    pub updated_at: String,
}

fn normalize_title(title: &str) -> Result<String, DbError> {
    let title = title.trim().to_string();
    if title.is_empty() {
        return Err(DbError::new("title is required"));
    }
    Ok(title)
}

fn normalize_description(description: Option<String>) -> Option<String> {
    description
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn validate_category_id(category_id: Option<i64>) -> Result<(), DbError> {
    if let Some(id) = category_id {
        Category::try_from(id).map_err(|_| {
            DbError::new(format!("category_id {id} is not a known category"))
        })?;
    }
    Ok(())
}

fn validate_range(
    starts_at: &Option<String>,
    ends_at: &Option<String>,
) -> Result<(), DbError> {
    if let (Some(start), Some(end)) = (starts_at, ends_at) {
        if end < start {
            return Err(DbError::new("ends_at must be >= starts_at"));
        }
    }
    Ok(())
}

impl CreateEventInput {
    pub fn into_new_event(self) -> Result<NewEvent, DbError> {
        let title = normalize_title(&self.title)?;
        let description = normalize_description(self.description);
        let starts_at = normalize_optional_iso_timestamp(self.starts_at.as_deref())?;
        let ends_at = normalize_optional_iso_timestamp(self.ends_at.as_deref())?;
        validate_range(&starts_at, &ends_at)?;
        validate_category_id(self.category_id)?;

        Ok(NewEvent {
            title,
            description,
            starts_at,
            ends_at,
            category_id: self.category_id,
        })
    }
}

impl UpdateEventInput {
    pub fn into_patch(self) -> Result<EventPatch, DbError> {
        if self.id <= 0 {
            return Err(DbError::new("id must be a positive integer"));
        }

        let title = normalize_title(&self.title)?;
        let description = normalize_description(self.description);
        let starts_at = normalize_optional_iso_timestamp(self.starts_at.as_deref())?;
        let ends_at = normalize_optional_iso_timestamp(self.ends_at.as_deref())?;
        let updated_at = normalize_iso_timestamp(&self.updated_at)?;
        validate_range(&starts_at, &ends_at)?;
        validate_category_id(self.category_id)?;

        Ok(EventPatch {
            id: self.id,
            title,
            description,
            starts_at,
            ends_at,
            category_id: self.category_id,
            updated_at,
        })
    }
}
