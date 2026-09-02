<script setup lang="ts">
import type { Course, CourseDraft, CourseTemplate } from '@/types/course'
import { WEEKDAY_LABELS } from '@/types/course'
import { avatarGradient } from '@/utils/avatar'
import { isCourseConflict } from '@/utils/conflict'
import { dateToTimestamp, timestampToDate, timeToMinutes, weekStart } from '@/utils/time'
import { draftsToCourses } from '@/store/template'
import { useTimeOptions } from '@/hooks/useCourseForm'
import { lightTap } from '@/utils/feedback'
import { useDialog, useToast } from '@wot-ui/ui'

definePage({
  style: {
    navigationBarTitleText: '模板管理',
  },
})

const templateStore = useTemplateStore()
const courseStore = useCourseStore()
const dialog = useDialog()
const toast = useToast()

// ---------- 分类 ----------
const tab = ref<'course' | 'cycle'>('course')
const courseTemplates = computed(() => templateStore.templates.filter(t => t.kind === 'course'))
const cycleTemplates = computed(() => templateStore.templates.filter(t => t.kind !== 'course'))

const tabOptions = ['course', 'cycle']

function useForNew(tpl: CourseTemplate) {
  lightTap()
  uni.navigateTo({ url: `/pages/course/edit?tplId=${tpl.id}` })
}

function removeCourseTpl(tpl: CourseTemplate) {
  lightTap()
  dialog
    .confirm({
      title: '删除模板',
      msg: `删除课程模板「${tpl.name}」？已生成的课程不受影响。`,
    })
    .then(() => {
      templateStore.removeTemplate(tpl.id)
    })
    .catch(() => {})
}

// ---------- 周期模板表单 ----------
const { timeColumns, timeToArr, arrToTime } = useTimeOptions()
const showForm = ref(false)
const editId = ref<string | null>(null)
const name = ref('')
const studentName = ref('')
const weekdays = ref<number[]>([])
const startTime = ref('09:00')
const endTime = ref('10:00')
const feeRaw = ref('')
const weeksRaw = ref('12')
const startDate = ref(weekStart())

// ---------- 选择器显隐控制 ----------
const showStartTimePicker = ref(false)
const showEndTimePicker = ref(false)

// ---------- 日历选择器 ref ----------
const startDateCalendarRef = ref()

// ---------- 时间选择器 v-model（双列：小时+分钟） ----------
const startTimeArr = computed({
  get: () => timeToArr(startTime.value),
  set: (val: (string | number)[]) => {
    startTime.value = arrToTime(val)
  },
})
const endTimeArr = computed({
  get: () => timeToArr(endTime.value),
  set: (val: (string | number)[]) => {
    endTime.value = arrToTime(val)
  },
})

// ---------- 日期时间戳双向转换 ----------
const startDateTs = computed({
  get: () => dateToTimestamp(startDate.value),
  set: (ts: number) => {
    startDate.value = timestampToDate(ts)
  },
})

function toggleWeekday(idx: number) {
  const i = weekdays.value.indexOf(idx)
  if (i >= 0)
    weekdays.value.splice(i, 1)
  else
    weekdays.value.push(idx)
}

function openStartDateCalendar() {
  startDateCalendarRef.value?.open()
}

function onStartDateConfirm({ value }: { value: number }) {
  startDateTs.value = value
}

function openCreate() {
  lightTap()
  editId.value = null
  name.value = ''
  studentName.value = ''
  weekdays.value = []
  startTime.value = '09:00'
  endTime.value = '10:00'
  feeRaw.value = ''
  weeksRaw.value = '12'
  startDate.value = weekStart()
  showForm.value = true
}

function openEdit(tpl: CourseTemplate) {
  lightTap()
  editId.value = tpl.id
  name.value = tpl.name
  studentName.value = tpl.studentName ?? ''
  weekdays.value = [...tpl.weekdays]
  startTime.value = tpl.startTime
  endTime.value = tpl.endTime
  feeRaw.value = tpl.fee != null ? String(tpl.fee) : ''
  weeksRaw.value = String(tpl.weeks)
  startDate.value = tpl.startDate ?? weekStart()
  showForm.value = true
}

