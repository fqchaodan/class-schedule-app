/**
 * D1 实现：把 Db 契约落到 Cloudflare D1（SQLite）关系表。
 * 复杂的 JSON 子结构（notes / weekdays / 回收站课程快照）以 TEXT 存 JSON，2 人规模无需拆表。
 */
import type { AppSettings, Course, CourseTemplate, Db, RecycleItem, Schedule, SnapshotInput, SnapshotResult, WriteResult } from './types'
import { DEFAULT_SETTINGS, ensureDefaultSchedule, normalizeCourse, normalizeSchedule, normalizeSettings, normalizeTemplate } from './types'

// ---- 最小 D1 类型（避免额外 @cloudflare/workers-types 依赖） ----
interface D1Result<T> { results: T[] }
export interface D1Stmt {
  bind: (...values: unknown[]) => D1Stmt
  all: <T = Record<string, unknown>>() => Promise<D1Result<T>>
  first: <T = Record<string, unknown>>() => Promise<T | null>
  run: () => Promise<unknown>
}
export interface D1Like {
  prepare: (sql: string) => D1Stmt
  batch: (statements: D1Stmt[]) => Promise<unknown[]>
  exec: (sql: string) => Promise<unknown>
}

const optStr = (v: string | undefined | null) => (v === undefined || v === null ? null : v)
const optNum = (v: number | undefined | null) => (v === undefined || v === null ? null : v)

function parseJson<T>(text: unknown, fallback: T): T {
  if (typeof text !== 'string' || text.length === 0)
    return fallback
  try {
    return JSON.parse(text) as T
  }
  catch {
    return fallback
  }
}

// ---------- 行 → 实体 ----------
function rowToCourse(r: Record<string, unknown>): Course {
  return {
    id: String(r.id),
    scheduleId: r.scheduleId == null ? undefined : String(r.scheduleId),
    studentName: String(r.studentName),
    name: r.name == null ? undefined : String(r.name),
    startDate: String(r.startDate),
    endDate: String(r.endDate),
    startTime: String(r.startTime),
    endTime: String(r.endTime),
    fee: r.fee == null ? undefined : Number(r.fee),
    meetingUrl: r.meetingUrl == null ? undefined : String(r.meetingUrl),
    completed: Number(r.completed) ? true : undefined,
    paid: Number(r.paid) ? true : undefined,
    notes: parseJson(r.notes, []),
    templateId: r.templateId == null ? undefined : String(r.templateId),
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  } as Course
}

function rowToTemplate(r: Record<string, unknown>): CourseTemplate {
  return {
    id: String(r.id),
    name: String(r.name),
    kind: r.kind == null ? undefined : (r.kind as CourseTemplate['kind']),
    studentName: r.studentName == null ? undefined : String(r.studentName),
    courseName: r.courseName == null ? undefined : String(r.courseName),
    meetingUrl: r.meetingUrl == null ? undefined : String(r.meetingUrl),
    weekdays: parseJson<number[]>(r.weekdays, []),
    startTime: String(r.startTime),
    endTime: String(r.endTime),
    fee: r.fee == null ? undefined : Number(r.fee),
    weeks: Number(r.weeks),
    startDate: r.startDate == null ? undefined : String(r.startDate),
    enabled: !!Number(r.enabled),
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  } as CourseTemplate
}

function rowToSchedule(r: Record<string, unknown>): Schedule {
  return {
    id: String(r.id),
    name: String(r.name),
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  }
}

const COURSE_COLS = `id, schedule_id AS scheduleId, student_name AS studentName, name, start_date AS startDate,
  end_date AS endDate, start_time AS startTime, end_time AS endTime, fee, meeting_url AS meetingUrl,
  completed, paid, notes, template_id AS templateId, created_at AS createdAt, updated_at AS updatedAt`
const TEMPLATE_COLS = `id, name, kind, student_name AS studentName, course_name AS courseName, meeting_url AS meetingUrl,
  weekdays, start_time AS startTime, end_time AS endTime, fee, weeks, start_date AS startDate, enabled,
  created_at AS createdAt, updated_at AS updatedAt`
const SCHEDULE_COLS = `id, name, created_at AS createdAt, updated_at AS updatedAt`

