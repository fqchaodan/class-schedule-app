<script setup lang="ts">
import type { Course } from '@/types/course'
import { computed, onMounted, ref } from 'vue'
import { WEEKDAY_LABELS } from '@/types/course'
import { addWeeks, shortDate, timeToMinutes, today, weekDays, weekStart } from '@/utils/time'
import { safeAreaBottom, statusBarHeight } from '@/utils/systemInfo'

definePage({
  style: {
    navigationBarTitleText: '每周看板',
  },
})

const courseStore = useCourseStore()

// ---------- 周导航 ----------
const curWeekStart = ref(weekStart())
const days = computed(() => weekDays(curWeekStart.value))
const weekLabel = computed(() => `${shortDate(days.value[0])} - ${shortDate(days.value[6])}`)
function prevWeek() {
  curWeekStart.value = addWeeks(curWeekStart.value, -1)
}
function nextWeek() {
  curWeekStart.value = addWeeks(curWeekStart.value, 1)
}
function goToday() {
  curWeekStart.value = weekStart()
}

// 表头顺序：周一 ~ 周日
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const dayNames = computed(() => DAY_ORDER.map(d => WEEKDAY_LABELS[d]))
function isTodayIdx(i: number) {
  return days.value[i] === today()
}

// ---------- 看板参数 ----------
const DAY_START = 6 // 06:00
const DAY_END = 24 // 24:00
const HOUR_HEIGHT = 56 // 每小时高度 px
const TIME_AXIS_WIDTH = 52 // 时间轴宽度 px
const BASE_COL_WIDTH = 120 // 基础列宽 px
const ZOOM_LEVELS = [0.5, 0.65, 0.8, 1, 1.2, 1.4, 1.6, 2]
const zoomIdx = ref(1)
const zoom = computed(() => ZOOM_LEVELS[zoomIdx.value])
const colWidth = computed(() => Math.round(BASE_COL_WIDTH * zoom.value))
const totalHeight = computed(() => (DAY_END - DAY_START) * HOUR_HEIGHT)
const totalWidth = computed(() => TIME_AXIS_WIDTH + colWidth.value * 7)
const hourLabels = computed(() => {
  const list: string[] = []
  for (let h = DAY_START; h < DAY_END; h++)
    list.push(`${String(h).padStart(2, '0')}:00`)
  return list
})
const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`)
function zoomOut() {
  zoomIdx.value = Math.max(0, zoomIdx.value - 1)
}
function zoomIn() {
  zoomIdx.value = Math.min(ZOOM_LEVELS.length - 1, zoomIdx.value + 1)
}

// ---------- 课程定位 ----------
function coursesOnDay(day: string): Course[] {
  return courseStore.coursesOnDay(day)
}
function courseTop(c: Course): number {
  const m = Math.max(timeToMinutes(c.startTime), DAY_START * 60)
  return ((m - DAY_START * 60) / 60) * HOUR_HEIGHT
}
function courseHeight(c: Course): number {
  const s = Math.max(timeToMinutes(c.startTime), DAY_START * 60)
  const e = Math.min(timeToMinutes(c.endTime), DAY_END * 60)
  return Math.max(34, ((e - s) / 60) * HOUR_HEIGHT,
  )
}

// ---------- 学生配色 ----------
const STUDENT_COLORS = [
  { bar: 'border-indigo-500', bg: 'bg-indigo-50' },
  { bar: 'border-sky-500', bg: 'bg-sky-50' },
  { bar: 'border-emerald-500', bg: 'bg-emerald-50' },
  { bar: 'border-amber-500', bg: 'bg-amber-50' },
  { bar: 'border-rose-500', bg: 'bg-rose-50' },
  { bar: 'border-violet-500', bg: 'bg-violet-50' },
]
function colorOf(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++)
    h = (h * 31 + name.charCodeAt(i)) >>> 0
  return STUDENT_COLORS[h % STUDENT_COLORS.length]
}
function cColor(c: Course) {
  return colorOf(c.studentName || c.name || '未命名')
}

const weekTotal = computed(() => days.value.reduce((n, d) => n + courseStore.coursesOnDay(d).length, 0))

// ---------- 横屏模式 ----------
// H5 端：CSS 旋转 + 全屏 API（浏览器不支持强制锁屏，用 CSS transform 模拟横屏）
// APP 端：plus.screen.lockOrientation 物理横屏，不需要 CSS 旋转（双重旋转会只显示部分内容）
const isLandscape = ref(false)

// H5 端 CSS 旋转所需的视口尺寸
const viewportW = ref(0)
const viewportH = ref(0)
function readViewport() {
  const info = uni.getSystemInfoSync()
  viewportW.value = info.windowWidth
  viewportH.value = info.windowHeight
}
readViewport()
onMounted(() => {
  // 监听窗口尺寸变化（旋转设备时更新）
  uni.onWindowResize?.(() => readViewport())
})

// H5 端横屏时容器的 CSS 旋转样式（APP 端用物理横屏，不需要 CSS 旋转）
const landscapeStyle = computed(() => {
  if (!isLandscape.value)
    return {}
  // #ifdef H5
  // 旋转 90° 后，宽高互换
  const w = viewportW.value
  const h = viewportH.value
  return {
    'width': `${h}px`,
    'height': `${w}px`,
    'transform': 'rotate(90deg)',
    'transform-origin': '0 0',
    'position': 'fixed' as const,
    'top': '0',
    'left': `${w}px`,
    'z-index': '1001',
  }
  // #endif
  // #ifndef H5
  // APP 端：物理横屏后页面自然变宽，无需 CSS 旋转
  return {}
  // #endif
})

async function rotateScreen() {
  if (isLandscape.value) {
    isLandscape.value = false
    // #ifdef APP-PLUS
    plus.screen.unlockOrientation?.()
    // #endif
    // #ifdef H5
    try {
      if (document.fullscreenElement)
        await document.exitFullscreen?.()
    }
    catch {
      // 退出全屏失败也不影响
    }
    // #endif
    return
  }
  readViewport()
  isLandscape.value = true
  // #ifdef APP-PLUS
  plus.screen.lockOrientation?.('landscape-primary')
  // #endif
  // #ifdef H5
  // 尝试进入全屏 + 锁定方向（失败也不影响 CSS 旋转效果）
  try {
    const orient = (screen as any).orientation
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.()
      orient?.lock?.('landscape')
    }
  }
  catch {
    // CSS 旋转方案兜底，无需提示
  }
  // #endif
}

// ---------- 操作 ----------
function openDetail(course: Course) {
  uni.navigateTo({ url: `/pages/course/detail?id=${course.id}` })
}
function openEdit() {
  uni.navigateTo({ url: '/pages/course/edit' })
}
</script>

<template>
  <view class="h-screen flex flex-col overflow-hidden bg-gray-50">
    <!-- 横屏模式：旋转容器 -->
    <view :style="landscapeStyle" class="flex flex-col overflow-hidden bg-gray-50">
      <!-- 标题行（与首页统一风格） -->
      <view class="shrink-0 from-indigo-50 to-white bg-gradient-to-b" :style="{ paddingTop: `${statusBarHeight}px` }">
        <view class="h-44px flex items-center justify-between px-4">
          <view class="flex items-center gap-2">
            <view class="i-carbon-calendar-heat-map text-lg text-indigo-500" />
            <text class="text-lg text-gray-900 font-bold">
              每周看板
            </text>
          </view>
        </view>
      </view>
      <!-- 工具条：周导航 + 缩放（固定） -->
      <view class="shrink-0 border-b border-gray-100 bg-white px-3 pb-2 pt-2 shadow-sm">
        <view class="flex items-center justify-between">
          <view class="flex items-center gap-0.5">
            <wd-button variant="text" size="small" icon="left" @click="prevWeek" />
            <view class="min-w-20 text-center text-xs text-gray-800 font-medium">
              {{ weekLabel }}
            </view>
            <wd-button variant="text" size="small" icon="right" @click="nextWeek" />
            <wd-button variant="text" size="small" @click="goToday">
              今天
            </wd-button>
          </view>
          <view class="flex items-center gap-1.5">
            <wd-button
              variant="text"
              size="small"
              :class="isLandscape ? 'rotate-180' : ''"
              icon="rotate-right"
              @click="rotateScreen"
            />
            <view class="flex items-center overflow-hidden border border-gray-200 rounded-full">
              <wd-button variant="text" size="small" icon="zoom-out" @click="zoomOut" />
              <view class="min-w-10 text-center text-xs text-gray-700">
                {{ zoomPercent }}
              </view>
              <wd-button variant="text" size="small" icon="zoom-in" @click="zoomIn" />
            </view>
          </view>
        </view>
      </view>

      <!-- 看板区：双向滚动 -->
      <view class="h-0 min-h-0 flex flex-1 flex-col overflow-hidden" :style="{ paddingBottom: `${50 + safeAreaBottom}px` }">
        <scroll-view scroll-x scroll-y class="h-full overflow-hidden">
          <view class="relative overflow-hidden" :style="{ width: `${totalWidth}px` }">
            <!-- 表头 -->
            <view class="sticky top-0 z-20 flex">
              <view class="sticky left-0 z-30 border-b border-r border-gray-200 bg-gray-50" :style="{ width: `${TIME_AXIS_WIDTH}px`, height: '44px' }" />
              <view
                v-for="(name, i) in dayNames"
                :key="i"
                class="shrink-0 border-b border-r border-gray-200 bg-white py-1.5 text-center"
                :style="{ width: `${colWidth}px` }"
              >
                <view class="text-xs font-medium" :class="isTodayIdx(i) ? 'text-indigo-600' : 'text-gray-700'">
                  {{ name }}
                </view>
                <view class="text-2xs" :class="isTodayIdx(i) ? 'text-indigo-500' : 'text-gray-400'">
                  {{ shortDate(days[i]) }}
                </view>
              </view>
            </view>

            <!-- 主体 -->
            <view class="flex">
              <!-- 时间轴 -->
              <view class="sticky left-0 z-10 bg-gray-50" :style="{ width: `${TIME_AXIS_WIDTH}px`, height: `${totalHeight}px` }">
                <view
                  v-for="(label, idx) in hourLabels"
                  :key="label"
                  class="absolute right-1 text-2xs text-gray-400"
                  :style="{ top: `${idx * HOUR_HEIGHT + 2}px` }"
                >
                  {{ label }}
                </view>
              </view>

              <!-- 7 列区域 -->
              <view class="relative" :style="{ width: `${colWidth * 7}px`, height: `${totalHeight}px` }">
                <view
                  v-for="i in 7"
                  :key="`col-${i}`"
                  class="absolute top-0 h-full border-r border-gray-100 bg-white"
                  :style="{ left: `${(i - 1) * colWidth}px`, width: `${colWidth}px` }"
                />
                <view
                  v-for="(label, idx) in hourLabels"
                  :key="`line-${label}`"
                  class="absolute left-0 right-0 border-t border-gray-100"
                  :style="{ top: `${(idx + 1) * HOUR_HEIGHT}px` }"
                />
                <template v-for="(day, i) in days" :key="day">
                  <view
                    v-for="c in coursesOnDay(day)"
                    :key="c.id"
                    class="absolute z-20 overflow-hidden border-l-2 rounded-lg px-1.5 py-1 shadow-sm"
                    :class="[cColor(c).bg, cColor(c).bar]"
                    :style="{
                      left: `${i * colWidth + 3}px`,
                      top: `${courseTop(c) + 3}px`,
                      width: `${colWidth - 6}px`,
                      height: `${courseHeight(c) - 6}px`,
                    }"
                    @click="openDetail(c)"
                  >
                    <view class="truncate pr-3 text-xs text-gray-800 font-medium leading-tight">
                      {{ c.studentName || '未命名' }}
                    </view>
                    <view class="text-2xs text-gray-500 leading-tight">
                      {{ c.startTime }}-{{ c.endTime }}
                    </view>
                    <view
                      class="absolute right-1 top-1 status-dot"
                      :class="c.completed ? 'bg-emerald-400' : 'bg-amber-400'"
                    />
                  </view>
                </template>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 整周无课提示 -->
      <view v-if="weekTotal === 0" class="pointer-events-none absolute inset-x-0 top-1/2 z-30 text-center text-sm text-gray-400 -translate-y-1/2">
        本周暂无课程，点击右下角新增
      </view>

      <!-- 新增按钮 -->
      <wd-fab
        :expandable="false"
        position="right-bottom"
        :gap="{ bottom: 80, right: 16 }"
        :z-index="9"
        @click="openEdit"
      />
    </view>
  </view>
</template>

<style scoped>
/* 横屏模式：确保旋转容器层级高于 tabbar(z-index:1000) */
view[style*='z-index: 1001'] {
  z-index: 1001 !important;
}
</style>
