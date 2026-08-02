use std::collections::BTreeMap;
use std::f64::consts::PI;

use chrono::{Duration, Local, NaiveDate, Timelike};
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
    pub place_label: Option<String>,
    pub days: Vec<DayWeatherDto>,
    pub weather_warning: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NominatimResponse {
    address: Option<NominatimAddress>,
}

#[derive(Debug, Deserialize)]
struct NominatimAddress {
    city: Option<String>,
    town: Option<String>,
    village: Option<String>,
    municipality: Option<String>,
    county: Option<String>,
    state: Option<String>,
    borough: Option<String>,
    city_district: Option<String>,
    suburb: Option<String>,
    district: Option<String>,
}

#[derive(Debug, Deserialize)]
struct KmaEnvelope {
    response: KmaResponse,
}

#[derive(Debug, Deserialize)]
struct KmaResponse {
    header: KmaHeader,
    body: Option<KmaBody>,
}

#[derive(Debug, Deserialize)]
struct KmaHeader {
    #[serde(rename = "resultCode")]
    result_code: String,
    #[serde(rename = "resultMsg")]
    result_msg: String,
}

#[derive(Debug, Deserialize)]
struct KmaBody {
    items: Option<KmaItems>,
}

#[derive(Debug, Deserialize)]
struct KmaItems {
    item: serde_json::Value,
}

#[derive(Debug, Deserialize, Clone)]
struct VilageItem {
    category: String,
    #[serde(rename = "fcstDate")]
    fcst_date: String,
    #[serde(rename = "fcstTime")]
    fcst_time: String,
    #[serde(rename = "fcstValue")]
    fcst_value: String,
}

#[derive(Debug, Deserialize, Clone)]
struct MidLandItem {
    #[serde(rename = "wf3Am")]
    wf3_am: Option<String>,
    #[serde(rename = "wf3Pm")]
    wf3_pm: Option<String>,
    #[serde(rename = "wf4Am")]
    wf4_am: Option<String>,
    #[serde(rename = "wf4Pm")]
    wf4_pm: Option<String>,
    #[serde(rename = "wf5Am")]
    wf5_am: Option<String>,
    #[serde(rename = "wf5Pm")]
    wf5_pm: Option<String>,
    #[serde(rename = "wf6Am")]
    wf6_am: Option<String>,
    #[serde(rename = "wf6Pm")]
    wf6_pm: Option<String>,
    #[serde(rename = "wf7Am")]
    wf7_am: Option<String>,
    #[serde(rename = "wf7Pm")]
    wf7_pm: Option<String>,
    wf8: Option<String>,
    wf9: Option<String>,
    wf10: Option<String>,
}

/// Fetch a 7-day forecast for the given coordinates (기상청).
#[tauri::command]
pub async fn fetch_week_weather(
    latitude: f64,
    longitude: f64,
    service_key: Option<String>,
) -> Result<WeekWeatherDto, String> {
    let key = resolve_service_key(service_key).ok();
    fetch_week_weather_at(latitude, longitude, key.as_deref()).await
}

/// Resolve Windows location, then fetch the nearest 7-day forecast (기상청).
#[tauri::command]
pub async fn fetch_local_week_weather(
    service_key: Option<String>,
) -> Result<WeekWeatherDto, String> {
    let location = tauri::async_runtime::spawn_blocking(fetch_windows_location_blocking)
        .await
        .map_err(|e| format!("위치 조회 작업이 중단되었습니다: {e}"))??;

    let key = resolve_service_key(service_key).ok();
    fetch_week_weather_at(location.latitude, location.longitude, key.as_deref()).await
}

fn resolve_service_key(service_key: Option<String>) -> Result<String, String> {
    if let Some(key) = service_key.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
        return Ok(key);
    }
    std::env::var("KMA_SERVICE_KEY")
        .map(|s| s.trim().to_string())
        .map_err(|_| {
            "기상청 API 키가 필요합니다. 설정에 공공데이터포털 인증키를 입력하거나 KMA_SERVICE_KEY 환경변수를 설정하세요."
                .into()
        })
        .and_then(|s| {
            if s.is_empty() {
                Err("기상청 API 키가 비어 있습니다.".into())
            } else {
                Ok(s)
            }
        })
}

