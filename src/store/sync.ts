import type { Role } from '@/api/sync'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * 会话与同步状态。
 * - 账号即访问凭证（两个固定账号：主账号=读写，只读账号=只读），登录后存本机。
 * - 数据以服务端 D1 为事实源；本机 store 作为工作副本，改动后自动上传。
 */
export const useSyncStore = defineStore(
  'sync',
  () => {
    const account = ref('')
    const role = ref<Role | ''>('')
    const lastSyncAt = ref(0)
    const lastSyncError = ref('')
    const syncing = ref(false)

    const loggedIn = computed(() => account.value.trim().length > 0 && role.value !== '')
    const readOnly = computed(() => role.value === 'viewer')
    const roleLabel = computed(() => role.value === 'writer' ? '主账号（读写）' : role.value === 'viewer' ? '只读账号' : '')

    function setSession(acc: string, r: Role) {
      account.value = acc.trim()
      role.value = r
    }

    function logout() {
      account.value = ''
      role.value = ''
      lastSyncAt.value = 0
      lastSyncError.value = ''
    }

    function markSynced() {
      lastSyncAt.value = Date.now()
      lastSyncError.value = ''
    }

    function markFailed(message: string) {
      lastSyncError.value = message
    }

    return {
      account,
      role,
      lastSyncAt,
      lastSyncError,
      syncing,
      loggedIn,
      readOnly,
      roleLabel,
      setSession,
      logout,
      markSynced,
      markFailed,
    }
  },
  { persist: true },
)
