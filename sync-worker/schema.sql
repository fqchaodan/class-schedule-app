-- 番茄课表 D1 schema（单一共享数据集）
-- 应用方式：wrangler d1 execute class-schedule-db --remote --file=./sync-worker/schema.sql
--           （本地：--local）
-- 说明：notes / weekdays / 回收站课程快照以 TEXT 存 JSON；2 人规模无需拆表。

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id           TEXT PRIMARY KEY,
  schedule_id  TEXT,
  student_name TEXT NOT NULL,
  name         TEXT,
  start_date   TEXT NOT NULL,
  end_date     TEXT NOT NULL,
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  fee          REAL,
  meeting_url  TEXT,
  completed    INTEGER NOT NULL DEFAULT 0,
  paid         INTEGER NOT NULL DEFAULT 0,
  notes        TEXT NOT NULL DEFAULT '[]',
  template_id  TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_courses_schedule ON courses (schedule_id);

CREATE TABLE IF NOT EXISTS templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT,
  student_name TEXT,
  course_name TEXT,
  meeting_url TEXT,
  weekdays    TEXT NOT NULL DEFAULT '[]',
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  fee         REAL,
  weeks       INTEGER NOT NULL DEFAULT 1,
  start_date  TEXT,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recycle_items (
  id         TEXT PRIMARY KEY,   -- 原课程 id
  course     TEXT NOT NULL,      -- 课程快照 JSON
  deleted_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  data       TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT 0
);

-- 初始化版本元信息与单行设置
INSERT INTO meta (key, value) VALUES ('version', '0') ON CONFLICT(key) DO NOTHING;
INSERT INTO meta (key, value) VALUES ('updated_at', '0') ON CONFLICT(key) DO NOTHING;
INSERT INTO settings (id, data, updated_at) VALUES (1, '{}', 0) ON CONFLICT(id) DO NOTHING;