async fn fetch_week_weather_at(
    latitude: f64,
    longitude: f64,
    service_key: Option<&str>,
) -> Result<WeekWeatherDto, String> {
    let client = reqwest::Client::builder()
        .user_agent("Scheduler/0.1 (desktop; kma-weather)")
        .build()
        .map_err(|e| format!("HTTP 클라이언트를 만들지 못했습니다: {e}"))?;

    // 지역명은 날씨 API와 무관하게 좌표로 먼저 구한다.
    let place_label = reverse_geocode_place(&client, latitude, longitude)
        .await
        .ok()
        .flatten();
    let (nx, ny) = lat_lon_to_grid(latitude, longitude);
    let reg_id = mid_land_reg_id(place_label.as_deref());

    let (short_days, mid_days, weather_warning) = if let Some(key) = service_key {
        let short_result = fetch_vilage_daily(&client, key, nx, ny).await;
        let mid_result = fetch_mid_land_daily(&client, key, &reg_id).await;
        let short = short_result.as_ref().ok().cloned().unwrap_or_default();
        let mid = mid_result.as_ref().ok().cloned().unwrap_or_default();
        if let Err(err) = &short_result {
            eprintln!("[Weather] vilage failed: {err}");
        }
        if let Err(err) = &mid_result {
            eprintln!("[Weather] mid-land failed: {err}");
        }
        let warning = if short.is_empty() && mid.is_empty() {
            let detail = short_result
                .err()
                .or_else(|| mid_result.err())
                .unwrap_or_else(|| "데이터가 비어 있습니다.".into());
            Some(format!(
                "기상청 날씨를 가져오지 못했습니다. API 키·활용승인을 확인하세요. ({detail})"
            ))
        } else {
            None
        };
        (short, mid, warning)
    } else {
        (
            BTreeMap::new(),
            BTreeMap::new(),
            Some("기상청 API 키가 없어 날씨 아이콘은 기본값입니다.".into()),
        )
    };

    let today = Local::now().date_naive();
    let mut days = Vec::with_capacity(7);
    for offset in 0..7 {
        let date = today + Duration::days(offset);
        let iso = date.format("%Y-%m-%d").to_string();
        let kma_date = date.format("%Y%m%d").to_string();

        let day = short_days
            .get(&kma_date)
            .cloned()
            .or_else(|| mid_days.get(&kma_date).cloned())
            .unwrap_or_else(|| DayWeatherDto {
                date: iso.clone(),
                weather_code: 3,
                condition: "cloudy".into(),
                label: "흐림".into(),
            });

        days.push(DayWeatherDto {
            date: iso,
            weather_code: day.weather_code,
            condition: day.condition,
            label: day.label,
        });
    }

    Ok(WeekWeatherDto {
        latitude,
        longitude,
        place_label,
        days,
        weather_warning,
    })
}

