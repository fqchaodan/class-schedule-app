import type { Schedule } from '@/types/course'
import { DEFAULT_SCHEDULE_ID, genId } from '@/types/course'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * 多课表管理：每张课表对应一位老师。
 * 课程通过 scheduleId 归属课表；未标记的课程一律视为默认课表（DEFAULT_SCHEDULE_ID）。
 */
export const useScheduleStore = defineStore(
  'schedule',
  () => {
    const schedules = ref<Schedule[]>([])
    const activeId = ref<string>(DEFAULT_SCHEDULE_ID)

    const activeSchedule = computed(() =>
      schedules.value.find(s => s.id === activeId.value) ?? schedules.value[0],
    )

    /** 确保默认课表存在且 activeId 有效（首次使用 / 持久化水合后状态异常时兜底修复） */
    function ensureValid() {
      if (!schedules.value.some(s => s.id === DEFAULT_SCHEDULE_ID)) {
        const now = Date.now()
        schedules.value.unshift({ id: DEFAULT_SCHEDULE_ID, name: '默认课表', createdAt: now, updatedAt: now })
      }
      if (!schedules.value.some(s => s.id === activeId.value))
        activeId.value = DEFAULT_SCHEDULE_ID
    }
    ensureValid()

    function createSchedule(name: string): Schedule {
      const now = Date.now()
      const s: Schedule = { id: genId(), name: name.trim(), createdAt: now, updatedAt: now }
      schedules.value.push(s)
      return s
    }

    function renameSchedule(id: string, name: string): boolean {
      const target = schedules.value.find(s => s.id === id)
      if (!target || !name.trim())
        return false
      target.name = name.trim()
      target.updatedAt = Date.now()
      return true
    }

    function switchTo(id: string): boolean {
      if (!schedules.value.some(s => s.id === id))
        return false
      activeId.value = id
      return true
    }

    /**
     * 删除课表。默认课表不可删；仍有课程的课表不可删（hasCourses 由调用方传入），
     * 避免回收站恢复时出现「归属已删除课表」的孤儿课程。
     */
    function removeSchedule(id: string, hasCourses: boolean): boolean {
      if (id === DEFAULT_SCHEDULE_ID)
        return false
      if (!schedules.value.some(s => s.id === id))
        return false
      if (hasCourses)
        return false
      schedules.value = schedules.value.filter(s => s.id !== id)
      if (activeId.value === id)
        activeId.value = schedules.value[0]?.id ?? DEFAULT_SCHEDULE_ID
      return true
    }

    /** 课表 id 是否存在（回收站恢复等场景校验用） */
    function exists(id: string | undefined): boolean {
      return id != null && schedules.value.some(s => s.id === id)
    }

    /** 清空全部数据时重置为初始状态：仅保留默认课表并切回它 */
    function reset() {
      const now = Date.now()
      schedules.value = [{ id: DEFAULT_SCHEDULE_ID, name: '默认课表', createdAt: now, updatedAt: now }]
      activeId.value = DEFAULT_SCHEDULE_ID
    }

    return {
      schedules,
      activeId,
      activeSchedule,
      ensureValid,
      createSchedule,
      renameSchedule,
      switchTo,
      removeSchedule,
      exists,
      reset,
    }
  },
  {
    persist: true,
  },
)
