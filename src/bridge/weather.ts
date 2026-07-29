import { invoke } from "@tauri-apps/api/core";

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
  days: DayWeather[];
};

export async function fetchWeekWeather(
  latitude: number,
  longitude: number,
): Promise<WeekWeather> {
  return invoke<WeekWeather>("fetch_week_weather", { latitude, longitude });
}

export async function fetchLocalWeekWeather(): Promise<WeekWeather> {
  return invoke<WeekWeather>("fetch_local_week_weather");
}
