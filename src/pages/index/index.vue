<script setup lang="ts">
import type { Course } from '@/types/course'
import { isTimeOverlap } from '@/utils/conflict'
import { addWeeks, courseCoversDay, longDate, shortDate, today, weekDays, weekStart } from '@/utils/time'
import { safeAreaBottom, statusBarHeight } from '@/utils/systemInfo'
import { bottomBarHeight, isTablet, windowWidth } from '@/store/device'
import { lightTap } from '@/utils/feedback'
import { useDialog } from '@wot-ui/ui/components/wd-dialog'
import { useToast } from '@wot-ui/ui/components/wd-toast'

definePage({
  type: 'home',
  style: {
    navigationBarTitleText: '我的课表',
    navigationStyle: 'custom',
  },
})

const courseStore = useCourseStore()
const scheduleStore = useScheduleStore()
const dialog = useDialog()
const toast = useToast()

/** 点击标题切换课表（小程序 actionSheet 最多 6 项） */
function switchSchedule() {
  lightTap()
  // 兜底修复异常状态（默认课表缺失 / 激活 id 失效），保证列表与切换可用
  scheduleStore.ensureValid()
  const list = scheduleStore.schedules
  if (list.length <= 1)
    return
  if (list.length > 6) {
    toast.show('课表较多，请到「设置 - 课表管理」切换')
    return
  }
  const names = list.map(s => (s.id === scheduleStore.activeId ? `✓ ${s.name}` : s.name))
  uni.showActionSheet({
    itemList: names,
    success: ({ tapIndex }) => {
      const target = list[tapIndex]
      if (target && target.id !== scheduleStore.activeId) {
        scheduleStore.switchTo(target.id)
        toast.show(`已切换到「${target.name}」`)
      }
    },
  })
}

const curWeekStart = ref(weekStart())

const days = computed(() => weekDays(curWeekStart.value))
const weekLabel = computed(() => {
  const s = days.value[0]
  const e = days.value[6]
  return `${shortDate(s)} - ${shortDate(e)}`
})

// 单次遍历生成「日期 -> 课程」索引，避免模板中反复 filter 全量课程
// （模板里 coursesOf(day) 每天会被取用 3 次，直接全量扫描会放大 20 倍以上）
const coursesByDay = computed(() => {
  const map = new Map<string, Course[]>(days.value.map(d => [d, [] as Course[]]))
  for (const c of courseStore.sortedByTime) {
    for (const day of days.value) {
      if (courseCoversDay(c.startDate, c.endDate, day))
        map.get(day)!.push(c)
    }
  }
  return map
})

function coursesOf(day: string): Course[] {
  return coursesByDay.value.get(day) ?? []
}

// 同一天内时间重叠的课程 id 集合（用于卡片上的「时间冲突」标记）
const conflictIds = computed(() => {
  const ids = new Set<string>()
  for (const list of coursesByDay.value.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (isTimeOverlap(list[i].startTime, list[i].endTime, list[j].startTime, list[j].endTime)) {
          ids.add(list[i].id)
          ids.add(list[j].id)
        }
      }
    }
  }
  return ids
})

function isToday(day: string) {
  return day === today()
}

function prevPeriod() {
  lightTap()
  curWeekStart.value = addWeeks(curWeekStart.value, -1)
}
function nextPeriod() {
  lightTap()
  curWeekStart.value = addWeeks(curWeekStart.value, 1)
}
function goToday() {
  lightTap()
  curWeekStart.value = weekStart()
}

function openDetail(course: Course) {
  lightTap()
  uni.navigateTo({ url: `/pages/course/detail?id=${course.id}` })
}
function openEdit() {
  lightTap()
  uni.navigateTo({ url: '/pages/course/edit' })
}

/** 长按卡片删除：确认弹窗由页面级单例接管（CourseCard 不再自带 dialog/toast 实例） */
function confirmDelete(course: Course) {
  const name = course.studentName || course.name || '此课程'
  dialog
    .confirm({
      title: '删除课程',
      msg: `确定删除「${name}」？删除后可在回收站恢复。`,
      confirmButtonProps: { type: 'danger' },
    })
    .then(() => {
      courseStore.removeCourse(course.id)
      toast.show('已移入回收站')
    })
    .catch(() => {})
}

