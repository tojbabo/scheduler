import { useEffect, useState } from "react";
import { deleteTask, listTasks, type Task } from "../bridge/db";
import { PageLayout } from "../layout/PageLayout";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; tasks: Task[] };

export function Home() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
            err instanceof Error ? err.message : "Task 목록을 불러오지 못했습니다.";
          setLoad({ status: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function loadTasks() {
    setRefreshKey((key) => key + 1);
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
          err instanceof Error ? err.message : "Task를 삭제하지 못했습니다.";
        setDeleteError(message);
      })
      .finally(() => {
        setDeletingId(null);
      });
  }

  return (
    <PageLayout
      eyebrow="Home"
      title="오늘의 일정"
      description="좌측 메뉴에 마우스를 올리면 펼쳐지고, 벗어나면 다시 접힙니다."
      onTaskCreated={loadTasks}
    >
      {load.status === "loading" ? (
        <p className="page__status">불러오는 중…</p>
      ) : null}

      {load.status === "error" ? (
        <p className="page__status page__status--error" role="alert">
          {load.message}
        </p>
      ) : null}

      {deleteError ? (
        <p className="page__status page__status--error" role="alert">
          {deleteError}
        </p>
      ) : null}

      {load.status === "ready" && load.tasks.length === 0 ? (
        <p className="page__status">등록된 Task가 없습니다.</p>
      ) : null}

      {load.status === "ready" && load.tasks.length > 0 ? (
        <ul className="task-list">
          {load.tasks.map((task) => (
            <li key={task.id} className="task-list__item">
              <dl className="task-fields">
                <div className="task-fields__row">
                  <dt>id</dt>
                  <dd>{task.id}</dd>
                </div>
                <div className="task-fields__row">
                  <dt>title</dt>
                  <dd>{task.title}</dd>
                </div>
                <div className="task-fields__row">
                  <dt>description</dt>
                  <dd>{task.description ?? "null"}</dd>
                </div>
                <div className="task-fields__row">
                  <dt>createdAt</dt>
                  <dd>{task.createdAt}</dd>
                </div>
                <div className="task-fields__row">
                  <dt>parentId</dt>
                  <dd>{task.parentId ?? "null"}</dd>
                </div>
                <div className="task-fields__row">
                  <dt>state</dt>
                  <dd>{task.state}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="task-list__delete"
                aria-label="삭제"
                disabled={deletingId !== null}
                onClick={() => handleDelete(task.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </PageLayout>
  );
}
