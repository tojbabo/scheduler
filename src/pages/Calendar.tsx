import { useState } from "react";
import { PageLayout } from "../layout/PageLayout";

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

export function Calendar() {
  const today = new Date();
  const [cursor, setCursor] = useState(() =>
    startOfMonth(today.getFullYear(), today.getMonth()),
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = buildMonthCells(year, month);

  function goPrevMonth() {
    setCursor(startOfMonth(year, month - 1));
  }

  function goNextMonth() {
    setCursor(startOfMonth(year, month + 1));
  }

  return (
    <PageLayout
      eyebrow="Calendar"
      title="캘린더"
      description="달력 형태로 일정을 보는 화면입니다."
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
          {WEEKDAYS.map((label) => (
            <div key={label} className="calendar__weekday" role="columnheader">
              {label}
            </div>
          ))}

          {cells.map((cell) => {
            const key = [
              cell.date.getFullYear(),
              cell.date.getMonth() + 1,
              cell.date.getDate(),
            ].join("-");
            const isToday = isSameDay(cell.date, today);
            const cellClass = [
              "calendar__cell",
              cell.inMonth ? "" : "calendar__cell--muted",
              isToday ? "calendar__cell--today" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={key}
                className={cellClass}
                role="gridcell"
                aria-current={isToday ? "date" : undefined}
              >
                <span
                  className={
                    isToday ? "calendar__day calendar__day--today" : "calendar__day"
                  }
                >
                  {cell.date.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </PageLayout>
  );
}
