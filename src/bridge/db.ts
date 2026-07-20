import { invoke } from "@tauri-apps/api/core";

/** Diagnostics DTO from the Rust data layer. */
export type DbStatus = {
  backend: string;
  location: string;
  schemaApplied: boolean;
};

/** Persisted task row (`id` is DB-assigned). */
export type Task = {
  id: number;
  title: string;
  description: string | null;
  createdAt: string;
  parentId: number | null;
  state: number;
};

/**
 * Input for creating a task. `id` is omitted (AUTOINCREMENT).
 * - `description` empty/omitted → NULL
 * - `parentId` omitted/null → root task
 * - `state` omitted/null → 3 (예정)
 */
export type CreateTaskInput = {
  title: string;
  description?: string | null;
  createdAt: string;
  parentId?: number | null;
  state?: number | null;
};

/** UI draft shape from TaskCreateDialog (all strings). */
export type TaskUiDraft = {
  title: string;
  description: string;
  createdAt: string;
  parentId: string;
  state: string;
};

/** Check that the DB backend is up and schema was applied at startup. */
export function getDbStatus(): Promise<DbStatus> {
  return invoke<DbStatus>("db_status");
}

/** Insert a task; returns the row including generated `id`. */
export function createTask(input: CreateTaskInput): Promise<Task> {
  return invoke<Task>("create_task", { input });
}

/**
 * Map UI string draft → create payload and persist.
 * Empty parentId/state become null (Rust defaults state to 3).
 */
export function createTaskFromUiDraft(draft: TaskUiDraft): Promise<Task> {
  const parentRaw = draft.parentId.trim();
  const stateRaw = draft.state.trim();

  let parentId: number | null = null;
  if (parentRaw.length > 0) {
    const n = Number(parentRaw);
    if (!Number.isInteger(n) || n <= 0) {
      return Promise.reject(new Error("parentId must be a positive integer"));
    }
    parentId = n;
  }

  let state: number | null = null;
  if (stateRaw.length > 0) {
    const n = Number(stateRaw);
    if (!Number.isInteger(n)) {
      return Promise.reject(new Error("state must be an integer"));
    }
    state = n;
  }

  const description = draft.description.trim();

  return createTask({
    title: draft.title.trim(),
    description: description.length > 0 ? description : null,
    createdAt: draft.createdAt.trim(),
    parentId,
    state,
  });
}