async fn fetch_vilage_daily(
    client: &reqwest::Client,
    service_key: &str,
    nx: i32,
    ny: i32,
) -> Result<BTreeMap<String, DayWeatherDto>, String> {
    let (base_date, base_time) = latest_vilage_base();
    let nx_s = nx.to_string();
    let ny_s = ny.to_string();
    let envelope = fetch_kma_envelope_with_key_fallback(
        client,
        "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst",
        service_key,
        &[
            ("pageNo", "1"),
            ("numOfRows", "1000"),
            ("dataType", "JSON"),
            ("base_date", base_date.as_str()),
            ("base_time", base_time.as_str()),
            ("nx", nx_s.as_str()),
            ("ny", ny_s.as_str()),
        ],
        "단기예보",
    )
    .await?;

    let items = envelope
        .response
        .body
        .and_then(|b| b.items)
        .map(|items| parse_value_list::<VilageItem>(items.item))
        .unwrap_or_default();

    let mut sky_by_date: BTreeMap<String, i32> = BTreeMap::new();
    let mut pty_by_date: BTreeMap<String, i32> = BTreeMap::new();
    let mut noon_sky: BTreeMap<String, i32> = BTreeMap::new();

    for item in items {
        match item.category.as_str() {
            "SKY" => {
                if let Ok(v) = item.fcst_value.parse::<i32>() {
                    let cur = sky_by_date.entry(item.fcst_date.clone()).or_insert(1);
                    *cur = (*cur).max(v);
                    if item.fcst_time == "1500" || item.fcst_time == "1200" {
                        noon_sky.insert(item.fcst_date.clone(), v);
                    }
                }
            }
            "PTY" => {
                if let Ok(v) = item.fcst_value.parse::<i32>() {
                    let cur = pty_by_date.entry(item.fcst_date.clone()).or_insert(0);
                    *cur = (*cur).max(v);
                }
            }
            _ => {}
        }
    }

    let mut out = BTreeMap::new();
    for (date, sky) in sky_by_date {
        let sky = noon_sky.get(&date).copied().unwrap_or(sky);
        let pty = pty_by_date.get(&date).copied().unwrap_or(0);
        let (condition, label, code) = map_sky_pty(sky, pty);
        let iso = kma_date_to_iso(&date).unwrap_or(date.clone());
        out.insert(
            date,
            DayWeatherDto {
                date: iso,
                weather_code: code,
                condition: condition.to_string(),
                label: label.to_string(),
            },
        );
    }
    Ok(out)
}

async fn fetch_mid_land_daily(
    client: &reqwest::Client,
    service_key: &str,
    reg_id: &str,
) -> Result<BTreeMap<String, DayWeatherDto>, String> {
    let (tm_fc, base_date) = latest_mid_tm_fc();
    let envelope = fetch_kma_envelope_with_key_fallback(
        client,
        "https://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst",
        service_key,
        &[
            ("pageNo", "1"),
            ("numOfRows", "10"),
            ("dataType", "JSON"),
            ("regId", reg_id),
            ("tmFc", tm_fc.as_str()),
        ],
        "중기육상예보",
    )
    .await?;

    let item_value = envelope
        .response
        .body
        .and_then(|b| b.items)
        .map(|items| match items.item {
            serde_json::Value::Array(mut arr) => {
                arr.pop().unwrap_or(serde_json::Value::Null)
            }
            other => other,
        })
        .filter(|v| !v.is_null())
        .ok_or_else(|| "중기육상예보 항목이 없습니다.".to_string())?;

    let item: MidLandItem = serde_json::from_value(item_value)
        .map_err(|e| format!("중기육상예보 항목을 파싱하지 못했습니다: {e}"))?;

    let pairs: [(i64, Option<String>, Option<String>); 5] = [
        (3, item.wf3_am, item.wf3_pm),
        (4, item.wf4_am, item.wf4_pm),
        (5, item.wf5_am, item.wf5_pm),
        (6, item.wf6_am, item.wf6_pm),
        (7, item.wf7_am, item.wf7_pm),
    ];

    let mut out = BTreeMap::new();
    for (day_offset, am, pm) in pairs {
        let text = pick_mid_text(am.as_deref(), pm.as_deref());
        if let Some(text) = text {
            let (condition, label, code) = map_mid_text(text);
            let date = base_date + Duration::days(day_offset);
            let kma_date = date.format("%Y%m%d").to_string();
            let iso = date.format("%Y-%m-%d").to_string();
            out.insert(
                kma_date,
                DayWeatherDto {
                    date: iso,
                    weather_code: code,
                    condition: condition.to_string(),
                    label: label.to_string(),
                },
            );
        }
    }

    for (day_offset, text) in [(8i64, item.wf8), (9, item.wf9), (10, item.wf10)] {
        if let Some(text) = text.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            let (condition, label, code) = map_mid_text(text);
            let date = base_date + Duration::days(day_offset);
            let kma_date = date.format("%Y%m%d").to_string();
            let iso = date.format("%Y-%m-%d").to_string();
            out.insert(
                kma_date,
                DayWeatherDto {
                    date: iso,
                    weather_code: code,
                    condition: condition.to_string(),
                    label: label.to_string(),
                },
            );
        }
    }

    Ok(out)
}

