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

  function handleTaskSubmit(_draft: TaskCreateDraft) {
    // Persistence / id generation → agent-data
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
