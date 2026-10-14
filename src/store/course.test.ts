import type { CourseDraft } from '@/types/course'
import { describe, expect, it } from 'vitest'
import { useCourseStore } from './course'
import { useRecycleStore } from './recycle'

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

describe('useCourseStore', () => {
  it('新增课程：无冲突时写入，有冲突时返回冲突列表且不写入', () => {
    const store = useCourseStore()

    expect(store.addCourse(makeDraft())).toEqual([])
    expect(store.courses).toHaveLength(1)

    // 与第一节课时间重叠 → 返回冲突且不保存
    const conflicts = store.addCourse(makeDraft({ studentName: '李四', startTime: '09:30', endTime: '10:30' }))
    expect(conflicts).toHaveLength(1)
    expect(store.courses).toHaveLength(1)

    // force = true 时忽略冲突保存
    expect(store.addCourse(makeDraft({ studentName: '李四', startTime: '09:30', endTime: '10:30' }), true)).toEqual([])
    expect(store.courses).toHaveLength(2)
  })

  it('编辑课程：排除自身后检测冲突', () => {
    const store = useCourseStore()
    store.addCourse(makeDraft())
    const id = store.courses[0].id

    // 仅微调时间，不应与自己冲突
    expect(store.updateCourse(id, makeDraft({ startTime: '09:10', endTime: '10:10' }))).toEqual([])
    expect(store.courses[0].startTime).toBe('09:10')
  })

  it('删除课程移入回收站，可恢复', () => {
    const store = useCourseStore()
    const recycle = useRecycleStore()
    store.addCourse(makeDraft())
    const id = store.courses[0].id

    expect(store.removeCourse(id)).toBe(true)
    expect(store.courses).toHaveLength(0)
    expect(recycle.items).toHaveLength(1)

    const restored = recycle.restore(id)
    expect(restored?.id).toBe(id)
    expect(recycle.items).toHaveLength(0)
  })

  it('已上 / 已收费状态切换', () => {
    const store = useCourseStore()
    store.addCourse(makeDraft())
    const id = store.courses[0].id

    expect(store.courses[0].completed).toBeFalsy()
    store.toggleCompleted(id)
    expect(store.courses[0].completed).toBe(true)
    store.togglePaid(id)
    expect(store.courses[0].paid).toBe(true)
    store.setCompleted(id, false)
    store.setPaid(id, false)
    expect(store.courses[0].completed).toBe(false)
    expect(store.courses[0].paid).toBe(false)
  })

  it('复制课程：日期平移 7 天且不带备注', () => {
    const store = useCourseStore()
    store.addCourse(makeDraft())
    const id = store.courses[0].id
    store.addNote(id, 'teaching', '今天讲了函数')

    const draft = store.duplicateCourse(id)
    expect(draft).not.toBeNull()
    expect(draft!.startDate).toBe('2026-10-21')
    expect(draft!.endDate).toBe('2026-10-21')
    expect(draft!.notes).toEqual([])
  })

  it('备注增删改', () => {
    const store = useCourseStore()
    store.addCourse(makeDraft())
    const id = store.courses[0].id

    const note = store.addNote(id, 'homework', '课后作业：练习册 P20')
    expect(note).not.toBeNull()
    expect(store.courses[0].notes).toHaveLength(1)

    expect(store.updateNote(id, note!.id, 'feedback', '学生反馈良好')).toBe(true)
    expect(store.courses[0].notes[0].type).toBe('feedback')

    expect(store.removeNote(id, note!.id)).toBe(true)
    expect(store.courses[0].notes).toHaveLength(0)

    // 空内容不落库
    expect(store.addNote(id, 'teaching', '   ')).toBeNull()
  })

  it('模板批量生成课程的插入与按模板删除', () => {
    const store = useCourseStore()
    const course = {
      id: 'gen-1',
      studentName: '王五',
      startDate: '2026-10-14',
      endDate: '2026-10-14',
      startTime: '14:00',
      endTime: '15:00',
      notes: [],
      templateId: 'tpl-1',
      createdAt: 0,
      updatedAt: 0,
    }
    store.insertMany([course])
    expect(store.courses).toHaveLength(1)

    store.removeByTemplateId('tpl-1')
    expect(store.courses).toHaveLength(0)
  })

  it('replaceById：同 id 覆盖，新 id 追加', () => {
    const store = useCourseStore()
    store.addCourse(makeDraft())
    const existingId = store.courses[0].id

    store.replaceById([
      { ...store.courses[0], studentName: '改名后' },
      {
        id: 'new-1',
        studentName: '新生',
        startDate: '2026-10-15',
        endDate: '2026-10-15',
        startTime: '11:00',
        endTime: '12:00',
        notes: [],
        createdAt: 0,
        updatedAt: 0,
      },
    ])
    expect(store.courses).toHaveLength(2)
    expect(store.getById(existingId)?.studentName).toBe('改名后')
  })
})
