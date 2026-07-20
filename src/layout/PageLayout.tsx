import { useState, type ReactNode } from "react";
import { createTaskFromUiDraft } from "../bridge/db";
import {
  TaskCreateDialog,
  type TaskCreateDraft,
} from "../components/TaskCreateDialog";

type PageLayoutProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Called after a task is successfully created (e.g. refresh home list). */
  onTaskCreated?: () => void;
};

/** Common page chrome: head (eyebrow / title / copy) + page-specific body. */
export function PageLayout({
  eyebrow,
  title,
  description,
  children,
  onTaskCreated,
}: PageLayoutProps) {
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function handleTaskSubmit(draft: TaskCreateDraft) {
    const fields = (
      ["title", "description", "createdAt", "parentId", "state"] as const
    ).map((key) => {
      const value = draft[key];
      const filled = value.trim().length > 0;
      return { field: key, value, filled };
    });

    console.group("[TaskCreate] submit draft");
    console.table(fields);
    for (const { field, value, filled } of fields) {
      console.log(
        `  ${field}: filled=${filled}`,
        filled ? value : "(empty)",
      );
    }
    console.groupEnd();

    setCreateError(null);

    void createTaskFromUiDraft(draft)
      .then((task) => {
        console.log("[TaskCreate] created", task);
        onTaskCreated?.();
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Task를 추가하지 못했습니다.";
        console.error("[TaskCreate] failed", err);
        setCreateError(message);
      });
  }

  return (
    <section className="page">
      <header className="page-head" data-tauri-drag-region>
        <div className="page-head__text">
          <p className="page-head__eyebrow">{eyebrow}</p>
          <h2 className="page-head__heading">{title}</h2>
          {description ? (
            <p className="page-head__copy">{description}</p>
          ) : null}
        </div>

        <div className="page-head__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setTaskDialogOpen(true)}
          >
            Task 추가
          </button>
        </div>
      </header>

      {createError ? (
        <p className="page__status page__status--error" role="alert">
          {createError}
        </p>
      ) : null}

      {children != null ? <div className="page__body">{children}</div> : null}

      <TaskCreateDialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        onSubmit={handleTaskSubmit}
      />
    </section>
  );
}
