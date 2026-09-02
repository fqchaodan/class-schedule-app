<script setup lang="ts">
import type { Course } from '@/types/course'

const props = defineProps<{
  visible: boolean
  conflicts: Course[]
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const shown = computed(() => props.conflicts.slice(0, 5))
const moreCount = computed(() => Math.max(0, props.conflicts.length - 5))
</script>

<template>
  <wd-popup
    :model-value="visible"
    position="center"
    :close-on-click-modal="false"
    @close="emit('cancel')"
  >
    <view class="w-320px rounded-2xl bg-white p-5">
      <view class="flex items-center gap-2.5">
        <view class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-red-50">
          <view class="i-carbon-warning-alt text-lg text-red-500" />
        </view>
        <text class="txt-heading">发现 {{ conflicts.length }} 条时间冲突</text>
      </view>
      <view class="mt-3 max-h-60 overflow-y-auto border border-red-100 rounded-xl bg-red-50/60 p-3">
        <view v-for="c in shown" :key="c.id" class="mb-1 text-xs text-gray-700 leading-5">
          「{{ c.studentName || c.name || '未命名课程' }}」{{ c.startDate }} {{ c.startTime }}-{{ c.endTime }}
        </view>
        <view v-if="moreCount > 0" class="text-xs text-gray-400">
          ...等共 {{ conflicts.length }} 条
        </view>
      </view>
      <view class="mt-4 flex gap-3">
        <wd-button variant="plain" block @click="emit('cancel')">
          返回修改
        </wd-button>
        <wd-button block type="danger" @click="emit('confirm')">
          仍要保存
        </wd-button>
      </view>
    </view>
  </wd-popup>
</template>
