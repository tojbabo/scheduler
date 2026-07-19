-- Scheduler schema
-- Applied at app startup (CREATE IF NOT EXISTS / idempotent where possible).
-- Timestamps: ISO 8601 TEXT, e.g. 2026-07-19T17:16:00 (local or UTC — app decides).
-- tasks.id: INTEGER AUTOINCREMENT; display as zero-padded (00001) in the app layer.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

-- Categories (optional FK from tasks). Grow here later (color, sort_order, …).
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
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

CREATE INDEX IF NOT EXISTS idx_tasks_starts_at ON tasks (starts_at);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks (category_id);


INSERT INTO schema_meta (key, value) VALUES ('version', '2')
ON CONFLICT (key) DO UPDATE SET value = excluded.value;