// ---------- 语句构造 ----------
function insertCourseStmt(db: D1Like, c: Course): D1Stmt {
  return db.prepare(
    `INSERT INTO courses (id, schedule_id, student_name, name, start_date, end_date, start_time, end_time,
      fee, meeting_url, completed, paid, notes, template_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET schedule_id=excluded.schedule_id, student_name=excluded.student_name,
      name=excluded.name, start_date=excluded.start_date, end_date=excluded.end_date, start_time=excluded.start_time,
      end_time=excluded.end_time, fee=excluded.fee, meeting_url=excluded.meeting_url, completed=excluded.completed,
      paid=excluded.paid, notes=excluded.notes, template_id=excluded.template_id, updated_at=excluded.updated_at`,
  ).bind(
    c.id,
    optStr(c.scheduleId),
    c.studentName,
    optStr(c.name),
    c.startDate,
    c.endDate,
    c.startTime,
    c.endTime,
    optNum(c.fee),
    optStr(c.meetingUrl),
    c.completed ? 1 : 0,
    c.paid ? 1 : 0,
    JSON.stringify(c.notes ?? []),
    optStr(c.templateId),
    c.createdAt,
    c.updatedAt,
  )
}

function insertTemplateStmt(db: D1Like, t: CourseTemplate): D1Stmt {
  return db.prepare(
    `INSERT INTO templates (id, name, kind, student_name, course_name, meeting_url, weekdays, start_time, end_time,
      fee, weeks, start_date, enabled, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, kind=excluded.kind, student_name=excluded.student_name,
      course_name=excluded.course_name, meeting_url=excluded.meeting_url, weekdays=excluded.weekdays,
      start_time=excluded.start_time, end_time=excluded.end_time, fee=excluded.fee, weeks=excluded.weeks,
      start_date=excluded.start_date, enabled=excluded.enabled, updated_at=excluded.updated_at`,
  ).bind(
    t.id,
    t.name,
    optStr(t.kind),
    optStr(t.studentName),
    optStr(t.courseName),
    optStr(t.meetingUrl),
    JSON.stringify(t.weekdays ?? []),
    t.startTime,
    t.endTime,
    optNum(t.fee),
    t.weeks,
    optStr(t.startDate),
    t.enabled ? 1 : 0,
    t.createdAt,
    t.updatedAt,
  )
}

function insertScheduleStmt(db: D1Like, s: Schedule): D1Stmt {
  return db.prepare(
    `INSERT INTO schedules (id, name, created_at, updated_at) VALUES (?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at`,
  ).bind(s.id, s.name, s.createdAt, s.updatedAt)
}

function insertRecycleStmt(db: D1Like, r: RecycleItem): D1Stmt {
  return db.prepare(
    `INSERT INTO recycle_items (id, course, deleted_at) VALUES (?,?,?)
     ON CONFLICT(id) DO UPDATE SET course=excluded.course, deleted_at=excluded.deleted_at`,
  ).bind(r.course.id, JSON.stringify(r.course), r.deletedAt)
}

