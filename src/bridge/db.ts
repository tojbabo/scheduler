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
 * - `state` omitted/null → Rust `TASK_STATE_DEFAULT` (omit 케이스용)
 * - UI create 경로(`createTaskFromUiDraft`)는 항상 `state: 0` (시작 전)을 전송
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

/**
 * UI draft shape from TaskCreateDialog (all strings).
 * `state` is optional and ignored — create always persists state 0.
 */
export type TaskUiDraft = {
  title: string;
  description: string;
  createdAt: string;
  parentId: string;
  /** @deprecated Ignored; create always uses state 0. */
  state?: string;
};

/** Category option from Rust `Category` enum. */
export type Category = {
  id: number;
  name: string;
};

/** All app-defined categories (id + Korean label). Call once when opening a select. */
export function listCategories(): Promise<Category[]> {
  return invoke<Category[]>("list_categories");
}

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

/**
 * Partial update: change only `state`, reusing the rest of the existing task.
 * Valid range matches schema CHECK (0–3): 시작 전 / 진행 중 / 중단 / 완료.
 */
export function updateTaskState(task: Task, state: number): Promise<Task> {
  if (!Number.isInteger(state) || state < 0 || state > 3) {
    return Promise.reject(new Error("state must be an integer between 0 and 3"));
  }

  return updateTask({
    id: task.id,
    title: task.title,
    description: task.description,
    createdAt: task.createdAt,
    parentId: task.parentId,
    state,
  });
}

/** Delete a task by id (child tasks cascade). */
export function deleteTask(id: number): Promise<void> {
  return invoke<void>("delete_task", { id });
}

/**
 * Map UI string draft → create payload and persist.
 * Empty parentId → null (root). New tasks always get `state: 0` (시작 전).
 */
export function createTaskFromUiDraft(draft: TaskUiDraft): Promise<Task> {
  const parentRaw = draft.parentId.trim();

  let parentId: number | null = null;
  if (parentRaw.length > 0) {
    const n = Number(parentRaw);
    if (!Number.isInteger(n) || n <= 0) {
      return Promise.reject(new Error("parentId must be a positive integer"));
    }
    parentId = n;
  }

  const description = draft.description.trim();

  return createTask({
    title: draft.title.trim(),
    description: description.length > 0 ? description : null,
    createdAt: draft.createdAt.trim(),
    parentId,
    state: 0,
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
