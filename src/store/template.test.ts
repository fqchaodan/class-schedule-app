import type { CourseTemplate } from '@/types/course'
import { describe, expect, it } from 'vitest'
import { draftsToCourses, useTemplateStore } from './template'

function makeTemplate(partial: Partial<CourseTemplate> = {}): CourseTemplate {
  return {
    id: 'tpl-1',
    name: '每周一数学',
    kind: 'cycle',
    weekdays: [1],
    startTime: '09:00',
    endTime: '10:00',
    weeks: 2,
    startDate: '2026-10-12', // 周一
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

describe('buildCourses', () => {
  it('从起始周（周一）起按周生成课程实例', () => {
    const store = useTemplateStore()
    const drafts = store.buildCourses(makeTemplate())
    expect(drafts.map(d => d.startDate)).toEqual(['2026-10-12', '2026-10-19'])
    expect(drafts[0].templateId).toBe('tpl-1')
    expect(drafts[0].studentName).toBe('')
  })

  it('起始日期落在周中时，仍从该周周一开始推算星期', () => {
    const store = useTemplateStore()
    // 2026-10-14 是周三，weekdays=[1] 只应命中该周与下周的周一
    const drafts = store.buildCourses(makeTemplate({ startDate: '2026-10-14' }))
    expect(drafts.map(d => d.startDate)).toEqual(['2026-10-12', '2026-10-19'])
  })

  it('多个 weekday 生成多节，按周内日期升序', () => {
    const store = useTemplateStore()
    const drafts = store.buildCourses(makeTemplate({ weekdays: [1, 3], weeks: 1 }))
    expect(drafts.map(d => d.startDate)).toEqual(['2026-10-12', '2026-10-14'])
  })

  it('weeksOverride 覆盖模板周数', () => {
    const store = useTemplateStore()
    const drafts = store.buildCourses(makeTemplate(), 3)
    expect(drafts).toHaveLength(3)
  })
})

describe('saveCourseAsTemplate', () => {
  it('同名学生覆盖更新，不重复堆积', () => {
    const store = useTemplateStore()
    const first = store.saveCourseAsTemplate({
      studentName: '张三',
      courseName: '数学',
      startTime: '09:00',
      endTime: '10:00',
      fee: 200,
    })
    const second = store.saveCourseAsTemplate({
      studentName: '张三',
      courseName: '英语',
      startTime: '14:00',
      endTime: '15:00',
    })
    expect(store.templates).toHaveLength(1)
    expect(second.id).toBe(first.id)
    expect(store.getById(first.id)?.courseName).toBe('英语')
    expect(store.getById(first.id)?.startTime).toBe('14:00')
  })

  it('不同学生各自生成模板', () => {
    const store = useTemplateStore()
    store.saveCourseAsTemplate({ studentName: '张三', startTime: '09:00', endTime: '10:00' })
    store.saveCourseAsTemplate({ studentName: '李四', startTime: '09:00', endTime: '10:00' })
    expect(store.templates).toHaveLength(2)
  })
})

describe('draftsToCourses', () => {
  it('草稿转课程：补全 id / notes / 时间戳', () => {
    const now = Date.now()
    const courses = draftsToCourses([
      { studentName: '张三', startDate: '2026-10-12', endDate: '2026-10-12', startTime: '09:00', endTime: '10:00', templateId: 'tpl-1' },
    ])
    expect(courses).toHaveLength(1)
    expect(courses[0].id).toBeTruthy()
    expect(courses[0].notes).toEqual([])
    expect(courses[0].templateId).toBe('tpl-1')
    expect(courses[0].createdAt).toBeGreaterThanOrEqual(now)
  })
})

describe('removeTemplate', () => {
  it('删除模板不影响已生成课程（仅删模板本身）', () => {
    const store = useTemplateStore()
    const tpl = store.addTemplate({
      name: '临时',
      weekdays: [1],
      startTime: '09:00',
      endTime: '10:00',
      weeks: 1,
      enabled: true,
    })
    expect(store.templates).toHaveLength(1)
    store.removeTemplate(tpl.id)
    expect(store.templates).toHaveLength(0)
  })
})