const weekTotal = computed(() => {
  let n = 0
  for (const list of coursesByDay.value.values())
    n += list.length
  return n
})

// 平板端周视图按窗口宽度分列：竖屏 2 列、宽屏 3 列；手机保持单列
const weekColumns = computed(() => {
  if (!isTablet.value) {
    return 1
  }
  return windowWidth.value >= 1000 ? 3 : 2
})
</script>

<template>
  <view class="h-screen flex flex-col overflow-hidden bg-gray-50">
    <!-- 顶部工具条（固定，不随内容滚动）：浅染色渐变，柔和不刺眼 -->
    <view class="shrink-0 from-indigo-50 to-white bg-gradient-to-b" :style="{ paddingTop: `${statusBarHeight}px` }">
      <!-- 标题行（与 NavBar 统一 44px 高度）；多课表时点击可切换 -->
      <view class="h-44px flex items-center px-4">
        <view class="max-w-full flex items-center gap-2" @click="switchSchedule">
          <view class="i-carbon-calendar shrink-0 text-lg text-indigo-500" />
          <text class="truncate text-lg text-gray-900 font-bold">
            {{ scheduleStore.activeSchedule?.name || '我的课表' }}
          </text>
          <view
            v-if="scheduleStore.schedules.length > 1"
            class="i-carbon-chevron-down shrink-0 text-sm text-gray-400"
          />
        </view>
      </view>
      <!-- 日期导航行 -->
      <view class="flex items-center justify-between px-4 pb-3">
        <view class="flex items-center gap-1">
          <wd-button
            variant="text"
            size="small"
            icon="left"
            @click="prevPeriod"
          />
          <view class="min-w-28 text-center text-sm text-gray-900 font-medium">
            {{ weekLabel }}
          </view>
          <wd-button
            variant="text"
            size="small"
            icon="right"
            @click="nextPeriod"
          />
          <view class="ml-1 pill-btn" @click="goToday">
            今天
          </view>
        </view>
        <view class="text-xs text-gray-400">
          共 {{ weekTotal }} 节课
        </view>
      </view>
    </view>

    <!-- 滚动内容区（底部额外留出可拖拽 FAB 的高度） -->
    <view class="h-0 min-h-0 flex-1 overflow-y-auto pt-3" :class="isTablet ? 'px-6' : 'px-3'" :style="{ paddingBottom: `${bottomBarHeight + safeAreaBottom + 64}px` }">
      <!-- 周视图：按天分组（平板上多列网格，手机单列） -->
      <view
        class="grid gap-4"
        :style="{ gridTemplateColumns: `repeat(${weekColumns}, minmax(0, 1fr))` }"
      >
        <view v-for="day in days" :key="day">
          <view class="mb-2 flex items-center gap-1.5">
            <text
              class="text-xs font-medium"
              :class="isToday(day) ? 'text-indigo-600' : 'text-gray-500'"
            >
              {{ longDate(day) }}
            </text>
            <view v-if="isToday(day)" class="status-dot bg-indigo-500" />
            <view v-if="coursesOf(day).length" class="text-2xs text-gray-400">
              {{ coursesOf(day).length }} 节
            </view>
          </view>
          <view
            v-if="coursesOf(day).length === 0 && !isToday(day)"
            class="border border-gray-200 rounded-xl border-dashed py-3 text-center text-xs text-gray-300"
          >
            暂无课程
          </view>
          <CourseCard
            v-for="c in coursesOf(day)"
            :key="c.id"
            :course="c"
            :conflict="conflictIds.has(c.id)"
            @click="openDetail"
            @delete="confirmDelete"
          />
        </view>
      </view>
    </view>

    <!-- 新增按钮（可拖拽） -->
    <DragFab @click="openEdit" />

    <wd-dialog />
    <wd-toast />
  </view>
</template>
