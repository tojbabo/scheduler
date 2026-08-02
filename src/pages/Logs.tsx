import { PageLayout } from "../layout/PageLayout";
import { useAppLogs } from "../state/LogContext";
import type { AppLogEntry, LogLevel } from "../bridge/log";

const LEVEL_LABEL: Record<LogLevel, string> = {
  info: "정보",
  warn: "경고",
  error: "오류",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function LogRow({ entry }: { entry: AppLogEntry }) {
  return (
    <li className={`app-log__item app-log__item--${entry.level}`}>
      <div className="app-log__meta">
        <time className="app-log__time" dateTime={entry.at}>
          {formatTime(entry.at)}
        </time>
        <span className="app-log__level">{LEVEL_LABEL[entry.level]}</span>
        <span className="app-log__source">{entry.source}</span>
      </div>
      <p className="app-log__message">{entry.message}</p>
      {entry.detail ? <p className="app-log__detail">{entry.detail}</p> : null}
    </li>
  );
}

export function Logs() {
  const { entries, clear } = useAppLogs();

  return (
    <PageLayout eyebrow="Logs" title="로그">
      <div className="app-log">
        <div className="app-log__toolbar">
          <p className="app-log__count">
            {entries.length > 0
              ? `${entries.length}건`
              : "기록된 로그가 없습니다."}
          </p>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={entries.length === 0}
            onClick={clear}
          >
            비우기
          </button>
        </div>

        {entries.length > 0 ? (
          <ul className="app-log__list">
            {entries.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
          </ul>
        ) : null}
      </div>
    </PageLayout>
  );
}
