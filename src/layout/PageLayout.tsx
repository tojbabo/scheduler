import { useState, type ReactNode } from "react";
import {
  TaskCreateDialog,
  type TaskCreateDraft,
} from "../components/TaskCreateDialog";

type PageLayoutProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
};

/** Common page chrome: head (eyebrow / title / copy) + page-specific body. */
export function PageLayout({
  eyebrow,
  title,
  description,
  children,
}: PageLayoutProps) {
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  function handleTaskSubmit(draft: TaskCreateDraft) {
    // Persistence / id generation → agent-data
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
  }

  return (
    <section className="page">
      <header className="page-head">
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

      {children != null ? <div className="page__body">{children}</div> : null}

      <TaskCreateDialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        onSubmit={handleTaskSubmit}
      />
    </section>
  );
}
