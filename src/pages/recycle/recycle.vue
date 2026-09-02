<script setup lang="ts">
import type { Course } from '@/types/course'
import { avatarGradient } from '@/utils/avatar'
import { durationHours } from '@/utils/time'

definePage({
  style: {
    navigationBarTitleText: '回收站',
  },
})

const recycleStore = useRecycleStore()
const courseStore = useCourseStore()

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
  const conflicts = courseStore.detectConflicts(item.course, item.course.id)
  const doRestore = () => {
    courseStore.insertMany([item.course])
    recycleStore.purge(item.course.id)
    uni.showToast({ title: '已恢复', icon: 'success' })
  }
  if (conflicts.length > 0) {
    uni.showModal({
      title: '时间冲突提醒',
      content: `恢复后与 ${conflicts.length} 条现有课程时间冲突，仍要恢复？`,
      success: (res) => {
        if (res.confirm)
          doRestore()
      },
    })
  }
  else {
    doRestore()
  }
}

function purge(item: { course: Course }) {
  uni.showModal({
    title: '彻底删除',
    content: `彻底删除「${titleOf(item.course)}」？此操作不可恢复。`,
    confirmColor: '#ef4444',
    success: (res) => {
      if (res.confirm) {
        recycleStore.purge(item.course.id)
        uni.showToast({ title: '已删除', icon: 'none' })
      }
    },
  })
}

function clearAll() {
  if (recycleStore.items.length === 0)
    return
  uni.showModal({
    title: '清空回收站',
    content: `彻底删除回收站全部 ${recycleStore.items.length} 条课程？此操作不可恢复。`,
    confirmColor: '#ef4444',
    success: (res) => {
      if (res.confirm) {
        recycleStore.clear()
        uni.showToast({ title: '已清空', icon: 'none' })
      }
    },
  })
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString()
}
</script>

<template>
  <view class="h-screen flex flex-col overflow-hidden bg-gray-50">
    <!-- 自定义导航栏 -->
    <NavBar title="回收站" />
    <!-- 滚动内容区 -->
    <scroll-view scroll-y class="h-0 min-h-0 flex-1 px-3 pt-3 pb-safe">
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
        <view v-for="item in items" :key="item.course.id" class="card mb-2 p-3">
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
              <view class="mt-0.5 text-xs text-gray-500">
                {{ item.course.startDate }} ~ {{ item.course.endDate }} · {{ item.course.startTime }}-{{ item.course.endTime }}（{{ durationHours(item.course.startTime, item.course.endTime) }}h）
              </view>
            </view>
          </view>
          <view class="mt-2.5 flex items-center justify-between">
            <text class="text-2xs text-gray-400">{{ fmtTime(item.deletedAt) }} 删除</text>
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
    </scroll-view>
  </view>
</template>
