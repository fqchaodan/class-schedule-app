import type { Course } from '@/types/course'
import { courseCoversDay, dateRangeDays, timeToMinutes } from './time'

/**
 * 两节课在某一天上是否时间重叠
 * 规则：边界相接不算冲突（10:00-11:00 与 11:00-12:00 不冲突）
 */
export function isTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const sA = timeToMinutes(startA)
  const eA = timeToMinutes(endA)
  const sB = timeToMinutes(startB)
  const eB = timeToMinutes(endB)
  if ([sA, eA, sB, eB].some(v => v < 0))
    return false
  // 段 A 可能横跨天级边界时按"每天同样时间段"处理，这里只比较时间段
  return sA < eB && sB < eA
}

/** 课程与候选课程是否冲突（存在任一共同日期且时间段重叠） */
export function isCourseConflict(a: Course, b: Course): boolean {
  // 共同日期
  const daysA = dateRangeDays(a.startDate, a.endDate)
  const daysB = new Set(dateRangeDays(b.startDate, b.endDate))
  if (!daysA.some(d => daysB.has(d)))
    return false
  return isTimeOverlap(a.startTime, a.endTime, b.startTime, b.endTime)
}

/**
 * 查找与候选课程冲突的已有课程
 * @param courses 已有课程
 * @param candidate 候选课程（保存前的新值）
 * @param excludeId 需要排除的课程 id（编辑自身时）
 */
export function findConflicts(
  courses: Course[],
  candidate: Pick<Course, 'startDate' | 'endDate' | 'startTime' | 'endTime'>,
  excludeId?: string,
): Course[] {
  return courses.filter(
    c => c.id !== excludeId && isCourseConflict(c, candidate as Course),
  )
}

/** 冲突提示文案 */
export function conflictText(conflicts: Course[]): string {
  if (conflicts.length === 0)
    return ''
  const label = (c: Course) => c.studentName || c.name || '未命名课程'
  const list = conflicts
    .slice(0, 5)
    .map(c => `「${label(c)}」${c.startDate} ${c.startTime}-${c.endTime}`)
  const more = conflicts.length > 5 ? `\n...等共 ${conflicts.length} 条冲突` : ''
  return `与以下课程时间冲突：\n${list.join('\n')}${more}`
}

/** 供展示：课程在指定日期区间内覆盖的天数 */
export function coveredDays(course: Course): string[] {
  return dateRangeDays(course.startDate, course.endDate)
}

export { courseCoversDay }
