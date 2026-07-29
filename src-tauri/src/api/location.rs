use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationDto {
    pub latitude: f64,
    pub longitude: f64,
    pub accuracy_meters: f64,
}

#[tauri::command]
pub async fn fetch_windows_location() -> Result<LocationDto, String> {
    tauri::async_runtime::spawn_blocking(fetch_windows_location_blocking)
        .await
        .map_err(|e| format!("위치 조회 작업이 중단되었습니다: {e}"))?
}

#[cfg(windows)]
pub(crate) fn fetch_windows_location_blocking() -> Result<LocationDto, String> {
    use windows::Devices::Geolocation::{GeolocationAccessStatus, Geolocator};

    let access = Geolocator::RequestAccessAsync()
        .map_err(|e| format!("위치 권한 요청에 실패했습니다: {e}"))?
        .get()
        .map_err(|e| format!("위치 권한 요청에 실패했습니다: {e}"))?;

    match access {
        GeolocationAccessStatus::Allowed => {}
        GeolocationAccessStatus::Denied => {
            return Err(
                "Windows 위치 권한이 거부되었습니다. 설정 > 개인 정보 > 위치에서 허용해 주세요."
                    .into(),
            );
        }
        GeolocationAccessStatus::Unspecified => {
            return Err("Windows 위치 권한 상태를 확인할 수 없습니다.".into());
        }
        _ => {
            return Err("Windows 위치 권한을 얻을 수 없습니다.".into());
        }
    }

    let locator =
        Geolocator::new().map_err(|e| format!("위치 서비스를 시작하지 못했습니다: {e}"))?;
    let position = locator
        .GetGeopositionAsync()
        .map_err(|e| format!("위치를 가져오지 못했습니다: {e}"))?
        .get()
        .map_err(|e| format!("위치를 가져오지 못했습니다: {e}"))?;

    let coordinate = position
        .Coordinate()
        .map_err(|e| format!("좌표를 읽지 못했습니다: {e}"))?;
    let point = coordinate
        .Point()
        .map_err(|e| format!("좌표를 읽지 못했습니다: {e}"))?;
    let basic = point
        .Position()
        .map_err(|e| format!("좌표를 읽지 못했습니다: {e}"))?;
    let accuracy = coordinate
        .Accuracy()
        .map_err(|e| format!("정확도를 읽지 못했습니다: {e}"))?;

    Ok(LocationDto {
        latitude: basic.Latitude,
        longitude: basic.Longitude,
        accuracy_meters: accuracy,
    })
}

#[cfg(not(windows))]
pub(crate) fn fetch_windows_location_blocking() -> Result<LocationDto, String> {
    Err("Windows에서만 위치를 가져올 수 있습니다.".into())
}
