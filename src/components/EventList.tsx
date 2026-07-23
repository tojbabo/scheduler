import { useEffect, useState } from "react";
import { listEvents, type Event } from "../bridge/db";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; events: Event[] };

function formatRange(startsAt: string | null, endsAt: string | null): string | null {
  if (!startsAt && !endsAt) return null;
  if (startsAt && endsAt) return `${startsAt} ~ ${endsAt}`;
  return startsAt ?? endsAt;
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
        const range = formatRange(event.startsAt, event.endsAt);

        return (
          <li key={event.id} className="event-list__item">
            <h4 className="event-list__title">{event.title}</h4>
            {range ? <p className="event-list__range">{range}</p> : null}
            {event.description ? (
              <p className="event-list__description">{event.description}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
