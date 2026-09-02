<script setup lang="ts">
import type { Course } from '@/types/course'
import { avatarGradient } from '@/utils/avatar'
import { durationHours } from '@/utils/time'

const props = withDefaults(defineProps<{
  course: Course
  /** 是否显示日期（列表/搜索结果中用） */
  showDate?: boolean
  /** 冲突标记 */
  conflict?: boolean
}>(), {
  showDate: false,
  conflict: false,
})

const emit = defineEmits<{
  click: [course: Course]
}>()

const courseStore = useCourseStore()

const noteCount = computed(() => props.course.notes.length)
const hours = computed(() => durationHours(props.course.startTime, props.course.endTime))
const isCrossDay = computed(() => props.course.endDate > props.course.startDate)

/** 卡片主体文字：优先学生姓名，兜底课程名 */
const title = computed(() => props.course.studentName || props.course.name || '未命名课程')
/** 副标题：学生姓名与课程名并存时展示课程名 */
const subtitle = computed(() => (props.course.studentName && props.course.name ? props.course.name : ''))
const initial = computed(() => (title.value || '课').slice(0, 1))

/** 头像渐变背景（按姓名/标题 hash 取色，全站统一见 utils/avatar） */
const avatarCls = computed(() => avatarGradient(title.value))

/** 手动切换已上/未上（点击徽标，不触发展开详情） */
function toggleStatus() {
  courseStore.toggleCompleted(props.course.id)
}

/** 手动切换已收费/未收费（点击徽标，不触发展开详情） */
function togglePaid() {
  courseStore.togglePaid(props.course.id)
}
</script>

<template>
  <view
    class="mb-2 w-full overflow-hidden rounded-2xl bg-white shadow-card active:bg-gray-50 transition-colors border-l-4"
    :class="course.completed ? 'border-l-emerald-400' : 'border-l-amber-400'"
    @click="emit('click', course)"
  >
    <view class="flex items-center gap-3 p-3">
      <!-- 学生头像 -->
      <view
        class="h-11 w-11 flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-base text-white font-medium"
        :class="avatarCls"
      >
        {{ initial }}
      </view>

      <!-- 主体 -->
      <view class="min-w-0 flex-1">
        <view class="flex items-center gap-2">
          <text class="truncate txt-heading">{{ title }}</text>
          <wd-tag v-if="conflict" type="danger" size="small" variant="plain">
            时间冲突
          </wd-tag>
        </view>
        <view class="mt-0.5 flex flex-wrap items-center gap-x-1 txt-sub">
          <text v-if="subtitle" class="truncate">{{ subtitle }}</text>
          <text v-if="subtitle" class="text-gray-300">·</text>
          <text v-if="showDate">{{ course.startDate }}<template v-if="isCrossDay">~{{ course.endDate }}</template> </text>
          <text>{{ course.startTime }}-{{ course.endTime }}（{{ hours }}h）</text>
        </view>
        <view v-if="course.meetingUrl" class="mt-1 flex items-center gap-1 text-2xs text-indigo-500">
          <view class="i-carbon-video text-sm" />
          <text>腾讯会议</text>
        </view>
      </view>

      <!-- 右侧：费用 + 状态 -->
      <view class="flex shrink-0 flex-col items-end gap-1.5">
        <text v-if="course.fee != null" class="text-sm txt-fee">
          ¥{{ course.fee }}
        </text>
        <view class="flex items-center gap-1.5">
          <wd-tag
            :type="course.paid ? 'success' : 'default'"
            size="small"
            round
            @click.stop="togglePaid"
          >
            {{ course.paid ? '已收费' : '未收费' }}
          </wd-tag>
          <wd-tag
            :type="course.completed ? 'success' : 'warning'"
            size="small"
            round
            @click.stop="toggleStatus"
          >
            {{ course.completed ? '已上' : '未上' }}
          </wd-tag>
        </view>
        <view v-if="noteCount > 0" class="flex items-center gap-0.5 text-2xs text-indigo-400">
          <view class="i-carbon-notebook text-sm" /> {{ noteCount }}
        </view>
      </view>
    </view>
  </view>
</template>
