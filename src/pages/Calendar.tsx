import { useEffect, useState } from "react";
import { listEvents, type Event } from "../bridge/db";
import { PageLayout, type EventDateRequest } from "../layout/PageLayout";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

type CalendarCell = {
  date: Date;
  inMonth: boolean;
};

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function buildMonthCells(year: number, month: number): CalendarCell[] {
  const first = startOfMonth(year, month);
  const startOffset = first.getDay(); // 0 = 일요일 (일~토)
  const gridStart = new Date(year, month, 1 - startOffset);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i,
    );
    cells.push({
      date,
      inMonth: date.getMonth() === month,
    });
  }
  return cells;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function monthTitle(year: number, month: number): string {
  return `${year}년 ${month + 1}월`;
}

function toDateInputValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Extract `YYYY-MM-DD` for date-only comparison. */
function toDateKey(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match?.[1] ?? null;
}

/** Inclusive range when both ends exist; single-day if only one; skip if neither. */
function eventOccursOnDay(event: Event, dayKey: string): boolean {
  const start = event.startsAt ? toDateKey(event.startsAt) : null;
  const end = event.endsAt ? toDateKey(event.endsAt) : null;
  if (start == null && end == null) return false;
  if (start != null && end != null) return dayKey >= start && dayKey <= end;
  return dayKey === (start ?? end);
}

function eventsForDay(events: Event[], dayKey: string): Event[] {
  return events.filter((event) => eventOccursOnDay(event, dayKey));
}

export function Calendar() {
  const today = new Date();
  const [cursor, setCursor] = useState(() =>
    startOfMonth(today.getFullYear(), today.getMonth()),
  );
  const [eventDateRequest, setEventDateRequest] =
    useState<EventDateRequest | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsVersion, setEventsVersion] = useState(0);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = buildMonthCells(year, month);

  useEffect(() => {
    let cancelled = false;

    listEvents()
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("[Calendar] listEvents failed", err);
          setEvents([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventsVersion]);

  function goPrevMonth() {
    setCursor(startOfMonth(year, month - 1));
  }

  function goNextMonth() {
    setCursor(startOfMonth(year, month + 1));
  }

  function requestEventForDate(date: Date) {
    setEventDateRequest({
      date: toDateInputValue(date),
      nonce: Date.now(),
    });
  }

  function refreshEvents() {
    setEventsVersion((v) => v + 1);
  }

  return (
    <PageLayout
      eyebrow="Calendar"
      title="캘린더"
      createLabel="일정 추가"
      createKind="event"
      eventDateRequest={eventDateRequest}
      onEventDateRequestConsumed={() => setEventDateRequest(null)}
      onEventCreated={refreshEvents}
    >
      <div className="calendar">
        <div className="calendar__toolbar">
          <h3 className="calendar__title">{monthTitle(year, month)}</h3>
          <div className="calendar__nav">
            <button
              type="button"
              className="btn btn--ghost calendar__nav-btn"
              onClick={goPrevMonth}
              aria-label="이전 달"
            >
              ◀
            </button>
            <button
              type="button"
              className="btn btn--ghost calendar__nav-btn"
              onClick={goNextMonth}
              aria-label="다음 달"
            >
              ▶
            </button>
          </div>
        </div>

        <div
          className="calendar__grid"
          role="grid"
          aria-label={`${monthTitle(year, month)} 달력`}
        >
          {WEEKDAYS.map((label, index) => {
            const weekendClass =
              index === 0
                ? "calendar__weekday--sun"
                : index === 6
                  ? "calendar__weekday--sat"
                  : "";
            return (
              <div
                key={label}
                className={["calendar__weekday", weekendClass]
                  .filter(Boolean)
                  .join(" ")}
                role="columnheader"
              >
                {label}
              </div>
            );
          })}

          {cells.map((cell) => {
            const iso = toDateInputValue(cell.date);
            const isToday = isSameDay(cell.date, today);
            const weekday = cell.date.getDay();
            const isWeekend = weekday === 0 || weekday === 6;
            const dayEvents = eventsForDay(events, iso);
            const cellClass = [
              "calendar__cell",
              cell.inMonth ? "" : "calendar__cell--muted",
              isToday ? "calendar__cell--today" : "",
              isWeekend ? "calendar__cell--weekend" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                key={iso}
                type="button"
                className={cellClass}
                role="gridcell"
                aria-current={isToday ? "date" : undefined}
                aria-label={
                  dayEvents.length > 0
                    ? `${iso} 일정 추가, ${dayEvents.map((e) => e.title).join(", ")}`
                    : `${iso} 일정 추가`
                }
                onClick={() => requestEventForDate(cell.date)}
              >
                <span
                  className={
                    isToday ? "calendar__day calendar__day--today" : "calendar__day"
                  }
                >
                  {cell.date.getDate()}
                </span>
                {dayEvents.length > 0 ? (
                  <ul className="calendar__events">
                    {dayEvents.map((event) => (
                      <li key={event.id} className="calendar__event-title">
                        {event.title}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </PageLayout>
  );
}
