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

/** 用服务端快照整份覆盖本机 store */
export function applySnapshot(snap: ServerSnapshot) {
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
  recycleStore.items = snap.recycle ?? []
  appStore.settings = { ...DEFAULT_SETTINGS, ...(snap.settings ?? {}) }
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
 * 启动/登录水合：
 * - 只读账号：直接以服务端为准覆盖本机。
 * - 写者设备：本机数据视为最新权威（含旧版离线编辑与回收站），登录时上迁 D1；
 *   仅当本机为空（全新设备）时才从服务端拉取。
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
    if (localHasData)
      await pushSnapshot()
    else
      applySnapshot(snap)
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
