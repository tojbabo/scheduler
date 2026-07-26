import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { createEventFromUiDraft, createTaskFromUiDraft } from "../bridge/db";
import { EventList } from "../components/EventList";
import {
  EventCreateDialog,
  type EventCreateDraft,
} from "../components/EventCreateDialog";
import { PlanList } from "../components/PlanList";
import {
  TaskCreateDialog,
  type TaskCreateDraft,
} from "../components/TaskCreateDialog";
import { PageLayout } from "../layout/PageLayout";

type MenuId = "home" | "plan" | "calendar" | "settings";

type HomeProps = {
  onNavigate: (id: MenuId) => void;
};

export function Home({ onNavigate }: HomeProps) {
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const [eventRefreshKey, setEventRefreshKey] = useState(0);
  const [createError, setCreateError] = useState<string | null>(null);

  function panelKeyDown(id: MenuId) {
    return (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onNavigate(id);
      }
    };
  }

  function openTaskDialog(e: MouseEvent) {
    e.stopPropagation();
    setCreateError(null);
    setTaskDialogOpen(true);
  }

  function openEventDialog(e: MouseEvent) {
    e.stopPropagation();
    setCreateError(null);
    setEventDialogOpen(true);
  }

  function handleTaskSubmit(draft: TaskCreateDraft) {
    setCreateError(null);
    void createTaskFromUiDraft(draft)
      .then(() => {
        setPlanRefreshKey((key) => key + 1);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "계획을 추가하지 못했습니다.";
        setCreateError(message);
      });
  }

  function handleEventSubmit(draft: EventCreateDraft) {
    setCreateError(null);
    void createEventFromUiDraft(draft)
      .then(() => {
        setEventRefreshKey((key) => key + 1);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "일정을 추가하지 못했습니다.";
        setCreateError(message);
      });
  }

  return (
    <PageLayout eyebrow="Home" title="오늘의 일정">
      {createError ? (
        <p className="page__status page__status--error" role="alert">
          {createError}
        </p>
      ) : null}

      <div className="home-split">
        <section
          className="home-panel home-panel--clickable"
          aria-labelledby="home-plans-heading"
          role="button"
          tabIndex={0}
          onClick={() => onNavigate("plan")}
          onKeyDown={panelKeyDown("plan")}
        >
          <div className="home-panel__header">
            <h3 id="home-plans-heading" className="home-panel__title">
              계획
            </h3>
            <button
              type="button"
              className="home-panel__add"
              aria-label="계획 추가"
              onClick={openTaskDialog}
            >
              +
            </button>
          </div>
          <PlanList interactive={false} refreshKey={planRefreshKey} />
        </section>

        <section
          className="home-panel home-panel--clickable"
          aria-labelledby="home-upcoming-heading"
          role="button"
          tabIndex={0}
          onClick={() => onNavigate("calendar")}
          onKeyDown={panelKeyDown("calendar")}
        >
          <div className="home-panel__header">
            <h3 id="home-upcoming-heading" className="home-panel__title">
              다가올 일정
            </h3>
            <button
              type="button"
              className="home-panel__add"
              aria-label="일정 추가"
              onClick={openEventDialog}
            >
              +
            </button>
          </div>
          <EventList refreshKey={eventRefreshKey} />
        </section>
      </div>

      <TaskCreateDialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        onSubmit={handleTaskSubmit}
      />
      <EventCreateDialog
        open={eventDialogOpen}
        onClose={() => setEventDialogOpen(false)}
        onSubmit={handleEventSubmit}
      />
    </PageLayout>
  );
}
