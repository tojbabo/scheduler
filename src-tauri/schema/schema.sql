-- Scheduler schema
-- Applied at app startup (CREATE IF NOT EXISTS / idempotent where possible).
-- Timestamps: ISO 8601 TEXT, e.g. 2026-07-19T17:16:00
-- Integer PKs: display as zero-padded (00001) in the app layer.
--
-- events = timed occurrences (약속·일정)
-- tasks  = open-ended work items (할 일), tree via parent_id
--
-- task.state (INTEGER):
--   0 = 중단
--   1 = 완료
--   2 = 실행 중
--   3 = 예정
--   4 = (예비)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Timed schedule items (was previously named tasks).
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    starts_at TEXT,
    ends_at TEXT,
    title TEXT NOT NULL,
    description TEXT,
    category_id INTEGER,
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events (starts_at);
CREATE INDEX IF NOT EXISTS idx_events_category_id ON events (category_id);

-- Open-ended todos (tree structure via parent_id).
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    parent_id INTEGER,
    state INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (parent_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CHECK (state IN (0, 1, 2, 3, 4))
);

CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks (parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks (state);

INSERT INTO schema_meta (key, value) VALUES ('version', '3')
ON CONFLICT (key) DO UPDATE SET value = excluded.value;
