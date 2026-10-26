<script setup lang="ts" generic="T extends string">
/**
 * 全站统一分段切换控件（统计页范围/分组、模板页分类共用一套外观）
 * 灰色轨道 + 白色选中 pill，替换 wd-segmented 在各页的不同样式
 */
import { lightTap } from '@/utils/feedback'

defineProps<{
  options: Array<{ value: T, label: string }>
}>()

const emit = defineEmits<{
  change: [value: T]
}>()

const modelValue = defineModel<T>({ required: true })

function select(value: T) {
  if (value === modelValue.value)
    return
  lightTap()
  modelValue.value = value
  emit('change', value)
}
</script>

<template>
  <view class="flex rounded-full bg-gray-200/60 p-0.5">
    <view
      v-for="opt in options"
      :key="opt.value"
      class="h-7 flex flex-1 items-center justify-center px-3 text-xs transition-colors active:opacity-70"
      :class="opt.value === modelValue
        ? 'bg-white text-indigo-600 font-semibold shadow-sm rounded-full'
        : 'text-gray-500 rounded-full'"
      @click="select(opt.value)"
    >
      {{ opt.label }}
    </view>
  </view>
</template>
