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

/** Persisted event row (`id` is DB-assigned). */
export type Event = {
  id: number;
  createdAt: string;
  updatedAt: string;
  startsAt: string | null;
  endsAt: string | null;
  title: string;
  description: string | null;
  categoryId: number | null;
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

/** Full update payload for a task. */
export type UpdateTaskInput = {
  id: number;
  title: string;
  description?: string | null;
  createdAt: string;
  parentId?: number | null;
  state: number;
};

/** Full update payload for an event (`createdAt` is not changed). */
export type UpdateEventInput = {
  id: number;
  title: string;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  categoryId?: number | null;
  updatedAt: string;
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

/** All tasks, ordered by id ascending. */
export function listTasks(): Promise<Task[]> {
  return invoke<Task[]>("list_tasks");
}

/** Insert a task; returns the row including generated `id`. */
export function createTask(input: CreateTaskInput): Promise<Task> {
  return invoke<Task>("create_task", { input });
}

/** Replace a task by id; returns the updated row. */
export function updateTask(input: UpdateTaskInput): Promise<Task> {
  return invoke<Task>("update_task", { input });
}

/** Delete a task by id (child tasks cascade). */
export function deleteTask(id: number): Promise<void> {
  return invoke<void>("delete_task", { id });
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

/** All events, ordered by starts_at (nulls last), then id. */
export function listEvents(): Promise<Event[]> {
  return invoke<Event[]>("list_events");
}

/** Replace an event by id; returns the updated row. */
export function updateEvent(input: UpdateEventInput): Promise<Event> {
  return invoke<Event>("update_event", { input });
}

/** Delete an event by id. */
export function deleteEvent(id: number): Promise<void> {
  return invoke<void>("delete_event", { id });
}
