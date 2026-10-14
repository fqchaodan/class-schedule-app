/**
 * 课程表 App 数据模型
 */

/** 备注类型 */
export type NoteType = 'teaching' | 'student' | 'homework' | 'feedback'

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  teaching: '教学内容',
  student: '学生情况',
  homework: '作业',
  feedback: '课后反馈',
}

export const NOTE_TYPE_OPTIONS = Object.entries(NOTE_TYPE_LABELS).map(([value, label]) => ({
  value: value as NoteType,
  label,
}))

/** 课程备注 */
export interface CourseNote {
  id: string
  type: NoteType
  content: string
  createdAt: number
}

/** 默认课表固定 id（历史数据中未标记 scheduleId 的课程均归属此课表） */
export const DEFAULT_SCHEDULE_ID = 'default'

/** 课表（多课表模式下每张课表对应一位老师） */
export interface Schedule {
  id: string
  /** 课表名称（通常为老师姓名） */
  name: string
  createdAt: number
  updatedAt: number
}

/** 课程 */
export interface Course {
  id: string
  /** 所属课表 id（缺省 = 默认课表） */
  scheduleId?: string
  /** 学生姓名（必填，界面主体） */
  studentName: string
  /** 课程名（选填，作为备注性质） */
  name?: string
  /** 开始日期 YYYY-MM-DD */
  startDate: string
  /** 结束日期 YYYY-MM-DD（当前版本仅支持单日课程，与 startDate 相同；保留字段以兼容导出结构） */
  endDate: string
  /** 开始时间 HH:mm */
  startTime: string
  /** 结束时间 HH:mm（支持 24:00 表示当天结束） */
  endTime: string
  /** 单次课时费（可空） */
  fee?: number
  /** 腾讯会议邀请链接（选填） */
  meetingUrl?: string
  /** 是否已上（false/缺省 = 未上） */
  completed?: boolean
  /** 是否已收费（false/缺省 = 未收费） */
  paid?: boolean
  /** 备注 */
  notes: CourseNote[]
  /** 来源模板 id */
  templateId?: string
  createdAt: number
  updatedAt: number
}

/** 课程表单草稿（新增/编辑/模板生成前的中间态） */
export interface CourseDraft {
  studentName: string
  name?: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  fee?: number
  meetingUrl?: string
  notes?: CourseNote[]
  templateId?: string
}

/** 周期排课模板 */
export interface CourseTemplate {
  id: string
  name: string
  /** 模板类型：cycle=周期排课模板（按周批量生成）；course=课程模板（新增/编辑时快速填充） */
  kind?: 'cycle' | 'course'
  /** 课程模板专用：学生姓名 */
  studentName?: string
  /** 课程模板专用：课程名（备注性质，选填） */
  courseName?: string
  /** 课程模板专用：腾讯会议链接（选填） */
  meetingUrl?: string
  /** 生效的星期，0=周日 ... 6=周六（周期模板用） */
  weekdays: number[]
  startTime: string
  endTime: string
  fee?: number
  /** 从起始日期起连续生成的周数（周期模板用） */
  weeks: number
  /** 起始日期（默认为当天所在周的周一） */
  startDate?: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

/** 回收站条目（课程快照） */
export interface RecycleItem {
  course: Course
  deletedAt: number
}

/** 导出文件结构 */
export interface ExportFile {
  app: 'teacher-schedule'
  schemaVersion: 1
  exportedAt: number
  courses: Course[]
  templates: CourseTemplate[]
  /** 多课表信息（旧版本备份文件无此字段，缺省时全部归入默认课表） */
  schedules?: Schedule[]
  settings?: AppSettings
}

/** 应用设置 */
export interface AppSettings {
  /** 默认课时费 */
  defaultFee?: number
  /** 是否开启课前通知 */
  notificationEnabled?: boolean
  /** 课前提前多少分钟通知 */
  notificationAdvanceMinutes?: number
  /** 通知内容模板：支持占位符 {student} {course} {time} */
  notificationTemplate?: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  notificationEnabled: false,
  notificationAdvanceMinutes: 15,
  notificationTemplate: '即将上课：{student} 的 {course}，时间 {time}',
}

/** 星期显示名（dayjs day(): 0=周日） */
export const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 生成一个不依赖 crypto 的唯一 id */
export function genId(): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 10)
  return `${t}${r}`
}