function saveForm() {
  lightTap()
  if (!name.value.trim()) {
    toast.error('请填写模板名称')
    return
  }
  if (!studentName.value.trim()) {
    toast.error('请填写学生姓名')
    return
  }
  if (weekdays.value.length === 0) {
    toast.error('请选择重复的星期')
    return
  }
  if (timeToMinutes(endTime.value) <= timeToMinutes(startTime.value)) {
    toast.error('结束时间需晚于开始时间')
    return
  }
  const weeks = Math.max(1, Math.floor(Number(weeksRaw.value) || 1))
  const data = {
    name: name.value.trim(),
    studentName: studentName.value.trim(),
    weekdays: [...weekdays.value].sort((a, b) => a - b),
    startTime: startTime.value,
    endTime: endTime.value,
    fee: feeRaw.value === '' ? undefined : Number(feeRaw.value),
    weeks,
    startDate: startDate.value,
    enabled: true,
  }
  let tpl: CourseTemplate
  if (editId.value) {
    templateStore.updateTemplate(editId.value, data)
    tpl = templateStore.getById(editId.value)!
  }
  else {
    tpl = templateStore.addTemplate(data)
  }
  // 自动生成课程到课表（编辑时先删除该模板旧课程，避免重复）
  if (editId.value)
    courseStore.removeByTemplateId(editId.value)
  const drafts = templateStore.buildCourses(tpl)
  courseStore.insertMany(draftsToCourses(drafts))
  showForm.value = false
  toast.success(`已保存并生成 ${drafts.length} 节课程`)
}

function removeTpl(tpl: CourseTemplate) {
  lightTap()
  dialog
    .confirm({
      title: '删除模板',
      msg: `删除模板「${tpl.name}」？已生成的课程不受影响。`,
    })
    .then(() => {
      templateStore.removeTemplate(tpl.id)
    })
    .catch(() => {})
}

// ---------- 生成预览 ----------
const previewTpl = ref<CourseTemplate | null>(null)
const previewDrafts = computed<CourseDraft[]>(() =>
  previewTpl.value ? templateStore.buildCourses(previewTpl.value) : [],
)
const previewWithConflict = computed(() =>
  previewDrafts.value.map(d => ({
    draft: d,
    conflict: courseStore.courses.some(c =>
      c.templateId !== previewTpl.value?.id
      && isCourseConflict(c, d as unknown as Course),
    ),
  })),
)
const conflictCount = computed(() => previewWithConflict.value.filter(i => i.conflict).length)

function openPreview(tpl: CourseTemplate) {
  lightTap()
  previewTpl.value = tpl
}

function closePreview() {
  previewTpl.value = null
}

function confirmGenerate() {
  lightTap()
  if (!previewTpl.value)
    return
  const drafts = previewDrafts.value
  // 先删除该模板之前已生成的课程，避免重复
  courseStore.removeByTemplateId(previewTpl.value.id)
  courseStore.insertMany(draftsToCourses(drafts))
  toast.success(`已生成 ${drafts.length} 节课程`)
  previewTpl.value = null
}

function weekdayText(weekdays: number[]) {
  return [...weekdays].sort((a, b) => a - b).map(d => WEEKDAY_LABELS[d]).join('、')
}

/** 模板头像渐变（与 CourseCard 同一 hash 规则） */
function tplAvatarCls(tpl: CourseTemplate) {
  return avatarGradient(tpl.studentName || tpl.name || '课')
}
</script>

