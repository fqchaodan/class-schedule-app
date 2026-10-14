import type { CourseDraft } from '@/types/course'
import { DEFAULT_SCHEDULE_ID } from '@/types/course'
import { describe, expect, it } from 'vitest'
import { useCourseStore } from './course'
import { useRecycleStore } from './recycle'
import { useScheduleStore } from './schedule'

function makeDraft(partial: Partial<CourseDraft> = {}): CourseDraft {
  return {
    studentName: '张三',
    startDate: '2026-10-14',
    endDate: '2026-10-14',
    startTime: '09:00',
    endTime: '10:00',
    ...partial,
  }
}

describe('useScheduleStore', () => {
  it('首次使用自动创建默认课表并激活', () => {
    const store = useScheduleStore()
    expect(store.schedules).toHaveLength(1)
    expect(store.schedules[0].id).toBe(DEFAULT_SCHEDULE_ID)
    expect(store.activeId).toBe(DEFAULT_SCHEDULE_ID)
    expect(store.activeSchedule?.name).toBe('默认课表')
  })

  it('ensureValid 可修复异常状态：默认课表缺失 / 激活 id 失效', () => {
    const store = useScheduleStore()

    // 模拟持久化水合后的异常状态：只有自定义课表，没有默认课表
    store.schedules = [{ id: 's1', name: '张老师', createdAt: 1, updatedAt: 1 }]
    store.activeId = 's1'
    store.ensureValid()
    expect(store.schedules[0].id).toBe(DEFAULT_SCHEDULE_ID)
    expect(store.schedules).toHaveLength(2)
    expect(store.activeId).toBe('s1')

    // 激活 id 也失效时回退到默认课表
    store.activeId = 'gone'
    store.ensureValid()
    expect(store.activeId).toBe(DEFAULT_SCHEDULE_ID)
  })

  it('创建 / 重命名课表', () => {
    const store = useScheduleStore()
    const s = store.createSchedule('  张老师  ')
    expect(store.schedules).toHaveLength(2)
    expect(s.name).toBe('张老师')

    expect(store.renameSchedule(s.id, '李老师')).toBe(true)
    expect(store.schedules.find(x => x.id === s.id)?.name).toBe('李老师')

    // 空名称 / 不存在的 id 拒绝
    expect(store.renameSchedule(s.id, '   ')).toBe(false)
    expect(store.renameSchedule('not-exist', '任意')).toBe(false)
  })

  it('切换课表：activeId 必须有效', () => {
    const store = useScheduleStore()
    const s = store.createSchedule('王老师')
    expect(store.switchTo(s.id)).toBe(true)
    expect(store.activeId).toBe(s.id)
    expect(store.switchTo('not-exist')).toBe(false)
    expect(store.activeId).toBe(s.id)
  })

  it('删除课表：默认课表不可删、非空不可删，删除后激活态回退', () => {
    const store = useScheduleStore()
    const s = store.createSchedule('赵老师')

    // 默认课表不可删
    expect(store.removeSchedule(DEFAULT_SCHEDULE_ID, false)).toBe(false)

    // 有课程不可删
    expect(store.removeSchedule(s.id, true)).toBe(false)
    expect(store.schedules).toHaveLength(2)

    // 空课表可删；删除当前激活课表后回退到剩余第一张
    expect(store.switchTo(s.id)).toBe(true)
    expect(store.removeSchedule(s.id, false)).toBe(true)
    expect(store.schedules).toHaveLength(1)
    expect(store.activeId).toBe(DEFAULT_SCHEDULE_ID)
  })

  it('删除非空课表：课程先移入回收站再删除课表', () => {
    const courseStore = useCourseStore()
    const scheduleStore = useScheduleStore()
    const recycleStore = useRecycleStore()

    const s = scheduleStore.createSchedule('袁老师')
    scheduleStore.switchTo(s.id)
    courseStore.addCourse(makeDraft())
    expect(courseStore.coursesOfSchedule(s.id)).toHaveLength(1)

    // 未迁移课程时 store 仍拒绝删除（最后防线）
    expect(scheduleStore.removeSchedule(s.id, true)).toBe(false)

    // 页面流程：先迁移课程（进回收站）→ 再删课表
    expect(courseStore.removeCoursesOfSchedule(s.id)).toBe(1)
    expect(recycleStore.items).toHaveLength(1)
    expect(recycleStore.items[0].course.scheduleId).toBe(s.id)

    expect(scheduleStore.removeSchedule(s.id, false)).toBe(true)
    expect(scheduleStore.exists(s.id)).toBe(false)
    expect(courseStore.courses).toHaveLength(0)
    // 激活态回退默认课表
    expect(scheduleStore.activeId).toBe(DEFAULT_SCHEDULE_ID)
  })

  it('exists：校验课表 id 是否存在', () => {
    const store = useScheduleStore()
    expect(store.exists(DEFAULT_SCHEDULE_ID)).toBe(true)
    expect(store.exists(undefined)).toBe(false)
    expect(store.exists('gone')).toBe(false)
  })

  it('reset：清空全部数据后仅保留默认课表并切回', () => {
    const store = useScheduleStore()
    store.renameSchedule(DEFAULT_SCHEDULE_ID, '改过名的默认表')
    const s1 = store.createSchedule('张老师')
    store.createSchedule('袁老师')
    store.switchTo(s1.id)

    store.reset()
    expect(store.schedules).toHaveLength(1)
    expect(store.schedules[0].id).toBe(DEFAULT_SCHEDULE_ID)
    expect(store.schedules[0].name).toBe('默认课表')
    expect(store.activeId).toBe(DEFAULT_SCHEDULE_ID)
  })
})