fn normalize_kma_service_key(service_key: &str) -> String {
    let trimmed = service_key.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    // Encoding 키(%..)로 저장된 경우 한 번 디코딩해 raw(Decoding) 키로 맞춘다.
    if trimmed.contains('%') {
        urlencoding::decode(trimmed)
            .map(|s| s.into_owned())
            .unwrap_or_else(|_| trimmed.to_string())
    } else {
        trimmed.to_string()
    }
}

fn build_kma_url(
    base: &str,
    service_key: &str,
    params: &[(&str, &str)],
) -> Result<reqwest::Url, String> {
    let decoded_key = normalize_kma_service_key(service_key);
    if decoded_key.is_empty() {
        return Err("기상청 API 키가 비어 있습니다.".into());
    }

    // query_pairs_mut가 serviceKey를 정확히 한 번만 percent-encode 한다.
    // (미리 Encoding된 키를 문자열에 붙인 뒤 Url::parse 하면 % → %25 이중 인코딩으로 401이 난다.)
    let mut url = reqwest::Url::parse(base)
        .map_err(|e| format!("기상청 API URL이 올바르지 않습니다: {e}"))?;
    {
        let mut query = url.query_pairs_mut();
        query.append_pair("serviceKey", &decoded_key);
        for (name, value) in params {
            query.append_pair(name, value);
        }
    }
    Ok(url)
}

async fn fetch_kma_envelope_with_key_fallback(
    client: &reqwest::Client,
    base: &str,
    service_key: &str,
    params: &[(&str, &str)],
    label: &str,
) -> Result<KmaEnvelope, String> {
    let url = build_kma_url(base, service_key, params)?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("기상청 {label} 요청에 실패했습니다: {e}"))?;

    let envelope = read_kma_envelope(response, label).await?;
    ensure_kma_ok(&envelope.response.header, label)?;
    Ok(envelope)
}

async fn read_kma_envelope(
    response: reqwest::Response,
    label: &str,
) -> Result<KmaEnvelope, String> {
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("기상청 {label} 본문을 읽지 못했습니다: {e}"))?;
    let trimmed = text.trim_start_matches('\u{feff}').trim_start();

    if !(trimmed.starts_with('{') || trimmed.starts_with('[')) {
        let preview: String = trimmed.chars().take(200).collect();
        return Err(format!(
            "기상청 {label}가 JSON이 아닌 응답을 반환했습니다 (HTTP {status}): {preview}"
        ));
    }

    serde_json::from_str(trimmed).map_err(|e| {
        let preview: String = trimmed.chars().take(200).collect();
        format!("기상청 {label} JSON 파싱 실패: {e} / {preview}")
    })
}

fn parse_value_list<T: for<'de> Deserialize<'de>>(value: serde_json::Value) -> Vec<T> {
    match value {
        serde_json::Value::Array(items) => items
            .into_iter()
            .filter_map(|item| serde_json::from_value::<T>(item).ok())
            .collect(),
        other => serde_json::from_value::<T>(other).into_iter().collect(),
    }
}

fn pick_mid_text<'a>(am: Option<&'a str>, pm: Option<&'a str>) -> Option<&'a str> {
    let am = am.map(str::trim).filter(|s| !s.is_empty());
    let pm = pm.map(str::trim).filter(|s| !s.is_empty());
    match (am, pm) {
        (Some(a), Some(p)) => {
            // Prefer wetter / more severe wording for the day icon.
            if severity_rank(p) >= severity_rank(a) {
                Some(p)
            } else {
                Some(a)
            }
        }
        (Some(a), None) => Some(a),
        (None, Some(p)) => Some(p),
        (None, None) => None,
    }
}

