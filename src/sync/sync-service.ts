import type { Course, CourseTemplate, ExportFile } from '@/types/course'
import { DEFAULT_SCHEDULE_ID } from '@/types/course'
import { useCourseStore } from '@/store/course'
import { useScheduleStore } from '@/store/schedule'
import { useSyncStore } from '@/store/sync'
import { useTemplateStore } from '@/store/template'
import { fetchCloudBackup, saveCloudBackup } from '@/api/sync'

/**
 * 云同步服务（手动模式）：
 * - 推送 pushNow：把本机当前数据整份覆盖到云端（备份）
 * - 拉取 pullNow：用云端备份整份覆盖本机数据（恢复）
 * 方向由用户显式选择，不做自动同步与冲突仲裁。
 */

function currentBackup(): ExportFile {
  const courseStore = useCourseStore()
  const templateStore = useTemplateStore()
  const scheduleStore = useScheduleStore()
  return {
    app: 'teacher-schedule',
    schemaVersion: 1,
    exportedAt: Date.now(),
    courses: courseStore.courses,
    templates: templateStore.templates,
    schedules: scheduleStore.schedules,
  }
}

/** 用云端备份整份替换本机数据 */
function applyBackup(data: ExportFile) {
  const courseStore = useCourseStore()
  const templateStore = useTemplateStore()
  const scheduleStore = useScheduleStore()

  scheduleStore.schedules = data.schedules ?? []
  if (!scheduleStore.schedules.some(schedule => schedule.id === DEFAULT_SCHEDULE_ID)) {
    const now = Date.now()
    scheduleStore.schedules.unshift({ id: DEFAULT_SCHEDULE_ID, name: '默认课表', createdAt: now, updatedAt: now })
  }
  courseStore.courses = data.courses as Course[]
  templateStore.templates = data.templates as CourseTemplate[]
  scheduleStore.ensureValid()
}

let inFlight: Promise<boolean> | null = null

function guard(action: (username: string) => Promise<void>): Promise<boolean> {
  const syncStore = useSyncStore()
  const username = syncStore.username.trim().normalize('NFC').toLowerCase()
  if (!username) {
    syncStore.markFailed('请先填写用户名')
    return Promise.resolve(false)
  }
  if (inFlight)
    return inFlight

  inFlight = (async () => {
    syncStore.syncing = true
    try {
      await action(username)
      syncStore.markSynced()
      return true
    }
    catch (error) {
      syncStore.markFailed(error instanceof Error ? error.message : '同步失败')
      return false
    }
    finally {
      syncStore.syncing = false
      inFlight = null
    }
  })()
  return inFlight
}

/** 推送：把本机当前数据整份覆盖到云端 */
export function pushNow(): Promise<boolean> {
  return guard(async (username) => {
    await saveCloudBackup(username, currentBackup())
  })
}

/** 拉取：用云端备份整份覆盖本机数据；云端没有备份时给出提示 */
export function pullNow(): Promise<boolean> {
  return guard(async (username) => {
    const remote = await fetchCloudBackup(username)
    if (!remote)
      throw new Error('云端还没有备份数据')
    applyBackup(remote.backup)
  })
}
