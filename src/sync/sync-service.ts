import type { Role, ServerSnapshot, SnapshotInput } from '@/api/sync'
import { DEFAULT_SETTINGS } from '@/types/course'
import { fetchSnapshot, getMe, saveSnapshot } from '@/api/sync'
import { useAppStore } from '@/store/app'
import { useCourseStore } from '@/store/course'
import { useRecycleStore } from '@/store/recycle'
import { useScheduleStore } from '@/store/schedule'
import { useSyncStore } from '@/store/sync'
import { useTemplateStore } from '@/store/template'

/**
 * 云同步（服务端权威，单写者 + 只读观看者）
 * - hydrate：登录/启动时以服务端 D1 为准水合本机；服务端为空则把本机现有数据上迁
 * - pushSnapshot：写者改动后自动把整份数据 upsert 到 D1
 * - applySnapshot：用服务端数据整份覆盖本机 store
 * 不再有手动「推送/拉取」按钮；观看者只读，永不推送。
 */

/** 抑制窗口：应用服务端数据时，避免触发 $subscribe 反向回推 */
let applyingUntil = 0
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let autoSyncInstalled = false

/** 从各 store 收集当前完整数据 */
export function snapshotInput(): SnapshotInput {
  return {
    schedules: useScheduleStore().schedules,
    courses: useCourseStore().courses,
    templates: useTemplateStore().templates,
    recycle: useRecycleStore().items,
    settings: useAppStore().settings,
  }
}

/** 用服务端快照整份覆盖本机 store；preserveLocalRecycle=true 时保留本机回收站条目（写者登录用） */
export function applySnapshot(snap: ServerSnapshot, preserveLocalRecycle = false) {
  applyingUntil = Date.now() + 1500
  const scheduleStore = useScheduleStore()
  const courseStore = useCourseStore()
  const templateStore = useTemplateStore()
  const recycleStore = useRecycleStore()
  const appStore = useAppStore()

  scheduleStore.schedules = snap.schedules ?? []
  scheduleStore.ensureValid()
  courseStore.courses = snap.courses ?? []
  templateStore.templates = snap.templates ?? []
  const serverRecycle = snap.recycle ?? []
  if (preserveLocalRecycle) {
    const merged = [...serverRecycle]
    for (const item of recycleStore.items) {
      if (item?.course?.id && !merged.some(m => m?.course?.id === item.course.id))
        merged.push(item)
    }
    recycleStore.items = merged
  }
  else {
    recycleStore.items = serverRecycle
  }
  appStore.settings = { ...DEFAULT_SETTINGS, ...(snap.settings ?? {}) }
}

/**
 * 本机数据里最新的"真实编辑"时间戳（课程/模板/回收站）。
 * 不含课表：默认课表在 store 初始化时会自动打上当前时间，作为新鲜度信号不可靠。
 */
function localLatestUpdatedAt(): number {
  let max = 0
  for (const c of useCourseStore().courses) max = Math.max(max, c.updatedAt || 0)
  for (const t of useTemplateStore().templates) max = Math.max(max, t.updatedAt || 0)
  for (const r of useRecycleStore().items) max = Math.max(max, r.deletedAt || 0)
  return max
}

export async function pushSnapshot(): Promise<boolean> {
  const store = useSyncStore()
  if (!store.loggedIn || store.readOnly)
    return false
  if (store.syncing)
    return false
  store.syncing = true
  try {
    await saveSnapshot(store.account, snapshotInput())
    store.markSynced()
    return true
  }
  catch (error) {
    store.markFailed(error instanceof Error ? error.message : '保存失败')
    return false
  }
  finally {
    store.syncing = false
  }
}

export async function pullSnapshot(): Promise<boolean> {
  const store = useSyncStore()
  if (!store.loggedIn)
    return false
  if (store.syncing)
    return false
  store.syncing = true
  try {
    const snap = await fetchSnapshot(store.account)
    applySnapshot(snap)
    store.markSynced()
    return true
  }
  catch (error) {
    store.markFailed(error instanceof Error ? error.message : '读取失败')
    return false
  }
  finally {
    store.syncing = false
  }
}

/**
 * 启动/登录水合（防止旧数据覆盖服务端）：
 * - 只读账号：直接以服务端为准覆盖本机。
 * - 写者设备：仅当本机数据比服务端「更新」时（本机最新 updatedAt > 服务端 updatedAt）才上迁；
 *   否则以服务端为准覆盖本机（保留本机回收站条目）。全新空设备同理直接拉取。
 */
export async function hydrate(): Promise<void> {
  const store = useSyncStore()
  if (!store.loggedIn)
    return
  try {
    const snap = await fetchSnapshot(store.account)
    if (store.readOnly) {
      applySnapshot(snap)
      return
    }
    const localHasData = useCourseStore().courses.length > 0
      || useTemplateStore().templates.length > 0
      || useRecycleStore().items.length > 0
    const localNewer = localHasData && localLatestUpdatedAt() > (snap.updatedAt || 0)
    if (localNewer)
      await pushSnapshot()
    else
      applySnapshot(snap, true)
  }
  catch (error) {
    store.markFailed(error instanceof Error ? error.message : '同步失败')
  }
}

/** 登录：校验账号 → 建立会话 → 水合数据。返回角色 */
export async function login(account: string): Promise<Role> {
  const store = useSyncStore()
  const trimmed = account.trim()
  if (!trimmed)
    throw new Error('请输入账号')
  const role = await getMe(trimmed)
  store.setSession(trimmed, role)
  await hydrate()
  return role
}

export function logout() {
  useSyncStore().logout()
}

/** 安装自动同步：任一 store 变更后防抖上传（仅写者、非水合期） */
export function setupAutoSync() {
  if (autoSyncInstalled)
    return
  autoSyncInstalled = true

  const schedulePush = () => {
    const store = useSyncStore()
    if (!store.loggedIn || store.readOnly)
      return
    if (Date.now() < applyingUntil)
      return
    if (debounceTimer)
      clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      void pushSnapshot()
    }, 800)
  }

  useCourseStore().$subscribe(schedulePush)
  useTemplateStore().$subscribe(schedulePush)
  useScheduleStore().$subscribe(schedulePush)
  useRecycleStore().$subscribe(schedulePush)
  useAppStore().$subscribe(schedulePush)
}
