import type { AppSettings } from '@/types/course'
import { DEFAULT_SETTINGS } from '@/types/course'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore(
  'app',
  () => {
    const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })

    function updateSettings(patch: Partial<AppSettings>) {
      settings.value = { ...settings.value, ...patch }
    }

    return { settings, updateSettings }
  },
  {
    persist: true,
  },
)
