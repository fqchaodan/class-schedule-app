/**
 * 带防抖的持久化存储（供 pinia-plugin-persistedstate 使用）
 *
 * 背景：插件默认每次状态变更都立即全量序列化并同步写盘
 * （uni.setStorageSync 在小程序 / APP 端是阻塞调用），
 * 连续操作（如批量勾选「已上 / 已收费」）会造成可感知的卡顿。
 *
 * 策略：300ms 内的多次写入合并为一次，并在应用进入后台（App onHide）
 * 时调用 flushPersistStorage() 强制落盘，把未落盘窗口压缩到可忽略。
 */

const DEBOUNCE_DELAY = 300

/** key -> 待写入的序列化字符串 */
const pending = new Map<string, string>()
let timer: ReturnType<typeof setTimeout> | null = null

/** 立即把待写数据全部落盘 */
function flush() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (pending.size === 0)
    return
  for (const [key, value] of pending) {
    try {
      uni.setStorageSync(key, value)
    }
    catch (e) {
      console.error('[persist] 写入本地存储失败：', key, e)
    }
  }
  pending.clear()
}

function schedule() {
  if (timer)
    return
  timer = setTimeout(flush, DEBOUNCE_DELAY)
}

export const debouncedStorage = {
  getItem(key: string): string | null {
    // 优先返回尚未落盘的值，避免「写入后立刻读取」拿到旧数据
    const pendingValue = pending.get(key)
    if (pendingValue !== undefined)
      return pendingValue
    try {
      const value = uni.getStorageSync(key)
      return value === '' || value == null ? null : String(value)
    }
    catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    pending.set(key, value)
    schedule()
  },
}

/** 应用进入后台 / 退出前调用，确保待写数据立即落盘 */
export function flushPersistStorage() {
  flush()
}
