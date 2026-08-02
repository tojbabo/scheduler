import { useEffect, useRef, useState, type PointerEvent } from "react";
import { appLog } from "../bridge/log";
import {
  deleteTask,
  listTasks,
  reorderTask,
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

function sameParent(a: Task, b: Task): boolean {
  return a.parentId === b.parentId;
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

/** Previous sibling in the list with the same parent → `afterId` for reorder API. */
function afterIdAt(tasks: Task[], index: number): number | null {
  const task = tasks[index];
  if (task == null) return null;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (sameParent(tasks[i], task)) return tasks[i].id;
  }
  return null;
}

function indexFromPoint(clientX: number, clientY: number): number | null {
  const el = document.elementFromPoint(clientX, clientY);
  const row = el?.closest("[data-task-index]");
  if (!(row instanceof HTMLElement)) return null;
  const index = Number(row.dataset.taskIndex);
  return Number.isInteger(index) ? index : null;
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
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragFromIndexRef = useRef<number | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);
  const tasksRef = useRef<Task[]>([]);
  const suppressClickRef = useRef(false);

  if (load.status === "ready") {
    tasksRef.current = load.tasks;
  }

  const isDragging = draggingIndex != null;

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });

    listTasks()
      .then((tasks) => {
        if (!cancelled) {
          setLoad({ status: "ready", tasks });
          if (interactive) {
            appLog.info("Plan", "계획 목록을 불러왔습니다.", { count: tasks.length });
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "계획 목록을 불러오지 못했습니다.";
          setLoad({ status: "error", message });
          appLog.error("Plan", "계획 목록 조회 실패", err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, localRefreshKey, interactive]);

  useEffect(() => {
    if (!isDragging) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dragFromIndexRef.current = null;
        dragOverIndexRef.current = null;
        setDraggingIndex(null);
        setDragOverIndex(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDragging]);

  function loadTasks() {
    setLocalRefreshKey((key) => key + 1);
  }

  function handleDelete(id: number) {
    if (deletingId !== null) return;

    setDeleteError(null);
    setDeletingId(id);

    void deleteTask(id)
      .then(() => {
        appLog.info("Plan", "계획을 삭제했습니다.", { id });
        loadTasks();
      })
      .catch((err: unknown) => {
        console.error("[TaskDelete] failed", err);
        appLog.error("Plan", "계획 삭제 실패", err);
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
        appLog.info("Plan", "계획 상태를 변경했습니다.", {
          id: task.id,
          title: task.title,
          state: nextState,
        });
        loadTasks();
      })
      .catch((err: unknown) => {
        console.error("[TaskStateUpdate] failed", err);
        appLog.error("Plan", "계획 상태 변경 실패", err);
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
        appLog.info("Plan", "계획을 수정했습니다.", {
          id: existing.id,
          title: draft.title,
        });
        loadTasks();
      })
      .catch((err: unknown) => {
        console.error("[TaskUpdate] failed", err);
        appLog.error("Plan", "계획 수정 실패", err);
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
        appLog.info("Plan", "계획을 삭제했습니다.", { id });
        closeEditDialog();
        loadTasks();
      })
      .catch((err: unknown) => {
        console.error("[TaskDelete] failed", err);
        appLog.error("Plan", "계획 삭제 실패", err);
        const message =
          err instanceof Error ? err.message : "계획을 삭제하지 못했습니다.";
        setEditError(message);
      });
  }

  function clearDragState() {
    dragFromIndexRef.current = null;
    dragOverIndexRef.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
  }

  function commitReorder(fromIndex: number, toIndex: number) {
    const previousTasks = tasksRef.current;
    const moving = previousTasks[fromIndex];
    const target = previousTasks[toIndex];
    if (moving == null || target == null || !sameParent(moving, target)) return;
    if (reorderingId !== null) return;

    const nextTasks = reorderTasks(previousTasks, fromIndex, toIndex);
    const afterId = afterIdAt(nextTasks, toIndex);

    setReorderError(null);
    setReorderingId(moving.id);
    setLoad({ status: "ready", tasks: nextTasks });

    void reorderTask({ id: moving.id, afterId })
      .then((updated) => {
        appLog.info("Plan", "계획 순서를 변경했습니다.", {
          id: updated.id,
          title: updated.title,
          fromIndex,
          toIndex,
          afterId,
        });
        setLoad((current) => {
          if (current.status !== "ready") return current;
          return {
            status: "ready",
            tasks: current.tasks.map((task) =>
              task.id === updated.id ? updated : task,
            ),
          };
        });
      })
      .catch((err: unknown) => {
        console.error("[PlanReorder] failed", err);
        appLog.error("Plan", "계획 순서 변경 실패", err);
        const message =
          err instanceof Error ? err.message : "계획 순서를 변경하지 못했습니다.";
        setReorderError(message);
        setLoad({ status: "ready", tasks: previousTasks });
      })
      .finally(() => {
        setReorderingId(null);
      });
  }

  function handleGripPointerDown(
    index: number,
    event: PointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0 || reorderingId !== null) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragFromIndexRef.current = index;
    dragOverIndexRef.current = index;
    suppressClickRef.current = false;
    setDraggingIndex(index);
    setDragOverIndex(index);
  }

  function handleGripPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const fromIndex = dragFromIndexRef.current;
    if (fromIndex == null) return;

    const over = indexFromPoint(event.clientX, event.clientY);
    if (over == null) return;

    const tasks = tasksRef.current;
    const moving = tasks[fromIndex];
    const target = tasks[over];
    if (moving == null || target == null || !sameParent(moving, target)) return;

    if (dragOverIndexRef.current !== over) {
      dragOverIndexRef.current = over;
      setDragOverIndex(over);
      if (over !== fromIndex) suppressClickRef.current = true;
    }
  }

  function handleGripPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (dragFromIndexRef.current == null) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const fromIndex = dragFromIndexRef.current;
    const toIndex = dragOverIndexRef.current;
    clearDragState();

    if (fromIndex == null || toIndex == null || fromIndex === toIndex) return;
    commitReorder(fromIndex, toIndex);
  }

  function handleItemClick(task: Task) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    openEditDialog(task);
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

      {interactive && reorderError ? (
        <p className="page__status page__status--error" role="alert">
          {reorderError}
        </p>
      ) : null}

      {load.status === "ready" && load.tasks.length === 0 ? (
        <p className="page__status">등록된 계획이 없습니다.</p>
      ) : null}

      {load.status === "ready" && load.tasks.length > 0 ? (
        <ul
          className={
            isDragging ? "task-list task-list--reordering" : "task-list"
          }
        >
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
                data-task-index={index}
                onClick={
                  interactive ? () => handleItemClick(task) : undefined
                }
              >
                {interactive ? (
                  <button
                    type="button"
                    className="task-list__grip"
                    aria-label={`${task.title} 순서 변경`}
                    title="드래그하여 순서 변경"
                    disabled={reorderingId !== null}
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) =>
                      handleGripPointerDown(index, event)
                    }
                    onPointerMove={handleGripPointerMove}
                    onPointerUp={handleGripPointerUp}
                    onPointerCancel={handleGripPointerUp}
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
