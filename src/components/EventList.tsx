import { useEffect, useState } from "react";
import { listEvents, type Event } from "../bridge/db";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; events: Event[] };

function dateKey(value: string | null): string | null {
  if (!value) return null;
  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 일 단위 차이: toKey − fromKey */
function dayDiff(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T00:00:00`);
  const to = new Date(`${toKey}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function formatDayMeta(startsAt: string | null, endsAt: string | null): string | null {
  const startKey = dateKey(startsAt);
  const endKey = dateKey(endsAt);
  const anchorKey = startKey ?? endKey;
  if (!anchorKey) return null;

  const n = dayDiff(todayKey(), anchorKey);
  const dLabel = n < 0 ? `D${n}` : `D+${n}`;

  if (startKey && endKey && startKey !== endKey) {
    return `${dLabel} ~ ${dayDiff(startKey, endKey)}`;
  }

  return dLabel;
}

export function EventList() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });

    listEvents()
      .then((events) => {
        if (!cancelled) setLoad({ status: "ready", events });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "일정 목록을 불러오지 못했습니다.";
          setLoad({ status: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (load.status === "loading") {
    return <p className="page__status">불러오는 중…</p>;
  }

  if (load.status === "error") {
    return (
      <p className="page__status page__status--error" role="alert">
        {load.message}
      </p>
    );
  }

  if (load.events.length === 0) {
    return <p className="page__status">다가올 일정이 없습니다.</p>;
  }

  return (
    <ul className="event-list">
      {load.events.map((event) => {
        const dayMeta = formatDayMeta(event.startsAt, event.endsAt);

        return (
          <li key={event.id} className="event-list__item">
            <div className="event-list__heading">
              <h4 className="event-list__title">{event.title}</h4>
              {dayMeta ? <span className="event-list__meta">{dayMeta}</span> : null}
            </div>
            {event.description ? (
              <p className="event-list__description">{event.description}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