<template>
  <view class="h-screen flex flex-col overflow-hidden bg-gray-50">
    <!-- 自定义导航栏 -->
    <NavBar title="模板管理" />
    <!-- 分类 tab（固定） -->
    <view class="shrink-0 border-b border-gray-100 bg-white px-4 pb-2 pt-2 shadow-sm">
      <wd-segmented
        v-model:value="tab"
        :options="tabOptions"
        theme="card"
        @change="(item: any) => tab = item.value"
      >
        <template #label="{ option }">
          {{ option.value === 'course' ? '课程模板' : '周期排课' }}
        </template>
      </wd-segmented>
    </view>

    <!-- 滚动内容区 -->
    <view class="h-0 min-h-0 flex-1 overflow-y-auto px-0 py-3">
      <!-- 课程模板 -->
      <view v-if="tab === 'course'">
        <wd-empty
          v-if="courseTemplates.length === 0"
          tip="还没有课程模板。新增课程后点「存为模板」，下次即可一键填充。"
          icon="save"
          custom-class="px-3"
        />
        <view v-for="tpl in courseTemplates" :key="tpl.id" class="card mx-3 mt-3 p-3.5">
          <view class="flex items-center gap-3">
            <view
              class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm text-white font-medium"
              :class="tplAvatarCls(tpl)"
            >
              {{ (tpl.studentName || tpl.name || '课').slice(0, 1) }}
            </view>
            <view class="min-w-0 flex-1 overflow-hidden">
              <view class="flex items-center gap-2">
                <text class="truncate text-sm text-gray-900 font-medium">{{ tpl.studentName || tpl.name }}</text>
                <text v-if="tpl.fee != null" class="shrink-0 text-xs text-orange-500">¥{{ tpl.fee }}/节</text>
              </view>
              <view class="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                <text v-if="tpl.courseName" class="truncate">{{ tpl.courseName }}</text>
                <text v-if="tpl.courseName" class="shrink-0">·</text>
                <text class="shrink-0">{{ tpl.startTime }}-{{ tpl.endTime }}</text>
                <text v-if="tpl.meetingUrl" class="shrink-0">· 会议</text>
              </view>
            </view>
          </view>
          <view class="mt-2.5 flex justify-end gap-2">
            <wd-button size="small" variant="plain" @click="removeCourseTpl(tpl)">
              删除
            </wd-button>
            <wd-button size="small" type="primary" @click="useForNew(tpl)">
              用于新增
            </wd-button>
          </view>
        </view>
      </view>

      <!-- 周期模板 -->
      <view v-else>
        <wd-empty
          v-if="cycleTemplates.length === 0"
          tip="暂无周期模板。创建模板后可一键按周生成重复课程"
          icon="clock-circle"
          custom-class="px-3"
        />
        <view v-for="tpl in cycleTemplates" :key="tpl.id" class="card mx-3 mt-3 p-3.5">
          <view class="flex items-center gap-3">
            <view
              class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm text-white font-medium"
              :class="tplAvatarCls(tpl)"
            >
              {{ (tpl.studentName || tpl.name || '模').slice(0, 1) }}
            </view>
            <view class="min-w-0 flex-1 overflow-hidden">
              <view class="flex items-center gap-2">
                <text class="truncate text-sm text-gray-900 font-medium">{{ tpl.name }}</text>
                <text v-if="tpl.studentName" class="shrink-0 text-xs text-gray-500">{{ tpl.studentName }}</text>
              </view>
              <view class="mt-0.5 text-xs text-gray-500">
                每周{{ weekdayText(tpl.weekdays) }} · {{ tpl.startTime }}-{{ tpl.endTime }} · 连续 {{ tpl.weeks }} 周
              </view>
            </view>
            <text v-if="tpl.fee != null" class="shrink-0 text-xs text-orange-500">¥{{ tpl.fee }}/节</text>
          </view>
          <view class="mt-2.5 flex justify-end gap-2">
            <wd-button size="small" variant="plain" @click="removeTpl(tpl)">
              删除
            </wd-button>
            <wd-button size="small" type="primary" variant="plain" @click="openEdit(tpl)">
              编辑
            </wd-button>
            <wd-button size="small" type="primary" @click="openPreview(tpl)">
              生成排课
            </wd-button>
          </view>
        </view>
      </view>
    </view>

    <!-- 新增按钮（周期模板 tab） -->
    <wd-fab
      v-if="tab === 'cycle'"
      :expandable="false"
      position="right-bottom"
      :gap="{ bottom: 80, right: 16 }"
      :z-index="9"
      @click="openCreate"
    />

    <!-- 周期模板表单弹层 -->
    <wd-popup
      v-model="showForm"
      position="bottom"
      round
      safe-area-inset-bottom
    >
      <view class="px-4 pb-6 pt-4">
        <view class="mb-3 text-center text-base text-gray-900 font-medium">
          {{ editId ? '编辑模板' : '新建周期模板' }}
        </view>
        <wd-cell-group border>
          <wd-cell title="模板名称" center>
            <template #default>
              <wd-input
                v-model="name"
                placeholder="如：初一数学长期班"
                compact
                clearable
                custom-style="width: 100%; text-align: right;"
              />
            </template>
          </wd-cell>
          <wd-cell title="学生姓名" center>
            <template #default>
              <wd-input
                v-model="studentName"
                placeholder="请填写学生姓名"
                compact
                clearable
                custom-style="width: 100%; text-align: right;"
              />
            </template>
          </wd-cell>
          <wd-cell title="每周重复" center>
            <template #default>
              <view class="flex flex-wrap justify-end gap-1.5">
                <wd-tag
                  v-for="(label, idx) in WEEKDAY_LABELS"
                  :key="idx"
                  :type="weekdays.includes(idx) ? 'primary' : 'default'"
                  size="small"
                  round
                  @click="toggleWeekday(idx)"
                >
                  {{ label }}
                </wd-tag>
              </view>
            </template>
          </wd-cell>
          <wd-cell
            title="开始时间"
            is-link
            center
            @click="showStartTimePicker = true"
          >
            <template #default>
              <text class="text-sm text-gray-800">{{ startTime }}</text>
            </template>
          </wd-cell>
          <wd-cell
            title="结束时间"
            is-link
            center
            @click="showEndTimePicker = true"
          >
            <template #default>
              <text class="text-sm text-gray-800">{{ endTime }}</text>
            </template>
          </wd-cell>
          <wd-cell title="课时费/节" center>
            <template #default>
              <view class="flex items-center gap-1">
                <wd-input
                  v-model="feeRaw"
                  type="number"
                  placeholder="可空"
                  compact
                  custom-style="flex: 1; min-width: 60px; text-align: right;"
                />
                <text class="text-xs text-gray-400">元</text>
              </view>
            </template>
          </wd-cell>
          <wd-cell
            title="起始日期"
            is-link
            center
            @click="openStartDateCalendar"
          >
            <template #default>
              <text class="text-sm text-gray-800">{{ startDate }}</text>
            </template>
          </wd-cell>
          <wd-cell title="连续周数" center>
            <template #default>
              <view class="flex items-center gap-1">
                <wd-input
                  v-model="weeksRaw"
                  type="number"
                  compact
                  custom-style="flex: 1; min-width: 40px; text-align: right;"
                />
                <text class="text-xs text-gray-400">周</text>
              </view>
            </template>
          </wd-cell>
        </wd-cell-group>
        <view class="mt-3 flex gap-3">
          <wd-button variant="plain" block @click="showForm = false">
            取消
          </wd-button>
          <wd-button block type="primary" @click="saveForm">
            保存
          </wd-button>
        </view>
      </view>
    </wd-popup>

    <!-- 时间选择器 - 开始时间（双列：小时+分钟） -->
    <wd-picker
      v-model="startTimeArr"
      v-model:visible="showStartTimePicker"
      :columns="timeColumns"
      title="开始时间"
    />

    <!-- 时间选择器 - 结束时间（双列：小时+分钟） -->
    <wd-picker
      v-model="endTimeArr"
      v-model:visible="showEndTimePicker"
      :columns="timeColumns"
      title="结束时间"
    />

    <!-- 日历选择器 - 起始日期 -->
    <wd-calendar
      ref="startDateCalendarRef"
      v-model="startDateTs"
      title="起始日期"
      type="date"
      :first-day-of-week="1"
      @confirm="onStartDateConfirm"
    />

    <!-- 生成预览弹层 -->
    <wd-popup
      :model-value="previewTpl != null"
      position="bottom"
      round
      safe-area-inset-bottom
      @close="closePreview"
    >
      <view class="max-h-85vh overflow-y-auto px-4 pb-6 pt-4">
        <view class="mb-1 text-center text-base text-gray-900 font-medium">
          生成预览
        </view>
        <view class="mb-2 text-center text-xs text-gray-400">
          将生成 {{ previewDrafts.length }} 节课程<template v-if="conflictCount > 0">
            ，其中 {{ conflictCount }} 节与现有课程冲突（橙色标记）
          </template>
        </view>
        <view
          v-for="item in previewWithConflict"
          :key="`${item.draft.startDate}-${item.draft.startTime}`"
          class="mb-1.5 rounded-lg p-2.5"
          :class="item.conflict ? 'bg-orange-50' : 'bg-gray-50'"
        >
          <view class="flex items-center justify-between text-xs text-gray-700">
            <text>{{ item.draft.startDate }}</text>
            <text>{{ item.draft.startTime }}-{{ item.draft.endTime }}</text>
          </view>
          <view v-if="item.conflict" class="mt-0.5 text-2xs text-orange-500">
            与现有课程时间冲突
          </view>
        </view>
        <view class="mt-3 flex gap-3">
          <wd-button variant="plain" block @click="closePreview">
            取消
          </wd-button>
          <wd-button block type="primary" @click="confirmGenerate">
            确认生成
          </wd-button>
        </view>
      </view>
    </wd-popup>

    <wd-dialog />
    <wd-toast />
  </view>
</template>
