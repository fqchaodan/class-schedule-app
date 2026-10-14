import type { Course } from '@/types/course'
import { describe, expect, it } from 'vitest'
import { findConflicts, isCourseConflict, isTimeOverlap } from './conflict'

function makeCourse(partial: Partial<Course> & Pick<Course, 'startDate' | 'startTime' | 'endTime'>): Course {
  return {
    id: partial.id ?? 'id-1',
    studentName: partial.studentName ?? '张三',
    startDate: partial.startDate,
    endDate: partial.endDate ?? partial.startDate,
    startTime: partial.startTime,
    endTime: partial.endTime,
    notes: [],
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  } as Course
}

describe('isTimeOverlap', () => {
  it('边界相接不算冲突', () => {
    expect(isTimeOverlap('10:00', '11:00', '11:00', '12:00')).toBe(false)
    expect(isTimeOverlap('11:00', '12:00', '10:00', '11:00')).toBe(false)
  })

  it('真实重叠判定', () => {
    expect(isTimeOverlap('10:00', '11:00', '10:30', '12:00')).toBe(true)
    expect(isTimeOverlap('10:00', '12:00', '10:30', '11:00')).toBe(true)
    expect(isTimeOverlap('10:00', '11:00', '10:00', '11:00')).toBe(true)
  })

  it('完全错开不冲突', () => {
    expect(isTimeOverlap('09:00', '10:00', '14:00', '15:00')).toBe(false)
  })

  it('非法时间返回 false（不误报冲突）', () => {
    expect(isTimeOverlap('bad', '11:00', '10:00', '12:00')).toBe(false)
  })
})

describe('isCourseConflict', () => {
  it('同日时段重叠 → 冲突', () => {
    const a = makeCourse({ startDate: '2026-10-14', startTime: '09:00', endTime: '10:00' })
    const b = makeCourse({ startDate: '2026-10-14', startTime: '09:30', endTime: '10:30' })
    expect(isCourseConflict(a, b)).toBe(true)
  })

  it('同日时段相接 → 不冲突', () => {
    const a = makeCourse({ startDate: '2026-10-14', startTime: '09:00', endTime: '10:00' })
    const b = makeCourse({ startDate: '2026-10-14', startTime: '10:00', endTime: '11:00' })
    expect(isCourseConflict(a, b)).toBe(false)
  })

  it('不同日期 → 不冲突', () => {
    const a = makeCourse({ startDate: '2026-10-14', startTime: '09:00', endTime: '10:00' })
    const b = makeCourse({ startDate: '2026-10-15', startTime: '09:00', endTime: '10:00' })
    expect(isCourseConflict(a, b)).toBe(false)
  })

  it('多日区间与单日课程在共同日期上重叠 → 冲突', () => {
    const multi = makeCourse({ startDate: '2026-10-12', endDate: '2026-10-16', startTime: '09:00', endTime: '10:00' })
    const single = makeCourse({ startDate: '2026-10-14', startTime: '09:30', endTime: '10:30' })
    expect(isCourseConflict(multi, single)).toBe(true)
  })

  it('多日区间与无交集日期的课程 → 不冲突', () => {
    const multi = makeCourse({ startDate: '2026-10-12', endDate: '2026-10-14', startTime: '09:00', endTime: '10:00' })
    const other = makeCourse({ startDate: '2026-10-15', startTime: '09:00', endTime: '10:00' })
    expect(isCourseConflict(multi, other)).toBe(false)
  })
})

describe('findConflicts', () => {
  const existing = [
    makeCourse({ id: 'a', startDate: '2026-10-14', startTime: '09:00', endTime: '10:00' }),
    makeCourse({ id: 'b', startDate: '2026-10-14', startTime: '10:00', endTime: '11:00' }),
    makeCourse({ id: 'c', startDate: '2026-10-15', startTime: '09:00', endTime: '10:00' }),
  ]

  it('返回全部冲突课程', () => {
    const conflicts = findConflicts(existing, {
      startDate: '2026-10-14',
      endDate: '2026-10-14',
      startTime: '09:30',
      endTime: '10:30',
    })
    expect(conflicts.map(c => c.id)).toEqual(['a', 'b'])
  })

  it('excludeId 排除自身（编辑场景）', () => {
    const conflicts = findConflicts(
      existing,
      { startDate: '2026-10-14', endDate: '2026-10-14', startTime: '09:00', endTime: '10:30' },
      'a',
    )
    expect(conflicts.map(c => c.id)).toEqual(['b'])
  })

  it('无冲突时返回空数组', () => {
    const conflicts = findConflicts(existing, {
      startDate: '2026-10-16',
      endDate: '2026-10-16',
      startTime: '09:00',
      endTime: '10:00',
    })
    expect(conflicts).toEqual([])
  })
})
