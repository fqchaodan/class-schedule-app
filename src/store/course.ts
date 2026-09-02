import type { Course, CourseDraft, CourseNote, NoteType } from '@/types/course'
import { genId } from '@/types/course'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { findConflicts } from '@/utils/conflict'
import { addDays, courseCoversDay } from '@/utils/time'
import { useRecycleStore } from './recycle'

export type { CourseDraft }

export const useCourseStore = defineStore(
  'course',
  () => {
    const courses = ref<Course[]>([])

    // ---------- 查询 ----------
    const getById = (id: string) => courses.value.find(c => c.id === id)

    const sortedByTime = computed(() =>
      [...courses.value].sort((a, b) =>
        a.startDate === b.startDate
          ? a.startTime.localeCompare(b.startTime)
          : a.startDate.localeCompare(b.startDate),
      ),
    )

    /** 某天覆盖的课程（按开始时间排序） */
    function coursesOnDay(day: string): Course[] {
      return sortedByTime.value.filter(c => courseCoversDay(c.startDate, c.endDate, day))
    }

    /** 搜索：课程名 / 学生名模糊匹配；weekday 为 0-6（可选） */
    function search(keyword = '', weekday?: number): Course[] {
      const kw = keyword.trim().toLowerCase()
      return sortedByTime.value.filter((c) => {
        if (weekday != null) {
          const startDow = new Date(`${c.startDate}T00:00:00`).getDay()
          const endDow = new Date(`${c.endDate}T00:00:00`).getDay()
          // 跨天课程：只要起止区间包含该星期即算（简化处理）
          if (startDow !== weekday && endDow !== weekday)
            return false
        }
        if (!kw)
          return true
        return (
          (c.name ?? '').toLowerCase().includes(kw)
          || (c.studentName ?? '').toLowerCase().includes(kw)
        )
      })
    }

    // ---------- 冲突 ----------
    /** 检测冲突（不写入） */
    function detectConflicts(draft: CourseDraft, excludeId?: string) {
      return findConflicts(courses.value, draft, excludeId)
    }

    // ---------- CRUD ----------
    /** 新增课程；force=true 时忽略冲突直接保存。返回冲突列表（有冲突且未 force 时不保存） */
    function addCourse(draft: CourseDraft, force = false): Course[] {
      const conflicts = detectConflicts(draft)
      if (conflicts.length > 0 && !force)
        return conflicts
      const now = Date.now()
      const course: Course = {
        id: genId(),
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
      const shift = (d: string) => addDays(d, 7)
      return {
        studentName: source.studentName,
        name: source.name,
        startDate: shift(source.startDate),
        endDate: shift(source.endDate),
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
      sortedByTime,
      getById,
      coursesOnDay,
      search,
      detectConflicts,
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
