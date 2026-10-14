import type { Course, CourseDraft, CourseNote, NoteType } from '@/types/course'
import { DEFAULT_SCHEDULE_ID, genId } from '@/types/course'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { findConflicts } from '@/utils/conflict'
import { addDays } from '@/utils/time'
import { useRecycleStore } from './recycle'
import { useScheduleStore } from './schedule'

export type { CourseDraft }

export const useCourseStore = defineStore(
  'course',
  () => {
    const courses = ref<Course[]>([])

    // ---------- 查询 ----------
    const getById = (id: string) => courses.value.find(c => c.id === id)

    /** 当前课表下的课程（scheduleId 缺省视为默认课表） */
    const activeCourses = computed(() => {
      const sid = useScheduleStore().activeId
      return courses.value.filter(c => (c.scheduleId ?? DEFAULT_SCHEDULE_ID) === sid)
    })

    /** 当前课表下按时间排序的课程（课表页/看板/统计均以此为准） */
    const sortedByTime = computed(() =>
      [...activeCourses.value].sort((a, b) =>
        a.startDate === b.startDate
          ? a.startTime.localeCompare(b.startTime)
          : a.startDate.localeCompare(b.startDate),
      ),
    )

    /** 某课表（缺省 = 默认课表）下的全部课程 */
    function coursesOfSchedule(scheduleId: string | undefined) {
      const sid = scheduleId ?? DEFAULT_SCHEDULE_ID
      return courses.value.filter(c => (c.scheduleId ?? DEFAULT_SCHEDULE_ID) === sid)
    }

    // ---------- 冲突 ----------
    /** 检测冲突（不写入），范围限定当前课表 */
    function detectConflicts(draft: CourseDraft, excludeId?: string) {
      return findConflicts(activeCourses.value, draft, excludeId)
    }

    /** 检测指定课表内的冲突（回收站恢复等场景：课程归属可能与当前激活课表不同） */
    function detectConflictsInSchedule(scheduleId: string | undefined, draft: CourseDraft, excludeId?: string) {
      return findConflicts(coursesOfSchedule(scheduleId), draft, excludeId)
    }

    // ---------- CRUD ----------
    /** 新增课程（归入当前课表）；force=true 时忽略冲突直接保存。返回冲突列表（有冲突且未 force 时不保存） */
    function addCourse(draft: CourseDraft, force = false): Course[] {
      const conflicts = detectConflicts(draft)
      if (conflicts.length > 0 && !force)
        return conflicts
      const now = Date.now()
      const course: Course = {
        id: genId(),
        scheduleId: useScheduleStore().activeId,
        studentName: draft.studentName,
        name: draft.name,
        startDate: draft.startDate,
        endDate: draft.endDate,
        startTime: draft.startTime,
        endTime: draft.endTime,
        fee: draft.fee,
        meetingUrl: draft.meetingUrl,
        notes: draft.notes ?? [],
        templateId: draft.templateId,
        createdAt: now,
        updatedAt: now,
      }
      courses.value.push(course)
      return []
    }

    /** 编辑课程；返回值同 addCourse */
    function updateCourse(id: string, draft: CourseDraft, force = false): Course[] {
      const target = getById(id)
      if (!target)
        return []
      const conflicts = detectConflicts(draft, id)
      if (conflicts.length > 0 && !force)
        return conflicts
      Object.assign(target, {
        ...draft,
        updatedAt: Date.now(),
      })
      return []
    }

    /** 删除课程（移入回收站） */
    function removeCourse(id: string): boolean {
      const idx = courses.value.findIndex(c => c.id === id)
      if (idx < 0)
        return false
      const [course] = courses.value.splice(idx, 1)
      useRecycleStore().push(course)
      return true
    }

    /** 切换已上/未上状态 */
    function toggleCompleted(id: string): boolean {
      const target = getById(id)
      if (!target)
        return false
      target.completed = !target.completed
      target.updatedAt = Date.now()
      return true
    }

    /** 切换已收费/未收费状态 */
    function togglePaid(id: string): boolean {
      const target = getById(id)
      if (!target)
        return false
      target.paid = !target.paid
      target.updatedAt = Date.now()
      return true
    }

    /** 设置已收费/未收费状态 */
    function setPaid(id: string, paid: boolean): boolean {
      const target = getById(id)
      if (!target)
        return false
      target.paid = paid
      target.updatedAt = Date.now()
      return true
    }

    /** 设置已上/未上状态 */
    function setCompleted(id: string, completed: boolean): boolean {
      const target = getById(id)
      if (!target)
        return false
      target.completed = completed
      target.updatedAt = Date.now()
      return true
    }

    /** 复制课程：日期默认平移 7 天，返回新课程草稿供编辑页预填 */
    function duplicateCourse(id: string): (CourseDraft & { sourceName: string }) | null {
      const source = getById(id)
      if (!source)
        return null
      const shiftedDate = addDays(source.startDate, 7)
      return {
        studentName: source.studentName,
        name: source.name,
        startDate: shiftedDate,
        endDate: shiftedDate,
        startTime: source.startTime,
        endTime: source.endTime,
        fee: source.fee,
        meetingUrl: source.meetingUrl,
        notes: [],
        sourceName: source.name ?? '',
      }
    }

    /** 直接批量插入（模板生成 / 导入用） */
    function insertMany(list: Course[]) {
      courses.value.push(...list)
    }

    /** 删除某模板已生成的全部课程（重新生成前清理用） */
    function removeByTemplateId(templateId: string) {
      courses.value = courses.value.filter(c => c.templateId !== templateId)
    }

    /** 删除某课表下的全部课程（移入回收站）；用于删除课表前清理其课程 */
    function removeCoursesOfSchedule(scheduleId: string | undefined): number {
      const sid = scheduleId ?? DEFAULT_SCHEDULE_ID
      const removed = courses.value.filter(c => (c.scheduleId ?? DEFAULT_SCHEDULE_ID) === sid)
      if (removed.length === 0)
        return 0
      courses.value = courses.value.filter(c => (c.scheduleId ?? DEFAULT_SCHEDULE_ID) !== sid)
      const recycle = useRecycleStore()
      for (const c of removed)
        recycle.push(c)
      return removed.length
    }

    /** 覆盖同 id 课程（导入合并用） */
    function replaceById(list: Course[]) {
      for (const item of list) {
        const idx = courses.value.findIndex(c => c.id === item.id)
        if (idx >= 0)
          courses.value[idx] = item
        else
          courses.value.push(item)
      }
    }

    function clearAll() {
      courses.value = []
    }

    // ---------- 备注 ----------
    function addNote(courseId: string, type: NoteType, content: string): CourseNote | null {
      const target = getById(courseId)
      if (!target || !content.trim())
        return null
      const note: CourseNote = {
        id: genId(),
        type,
        content: content.trim(),
        createdAt: Date.now(),
      }
      target.notes.push(note)
      target.updatedAt = Date.now()
      return note
    }

    function updateNote(courseId: string, noteId: string, type: NoteType, content: string): boolean {
      const target = getById(courseId)
      const note = target?.notes.find(n => n.id === noteId)
      if (!note)
        return false
      note.type = type
      note.content = content.trim()
      if (target)
        target.updatedAt = Date.now()
      return true
    }

    function removeNote(courseId: string, noteId: string): boolean {
      const target = getById(courseId)
      if (!target)
        return false
      const idx = target.notes.findIndex(n => n.id === noteId)
      if (idx < 0)
        return false
      target.notes.splice(idx, 1)
      target.updatedAt = Date.now()
      return true
    }

    return {
      courses,
      activeCourses,
      sortedByTime,
      coursesOfSchedule,
      getById,
      detectConflicts,
      detectConflictsInSchedule,
      addCourse,
      updateCourse,
      removeCourse,
      toggleCompleted,
      setCompleted,
      togglePaid,
      setPaid,
      duplicateCourse,
      insertMany,
      removeByTemplateId,
      removeCoursesOfSchedule,
      replaceById,
      clearAll,
      addNote,
      updateNote,
      removeNote,
    }
  },
  {
    persist: true,
  },
)
