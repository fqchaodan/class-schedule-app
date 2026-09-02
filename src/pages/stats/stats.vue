<script setup lang="ts">
import type { Course } from '@/types/course'
import { dayjs, durationHours, weekStart } from '@/utils/time'
import { safeAreaBottom, statusBarHeight } from '@/utils/systemInfo'

definePage({
  style: {
    navigationBarTitleText: '课时统计',
  },
})

const courseStore = useCourseStore()

// ---------- 时间范围 ----------
type RangeType = 'day' | 'week' | 'month' | 'year'
const rangeType = ref<RangeType>('week')
const curWeekStart = ref(weekStart())
const curMonth = ref(dayjs().format('YYYY-MM'))
const curYear = ref(dayjs().format('YYYY'))
const curDay = ref(dayjs().format('YYYY-MM-DD'))

const rangeLabel = computed(() => {
  switch (rangeType.value) {
    case 'day': return '今日'
    case 'week': return '本周'
    case 'month': return '本月'
    case 'year': return '本年'
    default: return ''
  }
})

const rangeStart = computed(() => {
  switch (rangeType.value) {
    case 'day': return curDay.value
    case 'week': return curWeekStart.value
    case 'month': return dayjs(`${curMonth.value}-01`).format('YYYY-MM-DD')
    case 'year': return `${curYear.value}-01-01`
    default: return curDay.value
  }
})
const rangeEnd = computed(() => {
  switch (rangeType.value) {
    case 'day': return curDay.value
    case 'week': return dayjs(curWeekStart.value).add(6, 'day').format('YYYY-MM-DD')
    case 'month': return dayjs(`${curMonth.value}-01`).endOf('month').format('YYYY-MM-DD')
    case 'year': return `${curYear.value}-12-31`
    default: return curDay.value
  }
})

/** 显示用的范围标签 */
const rangeDisplay = computed(() => {
  switch (rangeType.value) {
    case 'day': return dayjs(curDay.value).format('M月D日 ddd')
    case 'week': {
      const s = dayjs(curWeekStart.value)
      return `${s.format('M.D')} - ${s.add(6, 'day').format('M.D')}`
    }
    case 'month': return dayjs(`${curMonth.value}-01`).format('YYYY年M月')
    case 'year': return `${curYear.value}年`
    default: return ''
  }
})

function prevPeriod() {
  switch (rangeType.value) {
    case 'day': {
      curDay.value = dayjs(curDay.value).subtract(1, 'day').format('YYYY-MM-DD')
      break
    }
    case 'week': {
      curWeekStart.value = dayjs(curWeekStart.value).subtract(1, 'week').format('YYYY-MM-DD')
      break
    }
    case 'month': {
      curMonth.value = dayjs(`${curMonth.value}-01`).subtract(1, 'month').format('YYYY-MM')
      break
    }
    case 'year': {
      curYear.value = String(Number(curYear.value) - 1)
      break
    }
    default: break
  }
}
function nextPeriod() {
  switch (rangeType.value) {
    case 'day': {
      curDay.value = dayjs(curDay.value).add(1, 'day').format('YYYY-MM-DD')
      break
    }
    case 'week': {
      curWeekStart.value = dayjs(curWeekStart.value).add(1, 'week').format('YYYY-MM-DD')
      break
    }
    case 'month': {
      curMonth.value = dayjs(`${curMonth.value}-01`).add(1, 'month').format('YYYY-MM')
      break
    }
    case 'year': {
      curYear.value = String(Number(curYear.value) + 1)
      break
    }
    default: break
  }
}
function goToday() {
  curDay.value = dayjs().format('YYYY-MM-DD')
  curWeekStart.value = weekStart()
  curMonth.value = dayjs().format('YYYY-MM')
  curYear.value = dayjs().format('YYYY')
}

const rangeOptions = ['day', 'week', 'month', 'year'] as const

// ---------- 课程日期计算 ----------
function courseDatesInRange(course: Course): string[] {
  const dates: string[] = []
  let cur = dayjs(course.startDate)
  const end = dayjs(course.endDate > rangeEnd.value ? rangeEnd.value : course.endDate)
  const start = cur.isBefore(rangeStart.value) ? dayjs(rangeStart.value) : cur
  cur = start
  while (!cur.isAfter(end, 'day')) {
    dates.push(cur.format('YYYY-MM-DD'))
    cur = cur.add(1, 'day')
  }
  return dates
}

const coursesInRange = computed(() =>
  courseStore.sortedByTime.filter((c) => {
    return c.startDate <= rangeEnd.value && c.endDate >= rangeStart.value
  }),
)

// ---------- 统计 ----------
interface StatItem {
  key: string
  label: string
  count: number
  hours: number
  income: number
  completedCount: number
  paidIncome: number
}