fn severity_rank(text: &str) -> i32 {
    if text.contains("뇌우") || text.contains("폭풍") {
        5
    } else if text.contains("눈") {
        4
    } else if text.contains("비") || text.contains("소나기") {
        3
    } else if text.contains("흐림") {
        2
    } else if text.contains("구름") {
        1
    } else {
        0
    }
}

fn map_mid_text(text: &str) -> (&'static str, &'static str, i32) {
    if text.contains("뇌우") {
        ("thunder", "뇌우", 95)
    } else if text.contains("눈") {
        ("snow", "눈", 71)
    } else if text.contains("비") || text.contains("소나기") {
        ("rain", "비", 61)
    } else if text.contains("흐림") {
        ("cloudy", "흐림", 3)
    } else if text.contains("구름") {
        ("partly_cloudy", "구름많음", 2)
    } else if text.contains("맑") {
        ("clear", "맑음", 0)
    } else {
        ("cloudy", "흐림", 3)
    }
}

fn map_sky_pty(sky: i32, pty: i32) -> (&'static str, &'static str, i32) {
    match pty {
        1 | 4 | 5 => ("rain", "비", 61),
        2 | 6 => ("rain", "비/눈", 61),
        3 | 7 => ("snow", "눈", 71),
        _ => match sky {
            1 => ("clear", "맑음", 0),
            3 => ("partly_cloudy", "구름많음", 2),
            4 => ("cloudy", "흐림", 3),
            _ => ("cloudy", "흐림", 3),
        },
    }
}

fn ensure_kma_ok(header: &KmaHeader, label: &str) -> Result<(), String> {
    if header.result_code == "00" || header.result_code == "0" {
        Ok(())
    } else {
        Err(format!(
            "기상청 {label} 오류: {} ({})",
            header.result_msg, header.result_code
        ))
    }
}

fn latest_vilage_base() -> (String, String) {
    // 단기예보 발표: 02,05,08,11,14,17,20,23시 (대략 +10분 이후 안정)
    let now = Local::now() - Duration::minutes(10);
    let hours = [2, 5, 8, 11, 14, 17, 20, 23];
    let mut date = now.date_naive();
    let hour = now.hour() as i32;

    let mut chosen = None;
    for h in hours.iter().copied().rev() {
        if hour >= h {
            chosen = Some(h);
            break;
        }
    }
    let base_hour = chosen.unwrap_or_else(|| {
        date -= Duration::days(1);
        23
    });

    (
        date.format("%Y%m%d").to_string(),
        format!("{base_hour:02}00"),
    )
}

fn latest_mid_tm_fc() -> (String, NaiveDate) {
    // 중기예보: 06시 / 18시 발표
    let now = Local::now() - Duration::minutes(10);
    let mut date = now.date_naive();
    let hour = now.hour();
    let (base_hour, base_date) = if hour >= 18 {
        (18, date)
    } else if hour >= 6 {
        (6, date)
    } else {
        date -= Duration::days(1);
        (18, date)
    };
    (
        format!("{}{:02}00", base_date.format("%Y%m%d"), base_hour),
        base_date,
    )
}

fn kma_date_to_iso(raw: &str) -> Option<String> {
    NaiveDate::parse_from_str(raw, "%Y%m%d")
        .ok()
        .map(|d| d.format("%Y-%m-%d").to_string())
}

fn mid_land_reg_id(place_label: Option<&str>) -> String {
    let text = place_label.unwrap_or("");
    if text.contains("제주") {
        "11G00000"
    } else if text.contains("강원") && (text.contains("속초") || text.contains("강릉") || text.contains("동해") || text.contains("삼척") || text.contains("양양")) {
        "11D20000"
    } else if text.contains("강원") {
        "11D10000"
    } else if text.contains("충북") || text.contains("충청북") {
        "11C10000"
    } else if text.contains("충남") || text.contains("충청남") || text.contains("대전") || text.contains("세종") {
        "11C20000"
    } else if text.contains("전북") || text.contains("전라북") || text.contains("전주") || text.contains("군산") {
        "11F10000"
    } else if text.contains("전남") || text.contains("전라남") || text.contains("광주") {
        "11F20000"
    } else if text.contains("경북") || text.contains("경상북") || text.contains("대구") {
        "11H10000"
    } else if text.contains("경남") || text.contains("경상남") || text.contains("부산") || text.contains("울산") {
        "11H20000"
    } else {
        // 서울·인천·경기 및 기본
        "11B00000"
    }
    .to_string()
}

