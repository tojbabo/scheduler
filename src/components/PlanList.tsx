import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  deleteTask,
  listTasks,
  updateTaskFromUiDraft,
  updateTaskState,
  type Task,
} from "../bridge/db";
import {
  TaskCreateDialog,
  type TaskCreateDraft,
  type TaskCreateInitial,
} from "./TaskCreateDialog";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; tasks: Task[] };

const TASK_STATE_LABELS: Record<number, string> = {
  0: "시작 전",
  1: "진행 중",
  2: "중단",
  3: "완료",
};

const TASK_STATE_VALUES = [0, 1, 2, 3] as const;

type PlanListProps = {
  /** When false, shows title / state label / short description only. */
  interactive?: boolean;
  /** Bump from parent to reload (e.g. after create). */
  refreshKey?: number;
};

function taskToInitial(task: Task): TaskCreateInitial {
  return {
    title: task.title,
    description: task.description ?? "",
    createdAt: task.createdAt.slice(0, 16),
    parentId: task.parentId != null ? String(task.parentId) : "",
  };
}

function reorderTasks(tasks: Task[], fromIndex: number, toIndex: number): Task[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= tasks.length ||
    toIndex >= tasks.length
  ) {
    return tasks;
  }
  const next = [...tasks];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function DragHandle() {
  return (
    <span className="task-list__grip-dots" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

export function PlanList({ interactive = true, refreshKey = 0 }: PlanListProps) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editInitial, setEditInitial] = useState<TaskCreateInitial | null>(
    null,
  );
  const [editError, setEditError] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragFromIndexRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });

    listTasks()
      .then((tasks) => {
        if (!cancelled) setLoad({ status: "ready", tasks });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "계획 목록을 불러오지 못했습니다.";
          setLoad({ status: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, localRefreshKey]);

  function loadTasks() {
    setLocalRefreshKey((key) => key + 1);
  }

  function handleDelete(id: number) {
    if (deletingId !== null) return;

    setDeleteError(null);
    setDeletingId(id);

    void deleteTask(id)
      .then(() => {
        loadTasks();
      })
      .catch((err: unknown) => {
        console.error("[TaskDelete] failed", err);
        const message =
          err instanceof Error ? err.message : "계획을 삭제하지 못했습니다.";
        setDeleteError(message);
      })
      .finally(() => {
        setDeletingId(null);
      });
  }

  function handleStateChange(task: Task, nextState: number) {
    if (nextState === task.state) return;
    if (updatingId !== null) return;

    setStateError(null);
    setUpdatingId(task.id);

    void updateTaskState(task, nextState)
      .then(() => {
        loadTasks();
      })
      .catch((err: unknown) => {
        console.error("[TaskStateUpdate] failed", err);
        const message =
          err instanceof Error ? err.message : "계획 상태를 변경하지 못했습니다.";
        setStateError(message);
        loadTasks();
      })
      .finally(() => {
        setUpdatingId(null);
      });
  }

  function openEditDialog(task: Task) {
    setEditError(null);
    setEditingTask(task);
    setEditInitial(taskToInitial(task));
  }

  function closeEditDialog() {
    setEditingTask(null);
    setEditInitial(null);
  }

  function handleEditSubmit(draft: TaskCreateDraft) {
    if (editingTask == null) return;
    const existing = editingTask;
    setEditError(null);

    void updateTaskFromUiDraft(existing, draft)
      .then(() => {
        loadTasks();
      })
      .catch((err: unknown) => {
        console.error("[TaskUpdate] failed", err);
        const message =
          err instanceof Error ? err.message : "계획을 수정하지 못했습니다.";
        setEditError(message);
      });
  }

  function handleEditDelete() {
    if (editingTask == null) return;
    const id = editingTask.id;
    setEditError(null);

    void deleteTask(id)
      .then(() => {
        closeEditDialog();
        loadTasks();
      })
      .catch((err: unknown) => {
        console.error("[TaskDelete] failed", err);
        const message =
          err instanceof Error ? err.message : "계획을 삭제하지 못했습니다.";
        setEditError(message);
      });
  }

  function clearDragState() {
    dragFromIndexRef.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
  }

  function handleDragStart(index: number, event: DragEvent) {
    dragFromIndexRef.current = index;
    setDraggingIndex(index);
    setDragOverIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(index: number, event: DragEvent) {
    if (dragFromIndexRef.current == null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) setDragOverIndex(index);
  }

  function handleDrop(toIndex: number, event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    const fromIndex = dragFromIndexRef.current;
    clearDragState();

    if (fromIndex == null || fromIndex === toIndex) return;
    if (load.status !== "ready") return;

    const moved = load.tasks[fromIndex];
    if (moved == null) return;

    console.log("[PlanReorder]", {
      fromIndex,
      toIndex,
      id: moved.id,
      title: moved.title,
    });

    setLoad({
      status: "ready",
      tasks: reorderTasks(load.tasks, fromIndex, toIndex),
    });
  }

  function handleDragEnd() {
    clearDragState();
  }

  return (
    <>
      {load.status === "loading" ? (
        <p className="page__status">불러오는 중…</p>
      ) : null}

      {load.status === "error" ? (
        <p className="page__status page__status--error" role="alert">
          {load.message}
        </p>
      ) : null}

      {interactive && deleteError ? (
        <p className="page__status page__status--error" role="alert">
          {deleteError}
        </p>
      ) : null}

      {interactive && stateError ? (
        <p className="page__status page__status--error" role="alert">
          {stateError}
        </p>
      ) : null}

      {interactive && editError ? (
        <p className="page__status page__status--error" role="alert">
          {editError}
        </p>
      ) : null}

      {load.status === "ready" && load.tasks.length === 0 ? (
        <p className="page__status">등록된 계획이 없습니다.</p>
      ) : null}

      {load.status === "ready" && load.tasks.length > 0 ? (
        <ul className="task-list">
          {load.tasks.map((task, index) => {
            const itemClass = [
              "task-list__item",
              interactive ? "task-list__item--interactive" : "",
              draggingIndex === index ? "task-list__item--dragging" : "",
              dragOverIndex === index && draggingIndex !== index
                ? "task-list__item--drag-over"
                : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li
                key={task.id}
                className={itemClass}
                onClick={interactive ? () => openEditDialog(task) : undefined}
                onDragOver={
                  interactive ? (event) => handleDragOver(index, event) : undefined
                }
                onDrop={
                  interactive ? (event) => handleDrop(index, event) : undefined
                }
              >
                {interactive ? (
                  <button
                    type="button"
                    className="task-list__grip"
                    aria-label={`${task.title} 순서 변경`}
                    title="드래그하여 순서 변경"
                    draggable
                    onClick={(event) => event.stopPropagation()}
                    onDragStart={(event) => {
                      event.stopPropagation();
                      const row = event.currentTarget.closest("li");
                      if (row instanceof HTMLElement) {
                        event.dataTransfer.setDragImage(row, 24, 24);
                      }
                      handleDragStart(index, event);
                    }}
                    onDragEnd={handleDragEnd}
                  >
                    <DragHandle />
                  </button>
                ) : null}
                <div className="task-list__body">
                  <div className="task-list__header">
                    <h3 className="task-list__title">{task.title}</h3>
                    {interactive ? (
                      <select
                        className="task-list__state"
                        value={task.state}
                        aria-label={`${task.title} 상태`}
                        disabled={updatingId !== null}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          handleStateChange(task, Number(event.target.value))
                        }
                      >
                        {TASK_STATE_VALUES.map((value) => (
                          <option key={value} value={value}>
                            {TASK_STATE_LABELS[value]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="task-list__state-label">
                        {TASK_STATE_LABELS[task.state] ?? "알 수 없음"}
                      </span>
                    )}
                  </div>
                  {task.description ? (
                    <p className="task-list__description">{task.description}</p>
                  ) : null}
                  {interactive ? (
                    <time
                      className="task-list__created"
                      dateTime={task.createdAt}
                    >
                      {task.createdAt}
                    </time>
                  ) : null}
                </div>
                {interactive ? (
                  <button
                    type="button"
                    className="task-list__delete"
                    aria-label="삭제"
                    disabled={deletingId !== null || updatingId !== null}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(task.id);
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {interactive ? (
        <TaskCreateDialog
          open={editingTask != null}
          mode="edit"
          initialTask={editInitial ?? undefined}
          onClose={closeEditDialog}
          onSubmit={handleEditSubmit}
          onDelete={handleEditDelete}
        />
      ) : null}
    </>
  );
}
