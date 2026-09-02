import type { Course, RecycleItem } from '@/types/course'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRecycleStore = defineStore(
  'recycle',
  () => {
    const items = ref<RecycleItem[]>([])

    /** 删除时推入快照 */
    function push(course: Course) {
      items.value.push({ course, deletedAt: Date.now() })
    }

    /** 恢复到课程列表，返回恢复的课程；若恢复时与现有课程冲突由调用方决定提示 */
    function restore(id: string): Course | null {
      const idx = items.value.findIndex(i => i.course.id === id)
      if (idx < 0)
        return null
      const [item] = items.value.splice(idx, 1)
      return item.course
    }

    function purge(id: string) {
      items.value = items.value.filter(i => i.course.id !== id)
    }

    function clear() {
      items.value = []
    }

    return { items, push, restore, purge, clear }
  },
  {
    persist: true,
  },
)
