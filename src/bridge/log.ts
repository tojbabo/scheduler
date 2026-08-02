/** In-memory ring buffer for app activity / error logs. */

export type LogLevel = "info" | "warn" | "error";

export type AppLogEntry = {
  id: number;
  at: string;
  level: LogLevel;
  source: string;
  message: string;
  detail?: string;
};

const MAX_ENTRIES = 300;
const LOG_CHANGED = "scheduler:app-log-changed";

let nextId = 1;
const entries: AppLogEntry[] = [];

function emit() {
  window.dispatchEvent(new Event(LOG_CHANGED));
}

function push(
  level: LogLevel,
  source: string,
  message: string,
  detail?: unknown,
): void {
  let detailText: string | undefined;
  if (detail != null) {
    if (detail instanceof Error) {
      detailText = detail.message;
    } else if (typeof detail === "string") {
      detailText = detail;
    } else {
      try {
        detailText = JSON.stringify(detail);
      } catch {
        detailText = String(detail);
      }
    }
  }

  entries.unshift({
    id: nextId++,
    at: new Date().toISOString(),
    level,
    source,
    message,
    detail: detailText,
  });

  if (entries.length > MAX_ENTRIES) {
    entries.length = MAX_ENTRIES;
  }

  if (level === "error") {
    console.error(`[${source}] ${message}`, detail ?? "");
  } else if (level === "warn") {
    console.warn(`[${source}] ${message}`, detail ?? "");
  }

  emit();
}

export const appLog = {
  info(source: string, message: string, detail?: unknown) {
    push("info", source, message, detail);
  },
  warn(source: string, message: string, detail?: unknown) {
    push("warn", source, message, detail);
  },
  error(source: string, message: string, detail?: unknown) {
    push("error", source, message, detail);
  },
  clear() {
    entries.length = 0;
    emit();
  },
  list(): AppLogEntry[] {
    return entries.slice();
  },
  subscribe(listener: () => void): () => void {
    window.addEventListener(LOG_CHANGED, listener);
    return () => window.removeEventListener(LOG_CHANGED, listener);
  },
};
