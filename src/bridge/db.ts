import { invoke } from "@tauri-apps/api/core";

/** Diagnostics DTO from the Rust data layer. */
export type DbStatus = {
  backend: string;
  location: string;
  schemaApplied: boolean;
};

/** Check that the DB backend is up and schema was applied at startup. */
export function getDbStatus(): Promise<DbStatus> {
  return invoke<DbStatus>("db_status");
}