/// 기상청 LCC DFS 좌표변환 (위경도 → 격자).
fn lat_lon_to_grid(lat: f64, lon: f64) -> (i32, i32) {
    const RE: f64 = 6371.00877;
    const GRID: f64 = 5.0;
    const SLAT1: f64 = 30.0;
    const SLAT2: f64 = 60.0;
    const OLON: f64 = 126.0;
    const OLAT: f64 = 38.0;
    const XO: f64 = 43.0;
    const YO: f64 = 136.0;

    let degrad = PI / 180.0;
    let re = RE / GRID;
    let slat1 = SLAT1 * degrad;
    let slat2 = SLAT2 * degrad;
    let olon = OLON * degrad;
    let olat = OLAT * degrad;

    let sn = (slat1.cos() / slat2.cos()).ln() / (((PI * 0.25) + 0.5 * slat2).tan().ln()
        - ((PI * 0.25) + 0.5 * slat1).tan().ln());
    let mut sf = slat1.sin();
    sf = slat1.cos().powf(sn) * ((PI * 0.25 + 0.5 * slat1).tan()).powf(-sn) / sf;
    let mut ro = (PI * 0.25 + 0.5 * olat).tan().powf(-sn);
    ro = re * sf * ro;

    let ra = (PI * 0.25 + 0.5 * lat * degrad).tan().powf(-sn);
    let ra = re * sf * ra;
    let mut theta = lon * degrad - olon;
    if theta > PI {
        theta -= 2.0 * PI;
    }
    if theta < -PI {
        theta += 2.0 * PI;
    }
    theta *= sn;

    let x = (ra * theta.sin() + XO + 0.5).floor() as i32;
    let y = (ro - ra * theta.cos() + YO + 0.5).floor() as i32;
    (x, y)
}

async fn reverse_geocode_place(
    client: &reqwest::Client,
    latitude: f64,
    longitude: f64,
) -> Result<Option<String>, String> {
    let url = format!(
        "https://nominatim.openstreetmap.org/reverse?lat={latitude}&lon={longitude}&format=json&addressdetails=1&zoom=14"
    );

    let response = client
        .get(&url)
        .header("Accept-Language", "ko")
        .send()
        .await
        .map_err(|e| format!("위치명 조회에 실패했습니다: {e}"))?;

    if !response.status().is_success() {
        return Ok(None);
    }

    let payload: NominatimResponse = response
        .json()
        .await
        .map_err(|e| format!("위치명 응답을 파싱하지 못했습니다: {e}"))?;

    Ok(payload.address.and_then(format_place_label))
}

fn format_place_label(address: NominatimAddress) -> Option<String> {
    let city = first_nonempty(&[
        address.city.as_deref(),
        address.town.as_deref(),
        address.municipality.as_deref(),
        address.village.as_deref(),
        address.state.as_deref(),
    ]);

    let district = first_nonempty(&[
        address.borough.as_deref(),
        address.city_district.as_deref(),
        address.suburb.as_deref(),
        address.district.as_deref(),
        address.county.as_deref(),
    ]);

    match (city, district) {
        (Some(city), Some(district)) if city != district => Some(format!("{city} {district}")),
        (Some(city), _) => Some(city.to_string()),
        (None, Some(district)) => Some(district.to_string()),
        (None, None) => None,
    }
}

fn first_nonempty<'a>(values: &[Option<&'a str>]) -> Option<&'a str> {
    values
        .iter()
        .find_map(|value| value.map(str::trim).filter(|s| !s.is_empty()))
}