function metaStmts(db: D1Like, now: number): D1Stmt[] {
  return [
    db.prepare(`INSERT INTO meta (key, value) VALUES ('version', '0') ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1`),
    db.prepare(`INSERT INTO meta (key, value) VALUES ('updated_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(String(now)),
  ]
}

export function d1Db(database: D1Like): Db {
  const db = database

  async function readMeta(): Promise<{ version: number, updatedAt: number }> {
    const rows = await db.prepare(`SELECT key, value FROM meta`).all<{ key: string, value: string }>()
    let version = 0
    let updatedAt = 0
    for (const row of rows.results) {
      if (row.key === 'version')
        version = Number(row.value) || 0
      if (row.key === 'updated_at')
        updatedAt = Number(row.value) || 0
    }
    return { version, updatedAt }
  }

  const impl: Db = {
    async getSnapshot(): Promise<SnapshotResult> {
      const [schedules, courses, templates, recycle, settings, meta] = await Promise.all([
        db.prepare(`SELECT ${SCHEDULE_COLS} FROM schedules`).all(),
        db.prepare(`SELECT ${COURSE_COLS} FROM courses`).all(),
        db.prepare(`SELECT ${TEMPLATE_COLS} FROM templates`).all(),
        db.prepare(`SELECT id, course, deleted_at AS deletedAt FROM recycle_items`).all(),
        db.prepare(`SELECT data FROM settings WHERE id = 1`).first<{ data: string }>(),
        readMeta(),
      ])
      return {
        schedules: schedules.results.map(rowToSchedule),
        courses: courses.results.map(rowToCourse),
        templates: templates.results.map(rowToTemplate),
        recycle: recycle.results.map(r => ({ course: parseJson<Course>(r.course, {} as Course), deletedAt: Number(r.deletedAt) })).filter(r => r.course && r.course.id),
        settings: settings ? normalizeSettings(parseJson(settings.data, {})) : { ...DEFAULT_SETTINGS },
        version: meta.version,
        updatedAt: meta.updatedAt,
      }
    },

    async replaceSnapshot(input: SnapshotInput): Promise<WriteResult> {
      const now = Date.now()
      const schedules = ensureDefaultSchedule((input.schedules ?? []).map(normalizeSchedule).filter((s): s is Schedule => !!s))
      const courses = (input.courses ?? []).map(normalizeCourse).filter((c): c is Course => !!c)
      const templates = (input.templates ?? []).map(normalizeTemplate).filter((t): t is CourseTemplate => !!t)
      const recycle = (input.recycle ?? []).filter((r): r is RecycleItem => !!r && !!normalizeCourse(r.course))
      const settings = normalizeSettings(input.settings)

      const stmts: D1Stmt[] = [
        db.prepare(`DELETE FROM courses`),
        db.prepare(`DELETE FROM templates`),
        db.prepare(`DELETE FROM schedules`),
        db.prepare(`DELETE FROM recycle_items`),
        ...schedules.map(s => insertScheduleStmt(db, s)),
        ...courses.map(c => insertCourseStmt(db, c)),
        ...templates.map(t => insertTemplateStmt(db, t)),
        ...recycle.map(r => insertRecycleStmt(db, r)),
        db.prepare(`INSERT INTO settings (id, data, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`).bind(JSON.stringify(settings), now),
        ...metaStmts(db, now),
      ]
      await db.batch(stmts)
      const meta = await readMeta()
      return meta
    },

    async listCourses() {
      const r = await db.prepare(`SELECT ${COURSE_COLS} FROM courses`).all()
      return r.results.map(rowToCourse)
    },
    async getCourse(id: string) {
      const r = await db.prepare(`SELECT ${COURSE_COLS} FROM courses WHERE id = ?`).bind(id).first()
      return r ? rowToCourse(r) : null
    },
    async upsertCourse(course: Course) {
      const now = Date.now()
      await db.batch([insertCourseStmt(db, course), ...metaStmts(db, now)])
    },
    async deleteCourse(id: string) {
      await db.batch([db.prepare(`DELETE FROM courses WHERE id = ?`).bind(id), ...metaStmts(db, Date.now())])
    },

    async listTemplates() {
      const r = await db.prepare(`SELECT ${TEMPLATE_COLS} FROM templates`).all()
      return r.results.map(rowToTemplate)
    },
    async upsertTemplate(template: CourseTemplate) {
      await db.batch([insertTemplateStmt(db, template), ...metaStmts(db, Date.now())])
    },
    async deleteTemplate(id: string) {
      await db.batch([db.prepare(`DELETE FROM templates WHERE id = ?`).bind(id), ...metaStmts(db, Date.now())])
    },

    async listSchedules() {
      const r = await db.prepare(`SELECT ${SCHEDULE_COLS} FROM schedules`).all()
      return r.results.map(rowToSchedule)
    },
    async upsertSchedule(schedule: Schedule) {
      await db.batch([insertScheduleStmt(db, schedule), ...metaStmts(db, Date.now())])
    },
    async deleteSchedule(id: string) {
      await db.batch([db.prepare(`DELETE FROM schedules WHERE id = ?`).bind(id), ...metaStmts(db, Date.now())])
    },

    async listRecycle() {
      const r = await db.prepare(`SELECT id, course, deleted_at AS deletedAt FROM recycle_items`).all()
      return r.results
        .map(row => ({ course: parseJson<Course>(row.course, {} as Course), deletedAt: Number(row.deletedAt) }))
        .filter(item => item.course && item.course.id)
    },
    async addRecycle(item: RecycleItem) {
      await db.batch([insertRecycleStmt(db, item), ...metaStmts(db, Date.now())])
    },
    async deleteRecycle(id: string) {
      await db.batch([db.prepare(`DELETE FROM recycle_items WHERE id = ?`).bind(id), ...metaStmts(db, Date.now())])
    },

    async getSettings() {
      const r = await db.prepare(`SELECT data FROM settings WHERE id = 1`).first<{ data: string }>()
      return r ? normalizeSettings(parseJson(r.data, {})) : { ...DEFAULT_SETTINGS }
    },
    async putSettings(settings: AppSettings) {
      const now = Date.now()
      await db.batch([
        db.prepare(`INSERT INTO settings (id, data, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`).bind(JSON.stringify(settings), now),
        ...metaStmts(db, now),
      ])
    },
  }

  return impl
}
