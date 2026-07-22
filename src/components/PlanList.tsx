import { useEffect, useState } from "react";
import { deleteTask, listTasks, updateTaskState, type Task } from "../bridge/db";

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

export function PlanList({ interactive = true, refreshKey = 0 }: PlanListProps) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

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

      {load.status === "ready" && load.tasks.length === 0 ? (
        <p className="page__status">등록된 계획이 없습니다.</p>
      ) : null}

      {load.status === "ready" && load.tasks.length > 0 ? (
        <ul className="task-list">
          {load.tasks.map((task) => (
            <li key={task.id} className="task-list__item">
              <div className="task-list__body">
                <div className="task-list__header">
                  <h3 className="task-list__title">{task.title}</h3>
                  {interactive ? (
                    <select
                      className="task-list__state"
                      value={task.state}
                      aria-label={`${task.title} 상태`}
                      disabled={updatingId !== null}
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
                  <time className="task-list__created" dateTime={task.createdAt}>
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
                  onClick={() => handleDelete(task.id)}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
