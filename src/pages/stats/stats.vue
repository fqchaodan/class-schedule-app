<script setup lang="ts">
import type { Course } from '@/types/course'
import { dayjs, durationHours, weekStart } from '@/utils/time'
import { safeAreaBottom, statusBarHeight } from '@/utils/systemInfo'
import { bottomBarHeight, isTablet, windowWidth } from '@/store/device'
import { lightTap } from '@/utils/feedback'

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
  lightTap()
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
  lightTap()
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
  lightTap()
  curDay.value = dayjs().format('YYYY-MM-DD')
  curWeekStart.value = weekStart()
  curMonth.value = dayjs().format('YYYY-MM')
  curYear.value = dayjs().format('YYYY')
}

const rangeOptions: Array<{ value: RangeType, label: string }> = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
]

// ---------- 课程日期计算 ----------
function courseDatesInRange(course: Course): string[] {
  // 不存在跨天课程，startDate === endDate
  if (course.startDate >= rangeStart.value && course.startDate <= rangeEnd.value)
    return [course.startDate]
  return []
}

const coursesInRange = computed(() =>
  courseStore.sortedByTime.filter((c) => {
    // 不存在跨天课程，startDate === endDate
    return c.startDate >= rangeStart.value && c.startDate <= rangeEnd.value
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

/** 按课时费档位分组（key 为费用字符串，null 归入 'none' 档） */
const byFee = computed(() => {
  const groups: Record<string, Course[]> = {}
  for (const c of coursesInRange.value) {
    const key = c.fee != null ? String(c.fee) : 'none'
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

type GroupMode = 'student' | 'income'
const groupMode = ref<GroupMode>('student')

/** 明细列表：学生按课时数降序，收入档位按收入降序并格式化标签 */
const groupList = computed(() => {
  if (groupMode.value === 'income') {
    return [...byFee.value]
      .sort((a, b) => b.income - a.income)
      .map(i => ({ ...i, label: i.key === 'none' ? '未填课时费' : `¥${i.key}/节` }))
  }
  return byStudent.value
})

/** 明细列表最大值，用于进度条宽度 */
const maxCount = computed(() => Math.max(1, ...groupList.value.map(i => i.count)))

// 平板端分组条目多列排布：竖屏 2 列、宽屏 3 列；手机单列
const groupColumns = computed(() => {
  if (!isTablet.value) {
    return 1
  }
  return windowWidth.value >= 1000 ? 3 : 2
})

const groupOptions: Array<{ value: GroupMode, label: string }> = [
  { value: 'student', label: '按学生' },
  { value: 'income', label: '按收入' },
]
</script>

<template>
  <view class="h-screen flex flex-col overflow-hidden bg-gray-50">
    <!-- 标题行（与首页统一风格） -->
    <view class="shrink-0 from-indigo-50 to-white bg-gradient-to-b" :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="h-44px flex items-center px-4">
        <view class="flex items-center gap-2">
          <view class="i-carbon-chart-bar text-lg text-indigo-500" />
          <text class="text-lg text-gray-900 font-bold">
            课时统计
          </text>
        </view>
      </view>
      <!-- 范围切换行 -->
      <view class="px-4 pb-3">
        <SegControl v-model="rangeType" :options="rangeOptions" />
      </view>
      <!-- 日期导航行 -->
      <view class="flex items-center justify-between px-4 pb-3 pt-1">
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
          <view class="ml-1 pill-btn" @click="goToday">
            今天
          </view>
        </view>
        <view class="text-xs text-gray-400">
          共 {{ total.count }} 节
        </view>
      </view>
    </view>

    <!-- 滚动内容区 -->
    <view class="mb-2 h-0 min-h-0 flex-1 overflow-y-auto px-3 pt-3" :style="{ paddingBottom: `${bottomBarHeight + safeAreaBottom}px` }">
      <!-- 汇总卡片 -->
      <view class="overflow-hidden rounded-2xl bg-white shadow-card">
        <view class="border-b border-indigo-100 bg-indigo-50/80 px-4 py-2.5">
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
            <view class="text-3xl text-gray-900 font-bold tabular-nums">
              ¥{{ total.income }}
            </view>
            <view class="mt-0.5 text-2xs text-gray-400">
              预计收入
            </view>
          </view>
        </view>

        <!-- 第二行：完成与收费状态（金额保持中性色，状态语义只由圆点承担） -->
        <view class="flex border-t border-gray-50 bg-gray-50/50 px-2 py-2.5">
          <view class="flex flex-1 flex-col items-center gap-0.5">
            <text class="text-sm text-gray-800 font-semibold">{{ total.completedCount }} / {{ total.count }}</text>
            <view class="flex items-center gap-1 text-2xs text-gray-400">
              <view class="status-dot bg-indigo-500" /> 已完成
            </view>
          </view>
          <view class="flex flex-1 flex-col items-center gap-0.5">
            <text class="text-sm text-gray-800 font-semibold">{{ total.pendingCount }}</text>
            <view class="flex items-center gap-1 text-2xs text-gray-400">
              <view class="status-dot bg-gray-400" /> 待上课
            </view>
          </view>
          <view class="flex flex-1 flex-col items-center gap-0.5">
            <text class="text-sm text-gray-800 font-semibold tabular-nums">¥{{ total.paidIncome }}</text>
            <view class="flex items-center gap-1 text-2xs text-gray-400">
              <view class="status-dot bg-emerald-500" /> 已收
            </view>
          </view>
          <view class="flex flex-1 flex-col items-center gap-0.5">
            <text class="text-sm text-gray-800 font-semibold tabular-nums">¥{{ total.unpaidIncome }}</text>
            <view class="flex items-center gap-1 text-2xs text-gray-400">
              <view class="status-dot bg-amber-500" /> 未收
            </view>
          </view>
        </view>
      </view>

      <!-- 分组统计 -->
      <view class="mt-4">
        <view class="mb-2.5 flex items-center gap-3">
          <view class="flex shrink-0 items-center gap-1.5">
            <view class="i-carbon-list text-sm text-gray-600" />
            <view class="text-sm text-gray-700 font-medium">
              明细
            </view>
          </view>
          <SegControl v-model="groupMode" :options="groupOptions" class="ml-auto w-44" />
        </view>

        <wd-empty v-if="groupList.length === 0" tip="该时段暂无课程" />

        <!-- 平板端多列网格，手机单列（gap 与原 mb-2 间距一致） -->
        <view
          class="grid gap-2"
          :style="groupColumns > 1 ? { gridTemplateColumns: `repeat(${groupColumns}, minmax(0, 1fr))` } : {}"
        >
          <view
            v-for="(item, idx) in groupList"
            :key="item.key"
            class="card overflow-hidden"
          >
            <view class="p-3.5">
              <view class="flex items-center justify-between">
                <!-- 左侧：序号 + 名称 -->
                <view class="min-w-0 flex flex-1 items-center gap-2.5">
                  <view
                    class="h-6 w-6 flex shrink-0 items-center justify-center rounded-full text-2xs font-bold"
                    :class="idx === 0
                      ? 'from-amber-400 to-orange-400 bg-gradient-to-br text-white'
                      : 'bg-gray-100 text-gray-500'"
                  >
                    {{ idx + 1 }}
                  </view>
                  <text class="truncate text-sm text-gray-800 font-medium">{{ item.label }}</text>
                </view>
                <!-- 右侧：收入 -->
                <view class="ml-2 shrink-0 text-right">
                  <view class="text-sm txt-fee">
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
              <view class="mt-2 flex items-center gap-3 text-2xs text-gray-500">
                <text>{{ item.count }} 节</text>
                <text>{{ item.hours }}h</text>
                <text>已完成 {{ item.completedCount }}</text>
                <view class="ml-auto">
                  已收 ¥{{ item.paidIncome }}
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
