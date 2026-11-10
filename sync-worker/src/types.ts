/**
 * 服务端数据模型（与前端 src/types/course.ts 对齐的单一事实源）。
 * 后端只做持久化与校验，冲突检测仍在客户端。
 */

export type NoteType = 'teaching' | 'student' | 'homework' | 'feedback'

export interface CourseNote {
  id: string
  type: NoteType
  content: string
  createdAt: number
}

export const DEFAULT_SCHEDULE_ID = 'default'

export interface Schedule {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface Course {
  id: string
  scheduleId?: string
  studentName: string
  name?: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  fee?: number
  meetingUrl?: string
  completed?: boolean
  paid?: boolean
  notes: CourseNote[]
  templateId?: string
  createdAt: number
  updatedAt: number
}

export interface CourseTemplate {
  id: string
  name: string
  kind?: 'cycle' | 'course'
  studentName?: string
  courseName?: string
  meetingUrl?: string
  weekdays: number[]
  startTime: string
  endTime: string
  fee?: number
  weeks: number
  startDate?: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface RecycleItem {
  course: Course
  deletedAt: number
}

export interface AppSettings {
  defaultFee?: number
  notificationEnabled?: boolean
  notificationAdvanceMinutes?: number
  notificationTemplate?: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  notificationEnabled: false,
  notificationAdvanceMinutes: 15,
  notificationTemplate: '即将上课：{student} 的 {course}，时间 {time}',
}

/** 完整数据集（不含版本元信息） */
export interface SnapshotData {
  schedules: Schedule[]
  courses: Course[]
  templates: CourseTemplate[]
  recycle: RecycleItem[]
  settings: AppSettings
}

/** 读取快照返回：数据 + 版本元信息 */
export interface SnapshotResult extends SnapshotData {
  version: number
  updatedAt: number
}

/** 写入快照入参：各字段可选（缺省按空/默认处理） */
export type SnapshotInput = Partial<SnapshotData>

export interface WriteResult {
  version: number
  updatedAt: number
}

/** 持久化接口。D1 与内存实现各自的契约，便于路由层无 DB 单测。 */
export interface Db {
  getSnapshot: () => Promise<SnapshotResult>
  replaceSnapshot: (input: SnapshotInput) => Promise<WriteResult>

  listCourses: () => Promise<Course[]>
  getCourse: (id: string) => Promise<Course | null>
  upsertCourse: (course: Course) => Promise<void>
  deleteCourse: (id: string) => Promise<void>

  listTemplates: () => Promise<CourseTemplate[]>
  upsertTemplate: (template: CourseTemplate) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>

  listSchedules: () => Promise<Schedule[]>
  upsertSchedule: (schedule: Schedule) => Promise<void>
  deleteSchedule: (id: string) => Promise<void>

  listRecycle: () => Promise<RecycleItem[]>
  addRecycle: (item: RecycleItem) => Promise<void>
  deleteRecycle: (id: string) => Promise<void>

  getSettings: () => Promise<AppSettings>
  putSettings: (settings: AppSettings) => Promise<void>
}

// ---------- 运行时校验（HTTP 边界） ----------

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function asBoolean(value: unknown): boolean {
  return value === true
}

/** 规整一条课程；字段缺失则用兜底值，保证落库结构完整 */
export function normalizeCourse(raw: unknown): Course | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id.length === 0)
    return null
  if (typeof raw.studentName !== 'string' || typeof raw.startDate !== 'string')
    return null
  const notes = Array.isArray(raw.notes)
    ? raw.notes.filter(isRecord).map(n => ({
        id: typeof n.id === 'string' ? n.id : '',
        type: (typeof n.type === 'string' ? n.type : 'teaching') as NoteType,
        content: typeof n.content === 'string' ? n.content : '',
        createdAt: asNumber(n.createdAt),
      }))
    : []
  return {
    id: raw.id,
    scheduleId: typeof raw.scheduleId === 'string' ? raw.scheduleId : undefined,
    studentName: raw.studentName,
    name: typeof raw.name === 'string' ? raw.name : undefined,
    startDate: raw.startDate,
    endDate: typeof raw.endDate === 'string' ? raw.endDate : raw.startDate,
    startTime: typeof raw.startTime === 'string' ? raw.startTime : '00:00',
    endTime: typeof raw.endTime === 'string' ? raw.endTime : '00:00',
    fee: typeof raw.fee === 'number' ? raw.fee : undefined,
    meetingUrl: typeof raw.meetingUrl === 'string' ? raw.meetingUrl : undefined,
    completed: raw.completed === true,
    paid: raw.paid === true,
    notes,
    templateId: typeof raw.templateId === 'string' ? raw.templateId : undefined,
    createdAt: asNumber(raw.createdAt, Date.now()),
    updatedAt: asNumber(raw.updatedAt, Date.now()),
  }
}

export function normalizeTemplate(raw: unknown): CourseTemplate | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id.length === 0)
    return null
  if (typeof raw.name !== 'string')
    return null
  return {
    id: raw.id,
    name: raw.name,
    kind: raw.kind === 'course' || raw.kind === 'cycle' ? raw.kind : undefined,
    studentName: typeof raw.studentName === 'string' ? raw.studentName : undefined,
    courseName: typeof raw.courseName === 'string' ? raw.courseName : undefined,
    meetingUrl: typeof raw.meetingUrl === 'string' ? raw.meetingUrl : undefined,
    weekdays: Array.isArray(raw.weekdays) ? raw.weekdays.filter(w => typeof w === 'number') : [],
    startTime: typeof raw.startTime === 'string' ? raw.startTime : '00:00',
    endTime: typeof raw.endTime === 'string' ? raw.endTime : '00:00',
    fee: typeof raw.fee === 'number' ? raw.fee : undefined,
    weeks: asNumber(raw.weeks, 1),
    startDate: typeof raw.startDate === 'string' ? raw.startDate : undefined,
    enabled: raw.enabled !== false,
    createdAt: asNumber(raw.createdAt, Date.now()),
    updatedAt: asNumber(raw.updatedAt, Date.now()),
  }
}

export function normalizeSchedule(raw: unknown): Schedule | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id.length === 0)
    return null
  if (typeof raw.name !== 'string')
    return null
  return {
    id: raw.id,
    name: raw.name,
    createdAt: asNumber(raw.createdAt, Date.now()),
    updatedAt: asNumber(raw.updatedAt, Date.now()),
  }
}

export function normalizeSettings(raw: unknown): AppSettings {
  if (!isRecord(raw))
    return { ...DEFAULT_SETTINGS }
  const s: AppSettings = { ...DEFAULT_SETTINGS }
  if (typeof raw.defaultFee === 'number')
    s.defaultFee = raw.defaultFee
  if (typeof raw.notificationEnabled === 'boolean')
    s.notificationEnabled = raw.notificationEnabled
  if (typeof raw.notificationAdvanceMinutes === 'number')
    s.notificationAdvanceMinutes = raw.notificationAdvanceMinutes
  if (typeof raw.notificationTemplate === 'string')
    s.notificationTemplate = raw.notificationTemplate
  return s
}

/** 保证至少存在默认课表，且课程归属的课表 id 有效 */
export function ensureDefaultSchedule(schedules: Schedule[]): Schedule[] {
  const list = [...schedules]
  if (!list.some(s => s.id === DEFAULT_SCHEDULE_ID)) {
    const now = Date.now()
    list.unshift({ id: DEFAULT_SCHEDULE_ID, name: '默认课表', createdAt: now, updatedAt: now })
  }
  return list
}
