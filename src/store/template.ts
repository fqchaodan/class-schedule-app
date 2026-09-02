import type { Course, CourseDraft, CourseTemplate } from '@/types/course'
import { genId } from '@/types/course'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dayjs, weekStart } from '@/utils/time'

export const useTemplateStore = defineStore(
  'template',
  () => {
    const templates = ref<CourseTemplate[]>([])

    const getById = (id: string) => templates.value.find(t => t.id === id)

    function addTemplate(data: Omit<CourseTemplate, 'id' | 'createdAt' | 'updatedAt'>): CourseTemplate {
      const now = Date.now()
      const tpl: CourseTemplate = { ...data, id: genId(), createdAt: now, updatedAt: now }
      templates.value.push(tpl)
      return tpl
    }

    function updateTemplate(id: string, data: Partial<CourseTemplate>) {
      const target = getById(id)
      if (!target)
        return
      Object.assign(target, data, { updatedAt: Date.now() })
    }

    function removeTemplate(id: string) {
      templates.value = templates.value.filter(t => t.id !== id)
    }

    /**
     * 将一节课程保存为「课程模板」（kind=course），模板名直接取学生姓名。
     * 同名学生已存在同名模板时覆盖更新，避免重复堆积。
     */
    function saveCourseAsTemplate(data: {
      studentName: string
      courseName?: string
      meetingUrl?: string
      startTime: string
      endTime: string
      fee?: number
    }): CourseTemplate {
      const base = {
        kind: 'course' as const,
        name: data.studentName,
        studentName: data.studentName,
        courseName: data.courseName,
        meetingUrl: data.meetingUrl,
        startTime: data.startTime,
        endTime: data.endTime,
        fee: data.fee,
      }
      const existing = templates.value.find(t => t.kind === 'course' && t.studentName === data.studentName)
      if (existing) {
        Object.assign(existing, base, { weekdays: [], weeks: 1, enabled: true, updatedAt: Date.now() })
        return existing
      }
      return addTemplate({ ...base, weekdays: [], weeks: 1, enabled: true })
    }

    /**
     * 根据模板预生成课程实例（预览用，不落库）
     * 从 startDate（默认当前周的周一）起，连续 weeks 周，
     * 在 weekdays 内的每天生成一节单日课程。
     */
    function buildCourses(tpl: CourseTemplate, weeksOverride?: number): CourseDraft[] {
      const weeks = weeksOverride ?? tpl.weeks
      const base = tpl.startDate ? dayjs(tpl.startDate) : dayjs(weekStart())
      const start = dayjs(weekStart(base))
      const drafts: CourseDraft[] = []
      for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < 7; d++) {
          const day = start.add(w * 7 + d, 'day')
          if (!tpl.weekdays.includes(day.day()))
            continue
          const date = day.format('YYYY-MM-DD')
          drafts.push({
            studentName: tpl.studentName ?? '',
            name: tpl.name,
            startDate: date,
            endDate: date,
            startTime: tpl.startTime,
            endTime: tpl.endTime,
            fee: tpl.fee,
            templateId: tpl.id,
          })
        }
      }
      return drafts
    }

    return {
      templates,
      getById,
      addTemplate,
      updateTemplate,
      removeTemplate,
      saveCourseAsTemplate,
      buildCourses,
    }
  },
  {
    persist: true,
  },
)

/** 把 CourseDraft 批量转成 Course（生成确认后使用） */
export function draftsToCourses(drafts: CourseDraft[]): Course[] {
  const now = Date.now()
  return drafts.map(d => ({
    id: genId(),
    studentName: d.studentName,
    name: d.name,
    startDate: d.startDate,
    endDate: d.endDate,
    startTime: d.startTime,
    endTime: d.endTime,
    fee: d.fee,
    meetingUrl: d.meetingUrl,
    notes: d.notes ?? [],
    templateId: d.templateId,
    createdAt: now,
    updatedAt: now,
  }))
}
