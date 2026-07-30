import { invoke } from "@tauri-apps/api/core";

const KMA_SERVICE_KEY = "scheduler.settings.kmaServiceKey";
export const KMA_KEY_CHANGED = "scheduler:kma-key-changed";

export type WeatherCondition =
  | "clear"
  | "partly_cloudy"
  | "cloudy"
  | "fog"
  | "rain"
  | "snow"
  | "thunder";

export type DayWeather = {
  date: string;
  weatherCode: number;
  condition: WeatherCondition | string;
  label: string;
};

export type WeekWeather = {
  latitude: number;
  longitude: number;
  placeLabel: string | null;
  days: DayWeather[];
  weatherWarning: string | null;
};

export function readKmaServiceKey(): string {
  try {
    return localStorage.getItem(KMA_SERVICE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeKmaServiceKey(key: string): void {
  try {
    localStorage.setItem(KMA_SERVICE_KEY, key.trim());
  } catch {
    // Ignore storage failures.
  }
  window.dispatchEvent(new CustomEvent(KMA_KEY_CHANGED));
}

export async function fetchWeekWeather(
  latitude: number,
  longitude: number,
): Promise<WeekWeather> {
  return invoke<WeekWeather>("fetch_week_weather", {
    latitude,
    longitude,
    serviceKey: readKmaServiceKey() || null,
  });
}

export async function fetchLocalWeekWeather(): Promise<WeekWeather> {
  return invoke<WeekWeather>("fetch_local_week_weather", {
    serviceKey: readKmaServiceKey() || null,
  });
}
