<script setup lang="ts">
import type { Course } from '@/types/course'
import { avatarGradient } from '@/utils/avatar'
import { durationHours, formatDateTime } from '@/utils/time'
import { safeAreaBottom } from '@/utils/systemInfo'
import { lightTap } from '@/utils/feedback'
import { useDialog, useToast } from '@wot-ui/ui'

definePage({
  style: {
    navigationBarTitleText: '回收站',
  },
})

const recycleStore = useRecycleStore()
const courseStore = useCourseStore()
const dialog = useDialog()
const toast = useToast()

const items = computed(() =>
  [...recycleStore.items].sort((a, b) => b.deletedAt - a.deletedAt),
)

function titleOf(course: Course) {
  return course.studentName || course.name || '未命名课程'
}

/** 头像渐变（与 CourseCard 同一 hash 规则） */
function avatarClsOf(course: Course) {
  return avatarGradient(titleOf(course))
}

function restore(item: { course: Course }) {
  lightTap()
  const conflicts = courseStore.detectConflicts(item.course, item.course.id)
  const doRestore = () => {
    courseStore.insertMany([item.course])
    recycleStore.purge(item.course.id)
    toast.success('已恢复')
  }
  if (conflicts.length > 0) {
    dialog
      .confirm({
        title: '时间冲突提醒',
        msg: `恢复后与 ${conflicts.length} 条现有课程时间冲突，仍要恢复？`,
      })
      .then(() => {
        doRestore()
      })
      .catch(() => {})
  }
  else {
    doRestore()
  }
}

function purge(item: { course: Course }) {
  lightTap()
  dialog
    .confirm({
      title: '彻底删除',
      msg: `彻底删除「${titleOf(item.course)}」？此操作不可恢复。`,
      confirmButtonColor: '#ef4444',
    })
    .then(() => {
      recycleStore.purge(item.course.id)
      toast.show('已删除')
    })
    .catch(() => {})
}

function clearAll() {
  if (recycleStore.items.length === 0)
    return
  lightTap()
  dialog
    .confirm({
      title: '清空回收站',
      msg: `彻底删除回收站全部 ${recycleStore.items.length} 条课程？此操作不可恢复。`,
      confirmButtonColor: '#ef4444',
    })
    .then(() => {
      recycleStore.clear()
      toast.show('已清空')
    })
    .catch(() => {})
}
</script>

<template>
  <view class="h-screen flex flex-col overflow-hidden bg-gray-50">
    <!-- 自定义导航栏 -->
    <NavBar title="回收站" />
    <!-- 滚动内容区 -->
    <view class="h-0 min-h-0 flex-1 overflow-y-auto px-3 pt-3" :style="{ paddingBottom: `${safeAreaBottom}px` }">
      <wd-empty
        v-if="items.length === 0"
        tip="回收站是空的"
        icon="delete"
      />

      <template v-else>
        <view class="flex items-center justify-between px-1 pb-2 pt-3">
          <text class="text-xs text-gray-400">共 {{ items.length }} 条</text>
          <wd-button type="danger" size="small" variant="text" @click="clearAll">
            清空
          </wd-button>
        </view>
        <view v-for="item in items" :key="item.course.id" class="mb-2 card w-full overflow-hidden p-3">
          <view class="flex items-center gap-3">
            <view
              class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm text-white font-medium opacity-70"
              :class="avatarClsOf(item.course)"
            >
              {{ titleOf(item.course).slice(0, 1) }}
            </view>
            <view class="min-w-0 flex-1">
              <view class="flex items-center gap-2">
                <text class="truncate text-sm text-gray-800 font-semibold">{{ titleOf(item.course) }}</text>
                <text v-if="item.course.name && item.course.studentName" class="truncate text-xs text-gray-400">{{ item.course.name }}</text>
              </view>
              <view class="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-gray-500">
                <text>{{ item.course.startDate }} ~ {{ item.course.endDate }}</text>
                <text class="text-gray-300">·</text>
                <text>{{ item.course.startTime }}-{{ item.course.endTime }}（{{ durationHours(item.course.startTime, item.course.endTime) }}h）</text>
              </view>
            </view>
          </view>
          <view class="mt-2.5 flex items-center justify-between">
            <text class="text-2xs text-gray-400">{{ formatDateTime(item.deletedAt) }} 删除</text>
            <view class="flex gap-2">
              <wd-button size="small" variant="plain" @click="purge(item)">
                彻底删除
              </wd-button>
              <wd-button size="small" type="primary" @click="restore(item)">
                恢复
              </wd-button>
            </view>
          </view>
        </view>
      </template>
    </view>

    <wd-dialog />
    <wd-toast />
  </view>
</template>
