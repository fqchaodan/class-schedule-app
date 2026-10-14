import { describe, expect, it } from 'vitest'
import {
  addDays,
  addWeeks,
  courseCoversDay,
  durationHours,
  isValidDate,
  isValidTime,
  minutesToTime,
  shortDate,
  timeToMinutes,
  weekDays,
  weekStart,
} from './time'

describe('timeToMinutes', () => {
  it('解析 HH:mm', () => {
    expect(timeToMinutes('09:00')).toBe(540)
    expect(timeToMinutes('9:05')).toBe(545)
    expect(timeToMinutes('23:59')).toBe(1439)
  })

  it('24:00 表示当天结束', () => {
    expect(timeToMinutes('24:00')).toBe(1440)
  })

  it('非法输入返回 -1', () => {
    expect(timeToMinutes('24:01')).toBe(-1)
    expect(timeToMinutes('25:00')).toBe(-1)
    expect(timeToMinutes('09:60')).toBe(-1)
    expect(timeToMinutes('abc')).toBe(-1)
    expect(timeToMinutes('')).toBe(-1)
  })
})

describe('minutesToTime', () => {
  it('分钟数转 HH:mm', () => {
    expect(minutesToTime(540)).toBe('09:00')
    expect(minutesToTime(1440)).toBe('24:00')
  })
})

describe('isValidTime / isValidDate', () => {
  it('时间校验（含 24:00）', () => {
    expect(isValidTime('00:00')).toBe(true)
    expect(isValidTime('24:00')).toBe(true)
    expect(isValidTime('24:10')).toBe(false)
  })

  it('日期校验只接受 YYYY-MM-DD', () => {
    expect(isValidDate('2026-10-14')).toBe(true)
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('2026/10/14')).toBe(false)
    expect(isValidDate('2026-2-1')).toBe(false)
  })
})

describe('durationHours', () => {
  it('正常时长（保留 1 位小数）', () => {
    expect(durationHours('09:00', '10:30')).toBe(1.5)
    expect(durationHours('09:00', '10:00')).toBe(1)
  })

  it('结束不晚于开始时返回 0', () => {
    expect(durationHours('10:00', '09:00')).toBe(0)
    expect(durationHours('09:00', '09:00')).toBe(0)
    expect(durationHours('bad', '10:00')).toBe(0)
  })
})

describe('周计算（周一为一周起点）', () => {
  it('weekStart 返回所在周周一', () => {
    // 2026-10-14 是周三
    expect(weekStart('2026-10-14')).toBe('2026-10-12')
    expect(weekStart('2026-10-12')).toBe('2026-10-12')
    expect(weekStart('2026-10-18')).toBe('2026-10-12')
  })

  it('weekDays 返回连续 7 天', () => {
    const days = weekDays('2026-10-12')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-10-12')
    expect(days[6]).toBe('2026-10-18')
  })

  it('addWeeks / addDays 跨月计算', () => {
    expect(addWeeks('2026-10-12', 1)).toBe('2026-10-19')
    expect(addWeeks('2026-10-12', -1)).toBe('2026-10-05')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  })
})

describe('courseCoversDay', () => {
  it('单日课程只覆盖当天', () => {
    expect(courseCoversDay('2026-10-14', '2026-10-14', '2026-10-14')).toBe(true)
    expect(courseCoversDay('2026-10-14', '2026-10-14', '2026-10-13')).toBe(false)
    expect(courseCoversDay('2026-10-14', '2026-10-14', '2026-10-15')).toBe(false)
  })

  it('多日区间按天覆盖（含首尾）', () => {
    expect(courseCoversDay('2026-10-12', '2026-10-14', '2026-10-12')).toBe(true)
    expect(courseCoversDay('2026-10-12', '2026-10-14', '2026-10-13')).toBe(true)
    expect(courseCoversDay('2026-10-12', '2026-10-14', '2026-10-14')).toBe(true)
    expect(courseCoversDay('2026-10-12', '2026-10-14', '2026-10-15')).toBe(false)
  })
})

describe('shortDate', () => {
  it('显示为 M.D', () => {
    expect(shortDate('2026-10-05')).toBe('10.5')
  })
})
