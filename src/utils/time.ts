import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(isoWeek)

export type DateStr = string // YYYY-MM-DD
export type TimeStr = string // HH:mm 或 24:00

export const DATE_FORMAT = 'YYYY-MM-DD'
export const TIME_FORMAT = 'HH:mm'

/** 解析 HH:mm 为当天分钟数，支持 24:00=1440；非法返回 -1 */
export function timeToMinutes(time: TimeStr): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m)
    return -1
  const h = Number(m[1])
  const min = Number(m[2])
  if (min > 59)
    return -1
  if (h === 24 && min === 0)
    return 1440
  if (h > 23)
    return -1
  return h * 60 + min
}

/** 校验 HH:mm（含 24:00） */
export function isValidTime(time: string): boolean {
  return timeToMinutes(time) >= 0
}

/** 校验日期字符串 YYYY-MM-DD */
export function isValidDate(date: string): boolean {
  return dayjs(date, DATE_FORMAT, true).isValid()
}

/** 分钟数转 HH:mm（1440 -> 24:00） */
export function minutesToTime(mins: number): TimeStr {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 两个日期之间的所有日期（含首尾），YYYY-MM-DD 数组 */
export function dateRangeDays(start: DateStr, end: DateStr): DateStr[] {
  const s = dayjs(start)
  const e = dayjs(end)
  if (!s.isValid() || !e.isValid() || e.isBefore(s))
    return []
  const days: DateStr[] = []
  let cur = s
  while (!cur.isAfter(e, 'day')) {
    days.push(cur.format(DATE_FORMAT))
    cur = cur.add(1, 'day')
  }
  return days
}

/** 课程是否覆盖某一天 */
export function courseCoversDay(startDate: DateStr, endDate: DateStr, day: DateStr): boolean {
  const d = dayjs(day)
  return !d.isBefore(dayjs(startDate), 'day') && !d.isAfter(dayjs(endDate), 'day')
}

/** 某天所在周的周一 */
export function weekStart(date: DateStr | dayjs.Dayjs = dayjs()): DateStr {
  const d = dayjs.isDayjs(date) ? date : dayjs(date)
  return d.startOf('isoWeek').format(DATE_FORMAT)
}

/** 返回某周（周一开始）的 7 天日期 */
export function weekDays(weekStartDate: DateStr): DateStr[] {
  const s = dayjs(weekStartDate)
  return Array.from({ length: 7 }, (_, i) => s.add(i, 'day').format(DATE_FORMAT))
}

/** 增减周数 */
export function addWeeks(weekStartDate: DateStr, n: number): DateStr {
  return dayjs(weekStartDate).add(n, 'week').format(DATE_FORMAT)
}

/** 增减天数 */
export function addDays(date: DateStr, n: number): DateStr {
  return dayjs(date).add(n, 'day').format(DATE_FORMAT)
}

/** 显示用：M.D */
export function shortDate(date: DateStr): string {
  return dayjs(date).format('M.D')
}

/** 显示用：M月D日 ddd */
export function longDate(date: DateStr): string {
  const d = dayjs(date)
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.format('M月D日')} ${labels[d.day()]}`
}

/** 计算时长（小时，保留 1 位小数） */
export function durationHours(startTime: TimeStr, endTime: TimeStr): number {
  const s = timeToMinutes(startTime)
  const e = timeToMinutes(endTime)
  if (s < 0 || e < 0 || e <= s)
    return 0
  return Math.round(((e - s) / 60) * 10) / 10
}

/** 当前日期 YYYY-MM-DD */
export function today(): DateStr {
  return dayjs().format(DATE_FORMAT)
}

/** 将 YYYY-MM-DD 日期字符串转为当天 00:00:00 的时间戳（毫秒） */
export function dateToTimestamp(date: DateStr): number {
  return dayjs(date).startOf('day').valueOf()
}

/** 将时间戳（毫秒）转为 YYYY-MM-DD 日期字符串 */
export function timestampToDate(ts: number): DateStr {
  return dayjs(ts).format(DATE_FORMAT)
}

/** 统一时间戳格式化：YYYY-MM-DD HH:mm:ss */
export function formatDateTime(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD HH:mm:ss')
}

export { dayjs }
