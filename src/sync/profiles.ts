import type { ExportFile } from '@/types/course'
import { DEFAULT_SCHEDULE_ID } from '@/types/course'
import { useCourseStore } from '@/store/course'
import { useRecycleStore } from '@/store/recycle'
import { useScheduleStore } from '@/store/schedule'
import { useSyncStore } from '@/store/sync'
import { useTemplateStore } from '@/store/template'

function profileKey(username: string) {
  return username.trim().normalize('NFC').toLowerCase()
}

export function currentProfile(): ExportFile {
  return {
    app: 'teacher-schedule',
    schemaVersion: 1,
    exportedAt: Date.now(),
    courses: useCourseStore().courses,
    templates: useTemplateStore().templates,
    schedules: useScheduleStore().schedules,
  }
}

/** 切换本机数据到指定用户名：保存当前用户名快照，换入目标用户名的数据 */
export function switchLocalProfile(nextUsername: string) {
  const syncStore = useSyncStore()
  const next = profileKey(nextUsername)
  const current = syncStore.activeDataUsername
  if (next === current)
    return

  if (current) {
    syncStore.saveLocalProfile(current, currentProfile(), useRecycleStore().items)
  }
  else {
    // 首次配置用户名：沿用本机现有数据，而不是清空
    syncStore.setActiveDataUsername(next)
    return
  }

  const profile = syncStore.localProfiles[next]
  const courseStore = useCourseStore()
  const templateStore = useTemplateStore()
  const scheduleStore = useScheduleStore()
  const recycleStore = useRecycleStore()

  courseStore.courses = profile?.data.courses ?? []
  templateStore.templates = profile?.data.templates ?? []
  scheduleStore.schedules = profile?.data.schedules ?? [{
    id: DEFAULT_SCHEDULE_ID,
    name: '默认课表',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }]
  scheduleStore.activeId = DEFAULT_SCHEDULE_ID
  recycleStore.items = profile?.recycle ?? []
  scheduleStore.ensureValid()
  syncStore.setActiveDataUsername(next)
}
