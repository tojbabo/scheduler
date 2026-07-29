import { invoke } from "@tauri-apps/api/core";

const LOCATION_ALLOWED_KEY = "scheduler.settings.locationAllowed";
export const LOCATION_ALLOWED_CHANGED = "scheduler:location-allowed-changed";

export type WindowsLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

export function readLocationAllowed(): boolean {
  try {
    return localStorage.getItem(LOCATION_ALLOWED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeLocationAllowed(allowed: boolean): void {
  try {
    localStorage.setItem(LOCATION_ALLOWED_KEY, allowed ? "1" : "0");
  } catch {
    // Ignore quota / private-mode failures; in-memory toggle still works.
  }
  window.dispatchEvent(
    new CustomEvent(LOCATION_ALLOWED_CHANGED, { detail: { allowed } }),
  );
}

export async function fetchWindowsLocation(): Promise<WindowsLocation> {
  return invoke<WindowsLocation>("fetch_windows_location");
}
