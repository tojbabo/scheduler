import { useEffect, useState, type ReactNode } from "react";
import { createEventFromUiDraft, createTaskFromUiDraft } from "../bridge/db";
import {
  EventCreateDialog,
  type EventCreateDraft,
} from "../components/EventCreateDialog";
import {
  TaskCreateDialog,
  type TaskCreateDraft,
} from "../components/TaskCreateDialog";

export type EventDateRequest = {
  date: string;
  nonce: number;
};

type PageLayoutProps = {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  /** Create button label. When omitted, the button and dialog are hidden. */
  createLabel?: string;
  /** Which create dialog to open. Defaults to "plan". */
  createKind?: "plan" | "event";
  /** Called after a task is successfully created (e.g. refresh home list). */
  onTaskCreated?: () => void;
  /** Called after an event is successfully created (e.g. refresh calendar). */
  onEventCreated?: () => void;
  /**
   * When `nonce` changes, open the event dialog with `date` as initial
   * starts/ends (`YYYY-MM-DD`). Header 「일정 추가」 opens without a date.
   */
  eventDateRequest?: EventDateRequest | null;
  /** Clear the parent request after the dialog consumes / closes it. */
  onEventDateRequestConsumed?: () => void;
};

/** Common page chrome: head (eyebrow / title / copy) + page-specific body. */
export function PageLayout({
  eyebrow,
  title,
  children,
  createLabel,
  createKind = "plan",
  onTaskCreated,
  onEventCreated,
  eventDateRequest = null,
  onEventDateRequestConsumed,
}: PageLayoutProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [eventInitialDate, setEventInitialDate] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const today = new Date();
  const todayLabel = today.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const todayIso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const showCreate = createLabel != null && createLabel.length > 0;
  const requestNonce = eventDateRequest?.nonce;
  const requestDate = eventDateRequest?.date;

  useEffect(() => {
    if (requestNonce == null || requestDate == null) return;
    setEventInitialDate(requestDate);
    setCreateDialogOpen(true);
  }, [requestNonce, requestDate]);

  function openCreateDialog() {
    setEventInitialDate(null);
    setCreateDialogOpen(true);
  }

  function closeCreateDialog() {
    setCreateDialogOpen(false);
    setEventInitialDate(null);
    onEventDateRequestConsumed?.();
  }

  function handleTaskSubmit(draft: TaskCreateDraft) {
    const fields = (
      ["title", "createdAt", "parentId"] as const
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
          err instanceof Error ? err.message : "계획을 추가하지 못했습니다.";
        console.error("[TaskCreate] failed", err);
        setCreateError(message);
      });
  }

  function handleEventSubmit(draft: EventCreateDraft) {
    const fields = (
      ["startsAt", "endsAt", "title", "categoryId"] as const
    ).map((key) => {
      const value = draft[key];
      const filled = value.trim().length > 0;
      return { field: key, value, filled };
    });

    console.group("[EventCreate] submit draft");
    console.table(fields);
    for (const { field, value, filled } of fields) {
      console.log(
        `  ${field}: filled=${filled}`,
        filled ? value : "(empty)",
      );
    }
    console.groupEnd();

    setCreateError(null);

    void createEventFromUiDraft(draft)
      .then((event) => {
        console.log("[EventCreate] created", event);
        onEventCreated?.();
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "일정을 추가하지 못했습니다.";
        console.error("[EventCreate] failed", err);
        setCreateError(message);
      });
  }

  return (
    <section className="page">
      <header className="page-head" data-tauri-drag-region>
        <div className="page-head__text">
          <p className="page-head__eyebrow">{eyebrow}</p>
          <h2 className="page-head__heading">{title}</h2>
        </div>

        <div className="page-head__actions">
          <time className="page-head__date" dateTime={todayIso}>
            {todayLabel}
          </time>
          {showCreate ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={openCreateDialog}
            >
              {createLabel}
            </button>
          ) : null}
        </div>
      </header>

      {createError ? (
        <p className="page__status page__status--error" role="alert">
          {createError}
        </p>
      ) : null}

      {children != null ? <div className="page__body">{children}</div> : null}

      {showCreate && createKind === "plan" ? (
        <TaskCreateDialog
          open={createDialogOpen}
          title={createLabel}
          onClose={closeCreateDialog}
          onSubmit={handleTaskSubmit}
        />
      ) : null}

      {showCreate && createKind === "event" ? (
        <EventCreateDialog
          open={createDialogOpen}
          title={createLabel}
          initialStartsAt={eventInitialDate ?? undefined}
          initialEndsAt={eventInitialDate ?? undefined}
          onClose={closeCreateDialog}
          onSubmit={handleEventSubmit}
        />
      ) : null}
    </section>
  );
}
