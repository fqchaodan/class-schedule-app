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
/** 前台轮询：让另一台设备/另一个账号的改动不需要退出重登就能看到 */
let pullTimer: ReturnType<typeof setInterval> | null = null
/** 本次同步的开始时间，用于回收「进程被杀导致 finally 未执行」留下的脏锁 */
let syncStartedAt = 0
/** 本机有尚未成功上传的改动：此时写者侧不能被服务端数据覆盖 */
let pendingLocalChange = false

/** 轮询间隔：数据量很小（一份快照），20s 足够接近实时，又不至于太费流量 */
const PULL_INTERVAL = 20_000
/** 同步锁超时：超过这个时长仍显示同步中，视为脏锁 */
const SYNC_LOCK_TIMEOUT = 40_000

/** 回收脏锁（老版本把 syncing 持久化过，升级后首次启动可能仍是 true） */
function releaseStaleLock(store: ReturnType<typeof useSyncStore>) {
  if (!store.syncing)
    return
  if (syncStartedAt && Date.now() - syncStartedAt < SYNC_LOCK_TIMEOUT)
    return
  console.warn('[sync] 发现残留的同步锁，已自动释放')
  store.syncing = false
}

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
  releaseStaleLock(store)
  if (store.syncing)
    return false
  store.syncing = true
  syncStartedAt = Date.now()
  try {
    const res = await saveSnapshot(store.account, snapshotInput())
    store.setServerVersion(res.version)
    store.markSynced()
    pendingLocalChange = false
    return true
  }
  catch (error) {
    // 上传失败时保留「有未上传改动」标记，避免下一轮轮询用旧的服务端数据覆盖本机编辑
    pendingLocalChange = true
    store.markFailed(error instanceof Error ? error.message : '保存失败')
    return false
  }
  finally {
    store.syncing = false
    syncStartedAt = 0
  }
}

export interface PullOptions {
  /** 强制用服务端覆盖本机（忽略版本号与本地待上传改动），仅用于手动「立即同步」 */
  force?: boolean
}

/**
 * 拉取服务端快照。
 * - 版本号没变：直接跳过，避免整份覆盖造成的无谓重渲染
 * - 写者有未上传改动：跳过，等推送成功后再拉，防止本地编辑被回滚
 */
export async function pullSnapshot(options: PullOptions = {}): Promise<boolean> {
  const store = useSyncStore()
  if (!store.loggedIn)
    return false
  releaseStaleLock(store)
  if (store.syncing)
    return false
  if (!options.force && !store.readOnly && pendingLocalChange)
    return false
  store.syncing = true
  syncStartedAt = Date.now()
  try {
    const snap = await fetchSnapshot(store.account)
    const unchanged = !options.force && snap.version === store.serverVersion
    if (unchanged) {
      store.markSynced()
      return false
    }
    applySnapshot(snap, !store.readOnly)
    store.setServerVersion(snap.version)
    store.markSynced()
    return true
  }
  catch (error) {
    store.markFailed(error instanceof Error ? error.message : '读取失败')
    return false
  }
  finally {
    store.syncing = false
    syncStartedAt = 0
  }
}

/** 手动立即同步：写者先上传本机改动；只读者强制用服务端数据刷新本机 */
export async function syncNow(): Promise<void> {
  const store = useSyncStore()
  if (!store.loggedIn)
    return
  if (store.readOnly) {
    await pullSnapshot({ force: true })
    return
  }
  const pushed = await pushSnapshot()
  if (pushed)
    await pullSnapshot()
}

/**
 * 前台轮询：登录后一直在跑，页面停留时也能收到对方的改动。
 * 写者侧只有在本机没有待上传改动时才会被服务端数据覆盖。
 */
export function startAutoPull(): void {
  stopAutoPull()
  const store = useSyncStore()
  if (!store.loggedIn)
    return
  void pullSnapshot()
  pullTimer = setInterval(() => {
    void pullSnapshot()
  }, PULL_INTERVAL)
}

export function stopAutoPull(): void {
  if (pullTimer) {
    clearInterval(pullTimer)
    pullTimer = null
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
    store.setServerVersion(snap.version)
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
  pendingLocalChange = false
  await hydrate()
  return role
}

export function logout() {
  stopAutoPull()
  pendingLocalChange = false
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
    pendingLocalChange = true
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