function groupStat(groups: Record<string, Course[]>): StatItem[] {
  return Object.entries(groups)
    .map(([key, courses]) => {
      let count = 0
      let hours = 0
      let income = 0
      let completedCount = 0
      let paidIncome = 0
      for (const c of courses) {
        const dates = courseDatesInRange(c)
        count += dates.length
        hours += dates.length * durationHours(c.startTime, c.endTime)
        income += dates.length * (c.fee ?? 0)
        if (c.completed) {
          completedCount += dates.length
          if (c.paid)
            paidIncome += dates.length * (c.fee ?? 0)
        }
        else if (c.paid) {
          paidIncome += dates.length * (c.fee ?? 0)
        }
      }
      return {
        key,
        label: key || '未命名',
        count,
        hours: Math.round(hours * 10) / 10,
        income: Math.round(income * 100) / 100,
        completedCount,
        paidIncome: Math.round(paidIncome * 100) / 100,
      }
    })
    .sort((a, b) => b.count - a.count)
}

const byStudent = computed(() => {
  const groups: Record<string, Course[]> = {}
  for (const c of coursesInRange.value) {
    const key = c.studentName || '未填学生'
    ;(groups[key] ??= []).push(c)
  }
  return groupStat(groups)
})

const byCourse = computed(() => {
  const groups: Record<string, Course[]> = {}
  for (const c of coursesInRange.value) {
    const key = c.name || '未注明课程'
    ;(groups[key] ??= []).push(c)
  }
  return groupStat(groups)
})

const total = computed(() => {
  let count = 0
  let hours = 0
  let income = 0
  let completedCount = 0
  let unpaidIncome = 0
  for (const c of coursesInRange.value) {
    const dates = courseDatesInRange(c)
    count += dates.length
    hours += dates.length * durationHours(c.startTime, c.endTime)
    income += dates.length * (c.fee ?? 0)
    if (c.completed)
      completedCount += dates.length
    if (!c.paid)
      unpaidIncome += dates.length * (c.fee ?? 0)
  }
  return {
    count,
    hours: Math.round(hours * 10) / 10,
    income: Math.round(income * 100) / 100,
    completedCount,
    pendingCount: count - completedCount,
    unpaidIncome: Math.round(unpaidIncome * 100) / 100,
    paidIncome: Math.round((income - unpaidIncome) * 100) / 100,
  }
})

const groupMode = ref<'student' | 'course'>('student')
const groupList = computed(() => (groupMode.value === 'student' ? byStudent.value : byCourse.value))

/** 明细列表最大值，用于进度条宽度 */
const maxCount = computed(() => Math.max(1, ...groupList.value.map(i => i.count)))

const groupOptions = ['student', 'course'] as const
</script>

