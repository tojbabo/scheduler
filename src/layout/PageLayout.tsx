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
import { useWeekWeather } from "../state/WeatherContext";

export type EventDateRequest = {
  /** Inclusive range start (`YYYY-MM-DD`). */
  startDate: string;
  /** Inclusive range end (`YYYY-MM-DD`). Same as startDate for a single day. */
  endDate: string;
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
   * When `nonce` changes, open the event dialog with `startDate` /
   * `endDate` as initial starts/ends (`YYYY-MM-DD`). Header 「일정 추가」
   * opens without a date.
   */
  eventDateRequest?: EventDateRequest | null;
  /** Clear the parent request after the dialog consumes / closes it. */
  onEventDateRequestConsumed?: () => void;
};

/** Common page chrome: head (eyebrow / title / copy) + page-specific body. */
const WEEKDAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

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
  const [eventInitialStartsAt, setEventInitialStartsAt] = useState<
    string | null
  >(null);
  const [eventInitialEndsAt, setEventInitialEndsAt] = useState<string | null>(
    null,
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const { days: weekDays, placeLabel, warning: weatherWarning } = useWeekWeather();
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
  const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    return { offset, abbr: WEEKDAY_ABBR[day.getDay()] };
  });

  const showCreate = createLabel != null && createLabel.length > 0;
  const requestNonce = eventDateRequest?.nonce;
  const requestStartDate = eventDateRequest?.startDate;
  const requestEndDate = eventDateRequest?.endDate;

  useEffect(() => {
    if (
      requestNonce == null ||
      requestStartDate == null ||
      requestEndDate == null
    ) {
      return;
    }
    setEventInitialStartsAt(requestStartDate);
    setEventInitialEndsAt(requestEndDate);
    setCreateDialogOpen(true);
  }, [requestNonce, requestStartDate, requestEndDate]);

  function openCreateDialog() {
    setEventInitialStartsAt(null);
    setEventInitialEndsAt(null);
    setCreateDialogOpen(true);
  }

  function closeCreateDialog() {
    setCreateDialogOpen(false);
    setEventInitialStartsAt(null);
    setEventInitialEndsAt(null);
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
          <div className="page-head__meta">
            <time className="page-head__date" dateTime={todayIso}>
              {todayLabel}
            </time>
            <ul className="page-head__weather" aria-label="이번 주 날씨">
              {WEEKDAY_LABELS.map((label, i) => {
                const dayWeather = weekDays?.[i];
                const condition = dayWeather?.condition ?? "clear";
                const weatherLabel = dayWeather?.label ?? "맑음";
                return (
                  <li
                    key={label.offset}
                    className={`page-head__weather-day${i === 0 ? " page-head__weather-day--today" : ""}`}
                    title={`${label.abbr} · ${weatherLabel}`}
                  >
                    <WeatherIcon condition={condition} />
                    <span className="page-head__weather-abbr">{label.abbr}</span>
                  </li>
                );
              })}
            </ul>
            {placeLabel ? (
              <p className="page-head__place">{placeLabel}</p>
            ) : null}
            {weatherWarning ? (
              <p className="page-head__weather-warning" title={weatherWarning}>
                기상청 연동 확인 필요
              </p>
            ) : null}
          </div>
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
          initialStartsAt={eventInitialStartsAt ?? undefined}
          initialEndsAt={eventInitialEndsAt ?? undefined}
          onClose={closeCreateDialog}
          onSubmit={handleEventSubmit}
        />
      ) : null}
    </section>
  );
}

function WeatherIcon({ condition }: { condition: string }) {
  switch (condition) {
    case "partly_cloudy":
      return <PartlyCloudyIcon />;
    case "cloudy":
      return <CloudIcon />;
    case "fog":
      return <FogIcon />;
    case "rain":
      return <RainIcon />;
    case "snow":
      return <SnowIcon />;
    case "thunder":
      return <ThunderIcon />;
    case "clear":
    default:
      return <SunIcon />;
  }
}

function weatherSvgProps() {
  return {
    className: "page-head__weather-icon",
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
}

function SunIcon() {
  return (
    <svg {...weatherSvgProps()}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6" />
    </svg>
  );
}

function PartlyCloudyIcon() {
  return (
    <svg {...weatherSvgProps()}>
      <circle cx="9" cy="9" r="2.6" />
      <path d="M9 3.2v1.6M9 13.2v1.6M3.2 9h1.6M13.2 9h1.6M4.6 4.6l1.1 1.1M12.3 12.3l1.1 1.1M4.6 13.4l1.1-1.1M12.3 5.7l1.1-1.1" />
      <path d="M8.5 16.2h7.2a3.1 3.1 0 0 0 .3-6.2 4 4 0 0 0-7.5 1.2 2.6 2.6 0 0 0 0 5" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg {...weatherSvgProps()}>
      <path d="M7.2 17.5h9.5a3.6 3.6 0 0 0 .4-7.2 4.8 4.8 0 0 0-9.2 1.5A3.1 3.1 0 0 0 7.2 17.5z" />
    </svg>
  );
}

function FogIcon() {
  return (
    <svg {...weatherSvgProps()}>
      <path d="M4 9.5h16M6 12.5h12M5 15.5h14M7 18.5h10" />
    </svg>
  );
}

function RainIcon() {
  return (
    <svg {...weatherSvgProps()}>
      <path d="M7.2 13.2h9.5a3.6 3.6 0 0 0 .4-7.2 4.8 4.8 0 0 0-9.2 1.5A3.1 3.1 0 0 0 7.2 13.2z" />
      <path d="M9 15.8v3.2M12 16.5v3.2M15 15.8v3.2" />
    </svg>
  );
}

function SnowIcon() {
  return (
    <svg {...weatherSvgProps()}>
      <path d="M7.2 12.8h9.5a3.6 3.6 0 0 0 .4-7.2 4.8 4.8 0 0 0-9.2 1.5A3.1 3.1 0 0 0 7.2 12.8z" />
      <path d="M9 15.2l.8.8M9 16.8l.8-.8M12 15l1 1M12 17l1-1M15 15.2l.8.8M15 16.8l.8-.8" />
    </svg>
  );
}

function ThunderIcon() {
  return (
    <svg {...weatherSvgProps()}>
      <path d="M7.2 12.5h9.5a3.6 3.6 0 0 0 .4-7.2 4.8 4.8 0 0 0-9.2 1.5A3.1 3.1 0 0 0 7.2 12.5z" />
      <path d="M12.2 13.2l-2.2 3.6h2.4L10.8 21" />
    </svg>
  );
}
