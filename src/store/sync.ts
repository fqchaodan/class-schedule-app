import type { ExportFile, RecycleItem } from '@/types/course'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * 云同步状态（手动推送/拉取模式）。
 * 用户名是云端数据键；本机按用户名各存一份数据快照（切换用户名时换入换出）。
 */
export const useSyncStore = defineStore(
  'sync',
  () => {
    const username = ref('')
    const activeDataUsername = ref('')
    const localProfiles = ref<Record<string, { data: ExportFile, recycle: RecycleItem[] }>>({})
    const lastSyncAt = ref(0)
    const lastSyncError = ref('')
    const syncing = ref(false)

    const configured = computed(() => username.value.trim().length > 0)

    function setActiveDataUsername(name: string) {
      activeDataUsername.value = name
    }

    function saveLocalProfile(name: string, data: ExportFile, recycle: RecycleItem[]) {
      localProfiles.value = { ...localProfiles.value, [name]: { data, recycle } }
    }

    function markSynced() {
      lastSyncAt.value = Date.now()
      lastSyncError.value = ''
    }

    function markFailed(message: string) {
      lastSyncError.value = message
    }

    return {
      username,
      activeDataUsername,
      localProfiles,
      lastSyncAt,
      lastSyncError,
      syncing,
      configured,
      setActiveDataUsername,
      saveLocalProfile,
      markSynced,
      markFailed,
    }
  },
  { persist: true },
)
