<script setup lang="ts">
/**
 * 全站统一状态徽标（替代各页散落的 wd-tag 状态用法）
 * 语义色固定：
 * - attended/pending：已上（indigo）/ 未上（中性灰）
 * - paid/unpaid：已收费（emerald）/ 未收费（amber）
 * - conflict：时间冲突（red）
 * - info/neutral：中性标签
 */
withDefaults(defineProps<{
  tone?: 'attended' | 'pending' | 'paid' | 'unpaid' | 'conflict' | 'info' | 'neutral'
}>(), {
  tone: 'neutral',
})

const emit = defineEmits<{
  click: [event: unknown]
}>()

const TONE_CLS: Record<string, string> = {
  attended: 'bg-indigo-50 text-indigo-600',
  pending: 'bg-gray-100 text-gray-500',
  paid: 'bg-emerald-50 text-emerald-600',
  unpaid: 'bg-amber-50 text-amber-600',
  conflict: 'bg-red-50 text-red-500',
  info: 'bg-sky-50 text-sky-600',
  neutral: 'bg-gray-100 text-gray-500',
}
</script>

<template>
  <view
    class="h-5 inline-flex shrink-0 items-center rounded-md px-2 text-2xs font-medium"
    :class="TONE_CLS[tone]"
    @click="emit('click', $event)"
  >
    <slot />
  </view>
</template>
