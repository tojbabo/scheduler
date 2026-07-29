use serde::{Deserialize, Serialize};

use super::location::fetch_windows_location_blocking;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayWeatherDto {
    pub date: String,
    pub weather_code: i32,
    pub condition: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeekWeatherDto {
    pub latitude: f64,
    pub longitude: f64,
    pub days: Vec<DayWeatherDto>,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoResponse {
    daily: OpenMeteoDaily,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoDaily {
    time: Vec<String>,
    weather_code: Vec<i32>,
}

/// Fetch a 7-day forecast for the given coordinates (Open-Meteo).
#[tauri::command]
pub async fn fetch_week_weather(
    latitude: f64,
    longitude: f64,
) -> Result<WeekWeatherDto, String> {
    fetch_week_weather_at(latitude, longitude).await
}

/// Resolve Windows location, then fetch the nearest 7-day forecast.
#[tauri::command]
pub async fn fetch_local_week_weather() -> Result<WeekWeatherDto, String> {
    let location = tauri::async_runtime::spawn_blocking(fetch_windows_location_blocking)
        .await
        .map_err(|e| format!("위치 조회 작업이 중단되었습니다: {e}"))??;

    fetch_week_weather_at(location.latitude, location.longitude).await
}

async fn fetch_week_weather_at(latitude: f64, longitude: f64) -> Result<WeekWeatherDto, String> {
    let url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}&daily=weather_code&timezone=auto&forecast_days=7"
    );

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("날씨 API 요청에 실패했습니다: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "날씨 API가 오류를 반환했습니다 (HTTP {}).",
            response.status().as_u16()
        ));
    }

    let payload: OpenMeteoResponse = response
        .json()
        .await
        .map_err(|e| format!("날씨 응답을 파싱하지 못했습니다: {e}"))?;

    if payload.daily.time.len() != payload.daily.weather_code.len() {
        return Err("날씨 응답 형식이 올바르지 않습니다.".into());
    }

    let days = payload
        .daily
        .time
        .into_iter()
        .zip(payload.daily.weather_code)
        .map(|(date, weather_code)| {
            let (condition, label) = map_weather_code(weather_code);
            DayWeatherDto {
                date,
                weather_code,
                condition: condition.to_string(),
                label: label.to_string(),
            }
        })
        .collect();

    Ok(WeekWeatherDto {
        latitude,
        longitude,
        days,
    })
}

fn map_weather_code(code: i32) -> (&'static str, &'static str) {
    match code {
        0 => ("clear", "맑음"),
        1 | 2 => ("partly_cloudy", "약간 흐림"),
        3 => ("cloudy", "흐림"),
        45 | 48 => ("fog", "안개"),
        51 | 53 | 55 | 56 | 57 | 61 | 63 | 65 | 66 | 67 | 80 | 81 | 82 => ("rain", "비"),
        71 | 73 | 75 | 77 | 85 | 86 => ("snow", "눈"),
        95 | 96 | 99 => ("thunder", "뇌우"),
        _ => ("cloudy", "흐림"),
    }
}