describe('course store 多课表过滤', () => {
  it('新增课程归入当前课表；视图只看当前课表', () => {
    const courseStore = useCourseStore()
    const scheduleStore = useScheduleStore()

    courseStore.addCourse(makeDraft())
    expect(courseStore.courses).toHaveLength(1)
    expect(courseStore.courses[0].scheduleId).toBe(DEFAULT_SCHEDULE_ID)
    expect(courseStore.activeCourses).toHaveLength(1)

    // 切到新课表：视图为空，但全量数据不变
    const s = scheduleStore.createSchedule('张老师')
    scheduleStore.switchTo(s.id)
    expect(courseStore.activeCourses).toHaveLength(0)
    expect(courseStore.courses).toHaveLength(1)

    // 新增课程归入新课表
    courseStore.addCourse(makeDraft({ startTime: '11:00', endTime: '12:00' }))
    expect(courseStore.activeCourses).toHaveLength(1)
    expect(courseStore.activeCourses[0].scheduleId).toBe(s.id)
    expect(courseStore.courses).toHaveLength(2)
  })

  it('冲突检测限定在课表内：不同课表同时间不冲突', () => {
    const courseStore = useCourseStore()
    const scheduleStore = useScheduleStore()

    courseStore.addCourse(makeDraft())
    const s = scheduleStore.createSchedule('张老师')
    scheduleStore.switchTo(s.id)

    // 与另一张课表时间重叠 → 不冲突
    expect(courseStore.detectConflicts(makeDraft())).toEqual([])

    // 同一张课表内重叠 → 冲突
    courseStore.addCourse(makeDraft({ startTime: '11:00', endTime: '12:00' }))
    expect(courseStore.detectConflicts(makeDraft({ startTime: '11:30', endTime: '12:30' }))).toHaveLength(1)
  })

  it('无 scheduleId 的历史课程视为默认课表', () => {
    const courseStore = useCourseStore()
    const scheduleStore = useScheduleStore()
    courseStore.insertMany([{
      id: 'legacy-1',
      studentName: '老数据',
      startDate: '2026-10-14',
      endDate: '2026-10-14',
      startTime: '09:00',
      endTime: '10:00',
      notes: [],
      createdAt: 0,
      updatedAt: 0,
    }])
    expect(courseStore.activeCourses).toHaveLength(1)

    const s = scheduleStore.createSchedule('张老师')
    scheduleStore.switchTo(s.id)
    expect(courseStore.activeCourses).toHaveLength(0)
    // 新课表内新增课程与老数据同时间不冲突（课表隔离）
    expect(courseStore.detectConflicts(makeDraft())).toEqual([])
  })

  it('detectConflictsInSchedule：按指定课表检测（回收站恢复场景）', () => {
    const courseStore = useCourseStore()
    const scheduleStore = useScheduleStore()
    courseStore.addCourse(makeDraft())

    // 回收站里的课程属于另一张课表 → 即使当前激活的是默认课表，也按原课表检测
    const s = scheduleStore.createSchedule('张老师')
    expect(courseStore.detectConflictsInSchedule(s.id, makeDraft())).toEqual([])
    expect(courseStore.detectConflictsInSchedule(DEFAULT_SCHEDULE_ID, makeDraft())).toHaveLength(1)
    expect(courseStore.detectConflictsInSchedule(undefined, makeDraft())).toHaveLength(1)
  })
})
