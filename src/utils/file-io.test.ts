import type { Course, CourseTemplate, Schedule } from '@/types/course'
import { describe, expect, it } from 'vitest'
import { buildExportFile, EXPORT_APP_ID, SCHEMA_VERSION, summarizeImport, validateImportFile } from './file-io'

function makeCourse(partial: Partial<Course> = {}): Course {
  return {
    id: 'c-1',
    studentName: '张三',
    name: '数学',
    startDate: '2026-10-14',
    endDate: '2026-10-14',
    startTime: '09:00',
    endTime: '10:00',
    notes: [],
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

function makeTemplate(partial: Partial<CourseTemplate> = {}): CourseTemplate {
  return {
    id: 't-1',
    name: '每周数学',
    kind: 'cycle',
    weekdays: [1, 3],
    startTime: '09:00',
    endTime: '10:00',
    weeks: 12,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

describe('validateImportFile', () => {
  it('导出 → 导入往返通过', () => {
    const file = buildExportFile([makeCourse()], [makeTemplate()], { notificationEnabled: false })
    const result = validateImportFile(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.courses).toHaveLength(1)
      expect(result.data.templates).toHaveLength(1)
      expect(result.data.app).toBe(EXPORT_APP_ID)
      expect(result.data.schemaVersion).toBe(SCHEMA_VERSION)
    }
  })

  it('多课表信息随导出保留、随导入还原（课程归属不丢失）', () => {
    const schedules: Schedule[] = [{ id: 'sch-1', name: '张老师', createdAt: 1, updatedAt: 1 }]
    const file = buildExportFile(
      [makeCourse({ scheduleId: 'sch-1' }), makeCourse({ id: 'c-2', scheduleId: undefined })],
      [],
      { notificationEnabled: false },
      schedules,
    )
    const result = validateImportFile(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.schedules).toHaveLength(1)
      expect(result.data.schedules?.[0].name).toBe('张老师')
      expect(result.data.courses[0].scheduleId).toBe('sch-1')
      // 未标记归属的课程不携带 scheduleId（导入后归默认课表）
      expect(result.data.courses[1].scheduleId).toBeUndefined()
    }
  })

  it('旧版本备份（无 schedules 字段）仍可导入，非法条目被过滤', () => {
    const result = validateImportFile({
      app: EXPORT_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      courses: [makeCourse()],
      templates: [],
      schedules: [{ id: 'ok-1', name: '李老师' }, { id: '', name: '坏数据' }, { id: 'ok-2', name: '   ' }],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.schedules).toHaveLength(1)
      expect(result.data.schedules?.[0].id).toBe('ok-1')
    }
  })

  it('拒绝非对象 / 非本应用文件 / 版本不符', () => {
    expect(validateImportFile(null).ok).toBe(false)
    expect(validateImportFile('x').ok).toBe(false)
    expect(validateImportFile({ app: 'other-app' }).ok).toBe(false)
    expect(validateImportFile({ app: EXPORT_APP_ID, schemaVersion: 99 }).ok).toBe(false)
  })

  it('拒绝缺少数组字段的文件', () => {
    expect(validateImportFile({ app: EXPORT_APP_ID, schemaVersion: SCHEMA_VERSION }).ok).toBe(false)
  })

  it('学生姓名必填', () => {
    const result = validateImportFile({
      app: EXPORT_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      courses: [{ ...makeCourse(), studentName: '  ' }],
      templates: [],
    })
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('学生姓名不能为空') })
  })

  it('拒绝非法日期与时间', () => {
    const badDate = validateImportFile({
      app: EXPORT_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      courses: [{ ...makeCourse(), startDate: '2026-2-1' }],
      templates: [],
    })
    expect(badDate.ok).toBe(false)

    const badTime = validateImportFile({
      app: EXPORT_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      courses: [{ ...makeCourse(), endTime: '25:00' }],
      templates: [],
    })
    expect(badTime.ok).toBe(false)
  })

  it('结束时间需晚于开始时间', () => {
    const result = validateImportFile({
      app: EXPORT_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      courses: [{ ...makeCourse(), startTime: '10:00', endTime: '10:00' }],
      templates: [],
    })
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('结束时间需晚于开始时间') })
  })

  it('拒绝跨天 / 多日课程（当前版本仅支持单日）', () => {
    const result = validateImportFile({
      app: EXPORT_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      courses: [{ ...makeCourse(), endDate: '2026-10-16' }],
      templates: [],
    })
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('暂不支持跨天') })
  })

  it('模板字段校验（周数 ≥ 1、weekdays 0-6）', () => {
    const badWeeks = validateImportFile({
      app: EXPORT_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      courses: [],
      templates: [{ ...makeTemplate(), weeks: 0 }],
    })
    expect(badWeeks.ok).toBe(false)

    const badWeekday = validateImportFile({
      app: EXPORT_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      courses: [],
      templates: [{ ...makeTemplate(), weekdays: [7] }],
    })
    expect(badWeekday.ok).toBe(false)
  })
})

describe('summarizeImport', () => {
  it('统计新增 / 覆盖 / 冲突数量', () => {
    const existing = [
      makeCourse({ id: 'a', startDate: '2026-10-14', startTime: '09:00', endTime: '10:00' }),
    ]
    const incoming = [
      // 与 existing.a 同 id（覆盖），且时段冲突（被自己在 existing 中排除，不算冲突）
      makeCourse({ id: 'a', startDate: '2026-10-14', startTime: '09:00', endTime: '10:00' }),
      // 新增，与 existing.a 时间冲突
      makeCourse({ id: 'b', startDate: '2026-10-14', startTime: '09:30', endTime: '10:30' }),
      // 新增，不冲突
      makeCourse({ id: 'c', startDate: '2026-10-20', startTime: '09:00', endTime: '10:00' }),
    ]
    const stats = summarizeImport(incoming, existing)
    expect(stats.addCount).toBe(2)
    expect(stats.overwriteCount).toBe(1)
    expect(stats.conflictCount).toBe(1)
  })
})
