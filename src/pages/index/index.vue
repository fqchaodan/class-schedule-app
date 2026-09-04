<script setup lang="ts">
import type { Course } from '@/types/course'
import { addDays, addWeeks, longDate, shortDate, today, weekDays, weekStart } from '@/utils/time'
import { safeAreaBottom, statusBarHeight } from '@/utils/systemInfo'
import { bottomBarHeight, isTablet, windowWidth } from '@/store/device'
import { lightTap } from '@/utils/feedback'

definePage({
  type: 'home',
  style: {
    navigationBarTitleText: '我的课表',
    navigationStyle: 'custom',
  },
})

const courseStore = useCourseStore()
const appStore = useAppStore()

const mode = ref<'week' | 'day'>(appStore.settings.defaultView)
const curWeekStart = ref(weekStart())
const curDay = ref(today())

const days = computed(() => weekDays(curWeekStart.value))
const weekLabel = computed(() => {
  const s = days.value[0]
  const e = days.value[6]
  return `${shortDate(s)} - ${shortDate(e)}`
})

function coursesOf(day: string): Course[] {
  return courseStore.coursesOnDay(day)
}

function isToday(day: string) {
  return day === today()
}

function switchMode(m: 'week' | 'day') {
  lightTap()
  mode.value = m
  appStore.updateSettings({ defaultView: m })
}

function prevPeriod() {
  lightTap()
  if (mode.value === 'week') {
    curWeekStart.value = addWeeks(curWeekStart.value, -1)
    curDay.value = addWeeks(curDay.value, -7)
  }
  else {
    curDay.value = addDays(curDay.value, -1)
  }
}
function nextPeriod() {
  lightTap()
  if (mode.value === 'week') {
    curWeekStart.value = addWeeks(curWeekStart.value, 1)
    curDay.value = addWeeks(curDay.value, 7)
  }
  else {
    curDay.value = addDays(curDay.value, 1)
  }
}
function goToday() {
  lightTap()
  curWeekStart.value = weekStart()
  curDay.value = today()
}

function openDetail(course: Course) {
  lightTap()
  uni.navigateTo({ url: `/pages/course/detail?id=${course.id}` })
}
function openEdit() {
  lightTap()
  uni.navigateTo({ url: '/pages/course/edit' })
}

const weekTotal = computed(() => days.value.reduce((n, d) => n + coursesOf(d).length, 0))

// 平板端周视图按窗口宽度分列：竖屏 2 列、宽屏 3 列；手机保持单列
const weekColumns = computed(() => {
  if (!isTablet.value) {
    return 1
  }
  return windowWidth.value >= 1000 ? 3 : 2
})

const modeOptions = [
  { value: 'week', label: '周' },
  { value: 'day', label: '日' },
]
</script>

<template>
  <view class="h-screen flex flex-col overflow-hidden bg-gray-50">
    <!-- 顶部工具条（固定，不随内容滚动）：浅染色渐变，柔和不刺眼 -->
    <view class="shrink-0 from-indigo-50 to-white bg-gradient-to-b" :style="{ paddingTop: `${statusBarHeight}px` }">
      <!-- 标题行（与 NavBar 统一 44px 高度） -->
      <view class="h-44px flex items-center justify-between px-4">
        <view class="flex items-center gap-2">
          <view class="i-carbon-calendar text-lg text-indigo-500" />
          <text class="text-lg text-gray-900 font-bold">
            我的课表
          </text>
        </view>
        <view class="flex items-center gap-2">
          <wd-segmented
            v-model:value="mode"
            :options="['week', 'day']"
            theme="outline"
            @change="(item: any) => switchMode(item.value)"
          >
            <template #label="{ option }">
              {{ option.value === 'week' ? '周' : '日' }}
            </template>
          </wd-segmented>
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
            {{ mode === 'week' ? weekLabel : longDate(curDay) }}
          </view>
          <wd-button
            variant="text"
            size="small"
            icon="right"
            @click="nextPeriod"
          />
          <wd-button
            variant="text"
            size="small"
            @click="goToday"
          >
            今天
          </wd-button>
        </view>
        <view v-if="mode === 'week'" class="text-2xs text-gray-400">
          本周共 {{ weekTotal }} 节课
        </view>
      </view>
    </view>

    <!-- 滚动内容区 -->
    <view class="h-0 min-h-0 flex-1 overflow-y-auto pt-3" :class="isTablet ? 'px-6' : 'px-3'" :style="{ paddingBottom: `${bottomBarHeight + safeAreaBottom}px` }">
      <!-- 周视图：按天分组（平板上多列网格，手机单列） -->
      <view
        v-if="mode === 'week'"
        class="grid gap-4"
        :style="{ gridTemplateColumns: `repeat(${weekColumns}, minmax(0, 1fr))` }"
      >
        <view v-for="day in days" :key="day">
          <view class="mb-2 flex items-center gap-2">
            <wd-tag
              :type="isToday(day) ? 'primary' : 'default'"
              size="small"
              round
            >
              {{ longDate(day) }}
            </wd-tag>
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
            @click="openDetail"
          />
        </view>
      </view>

      <!-- 日视图（平板上约束宽度居中，避免卡片被拉得过宽） -->
      <view v-else :class="isTablet ? 'mx-auto max-w-180' : ''">
        <wd-empty
          v-if="coursesOf(curDay).length === 0"
          tip="今天没有课程"
          icon="calendar"
          icon-size="60px"
        />
        <CourseCard
          v-for="c in coursesOf(curDay)"
          :key="c.id"
          :course="c"
          @click="openDetail"
        />
      </view>
    </view>

    <!-- 新增按钮（可拖拽） -->
    <DragFab @click="openEdit" />
  </view>
</template>