<template>
  <view class="h-screen flex flex-col overflow-hidden bg-gray-50">
    <!-- 标题行（与首页统一风格） -->
    <view class="shrink-0 bg-gradient-to-b from-indigo-50 to-white" :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="h-44px flex items-center px-4">
        <view class="flex items-center gap-2">
          <view class="i-carbon-chart-bar text-lg text-indigo-500" />
          <text class="text-lg text-gray-900 font-bold">
            课时统计
          </text>
        </view>
      </view>
      <!-- 范围切换行 -->
      <view class="flex items-center justify-between px-4 pb-3">
        <wd-segmented
          v-model:value="rangeType"
          :options="rangeOptions as unknown as string[]"
          theme="outline"
          custom-class="!w-auto"
          @change="(item: any) => rangeType = item.value"
        >
          <template #label="{ option }">
            {{ option.value === 'day' ? '日' : option.value === 'week' ? '周' : option.value === 'month' ? '月' : '年' }}
          </template>
        </wd-segmented>
      </view>
      <!-- 日期导航行 -->
      <view class="flex items-center justify-between px-4 pb-3 pt-2">
        <view class="flex items-center gap-1">
          <wd-button
            variant="text"
            size="small"
            icon="left"
            @click="prevPeriod"
          />
          <view class="min-w-24 text-center text-sm text-gray-900 font-medium">
            {{ rangeDisplay }}
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
        <view class="text-2xs text-gray-400">
          共 {{ total.count }} 节
        </view>
      </view>
    </view>

    <!-- 滚动内容区 -->
    <view class="h-0 min-h-0 flex-1 overflow-y-auto px-3 pt-3" :style="{ paddingBottom: `${50 + safeAreaBottom}px` }">
      <!-- 汇总卡片 -->
      <view class="overflow-hidden rounded-2xl bg-white shadow-card">
        <view class="bg-indigo-50/80 border-b border-indigo-100 px-4 py-2.5">
          <view class="flex items-center gap-1.5">
            <view class="i-carbon-chart-bar text-sm text-indigo-500" />
            <text class="text-xs text-indigo-600 font-medium">{{ rangeLabel }}汇总</text>
          </view>
        </view>

        <!-- 第一行：核心三指标 -->
        <view class="flex items-center px-2 py-4">
          <view class="flex-1 text-center">
            <view class="text-3xl text-gray-900 font-bold tabular-nums">
              {{ total.count }}
            </view>
            <view class="mt-0.5 text-2xs text-gray-400">
              课时（节）
            </view>
          </view>
          <view class="h-10 w-px bg-gray-100" />
          <view class="flex-1 text-center">
            <view class="text-3xl text-gray-900 font-bold tabular-nums">
              {{ total.hours }}
            </view>
            <view class="mt-0.5 text-2xs text-gray-400">
              总时长（h）
            </view>
          </view>
          <view class="h-10 w-px bg-gray-100" />
          <view class="flex-1 text-center">
            <view class="text-3xl text-orange-500 font-bold tabular-nums">
              ¥{{ total.income }}
            </view>
            <view class="mt-0.5 text-2xs text-gray-400">
              预计收入
            </view>
          </view>
        </view>

        <!-- 第二行：完成与收费状态 -->
        <view class="flex border-t border-gray-50 bg-gray-50/50 px-2 py-2.5">
          <view class="flex-1 text-center">
            <text class="text-sm text-emerald-600 font-semibold">{{ total.completedCount }}</text>
            <text class="text-2xs text-gray-400"> / {{ total.count }} 已完成</text>
          </view>
          <view class="flex-1 text-center">
            <text class="text-sm text-amber-600 font-semibold">{{ total.pendingCount }}</text>
            <text class="text-2xs text-gray-400"> 待上课</text>
          </view>
          <view class="flex-1 text-center">
            <text class="text-sm text-emerald-600 font-semibold">¥{{ total.paidIncome }}</text>
            <text class="text-2xs text-gray-400"> 已收</text>
          </view>
          <view class="flex-1 text-center">
            <text class="text-sm text-amber-500 font-semibold">¥{{ total.unpaidIncome }}</text>
            <text class="text-2xs text-gray-400"> 未收</text>
          </view>
        </view>
      </view>

      <!-- 分组统计 -->
      <view class="mt-4">
        <view class="mb-2.5 flex items-center justify-between">
          <view class="flex shrink-0 items-center gap-1.5">
            <view class="i-carbon-list text-sm text-gray-600" />
            <view class="text-sm text-gray-700 font-medium">
              明细
            </view>
          </view>
          <wd-segmented
            v-model:value="groupMode"
            :options="groupOptions as unknown as string[]"
            theme="outline"
            size="small"
            custom-class="!w-auto"
            @change="(item: any) => groupMode = item.value"
          >
            <template #label="{ option }">
              {{ option.value === 'student' ? '按学生' : '按课程' }}
            </template>
          </wd-segmented>
        </view>

        <wd-empty v-if="groupList.length === 0" tip="该时段暂无课程" />

        <view
          v-for="(item, idx) in groupList"
          :key="item.key"
          class="card mb-2 overflow-hidden"
        >
          <view class="p-3.5">
            <view class="flex items-center justify-between">
              <!-- 左侧：序号 + 名称 -->
              <view class="min-w-0 flex flex-1 items-center gap-2.5">
                <view
                  class="h-6 w-6 flex shrink-0 items-center justify-center rounded-full text-2xs font-bold"
                  :class="idx === 0
                    ? 'from-amber-400 to-orange-400 bg-gradient-to-br text-white'
                    : idx === 1
                      ? 'from-gray-300 to-gray-400 bg-gradient-to-br text-white'
                      : idx === 2
                        ? 'from-orange-300 to-amber-400 bg-gradient-to-br text-white'
                        : 'bg-gray-100 text-gray-500'"
                >
                  {{ idx + 1 }}
                </view>
                <text class="truncate text-sm text-gray-800 font-medium">{{ item.label }}</text>
              </view>
              <!-- 右侧：收入 -->
              <view class="ml-2 shrink-0 text-right">
                <view class="text-sm text-orange-500 font-semibold">
                  ¥{{ item.income }}
                </view>
                <view class="text-2xs text-gray-400">
                  收入
                </view>
              </view>
            </view>

            <!-- 进度条 -->
            <view class="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <view
                class="h-full rounded-full bg-indigo-500 transition-all duration-300"
                :style="{ width: `${(item.count / maxCount) * 100}%` }"
              />
            </view>

            <!-- 底部数据行 -->
            <view class="mt-2 flex items-center gap-4 text-2xs">
              <view class="flex items-center gap-1">
                <view class="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                <text class="text-gray-500">{{ item.count }} 节</text>
              </view>
              <view class="flex items-center gap-1">
                <view class="h-1.5 w-1.5 rounded-full bg-gray-300" />
                <text class="text-gray-500">{{ item.hours }}h</text>
              </view>
              <view class="flex items-center gap-1">
                <view class="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <text class="text-gray-500">已完成 {{ item.completedCount }}</text>
              </view>
              <view class="ml-auto flex items-center gap-1">
                <view class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <text class="text-gray-500">已收 ¥{{ item.paidIncome }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
